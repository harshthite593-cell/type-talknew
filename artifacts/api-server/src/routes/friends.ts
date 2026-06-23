import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, friendshipsTable } from "@workspace/db";
import { and, eq, or, ne } from "drizzle-orm";

const router: IRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] ?? "typetalk-secret-change-me";

function getUser(req: Parameters<Parameters<typeof router.get>[1]>[0]): { userId: string } | null {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
  } catch { return null; }
}

// Browse other users (excluding self and already connected)
router.get("/users/browse", async (req, res) => {
  const me = getUser(req);
  if (!me) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    // Get my existing friendship user IDs
    const myFriendships = await db.select().from(friendshipsTable)
      .where(or(eq(friendshipsTable.requesterId, me.userId), eq(friendshipsTable.receiverId, me.userId)));

    const connectedIds = new Set<string>();
    myFriendships.forEach(f => {
      connectedIds.add(f.requesterId);
      connectedIds.add(f.receiverId);
    });

    const statusMap = new Map<string, string>();
    myFriendships.forEach(f => {
      const otherId = f.requesterId === me.userId ? f.receiverId : f.requesterId;
      const status = f.status === "accepted" ? "accepted"
        : f.requesterId === me.userId ? "pending_sent" : "pending_received";
      statusMap.set(otherId, status);
    });

    const allUsers = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      age: usersTable.age,
      gender: usersTable.gender,
      bio: usersTable.bio,
    }).from(usersTable).where(ne(usersTable.id, me.userId)).limit(50);

    const result = allUsers.map(u => ({
      ...u,
      friendshipStatus: statusMap.get(u.id) ?? "none",
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Send a friend request
router.post("/friends/request", async (req, res) => {
  const me = getUser(req);
  if (!me) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { receiverId } = req.body as { receiverId?: string };
  if (!receiverId || receiverId === me.userId) {
    res.status(400).json({ error: "Invalid receiver" }); return;
  }

  try {
    const existing = await db.select().from(friendshipsTable)
      .where(or(
        and(eq(friendshipsTable.requesterId, me.userId), eq(friendshipsTable.receiverId, receiverId)),
        and(eq(friendshipsTable.requesterId, receiverId), eq(friendshipsTable.receiverId, me.userId)),
      )).limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Friend request already exists" }); return;
    }

    const [friendship] = await db.insert(friendshipsTable).values({
      requesterId: me.userId,
      receiverId,
      status: "pending",
    }).returning();

    res.json(friendship);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// List my friends and pending requests
router.get("/friends", async (req, res) => {
  const me = getUser(req);
  if (!me) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const friendships = await db.select().from(friendshipsTable)
      .where(or(eq(friendshipsTable.requesterId, me.userId), eq(friendshipsTable.receiverId, me.userId)));

    const otherIds = friendships.map(f =>
      f.requesterId === me.userId ? f.receiverId : f.requesterId
    );

    const statusMap = new Map<string, { status: string; isSender: boolean }>();
    friendships.forEach(f => {
      const otherId = f.requesterId === me.userId ? f.receiverId : f.requesterId;
      statusMap.set(otherId, { status: f.status, isSender: f.requesterId === me.userId });
    });

    if (otherIds.length === 0) {
      res.json({ accepted: [], pending: [] }); return;
    }

    const usersList = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      age: usersTable.age,
      gender: usersTable.gender,
      bio: usersTable.bio,
    }).from(usersTable);

    const relevant = usersList.filter(u => otherIds.includes(u.id));

    const accepted: unknown[] = [];
    const pending: unknown[] = [];

    relevant.forEach(u => {
      const info = statusMap.get(u.id);
      if (!info) return;
      if (info.status === "accepted") {
        accepted.push({ ...u, friendshipStatus: "accepted" });
      } else if (info.status === "pending") {
        const status = info.isSender ? "pending_sent" : "pending_received";
        pending.push({ ...u, friendshipStatus: status });
      }
    });

    res.json({ accepted, pending });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Accept a friend request
router.patch("/friends/:requesterId/accept", async (req, res) => {
  const me = getUser(req);
  if (!me) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { requesterId } = req.params;

  try {
    await db.update(friendshipsTable)
      .set({ status: "accepted" })
      .where(and(
        eq(friendshipsTable.requesterId, requesterId),
        eq(friendshipsTable.receiverId, me.userId),
        eq(friendshipsTable.status, "pending"),
      ));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
