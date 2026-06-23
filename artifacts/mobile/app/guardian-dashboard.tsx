import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getGuardianStats, type GuardianStats } from "@/utils/guardianAnalytics";

const GUARDIAN_PURPLE = "#7C6AF7";
const GUARDIAN_PURPLE_DARK = "#5B4DD6";

export default function GuardianDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile, logout, setRole } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [stats, setStats] = useState<GuardianStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const loadStats = async () => {
    const s = await getGuardianStats();
    setStats(s);
  };

  useEffect(() => {
    (async () => {
      await loadStats();
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]).start();
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadStats();
    setRefreshing(false);
  };

  const handleSwitchToUser = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setRole("user");
    router.replace("/");
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const displayName = profile?.name ?? user?.name ?? "Guardian";
  const todayDate = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  const s = makeStyles(colors, topPad, bottomPad);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <LinearGradient
        colors={[GUARDIAN_PURPLE, GUARDIAN_PURPLE_DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: topPad + 12 }]}
      >
        <View style={s.headerTop}>
          <TouchableOpacity style={s.headerBtn} onPress={handleSwitchToUser} activeOpacity={0.8}>
            <Feather name="mic" size={18} color="rgba(255,255,255,0.8)" />
            <Text style={s.headerBtnText}>User Mode</Text>
          </TouchableOpacity>
          <View style={s.headerBadge}>
            <Feather name="shield" size={13} color="#fff" />
            <Text style={s.headerBadgeText}>Guardian</Text>
          </View>
          <TouchableOpacity style={s.headerBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Feather name="log-out" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
        <Text style={s.headerGreeting}>Monitoring {displayName}</Text>
        <Text style={s.headerDate}>{todayDate}</Text>
      </LinearGradient>

      {loading ? (
        <View style={s.loader}>
          <Text style={s.loaderText}>Loading dashboard…</Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          contentContainerStyle={{ paddingBottom: bottomPad + 32, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GUARDIAN_PURPLE} />
          }
        >
          {/* ── Row 1: Words Spoken + Emergency Usage ── */}
          <View style={s.row}>
            <WidgetCard
              style={{ flex: 1 }}
              icon="message-square"
              iconColor={GUARDIAN_PURPLE}
              iconBg={`${GUARDIAN_PURPLE}18`}
              label="Words Spoken"
              sublabel="today"
              colors={colors}
            >
              <Text style={s.bigNumber}>{stats?.wordsSpokenToday ?? 0}</Text>
            </WidgetCard>

            <WidgetCard
              style={{ flex: 1 }}
              icon="alert-triangle"
              iconColor="#FF6B6B"
              iconBg="#FF6B6B18"
              label="Emergency Panel"
              sublabel="uses today"
              colors={colors}
            >
              <Text style={[s.bigNumber, stats && stats.emergencyUsesToday > 0 ? s.numberRed : null]}>
                {stats?.emergencyUsesToday ?? 0}
              </Text>
            </WidgetCard>
          </View>

          {/* ── Widget 3: Speaking Analysis ── */}
          {stats && (
            <View style={[s.widgetCard, { marginHorizontal: 16, marginBottom: 12 }]}>
              <View style={s.widgetHeader}>
                <View style={[s.widgetIconWrap, { backgroundColor: "#4F8EF718" }]}>
                  <Feather name="activity" size={16} color="#4F8EF7" />
                </View>
                <View>
                  <Text style={[s.widgetLabel, { color: colors.foreground }]}>Speaking Analysis</Text>
                  <Text style={s.widgetSublabel}>today's communication patterns</Text>
                </View>
              </View>

              {stats.speakingAnalysis.totalUtterances === 0 ? (
                <Text style={s.emptyText}>No speech recorded today yet.</Text>
              ) : (
                <>
                  <View style={s.analysisGrid}>
                    <AnalysisStat
                      label="Clarity Score"
                      value={`${stats.speakingAnalysis.clarityScore}%`}
                      color="#34D399"
                      colors={colors}
                    />
                    <AnalysisStat
                      label="Avg Word Length"
                      value={`${stats.speakingAnalysis.avgWordLength} chars`}
                      color="#4F8EF7"
                      colors={colors}
                    />
                    <AnalysisStat
                      label="Utterances"
                      value={`${stats.speakingAnalysis.totalUtterances}`}
                      color={GUARDIAN_PURPLE}
                      colors={colors}
                    />
                    <AnalysisStat
                      label="Tone"
                      value={capitalize(stats.speakingAnalysis.tone)}
                      color={toneColor(stats.speakingAnalysis.tone)}
                      colors={colors}
                    />
                  </View>

                  {/* Clarity bar */}
                  <View style={s.clarityBarWrap}>
                    <View style={s.clarityBarTrack}>
                      <View style={[s.clarityBarFill, {
                        width: `${stats.speakingAnalysis.clarityScore}%` as `${number}%`,
                        backgroundColor: clarityColor(stats.speakingAnalysis.clarityScore),
                      }]} />
                    </View>
                    <Text style={s.clarityBarLabel}>
                      {clarityLabel(stats.speakingAnalysis.clarityScore)}
                    </Text>
                  </View>

                  {stats.speakingAnalysis.languagesUsed.length > 0 && (
                    <View style={s.langRow}>
                      <Feather name="globe" size={12} color={colors.mutedForeground} />
                      <Text style={s.langText}>
                        {stats.speakingAnalysis.languagesUsed.join(", ")}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* ── Widget 4: Mood Analysis ── */}
          {stats && (
            <View style={[s.widgetCard, s.moodCard, { marginHorizontal: 16, marginBottom: 12 }]}>
              <View style={s.widgetHeader}>
                <View style={[s.widgetIconWrap, { backgroundColor: "#FFE66D18" }]}>
                  <Feather name="heart" size={16} color="#FFE66D" />
                </View>
                <View>
                  <Text style={[s.widgetLabel, { color: colors.foreground }]}>Mood Analysis</Text>
                  <Text style={s.widgetSublabel}>based on today's speech patterns</Text>
                </View>
              </View>

              {stats.speakingAnalysis.totalUtterances === 0 ? (
                <Text style={s.emptyText}>Speak some phrases to see mood analysis.</Text>
              ) : (
                <>
                  <View style={s.moodMainRow}>
                    <Text style={s.moodEmoji}>{stats.moodAnalysis.emoji}</Text>
                    <View>
                      <Text style={s.moodLabel}>{capitalize(stats.moodAnalysis.label)}</Text>
                      <Text style={s.moodSub}>
                        {moodDescription(stats.moodAnalysis.label)}
                      </Text>
                    </View>
                  </View>

                  <View style={s.moodBars}>
                    <MoodBar
                      label="Positive signals"
                      percent={stats.moodAnalysis.positivePercent}
                      color="#34D399"
                      colors={colors}
                    />
                    <MoodBar
                      label="Urgent signals"
                      percent={stats.moodAnalysis.urgentPercent}
                      color="#FF6B6B"
                      colors={colors}
                    />
                  </View>

                  {stats.moodAnalysis.topWords.length > 0 && (
                    <View style={s.topWordsRow}>
                      {stats.moodAnalysis.topWords.map((w) => (
                        <View key={w} style={s.wordChip}>
                          <Text style={s.wordChipText}>{w}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* ── Widget 5: App Activity ── */}
          {stats && (
            <View style={[s.widgetCard, { marginHorizontal: 16, marginBottom: 12 }]}>
              <View style={s.widgetHeader}>
                <View style={[s.widgetIconWrap, { backgroundColor: "#34D39918" }]}>
                  <Feather name="clock" size={16} color="#34D399" />
                </View>
                <View>
                  <Text style={[s.widgetLabel, { color: colors.foreground }]}>App Activity</Text>
                  <Text style={s.widgetSublabel}>session usage today</Text>
                </View>
              </View>

              {stats.appActivity.totalMinutesActive === 0 ? (
                <Text style={s.emptyText}>No activity recorded today yet.</Text>
              ) : (
                <View style={s.activityGrid}>
                  <View style={s.activityCell}>
                    <Text style={s.activityValue}>{formatMinutes(stats.appActivity.totalMinutesActive)}</Text>
                    <Text style={s.activityLabel}>Active Time</Text>
                  </View>
                  <View style={s.activityDivider} />
                  <View style={s.activityCell}>
                    <Text style={s.activityValue}>{stats.appActivity.sessionCount}</Text>
                    <Text style={s.activityLabel}>
                      {stats.appActivity.sessionCount === 1 ? "Session" : "Sessions"}
                    </Text>
                  </View>
                  <View style={s.activityDivider} />
                  <View style={s.activityCell}>
                    <Text style={s.activityValue}>{stats.appActivity.firstActivityTime ?? "—"}</Text>
                    <Text style={s.activityLabel}>First Active</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Switch to User mode banner */}
          <TouchableOpacity style={s.switchBanner} onPress={handleSwitchToUser} activeOpacity={0.85}>
            <Feather name="mic" size={18} color={GUARDIAN_PURPLE} />
            <Text style={s.switchBannerText}>Switch to User Mode to type & speak</Text>
            <Feather name="arrow-right" size={16} color={GUARDIAN_PURPLE} />
          </TouchableOpacity>

        </Animated.ScrollView>
      )}
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────

interface WidgetCardProps {
  style?: object;
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}

function WidgetCard({ style, icon, iconColor, iconBg, label, sublabel, children, colors }: WidgetCardProps) {
  const s = makeStyles(colors, 0, 0);
  return (
    <View style={[s.widgetCard, style]}>
      <View style={s.widgetHeader}>
        <View style={[s.widgetIconWrap, { backgroundColor: iconBg }]}>
          <Feather name={icon as "mic"} size={16} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.widgetLabel, { color: colors.foreground }]}>{label}</Text>
          <Text style={s.widgetSublabel}>{sublabel}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

interface AnalysisStatProps {
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof useColors>;
}

function AnalysisStat({ label, value, color, colors }: AnalysisStatProps) {
  const s = makeStyles(colors, 0, 0);
  return (
    <View style={s.analysisStat}>
      <Text style={[s.analysisStatValue, { color }]}>{value}</Text>
      <Text style={s.analysisStatLabel}>{label}</Text>
    </View>
  );
}

interface MoodBarProps {
  label: string;
  percent: number;
  color: string;
  colors: ReturnType<typeof useColors>;
}

function MoodBar({ label, percent, color, colors }: MoodBarProps) {
  const s = makeStyles(colors, 0, 0);
  return (
    <View style={s.moodBarRow}>
      <Text style={s.moodBarLabel}>{label}</Text>
      <View style={s.moodBarTrack}>
        <View style={[s.moodBarFill, { width: `${Math.min(100, percent)}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.moodBarPct, { color }]}>{percent}%</Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toneColor(tone: string) {
  switch (tone) {
    case "urgent": return "#FF6B6B";
    case "expressive": return "#FFE66D";
    case "mixed": return "#FF9F43";
    default: return "#34D399";
  }
}

function clarityColor(score: number) {
  if (score >= 75) return "#34D399";
  if (score >= 50) return "#FFE66D";
  return "#FF6B6B";
}

function clarityLabel(score: number) {
  if (score >= 80) return "Very clear communication";
  if (score >= 60) return "Mostly clear";
  if (score >= 40) return "Moderate complexity";
  return "Complex language detected";
}

function moodDescription(label: string) {
  switch (label) {
    case "happy": return "Communication feels positive and upbeat";
    case "anxious": return "Some urgent signals detected — check in";
    case "distressed": return "High urgency detected — consider reaching out";
    default: return "Communication is calm and steady";
  }
}

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Styles ─────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 16, paddingBottom: 20 },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    headerBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)" },
    headerBtnText: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
    headerBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    headerBadgeText: { fontSize: 12, color: "#fff", fontWeight: "700", letterSpacing: 0.5 },
    headerGreeting: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 2 },
    headerDate: { fontSize: 13, color: "rgba(255,255,255,0.7)" },

    loader: { flex: 1, alignItems: "center", justifyContent: "center" },
    loaderText: { fontSize: 16, color: colors.mutedForeground },

    row: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginBottom: 12 },

    widgetCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    moodCard: { backgroundColor: `${colors.card}` },
    widgetHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
    widgetIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    widgetLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
    widgetSublabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 1 },

    bigNumber: { fontSize: 38, fontWeight: "700", color: colors.foreground, lineHeight: 44 },
    numberRed: { color: "#FF6B6B" },

    emptyText: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", paddingVertical: 8 },

    // Speaking analysis
    analysisGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
    analysisStat: {
      flex: 1, minWidth: "45%",
      backgroundColor: colors.background,
      borderRadius: 12, padding: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    analysisStatValue: { fontSize: 18, fontWeight: "700", marginBottom: 2 },
    analysisStatLabel: { fontSize: 11, color: colors.mutedForeground },

    clarityBarWrap: { marginBottom: 8 },
    clarityBarTrack: { height: 7, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden", marginBottom: 4 },
    clarityBarFill: { height: "100%", borderRadius: 4 },
    clarityBarLabel: { fontSize: 11, color: colors.mutedForeground },

    langRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    langText: { fontSize: 11, color: colors.mutedForeground },

    // Mood analysis
    moodMainRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
    moodEmoji: { fontSize: 42 },
    moodLabel: { fontSize: 20, fontWeight: "700", color: colors.foreground },
    moodSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, maxWidth: 200 },

    moodBars: { gap: 8, marginBottom: 12 },
    moodBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    moodBarLabel: { fontSize: 12, color: colors.mutedForeground, width: 110 },
    moodBarTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
    moodBarFill: { height: "100%", borderRadius: 3 },
    moodBarPct: { fontSize: 12, fontWeight: "600", width: 36, textAlign: "right" },

    topWordsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    wordChip: { backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
    wordChipText: { fontSize: 12, color: colors.foreground },

    // App activity
    activityGrid: { flexDirection: "row", alignItems: "center" },
    activityCell: { flex: 1, alignItems: "center", paddingVertical: 6 },
    activityDivider: { width: 1, height: 40, backgroundColor: colors.border },
    activityValue: { fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 3 },
    activityLabel: { fontSize: 11, color: colors.mutedForeground, textAlign: "center" },

    // Switch banner
    switchBanner: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      marginHorizontal: 16, marginTop: 4, marginBottom: 8,
      borderWidth: 1, borderColor: `${GUARDIAN_PURPLE}40`,
      borderRadius: 14, paddingVertical: 14,
      backgroundColor: `${GUARDIAN_PURPLE}08`,
    },
    switchBannerText: { fontSize: 14, fontWeight: "600", color: GUARDIAN_PURPLE },
  });
}
