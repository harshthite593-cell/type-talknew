import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import GlobalKeyShortcuts from "@/components/GlobalKeyShortcuts";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  type Shortcut,
  loadShortcuts,
  saveShortcuts,
} from "@/utils/shortcuts";

export const SAVED_PHRASES_KEY = "tts_saved_phrases_v1";

export interface SavedPhrase {
  id: string;
  text: string;
  savedAt: string;
}

type Tab = "phrases" | "shortcuts";

export default function SavedPhrasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("phrases");

  // ── Saved Phrases ─────────────────────────────────────────────
  const [phrases, setPhrases] = useState<SavedPhrase[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // ── Shortcuts ─────────────────────────────────────────────────
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const phraseInputRef = useRef<TextInput>(null);

  // ── Toast ─────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPhrases();
    loadShortcuts().then(setShortcuts);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Speech.stop();
    };
  }, []);

  const loadPhrases = async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_PHRASES_KEY);
      if (raw) setPhrases(JSON.parse(raw));
    } catch {}
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Phrase actions ────────────────────────────────────────────
  const speakPhrase = useCallback(async (phrase: SavedPhrase) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { await Speech.stop(); } catch {}
    setSpeakingId(phrase.id);
    Speech.speak(phrase.text, {
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setSpeakingId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const deletePhrase = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = phrases.filter((p) => p.id !== id);
      setPhrases(updated);
      try {
        await AsyncStorage.setItem(SAVED_PHRASES_KEY, JSON.stringify(updated));
      } catch {}
      showToast("Phrase deleted");
    },
    [phrases, showToast]
  );

  // ── Shortcut actions ──────────────────────────────────────────
  const addShortcut = useCallback(async () => {
    const key = newKey.trim().toLowerCase();
    const phrase = newPhrase.trim();

    if (!key) { showToast("Enter a shortcut key"); return; }
    if (!phrase) { showToast("Enter a phrase for this key"); return; }
    if (key.includes(" ")) { showToast("Key cannot contain spaces"); return; }

    const isDuplicate = shortcuts.some((s) => s.key.toLowerCase() === key);
    if (isDuplicate) { showToast(`Key "${key}" already exists`); return; }

    const entry: Shortcut = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      key,
      phrase,
    };
    const updated = [entry, ...shortcuts];
    setShortcuts(updated);
    await saveShortcuts(updated);
    setNewKey("");
    setNewPhrase("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(`Shortcut "${key}" saved ✅`);
  }, [newKey, newPhrase, shortcuts, showToast]);

  const deleteShortcut = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = shortcuts.filter((s) => s.id !== id);
      setShortcuts(updated);
      await saveShortcuts(updated);
      showToast("Shortcut deleted");
    },
    [shortcuts, showToast]
  );

  const s = makeStyles(colors, topPad, bottomPad);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { Speech.stop(); router.back(); }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.title}>My Phrases</Text>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.replace("/")}
        >
          <Feather name="home" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === "phrases" && s.tabActive]}
          onPress={() => setActiveTab("phrases")}
        >
          <Feather
            name="bookmark"
            size={15}
            color={activeTab === "phrases" ? colors.primary : colors.mutedForeground}
          />
          <Text style={[s.tabText, activeTab === "phrases" && s.tabTextActive]}>
            Saved Phrases
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === "shortcuts" && s.tabActive]}
          onPress={() => setActiveTab("shortcuts")}
        >
          <Feather
            name="zap"
            size={15}
            color={activeTab === "shortcuts" ? "#F59E0B" : colors.mutedForeground}
          />
          <Text
            style={[
              s.tabText,
              activeTab === "shortcuts" && s.tabTextShortcut,
            ]}
          >
            Shortcuts
          </Text>
          {shortcuts.length > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{shortcuts.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Saved Phrases tab ── */}
      {activeTab === "phrases" && (
        phrases.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Feather name="bookmark" size={36} color="#4ECDC4" />
            </View>
            <Text style={s.emptyTitle}>No saved phrases yet</Text>
            <Text style={s.emptySubtext}>
              Save your favorites by tapping the{"\n"}bookmark icon on the main screen
            </Text>
          </View>
        ) : (
          <FlatList
            data={phrases}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[s.listContent, { paddingBottom: bottomPad + 24 }]}
            renderItem={({ item }) => {
              const isActive = speakingId === item.id;
              return (
                <View style={s.phraseCard}>
                  <Text style={s.phraseText}>{item.text}</Text>
                  <Text style={s.phraseDate}>Saved {formatDate(item.savedAt)}</Text>
                  <View style={s.phraseActions}>
                    <TouchableOpacity
                      style={[s.actionBtn, s.speakBtn, isActive && s.speakBtnActive]}
                      onPress={isActive ? stopSpeaking : () => speakPhrase(item)}
                      activeOpacity={0.8}
                    >
                      <Feather name={isActive ? "square" : "volume-2"} size={16} color="#FFFFFF" />
                      <Text style={s.speakBtnText}>{isActive ? "Stop" : "Speak"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, s.deleteBtn]}
                      onPress={() => deletePhrase(item.id)}
                      activeOpacity={0.8}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )
      )}

      {/* ── Shortcuts tab ── */}
      {activeTab === "shortcuts" && (
        <ScrollView
          contentContainerStyle={[s.listContent, { paddingBottom: bottomPad + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* How it works */}
          <View style={s.infoBox}>
            <Feather name="info" size={14} color="#F59E0B" />
            <Text style={s.infoText}>
              Type a shortcut key in the main screen and press{" "}
              <Text style={s.infoHighlight}>Enter</Text> — the app will speak its
              phrase instead.
            </Text>
          </View>

          {/* Add shortcut form */}
          <View style={s.formCard}>
            <Text style={s.formTitle}>Add New Shortcut</Text>

            <Text style={s.inputLabel}>Shortcut key</Text>
            <TextInput
              style={s.input}
              value={newKey}
              onChangeText={(t) => setNewKey(t.replace(/\s/g, ""))}
              placeholder="e.g. aaa"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => phraseInputRef.current?.focus()}
            />

            <Text style={s.inputLabel}>Phrase to speak</Text>
            <TextInput
              ref={phraseInputRef}
              style={[s.input, s.inputTall]}
              value={newPhrase}
              onChangeText={setNewPhrase}
              placeholder="e.g. Hello, how are you?"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="sentences"
              autoCorrect={false}
              multiline
              returnKeyType="done"
              onSubmitEditing={addShortcut}
            />

            <TouchableOpacity style={s.addBtn} onPress={addShortcut} activeOpacity={0.85}>
              <Feather name="plus" size={18} color="#FFFFFF" />
              <Text style={s.addBtnText}>Add Shortcut</Text>
            </TouchableOpacity>
          </View>

          {/* Shortcut list */}
          {shortcuts.length === 0 ? (
            <View style={s.emptyShortcuts}>
              <Feather name="zap" size={28} color={colors.mutedForeground} />
              <Text style={s.emptyShortcutsText}>No shortcuts yet</Text>
            </View>
          ) : (
            <>
              <Text style={s.sectionLabel}>Your shortcuts</Text>
              {shortcuts.map((sc) => (
                <View key={sc.id} style={s.shortcutCard}>
                  <View style={s.shortcutKeyBadge}>
                    <Text style={s.shortcutKeyText}>{sc.key}</Text>
                  </View>
                  <View style={s.shortcutArrow}>
                    <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                  </View>
                  <Text style={s.shortcutPhrase} numberOfLines={2}>
                    {sc.phrase}
                  </Text>
                  <TouchableOpacity
                    style={s.shortcutDelete}
                    onPress={() => deleteShortcut(sc.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Toast */}
      {toast && (
        <View style={s.toast} pointerEvents="none">
          <Feather name="check-circle" size={14} color="#FFFFFF" />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
      <GlobalKeyShortcuts />
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  } catch { return ""; }
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  topPad: number,
  bottomPad: number
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: topPad + 12,
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    title: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },

    // ── Tab bar ───────────────────────────────────────────────────
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: { borderBottomColor: colors.primary },
    tabText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    tabTextActive: { color: colors.primary },
    tabTextShortcut: { color: "#F59E0B" },
    badge: {
      backgroundColor: "#F59E0B",
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700" as const,
      color: "#000",
      fontFamily: "Inter_700Bold",
    },

    listContent: { paddingHorizontal: 20, paddingTop: 20 },

    // ── Phrase cards ──────────────────────────────────────────────
    phraseCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    phraseText: {
      fontSize: 18,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      lineHeight: 26,
      marginBottom: 6,
    },
    phraseDate: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 14,
    },
    phraseActions: { flexDirection: "row", gap: 10 },
    actionBtn: { height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    speakBtn: { flex: 1, flexDirection: "row", gap: 8, backgroundColor: colors.primary },
    speakBtnActive: { backgroundColor: colors.destructive },
    speakBtnText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: "#FFFFFF",
      fontFamily: "Inter_600SemiBold",
    },
    deleteBtn: { width: 48, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },

    // ── Shortcuts tab ─────────────────────────────────────────────
    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: "rgba(245,158,11,0.1)",
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.25)",
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 19,
    },
    infoHighlight: {
      color: "#F59E0B",
      fontFamily: "Inter_600SemiBold",
    },
    formCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 24,
    },
    formTitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 16,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      marginBottom: 14,
    },
    inputTall: {
      minHeight: 72,
      textAlignVertical: "top",
      paddingTop: 11,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#F59E0B",
      borderRadius: 12,
      paddingVertical: 14,
    },
    addBtnText: {
      fontSize: 15,
      fontWeight: "700" as const,
      color: "#000",
      fontFamily: "Inter_700Bold",
    },

    sectionLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    shortcutCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
      gap: 10,
    },
    shortcutKeyBadge: {
      backgroundColor: "rgba(245,158,11,0.15)",
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.4)",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minWidth: 48,
      alignItems: "center",
    },
    shortcutKeyText: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: "#F59E0B",
      fontFamily: "Inter_700Bold",
    },
    shortcutArrow: { opacity: 0.5 },
    shortcutPhrase: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      lineHeight: 20,
    },
    shortcutDelete: {
      padding: 4,
    },

    emptyShortcuts: {
      alignItems: "center",
      gap: 10,
      paddingVertical: 32,
      opacity: 0.5,
    },
    emptyShortcutsText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },

    // ── Empty state ───────────────────────────────────────────────
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      paddingBottom: 80,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "rgba(78,205,196,0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      textAlign: "center",
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 21,
    },

    // ── Toast ─────────────────────────────────────────────────────
    toast: {
      position: "absolute",
      bottom: bottomPad + 32,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#1E2338",
      borderRadius: 100,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toastText: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
  });
}
