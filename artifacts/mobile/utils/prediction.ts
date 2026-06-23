import AsyncStorage from "@react-native-async-storage/async-storage";

const FREQ_KEY = "tts_word_freq_v1";
const MAX_FREQ_WORDS = 500;

interface FreqMap {
  [word: string]: number;
}

let freqCache: FreqMap | null = null;

async function loadFreq(): Promise<FreqMap> {
  if (freqCache) return freqCache;
  try {
    const raw = await AsyncStorage.getItem(FREQ_KEY);
    freqCache = raw ? JSON.parse(raw) : {};
  } catch {
    freqCache = {};
  }
  return freqCache!;
}

async function saveFreq(freq: FreqMap): Promise<void> {
  try {
    await AsyncStorage.setItem(FREQ_KEY, JSON.stringify(freq));
  } catch {}
}

export async function recordSpokenText(text: string): Promise<void> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return;

  const freq = await loadFreq();
  for (const word of words) {
    freq[word] = (freq[word] ?? 0) + 1;
  }

  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const trimmed = Object.fromEntries(entries.slice(0, MAX_FREQ_WORDS));
  freqCache = trimmed;
  await saveFreq(trimmed);
}

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd = false;
  freq = 0;
}

class Trie {
  root = new TrieNode();

  insert(word: string, freq: number) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode());
      }
      node = node.children.get(ch)!;
    }
    node.isEnd = true;
    node.freq = freq;
  }

  completions(prefix: string, limit = 5): Array<{ word: string; freq: number }> {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children.has(ch)) return [];
      node = node.children.get(ch)!;
    }
    const results: Array<{ word: string; freq: number }> = [];
    this._dfs(node, prefix, results, limit);
    return results.sort((a, b) => b.freq - a.freq).slice(0, limit);
  }

  private _dfs(
    node: TrieNode,
    current: string,
    results: Array<{ word: string; freq: number }>,
    limit: number
  ) {
    if (results.length >= limit * 3) return;
    if (node.isEnd) results.push({ word: current, freq: node.freq });
    for (const [ch, child] of node.children) {
      this._dfs(child, current + ch, results, limit);
    }
  }
}

const COMMON_WORDS = [
  "I", "you", "the", "a", "is", "are", "was", "were", "have", "has",
  "can", "could", "would", "will", "do", "does", "did", "not", "yes",
  "no", "please", "thank", "thanks", "help", "need", "want", "like",
  "okay", "ok", "good", "great", "sorry", "hello", "hi", "bye",
  "what", "where", "when", "how", "who", "why", "this", "that",
  "here", "there", "go", "come", "get", "give", "take", "make",
  "just", "really", "very", "more", "some", "all", "one", "time",
  "today", "now", "later", "again", "much", "many", "think", "know",
  "feel", "hurt", "pain", "water", "food", "bathroom", "medicine",
  "doctor", "hospital", "ambulance", "emergency", "call", "phone",
  "home", "outside", "inside", "hot", "cold", "tired", "hungry",
  "thirsty", "sick", "better", "worse", "understand", "repeat",
  "slower", "louder", "quiet", "stop", "start", "wait", "ready",
].map((w) => w.toLowerCase());

let builtTrie: Trie | null = null;

async function buildTrie(): Promise<Trie> {
  const freq = await loadFreq();
  const trie = new Trie();

  for (const word of COMMON_WORDS) {
    trie.insert(word, freq[word] ?? 1);
  }

  for (const [word, count] of Object.entries(freq)) {
    trie.insert(word.toLowerCase(), count + 10);
  }

  builtTrie = trie;
  return trie;
}

export function invalidateTrieCache() {
  builtTrie = null;
}

export async function getPredictions(currentText: string): Promise<string[]> {
  const trie = builtTrie ?? (await buildTrie());

  const words = currentText.split(/\s+/);
  const lastWord = words[words.length - 1] ?? "";

  if (lastWord.length === 0) {
    const freq = await loadFreq();
    const topPersonal = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);
    return topPersonal.length > 0 ? topPersonal : COMMON_WORDS.slice(0, 5);
  }

  const prefix = lastWord.toLowerCase();
  const completions = trie.completions(prefix, 5);

  const results = completions
    .filter((c) => c.word !== prefix)
    .map((c) => c.word);

  return results.slice(0, 5);
}

export async function applyPrediction(
  currentText: string,
  prediction: string
): Promise<string> {
  const words = currentText.split(/\s+/);
  words[words.length - 1] = prediction;
  const joined = words.join(" ");
  return joined + " ";
}
