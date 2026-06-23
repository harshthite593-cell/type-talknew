import AsyncStorage from "@react-native-async-storage/async-storage";

export const SHORTCUTS_KEY = "tts_shortcuts_v1";

export interface Shortcut {
  id: string;
  key: string;
  phrase: string;
}

export async function loadShortcuts(): Promise<Shortcut[]> {
  try {
    const raw = await AsyncStorage.getItem(SHORTCUTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveShortcuts(shortcuts: Shortcut[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
  } catch {}
}

export function resolveShortcut(
  text: string,
  shortcuts: Shortcut[]
): string | null {
  const trimmed = text.trim().toLowerCase();
  const match = shortcuts.find((s) => s.key.toLowerCase() === trimmed);
  return match ? match.phrase : null;
}
