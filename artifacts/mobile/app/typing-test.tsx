import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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

const BEST_WPM_KEY = "typetalk_best_wpm";

const PASSAGES = [
  "The quick brown fox jumps over the lazy dog near the river bank while the sun sets behind the mountains casting long shadows across the golden fields of wheat swaying gently in the evening breeze.",
  "Typing speed is a measure of how quickly and accurately you can type on a keyboard. Professional typists can achieve speeds of over one hundred words per minute with near perfect accuracy.",
  "Technology has transformed the way we communicate with each other. From handwritten letters to instant messages, every generation finds new and faster ways to share thoughts and ideas across the world.",
  "Practice makes perfect when it comes to typing. The more you type, the more your fingers learn the position of each key, allowing you to focus on your thoughts rather than the mechanics of typing.",
  "A good typing speed helps you become more productive at work and in everyday life. Even a small improvement in your words per minute can save you hours of time over the course of a year.",
];

type Phase = "idle" | "countdown" | "active" | "done";

function calcWPM(correctChars: number, elapsedSeconds: number) {
  if (elapsedSeconds <= 0) return 0;
  return Math.round((correctChars / 5) / (elapsedSeconds / 60));
}

function calcAccuracy(typed: string, target: string) {
  if (!typed.length) return 100;
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === target[i]) correct++;
  }
  return Math.round((correct / typed.length) * 100);
}

export default function TypingTestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [duration, setDuration] = useState<30 | 60>(60);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [passage, setPassage] = useState(PASSAGES[0]);
  const [typed, setTyped] = useState("");
  const [wpm, setWpm] = useState(0);
  const [finalWpm, setFinalWpm] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(100);
  const [bestWpm, setBestWpm] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(BEST_WPM_KEY).then(v => { if (v) setBestWpm(parseInt(v, 10)); });
  }, []);

  const clearTimer = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

  const pickPassage = () => PASSAGES[Math.floor(Math.random() * PASSAGES.length)];

  const startCountdown = () => {
    setPhase("countdown");
    setCountdown(3);
    setTyped("");
    setWpm(0);
    setPassage(pickPassage());
    let count = 3;
    const iv = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(iv);
        beginTest();
      } else {
        setCountdown(count);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 1000);
  };

  const beginTest = useCallback(() => {
    setPhase("active");
    setTimeLeft(duration);
    startTimeRef.current = Date.now();
    setTimeout(() => inputRef.current?.focus(), 100);
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const left = Math.max(0, duration - Math.floor(elapsed));
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(intervalRef.current!);
        finishTest();
      }
    }, 250);
  }, [duration]);

  const finishTest = useCallback(() => {
    clearTimer();
    setPhase("done");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTyped(prev => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const correctChars = prev.split("").filter((c, i) => c === passage[i]).length;
      const finalW = calcWPM(correctChars, elapsed);
      const finalA = calcAccuracy(prev, passage);
      setFinalWpm(finalW);
      setFinalAccuracy(finalA);
      AsyncStorage.getItem(BEST_WPM_KEY).then(v => {
        const prev = v ? parseInt(v, 10) : 0;
        if (finalW > prev) {
          AsyncStorage.setItem(BEST_WPM_KEY, String(finalW));
          setBestWpm(finalW);
        }
      });
      return prev;
    });
  }, [passage]);

  // Update live WPM
  useEffect(() => {
    if (phase !== "active") return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const correctChars = typed.split("").filter((c, i) => c === passage[i]).length;
    setWpm(calcWPM(correctChars, elapsed));
  }, [typed, phase, passage]);

  const handleType = (val: string) => {
    if (phase !== "active") return;
    // Clamp to passage length
    if (val.length > passage.length) return;
    setTyped(val);
    // Auto finish if completed
    if (val.length === passage.length) finishTest();
  };

  useEffect(() => () => clearTimer(), []);

  const s = makeStyles(colors, topPad, bottomPad);

  // ── Idle screen ──────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Typing Test</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={s.idleContent}>
          <View style={s.idleIcon}>
            <Feather name="zap" size={40} color={colors.primary} />
          </View>
          <Text style={s.idleTitle}>How fast do you type?</Text>
          <Text style={s.idleSub}>Test your typing speed and accuracy. Best score is saved.</Text>

          {bestWpm > 0 && (
            <View style={s.bestBadge}>
              <Feather name="award" size={16} color="#FFD700" />
              <Text style={s.bestBadgeText}>Best: {bestWpm} WPM</Text>
            </View>
          )}

          <Text style={s.modeLabel}>Choose duration</Text>
          <View style={s.modeRow}>
            {([30, 60] as const).map(d => (
              <TouchableOpacity
                key={d}
                style={[s.modeBtn, duration === d && s.modeBtnActive]}
                onPress={() => { setDuration(d); Haptics.selectionAsync(); }}
              >
                <Text style={[s.modeBtnText, duration === d && s.modeBtnTextActive]}>{d}s</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.startBtn} onPress={startCountdown} activeOpacity={0.85}>
            <Feather name="play" size={20} color="#000" />
            <Text style={s.startBtnText}>Start Test</Text>
          </TouchableOpacity>

          <Text style={s.tipText}>💡 Tip: Don't look at your hands — focus on the screen</Text>
        </ScrollView>
      </View>
    );
  }

  // ── Countdown ────────────────────────────────────────────────────────
  if (phase === "countdown") {
    return (
      <View style={[s.root, s.centred]}>
        <Text style={s.countdownNum}>{countdown}</Text>
        <Text style={s.countdownLabel}>Get ready...</Text>
      </View>
    );
  }

  // ── Done screen ──────────────────────────────────────────────────────
  if (phase === "done") {
    const isNewBest = finalWpm >= bestWpm && finalWpm > 0;
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Results</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={s.idleContent}>
          {isNewBest && (
            <View style={s.newBestBanner}>
              <Feather name="award" size={18} color="#FFD700" />
              <Text style={s.newBestText}>New personal best!</Text>
            </View>
          )}
          <View style={s.resultsGrid}>
            <View style={s.resultCard}>
              <Text style={s.resultNum}>{finalWpm}</Text>
              <Text style={s.resultLabel}>WPM</Text>
            </View>
            <View style={s.resultCard}>
              <Text style={s.resultNum}>{finalAccuracy}%</Text>
              <Text style={s.resultLabel}>Accuracy</Text>
            </View>
            <View style={s.resultCard}>
              <Text style={s.resultNum}>{typed.split("").filter((c, i) => c === passage[i]).length}</Text>
              <Text style={s.resultLabel}>Correct chars</Text>
            </View>
            <View style={s.resultCard}>
              <Text style={s.resultNum}>{duration}s</Text>
              <Text style={s.resultLabel}>Duration</Text>
            </View>
          </View>

          {bestWpm > 0 && (
            <View style={s.bestBadge}>
              <Feather name="award" size={14} color="#FFD700" />
              <Text style={s.bestBadgeText}>Personal best: {bestWpm} WPM</Text>
            </View>
          )}

          <View style={s.resultBtns}>
            <TouchableOpacity style={s.startBtn} onPress={startCountdown} activeOpacity={0.85}>
              <Feather name="refresh-cw" size={18} color="#000" />
              <Text style={s.startBtnText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.outlineBtn} onPress={() => router.back()}>
              <Text style={s.outlineBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Active test ──────────────────────────────────────────────────────
  const chars = passage.split("");
  const typedChars = typed.split("");
  const timerColor = timeLeft <= 10 ? "#FF6B6B" : colors.primary;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {/* Timer bar */}
      <View style={[s.timerBar, { paddingTop: topPad + 8 }]}>
        <View style={s.timerRow}>
          <Text style={[s.timerNum, { color: timerColor }]}>{timeLeft}s</Text>
          <View style={s.liveStats}>
            <Text style={s.liveStat}><Text style={{ color: colors.primary, fontWeight: "700" }}>{wpm}</Text> WPM</Text>
            <Text style={s.liveStat}><Text style={{ color: colors.primary, fontWeight: "700" }}>{calcAccuracy(typed, passage)}%</Text> acc</Text>
          </View>
        </View>
        {/* Progress bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${((duration - timeLeft) / duration) * 100}%`, backgroundColor: timerColor }]} />
        </View>
      </View>

      {/* Text to type */}
      <ScrollView style={s.passageScroll} contentContainerStyle={s.passageContent} scrollEnabled={false}>
        <Text style={s.passage}>
          {chars.map((char, i) => {
            const t = typedChars[i];
            const isCursor = i === typedChars.length;
            const bg = isCursor ? `${colors.primary}40` : undefined;
            const textColor = t === undefined ? colors.mutedForeground
              : t === char ? "#4CAF50" : "#FF6B6B";
            return (
              <Text key={i} style={[s.passageChar, { color: textColor, backgroundColor: bg }]}>
                {char}
              </Text>
            );
          })}
        </Text>
      </ScrollView>

      {/* Hidden / visible input */}
      <View style={s.inputWrap}>
        <TextInput
          ref={inputRef}
          style={s.typeInput}
          value={typed}
          onChangeText={handleType}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          multiline
          placeholder="Start typing here..."
          placeholderTextColor={colors.mutedForeground}
        />
        <TouchableOpacity style={s.giveUpBtn} onPress={finishTest}>
          <Text style={s.giveUpText}>Finish early</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    centred: { alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: topPad + 12, paddingBottom: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    idleContent: { flexGrow: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 12, paddingBottom: bottomPad + 24 },
    idleIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}20`, alignItems: "center", justifyContent: "center", marginBottom: 20 },
    idleTitle: { fontSize: 24, fontWeight: "700", color: colors.foreground, textAlign: "center", marginBottom: 8 },
    idleSub: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 20 },
    bestBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFD70020", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 16 },
    bestBadgeText: { fontSize: 14, fontWeight: "700", color: "#FFD700" },
    modeLabel: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
    modeRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
    modeBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border },
    modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    modeBtnText: { fontSize: 16, fontWeight: "600", color: colors.mutedForeground },
    modeBtnTextActive: { color: "#000" },
    startBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 16 },
    startBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
    tipText: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", marginTop: 8 },
    countdownNum: { fontSize: 96, fontWeight: "700", color: colors.primary },
    countdownLabel: { fontSize: 18, color: colors.mutedForeground, marginTop: -10 },
    timerBar: { paddingHorizontal: 20, paddingBottom: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    timerNum: { fontSize: 32, fontWeight: "700" },
    liveStats: { flexDirection: "row", gap: 16 },
    liveStat: { fontSize: 14, color: colors.mutedForeground },
    progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" },
    progressFill: { height: 4, borderRadius: 2 },
    passageScroll: { flex: 1 },
    passageContent: { padding: 20 },
    passage: { fontSize: 20, lineHeight: 34, letterSpacing: 0.3 },
    passageChar: { fontSize: 20, lineHeight: 34 },
    inputWrap: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, paddingBottom: bottomPad + 12 },
    typeInput: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 16, color: colors.foreground, minHeight: 80, textAlignVertical: "top" },
    giveUpBtn: { alignItems: "center", marginTop: 8 },
    giveUpText: { fontSize: 13, color: colors.mutedForeground, textDecorationLine: "underline" },
    newBestBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFD70020", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginBottom: 20 },
    newBestText: { fontSize: 16, fontWeight: "700", color: "#FFD700" },
    resultsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 20 },
    resultCard: { width: 140, backgroundColor: colors.card, borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    resultNum: { fontSize: 32, fontWeight: "700", color: colors.primary },
    resultLabel: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
    resultBtns: { gap: 10, width: "100%" },
    outlineBtn: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, alignItems: "center" },
    outlineBtnText: { fontSize: 16, fontWeight: "600", color: colors.mutedForeground },
  });
}
