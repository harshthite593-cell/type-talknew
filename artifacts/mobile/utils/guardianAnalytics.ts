import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadLogs } from "./analytics";

const EMERGENCY_EVENTS_KEY = "tts_emergency_events_v1";
const SESSION_LOG_KEY = "guardian_session_log_v1";

export interface SessionEntry {
  id: string;
  startTs: number;
  endTs: number;
}

export interface GuardianStats {
  wordsSpokenToday: number;
  emergencyUsesToday: number;
  speakingAnalysis: {
    clarityScore: number;
    avgWordLength: number;
    tone: "calm" | "expressive" | "urgent" | "mixed";
    totalUtterances: number;
    languagesUsed: string[];
  };
  moodAnalysis: {
    label: "happy" | "neutral" | "anxious" | "distressed";
    emoji: string;
    positivePercent: number;
    urgentPercent: number;
    topWords: string[];
  };
  appActivity: {
    totalMinutesActive: number;
    sessionCount: number;
    firstActivityTime: string | null;
    lastActivityTime: string | null;
  };
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const POSITIVE_KEYWORDS = [
  "thank", "thanks", "please", "great", "good", "love", "happy", "nice",
  "yes", "sure", "okay", "fine", "wonderful", "excellent", "perfect", "well",
];
const URGENT_KEYWORDS = [
  "help", "emergency", "stop", "no", "pain", "hurt", "call", "sos",
  "fire", "danger", "sick", "fall", "fell", "urgent", "quick", "now",
];

export async function getGuardianStats(): Promise<GuardianStats> {
  const todayStart = startOfTodayMs();
  const logs = await loadLogs();
  const todayLogs = logs.filter((l) => l.timestamp >= todayStart);

  // ── 1. Words spoken today ──────────────────────────────────────
  const wordsSpokenToday = todayLogs.reduce((sum, l) => sum + l.wordCount, 0);

  // ── 2. Emergency panel usage today ────────────────────────────
  let emergencyUsesToday = 0;
  try {
    const raw = await AsyncStorage.getItem(EMERGENCY_EVENTS_KEY);
    if (raw) {
      const events: Array<{ timestamp: number }> = JSON.parse(raw);
      emergencyUsesToday = events.filter((e) => e.timestamp >= todayStart).length;
    }
  } catch { /* ignore */ }

  // ── 3. Speaking analysis ──────────────────────────────────────
  const allWords = todayLogs.flatMap((l) =>
    l.text.trim().split(/\s+/).filter(Boolean)
  );
  const totalUtterances = todayLogs.length;

  let clarityScore = 100;
  let avgWordLength = 0;
  let tone: GuardianStats["speakingAnalysis"]["tone"] = "calm";

  if (allWords.length > 0) {
    const shortWords = allWords.filter((w) => w.length <= 6).length;
    clarityScore = Math.round((shortWords / allWords.length) * 100);
    avgWordLength =
      Math.round(
        (allWords.reduce((s, w) => s + w.length, 0) / allWords.length) * 10
      ) / 10;

    const fullText = todayLogs.map((l) => l.text).join(" ").toLowerCase();
    const exclamations = (fullText.match(/!/g) ?? []).length;
    const questions = (fullText.match(/\?/g) ?? []).length;
    const urgentHits = URGENT_KEYWORDS.filter((k) => fullText.includes(k)).length;

    if (urgentHits >= 2) tone = "urgent";
    else if (exclamations > 2) tone = "expressive";
    else if (exclamations + questions > 4) tone = "mixed";
    else tone = "calm";
  }

  const languagesUsed = [...new Set(todayLogs.map((l) => l.language))];

  // ── 4. Mood analysis ─────────────────────────────────────────
  const fullTextLower = todayLogs.map((l) => l.text).join(" ").toLowerCase();
  const positiveHits = POSITIVE_KEYWORDS.filter((k) => fullTextLower.includes(k)).length;
  const urgentHits2 = URGENT_KEYWORDS.filter((k) => fullTextLower.includes(k)).length;
  const totalKeywords = positiveHits + urgentHits2 || 1;

  const positivePercent = Math.round((positiveHits / totalKeywords) * 100);
  const urgentPercent = Math.round((urgentHits2 / totalKeywords) * 100);

  let moodLabel: GuardianStats["moodAnalysis"]["label"] = "neutral";
  let moodEmoji = "😐";
  if (totalUtterances === 0) {
    moodLabel = "neutral";
    moodEmoji = "😶";
  } else if (urgentPercent >= 40) {
    moodLabel = "distressed";
    moodEmoji = "😰";
  } else if (urgentPercent >= 20) {
    moodLabel = "anxious";
    moodEmoji = "😟";
  } else if (positivePercent >= 40) {
    moodLabel = "happy";
    moodEmoji = "😊";
  } else {
    moodLabel = "neutral";
    moodEmoji = "😐";
  }

  const wordFreq = new Map<string, number>();
  allWords
    .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
    .filter((w) => w.length > 3)
    .forEach((w) => wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1));
  const topWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  // ── 5. App activity ───────────────────────────────────────────
  let totalMinutesActive = 0;
  let sessionCount = 0;
  let firstActivityTime: string | null = null;
  let lastActivityTime: string | null = null;

  if (todayLogs.length > 0) {
    const timestamps = todayLogs.map((l) => l.timestamp).sort((a, b) => a - b);
    firstActivityTime = formatTime(timestamps[0]);
    lastActivityTime = formatTime(timestamps[timestamps.length - 1]);

    const totalDurationSec = todayLogs.reduce((s, l) => s + l.duration, 0);
    totalMinutesActive = Math.max(1, Math.round(totalDurationSec / 60));

    let sessions = 1;
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] > 15 * 60 * 1000) sessions++;
    }
    sessionCount = sessions;
  }

  const savedSessions = await loadSessions();
  const todaySessions = savedSessions.filter((s) => s.startTs >= todayStart);
  if (todaySessions.length > 0) {
    const savedMin = Math.round(
      todaySessions.reduce((s, sess) => s + (sess.endTs - sess.startTs), 0) / 60000
    );
    totalMinutesActive = Math.max(totalMinutesActive, savedMin);
    sessionCount = Math.max(sessionCount, todaySessions.length);
  }

  return {
    wordsSpokenToday,
    emergencyUsesToday,
    speakingAnalysis: {
      clarityScore,
      avgWordLength,
      tone,
      totalUtterances,
      languagesUsed,
    },
    moodAnalysis: {
      label: moodLabel,
      emoji: moodEmoji,
      positivePercent,
      urgentPercent,
      topWords,
    },
    appActivity: {
      totalMinutesActive,
      sessionCount,
      firstActivityTime,
      lastActivityTime,
    },
  };
}

// ── Session tracking ──────────────────────────────────────────────

async function loadSessions(): Promise<SessionEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function recordSessionStart(): Promise<string> {
  const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
  const sessions = await loadSessions();
  sessions.push({ id, startTs: Date.now(), endTs: Date.now() });
  await AsyncStorage.setItem(SESSION_LOG_KEY, JSON.stringify(sessions.slice(-100)));
  return id;
}

export async function recordSessionEnd(id: string): Promise<void> {
  const sessions = await loadSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx !== -1) {
    sessions[idx].endTs = Date.now();
    await AsyncStorage.setItem(SESSION_LOG_KEY, JSON.stringify(sessions));
  }
}
