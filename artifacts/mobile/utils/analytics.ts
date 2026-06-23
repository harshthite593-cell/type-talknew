import AsyncStorage from "@react-native-async-storage/async-storage";

const SPEECH_LOGS_KEY = "tts_speech_logs_v1";
const MAX_LOGS = 2000;

export interface SpeechLog {
  id: string;
  text: string;
  timestamp: number;
  wordCount: number;
  language: string;
  duration: number;
}

export interface PhraseCount {
  text: string;
  count: number;
}

export interface DailyCount {
  date: number;
  dayLabel: string;
  totalWords: number;
}

// ── Storage helpers ──────────────────────────────────────────────

export async function loadLogs(): Promise<SpeechLog[]> {
  try {
    const raw = await AsyncStorage.getItem(SPEECH_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLogs(logs: SpeechLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SPEECH_LOGS_KEY, JSON.stringify(logs));
  } catch {}
}

export async function insertLog(
  text: string,
  language: string,
  speechRate: number
): Promise<void> {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const duration = wordCount / (speechRate * 2.5);
  const log: SpeechLog = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    text: text.trim(),
    timestamp: Date.now(),
    wordCount,
    language,
    duration,
  };
  const logs = await loadLogs();
  const updated = [log, ...logs].slice(0, MAX_LOGS);
  await saveLogs(updated);
}

export async function deleteAllLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SPEECH_LOGS_KEY);
  } catch {}
}

// ── Query helpers ────────────────────────────────────────────────

function startOfDayMs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: "short" });
}

export async function getStats(): Promise<{
  totalWordsToday: number;
  totalWordsThisWeek: number;
  totalWordsAllTime: number;
  totalWordsLastWeek: number;
  currentStreak: number;
  mostUsedPhrases: PhraseCount[];
  dailyWordCounts: DailyCount[];
  totalSpeakingMinutes: number;
  averageWordsPerDay: number;
}> {
  const logs = await loadLogs();

  const now = Date.now();
  const todayStart = startOfDayMs(now);
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const lastWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;

  let totalWordsToday = 0;
  let totalWordsThisWeek = 0;
  let totalWordsLastWeek = 0;
  let totalWordsAllTime = 0;
  let totalDurationSeconds = 0;

  const phraseMap = new Map<string, number>();
  const activeDaysThisWeek = new Set<string>();

  for (const log of logs) {
    totalWordsAllTime += log.wordCount;
    totalDurationSeconds += log.duration;

    if (log.timestamp >= todayStart) {
      totalWordsToday += log.wordCount;
    }
    if (log.timestamp >= weekStart) {
      totalWordsThisWeek += log.wordCount;
      const dayKey = new Date(log.timestamp).toDateString();
      activeDaysThisWeek.add(dayKey);
      const prev = phraseMap.get(log.text) ?? 0;
      phraseMap.set(log.text, prev + 1);
    }
    if (log.timestamp >= lastWeekStart && log.timestamp < weekStart) {
      totalWordsLastWeek += log.wordCount;
    }
  }

  // Top 5 phrases
  const mostUsedPhrases: PhraseCount[] = Array.from(phraseMap.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Last 7 days bar data
  const dailyWordCounts: DailyCount[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = todayStart - i * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const words = logs
      .filter((l) => l.timestamp >= dayStart && l.timestamp < dayEnd)
      .reduce((sum, l) => sum + l.wordCount, 0);
    dailyWordCounts.push({
      date: dayStart,
      dayLabel: dayLabel(dayStart),
      totalWords: words,
    });
  }

  // Streak: consecutive days ending today with at least 1 log
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const ds = todayStart - i * 24 * 60 * 60 * 1000;
    const de = ds + 24 * 60 * 60 * 1000;
    const hasLog = logs.some((l) => l.timestamp >= ds && l.timestamp < de);
    if (hasLog) {
      currentStreak++;
    } else {
      break;
    }
  }

  const activeDays = activeDaysThisWeek.size || 1;
  const averageWordsPerDay = Math.round(totalWordsThisWeek / activeDays);
  const totalSpeakingMinutes = totalDurationSeconds / 60;

  return {
    totalWordsToday,
    totalWordsThisWeek,
    totalWordsAllTime,
    totalWordsLastWeek,
    currentStreak,
    mostUsedPhrases,
    dailyWordCounts,
    totalSpeakingMinutes,
    averageWordsPerDay,
  };
}
