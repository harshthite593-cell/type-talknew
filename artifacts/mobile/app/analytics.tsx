import { router } from "expo-router";
import GlobalKeyShortcuts from "@/components/GlobalKeyShortcuts";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  deleteAllLogs,
  getStats,
  type DailyCount,
  type PhraseCount,
} from "@/utils/analytics";

interface Stats {
  totalWordsToday: number;
  totalWordsThisWeek: number;
  totalWordsAllTime: number;
  totalWordsLastWeek: number;
  currentStreak: number;
  mostUsedPhrases: PhraseCount[];
  dailyWordCounts: DailyCount[];
  totalSpeakingMinutes: number;
  averageWordsPerDay: number;
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    (async () => {
      const s = await getStats();
      setStats(s);
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    })();
  }, []);

  const s = makeStyles(colors, topPad, bottomPad);

  const weekChangePercent =
    stats && stats.totalWordsLastWeek > 0
      ? Math.round(
          ((stats.totalWordsThisWeek - stats.totalWordsLastWeek) /
            stats.totalWordsLastWeek) *
            100
        )
      : null;

  const aiInsight = stats ? generateInsight(stats, weekChangePercent) : "";

  const speakingHours = stats
    ? Math.floor(stats.totalSpeakingMinutes / 60)
    : 0;
  const speakingMins = stats
    ? Math.round(stats.totalSpeakingMinutes % 60)
    : 0;

  const maxBarWords =
    stats && stats.dailyWordCounts.length > 0
      ? Math.max(...stats.dailyWordCounts.map((d) => d.totalWords), 1)
      : 1;

  const todayIdx = stats ? stats.dailyWordCounts.length - 1 : 6;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={s.backBtn} onPress={() => router.replace("/")}>
            <Feather name="home" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <Text style={s.headerTitle}>My Progress</Text>
        <TouchableOpacity
          style={s.backBtn}
          onPress={async () => {
            await deleteAllLogs();
            const s2 = await getStats();
            setStats(s2);
          }}
        >
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}>
          <Text style={s.loaderText}>Loading your stats…</Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          contentContainerStyle={{ paddingBottom: bottomPad + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero card ── */}
          <LinearGradient
            colors={["#4F8EF7", "#2563C4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <Text style={s.heroLabel}>words this week</Text>
            <Text style={s.heroNumber}>
              {stats?.totalWordsThisWeek.toLocaleString() ?? "0"}
            </Text>
            {weekChangePercent !== null && (
              <View
                style={[
                  s.changeBadge,
                  weekChangePercent >= 0 ? s.changeBadgeUp : s.changeBadgeDown,
                ]}
              >
                <Text style={s.changeBadgeText}>
                  {weekChangePercent >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(weekChangePercent)}% from last week
                </Text>
              </View>
            )}
            <View style={s.heroSubRow}>
              <View style={s.heroStat}>
                <Text style={s.heroStatNum}>{stats?.totalWordsToday ?? 0}</Text>
                <Text style={s.heroStatLabel}>today</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStat}>
                <Text style={s.heroStatNum}>
                  {stats?.totalWordsAllTime.toLocaleString() ?? 0}
                </Text>
                <Text style={s.heroStatLabel}>all time</Text>
              </View>
            </View>
          </LinearGradient>

          {/* ── Streak ── */}
          <View style={s.streakCard}>
            <Text style={s.streakEmoji}>
              {(stats?.currentStreak ?? 0) > 3 ? "🔥" : "⚡"}
            </Text>
            <View>
              <Text style={s.streakTitle}>
                {stats?.currentStreak ?? 0}-day streak!
              </Text>
              <Text style={s.streakSub}>
                {(stats?.currentStreak ?? 0) > 0
                  ? "Don't break it! 💪"
                  : "Start speaking today! 🚀"}
              </Text>
            </View>
          </View>

          {/* ── Bar chart ── */}
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Last 7 Days</Text>
            <View style={s.chart}>
              {(stats?.dailyWordCounts ?? []).map((day, i) => {
                const barHeight = Math.max(
                  4,
                  Math.round((day.totalWords / maxBarWords) * 120)
                );
                const isToday = i === todayIdx;
                return (
                  <View key={day.date} style={s.barCol}>
                    <Text style={s.barValue}>
                      {day.totalWords > 0 ? day.totalWords : ""}
                    </Text>
                    <View style={s.barTrack}>
                      <View
                        style={[
                          s.bar,
                          { height: barHeight },
                          isToday ? s.barToday : s.barNormal,
                        ]}
                      />
                    </View>
                    <Text style={[s.barLabel, isToday && s.barLabelToday]}>
                      {day.dayLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Top phrases ── */}
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Most Used Phrases</Text>
            {stats && stats.mostUsedPhrases.length > 0 ? (
              stats.mostUsedPhrases.map((phrase, i) => (
                <View key={phrase.text} style={s.phraseRow}>
                  <Text style={s.phraseRank}>#{i + 1}</Text>
                  <Text style={s.phraseText} numberOfLines={1}>
                    {phrase.text.length > 32
                      ? phrase.text.slice(0, 32) + "…"
                      : phrase.text}
                  </Text>
                  <View style={s.phraseBadge}>
                    <Text style={s.phraseBadgeText}>{phrase.count}×</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={s.emptyPhrasesText}>
                Speak more phrases to see your favorites here!
              </Text>
            )}
          </View>

          {/* ── AI Insight ── */}
          <View style={[s.sectionCard, s.insightCard]}>
            <View style={s.insightHeader}>
              <Text style={s.insightEmoji}>💡</Text>
              <Text style={s.insightTitle}>Weekly Insight</Text>
            </View>
            <Text style={s.insightText}>{aiInsight}</Text>
          </View>

          {/* ── Bottom stats grid ── */}
          <View style={s.statsGrid}>
            <View style={s.statCell}>
              <Text style={s.statCellValue}>
                {speakingHours}h {speakingMins}m
              </Text>
              <Text style={s.statCellLabel}>Total Speaking Time</Text>
            </View>
            <View style={s.statCellDivider} />
            <View style={s.statCell}>
              <Text style={s.statCellValue}>
                {stats?.averageWordsPerDay ?? 0}
              </Text>
              <Text style={s.statCellLabel}>Avg Words / Day</Text>
            </View>
          </View>
        </Animated.ScrollView>
      )}
      <GlobalKeyShortcuts />
    </View>
  );
}

function generateInsight(stats: Stats, weekChange: number | null): string {
  if (stats.currentStreak > 7) {
    return `Amazing ${stats.currentStreak}-day streak! You're on fire! 🔥`;
  }
  if (weekChange !== null && weekChange > 0) {
    return `Great progress! You spoke ${weekChange}% more this week. Keep it up! 🎉`;
  }
  if (stats.mostUsedPhrases.length > 0) {
    return `You've been saying "${stats.mostUsedPhrases[0].text}" a lot this week. Keep communicating! 💬`;
  }
  if (stats.totalWordsThisWeek === 0) {
    return "Start speaking today — every word counts! Your journey begins now. 🚀";
  }
  return `You've spoken ${stats.totalWordsThisWeek.toLocaleString()} words this week. Every word matters. Keep going! 💪`;
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  topPad: number,
  bottomPad: number
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Header
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
    backBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },

    // Loading
    loader: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loaderText: {
      fontSize: 16,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },

    // Hero
    heroCard: {
      margin: 16,
      borderRadius: 20,
      padding: 24,
      alignItems: "center",
    },
    heroLabel: {
      fontSize: 14,
      color: "rgba(255,255,255,0.75)",
      fontFamily: "Inter_400Regular",
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    heroNumber: {
      fontSize: 56,
      fontWeight: "700" as const,
      color: "#FFFFFF",
      fontFamily: "Inter_700Bold",
      lineHeight: 64,
    },
    changeBadge: {
      borderRadius: 100,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginTop: 8,
      marginBottom: 16,
    },
    changeBadgeUp: { backgroundColor: "rgba(52,211,153,0.25)" },
    changeBadgeDown: { backgroundColor: "rgba(239,68,68,0.25)" },
    changeBadgeText: {
      fontSize: 13,
      color: "#FFFFFF",
      fontFamily: "Inter_500Medium",
    },
    heroSubRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
    },
    heroStat: { alignItems: "center", paddingHorizontal: 24 },
    heroStatNum: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: "#FFFFFF",
      fontFamily: "Inter_700Bold",
    },
    heroStatLabel: {
      fontSize: 12,
      color: "rgba(255,255,255,0.7)",
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    heroStatDivider: {
      width: 1,
      height: 32,
      backgroundColor: "rgba(255,255,255,0.3)",
    },

    // Streak
    streakCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    streakEmoji: { fontSize: 36 },
    streakTitle: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    streakSub: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },

    // Sections
    sectionCard: {
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 16,
    },

    // Bar chart
    chart: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 150,
    },
    barCol: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    barValue: {
      fontSize: 9,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      minHeight: 12,
    },
    barTrack: {
      flex: 1,
      justifyContent: "flex-end",
      width: "100%",
      alignItems: "center",
    },
    bar: {
      width: "70%",
      borderRadius: 4,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    barNormal: { backgroundColor: "#4F8EF7" },
    barToday: { backgroundColor: "#FF6B6B" },
    barLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    barLabelToday: {
      color: "#FF6B6B",
      fontWeight: "600" as const,
    },

    // Top phrases
    phraseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    phraseRank: {
      width: 24,
      fontSize: 13,
      fontWeight: "700" as const,
      color: colors.primary,
      fontFamily: "Inter_700Bold",
    },
    phraseText: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    phraseBadge: {
      backgroundColor: colors.secondary,
      borderRadius: 100,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    phraseBadgeText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
    emptyPhrasesText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      paddingVertical: 8,
    },

    // AI Insight
    insightCard: {
      backgroundColor: "rgba(255,230,109,0.08)",
      borderColor: "rgba(255,230,109,0.2)",
    },
    insightHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    insightEmoji: { fontSize: 20 },
    insightTitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: "#FFE66D",
      fontFamily: "Inter_600SemiBold",
    },
    insightText: {
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      lineHeight: 22,
    },

    // Stats grid
    statsGrid: {
      flexDirection: "row",
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      padding: 18,
    },
    statCellDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    statCellValue: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      marginBottom: 4,
    },
    statCellLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
  });
}
