import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] ?? "typetalk-secret-change-me";

router.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: "Name, email, and password are required" }); return;
  }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  if (!email.includes("@")) { res.status(400).json({ error: "Invalid email address" }); return; }

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) { res.status(409).json({ error: "Email already registered" }); return; }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      name: name.trim(), email: email.toLowerCase().trim(), passwordHash,
    }).returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });

    const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password) { res.status(400).json({ error: "Email and password are required" }); return; }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user) { res.status(401).json({ error: "Invalid email or password" }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }

    const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "30d" });
    const profile = (user.age && user.gender && user.birthDate)
      ? { name: user.name, age: user.age, gender: user.gender, birthDate: user.birthDate, bio: user.bio ?? undefined }
      : null;
    res.json({ token, user: { id: user.id, name: user.name, email: user.email }, profile });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/auth/me", (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string; email: string; name: string };
    res.json({ id: payload.userId, email: payload.email, name: payload.name });
  } catch { res.status(401).json({ error: "Invalid token" }); }
});

router.patch("/auth/profile", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    const { age, gender, birthDate, bio } = req.body as { age?: number; gender?: string; birthDate?: string; bio?: string };
    await db.update(usersTable).set({ age, gender, birthDate, bio }).where(eq(usersTable.id, payload.userId));
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

export default router;
