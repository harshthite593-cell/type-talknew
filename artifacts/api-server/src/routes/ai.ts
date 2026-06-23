import { Router } from "express";

const router = Router();

const GEMINI_API_KEY = process.env["GEMINI_API_KEY"];
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent";

interface RefinedVariant {
  label: string;
  text: string;
}

const hourlyCache = new Map<string, { results: RefinedVariant[]; ts: number }>();
const REQUEST_LIMIT = 30;
const ONE_HOUR = 60 * 60 * 1000;

let requestCount = 0;
let windowStart = Date.now();

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - windowStart > ONE_HOUR) {
    requestCount = 0;
    windowStart = now;
  }
  if (requestCount >= REQUEST_LIMIT) return false;
  requestCount++;
  return true;
}

router.post("/ai/refine", async (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const trimmed = text.trim().slice(0, 500);
  const cacheKey = trimmed.toLowerCase();

  const cached = hourlyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ONE_HOUR) {
    res.json({ variants: cached.results });
    return;
  }

  if (!GEMINI_API_KEY) {
    res.status(503).json({ error: "AI not configured" });
    return;
  }

  if (!checkRateLimit()) {
    res.status(429).json({ error: "Rate limit reached, try again later" });
    return;
  }

  const prompt = `You are a communication assistant helping a speech-impaired person. Given the phrase below, provide exactly 3 improved variants:
1. "Clearer" — more precise and unambiguous
2. "Polite" — friendlier and more courteous  
3. "Urgent" — more direct for urgent situations

Original phrase: "${trimmed}"

Respond ONLY with a JSON array (no markdown, no explanation):
[
  {"label": "Clearer", "text": "..."},
  {"label": "Polite", "text": "..."},
  {"label": "Urgent", "text": "..."}
]`;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.warn({ status: response.status, body: errText }, "Gemini API error");
      res.status(502).json({ error: "AI service error" });
      return;
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      req.log.warn({ raw }, "Could not parse Gemini JSON");
      res.status(502).json({ error: "Could not parse AI response" });
      return;
    }

    const variants = JSON.parse(jsonMatch[0]) as RefinedVariant[];

    hourlyCache.set(cacheKey, { results: variants, ts: Date.now() });

    res.json({ variants });
  } catch (err) {
    req.log.error({ err }, "Gemini request failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
