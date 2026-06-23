import { router } from "expo-router";
import GlobalKeyShortcuts from "@/components/GlobalKeyShortcuts";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EMERGENCY_PHRASES,
  getActiveContacts,
  logEmergencyEvent,
} from "@/utils/emergency";

const CORAL = "#FF6B6B";
const DARK_RED = "#C53030";
const WHITE = "#FFFFFF";

// ── Keyboard navigation constants ────────────────────────────────
// Items 0 … EMERGENCY_PHRASES.length-1 = phrase grid cards
// Item CALL_112_IDX                     = CALL 112 button
// Item SEND_LOC_IDX                     = Send Location button
const CALL_112_IDX = EMERGENCY_PHRASES.length;        // 6
const SEND_LOC_IDX = EMERGENCY_PHRASES.length + 1;    // 7
const TOTAL_ITEMS  = EMERGENCY_PHRASES.length + 2;    // 8

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [speakingPhrase, setSpeakingPhrase] = useState<string | null>(null);
  const [usedPhrases, setUsedPhrases]       = useState<Set<string>>(new Set());
  const [sendingLocation, setSendingLocation] = useState(false);
  const [statusMsg, setStatusMsg]           = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex]   = useState<number | null>(null);

  // Refs for stable access inside useCallback closures
  const selectedIndexRef = useRef<number | null>(null);
  selectedIndexRef.current = selectedIndex;
  const lastPhraseRef = useRef<string | null>(null);

  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const statusOpacity = useRef(new Animated.Value(0)).current;
  const selectedScale = useRef(new Animated.Value(1)).current;

  // ── Pulse header animation ───────────────────────────────────
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();

    logEmergencyEvent({
      timestamp: Date.now(),
      phraseUsed: "",
      locationLat: null,
      locationLng: null,
      contactsNotified: "",
      resolved: false,
    });

    return () => {
      pulse.stop();
      Speech.stop();
    };
  }, []);

  // ── Animate selection card when index changes ───────────────
  useEffect(() => {
    if (selectedIndex === null) return;
    Animated.sequence([
      Animated.timing(selectedScale, { toValue: 1.04, duration: 120, useNativeDriver: true }),
      Animated.timing(selectedScale, { toValue: 1.02, duration: 80,  useNativeDriver: true }),
    ]).start();
  }, [selectedIndex]);

  // ── Status toast ─────────────────────────────────────────────
  const showStatus = useCallback((msg: string) => {
    setStatusMsg(msg);
    Animated.sequence([
      Animated.timing(statusOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(statusOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setStatusMsg(null));
  }, [statusOpacity]);

  // ── Speak phrase ─────────────────────────────────────────────
  const speakPhrase = useCallback(async (phrase: string) => {
    try { await Speech.stop(); } catch {}
    setSpeakingPhrase(phrase);
    lastPhraseRef.current = phrase;
    setUsedPhrases((prev) => new Set([...prev, phrase]));
    Speech.speak(phrase, {
      rate: 0.85,
      pitch: 1.0,
      onDone:    () => setSpeakingPhrase(null),
      onStopped: () => setSpeakingPhrase(null),
      onError:   () => setSpeakingPhrase(null),
    });
  }, []);

  // ── Call 112 ─────────────────────────────────────────────────
  const callEmergency = useCallback(() => {
    const url = "tel:112";
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else Alert.alert("Unable to call", "Please call 112 manually.");
    });
  }, []);

  // ── Send location SMS ────────────────────────────────────────
  const sendLocation = useCallback(async () => {
    setSendingLocation(true);
    showStatus("Getting location…");
    try {
      const contacts = await getActiveContacts();
      if (contacts.length === 0) {
        showStatus("No active contacts. Add contacts first.");
        setSendingLocation(false);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locationText = "";
      let lat: number | null = null;
      let lng: number | null = null;
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        locationText = `https://maps.google.com/?q=${lat},${lng}`;
      } else {
        locationText = "(Location permission denied)";
      }
      const phrase = lastPhraseRef.current ?? "Emergency alert";
      const timestamp = new Date().toLocaleString();
      const message =
        `🚨 EMERGENCY ALERT via Type Talk App.\n` +
        `Message: "${phrase}"\n` +
        `Location: ${locationText}\n` +
        `Time: ${timestamp}\n` +
        `Please respond immediately.`;
      const smsAvailable = await SMS.isAvailableAsync();
      if (smsAvailable) {
        const phones = contacts.map((c) => c.phone);
        const names  = contacts.map((c) => c.name).join(", ");
        await SMS.sendSMSAsync(phones, message);
        showStatus(`SMS sent to ${names} ✅`);
        await logEmergencyEvent({
          timestamp: Date.now(), phraseUsed: phrase,
          locationLat: lat, locationLng: lng,
          contactsNotified: names, resolved: false,
        });
      } else {
        showStatus("SMS not available on this device");
      }
    } catch {
      showStatus("Failed to send location");
    }
    setSendingLocation(false);
  }, [showStatus]);

  // ── Keyboard: N + Enter → next item ─────────────────────────
  const handleNext = useCallback(() => {
    setSelectedIndex((prev) =>
      prev === null ? 0 : (prev + 1) % TOTAL_ITEMS
    );
  }, []);

  // ── Keyboard: Enter alone → activate selected item ───────────
  const handleActivate = useCallback(() => {
    const idx = selectedIndexRef.current;
    if (idx === null) return;
    const phrases = EMERGENCY_PHRASES as ReadonlyArray<{ emoji: string; text: string }>;
    if (idx < EMERGENCY_PHRASES.length) {
      speakPhrase(phrases[idx].text);
    } else if (idx === CALL_112_IDX) {
      callEmergency();
    } else {
      sendLocation();
    }
  }, [speakPhrase, callEmergency, sendLocation]);

  // ── Confirm safe ─────────────────────────────────────────────
  const confirmSafe = () => {
    Alert.alert("Are you safe?", "Confirm that you are no longer in danger.", [
      { text: "No, stay here", style: "cancel" },
      {
        text: "Yes, I'm safe",
        onPress: async () => {
          await logEmergencyEvent({
            timestamp: Date.now(),
            phraseUsed: lastPhraseRef.current ?? "",
            locationLat: null,
            locationLng: null,
            contactsNotified: "",
            resolved: true,
          });
          router.back();
        },
      },
    ]);
  };

  const s = makeStyles(topPad, bottomPad);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_RED} />

      <LinearGradient
        colors={[CORAL, DARK_RED]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top row */}
      <View style={[s.safeRow, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={s.homeBtn} onPress={() => router.replace("/")}>
          <Feather name="home" size={16} color={WHITE} />
        </TouchableOpacity>
        <TouchableOpacity style={s.safeBtn} onPress={confirmSafe}>
          <Text style={s.safeBtnText}>I'm Safe Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.contactsBtn} onPress={() => router.push("/emergency-contacts")}>
          <Feather name="users" size={16} color={WHITE} />
        </TouchableOpacity>
      </View>

      {/* Pulsing header */}
      <Animated.View style={[s.headerBlock, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={s.headerEmoji}>🚨</Text>
        <Text style={s.headerTitle}>EMERGENCY</Text>
        <Text style={s.headerSub}>
          Tap to speak  ·  Keyboard: <Text style={s.headerKey}>N</Text>↵ navigate  ·  ↵ activate
        </Text>
      </Animated.View>

      {/* Status toast */}
      {statusMsg && (
        <Animated.View style={[s.statusBar, { opacity: statusOpacity }]}>
          <Text style={s.statusText}>{statusMsg}</Text>
        </Animated.View>
      )}

      {/* Keyboard hint bar — shows when an item is selected */}
      {selectedIndex !== null && (
        <View style={s.kbHintBar}>
          <Text style={s.kbHintText}>
            👉 Item {selectedIndex + 1} of {TOTAL_ITEMS} selected  ·  ↵ to activate
          </Text>
        </View>
      )}

      {/* Scrollable content */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Phrase grid */}
        <View style={s.grid}>
          {(EMERGENCY_PHRASES as ReadonlyArray<{ emoji: string; text: string }>).map(({ emoji, text }, idx) => {
            const isActive   = speakingPhrase === text;
            const wasUsed    = usedPhrases.has(text);
            const isSelected = selectedIndex === idx;
            return (
              <Animated.View
                key={text}
                style={[
                  s.phraseCardWrap,
                  isSelected && { transform: [{ scale: selectedScale }] },
                ]}
              >
                <TouchableOpacity
                  style={[
                    s.phraseBtn,
                    isActive   && s.phraseBtnActive,
                    wasUsed && !isActive && s.phraseBtnUsed,
                    isSelected && s.phraseBtnSelected,
                  ]}
                  onPress={() => speakPhrase(text)}
                  activeOpacity={0.75}
                >
                  {isSelected && <Text style={s.pointerEmoji}>👉</Text>}
                  <Text style={s.phraseEmoji}>{emoji}</Text>
                  <Text
                    style={[s.phraseText, isActive && s.phraseTextActive]}
                    numberOfLines={2}
                  >
                    {text}
                  </Text>
                  {isActive && <Text style={s.speakingLabel}>Speaking…</Text>}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* CALL 112 */}
        <TouchableOpacity
          style={[s.callBtn, selectedIndex === CALL_112_IDX && s.callBtnSelected]}
          onPress={callEmergency}
          activeOpacity={0.85}
        >
          {selectedIndex === CALL_112_IDX && <Text style={s.pointerEmojiLarge}>👉</Text>}
          <Text style={s.callBtnEmoji}>📞</Text>
          <Text style={s.callBtnText}>CALL 112</Text>
        </TouchableOpacity>

        {/* Send location */}
        <TouchableOpacity
          style={[
            s.locationBtn,
            sendingLocation && s.locationBtnDisabled,
            selectedIndex === SEND_LOC_IDX && s.locationBtnSelected,
          ]}
          onPress={sendLocation}
          disabled={sendingLocation}
          activeOpacity={0.8}
        >
          {selectedIndex === SEND_LOC_IDX && <Text style={s.pointerEmojiLarge}>👉</Text>}
          <Text style={s.locationBtnEmoji}>📍</Text>
          <Text style={s.locationBtnText}>
            {sendingLocation ? "Sending…" : "Send My Location to Contacts"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: bottomPad + 16 }} />
      </ScrollView>

      {/* Keyboard handler — N+Enter = next, Enter alone = activate */}
      <GlobalKeyShortcuts extras={{ n: handleNext, "": handleActivate }} />
    </View>
  );
}

function makeStyles(topPad: number, bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 14 },

    safeRow: {
      flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", paddingHorizontal: 16, paddingBottom: 4,
    },
    safeBtn: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
    },
    safeBtnText: { fontSize: 13, color: WHITE, fontFamily: "Inter_500Medium" },
    contactsBtn: {
      width: 36, height: 36, borderRadius: 18,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
      alignItems: "center", justifyContent: "center",
    },
    homeBtn: {
      width: 36, height: 36, borderRadius: 18,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
      alignItems: "center", justifyContent: "center",
    },

    headerBlock: { alignItems: "center", paddingVertical: 12 },
    headerEmoji: { fontSize: 40 },
    headerTitle: {
      fontSize: 36, fontWeight: "700" as const, color: WHITE,
      fontFamily: "Inter_700Bold", letterSpacing: 2, marginTop: 4,
    },
    headerSub: {
      fontSize: 12, color: "rgba(255,255,255,0.75)",
      fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center",
    },
    headerKey: {
      fontFamily: "Inter_700Bold", color: WHITE, fontSize: 13,
    },

    // Keyboard hint bar
    kbHintBar: {
      marginHorizontal: 14, marginBottom: 6,
      backgroundColor: "rgba(0,0,0,0.3)",
      borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14,
    },
    kbHintText: {
      fontSize: 12, color: "rgba(255,255,255,0.9)",
      fontFamily: "Inter_500Medium", textAlign: "center",
    },

    statusBar: {
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 100,
      paddingHorizontal: 16, paddingVertical: 8, alignSelf: "center",
    },
    statusText: {
      fontSize: 13, color: WHITE,
      fontFamily: "Inter_500Medium", textAlign: "center",
    },

    // Grid
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
    phraseCardWrap: { width: "48%" },
    phraseBtn: {
      minHeight: 100, backgroundColor: WHITE, borderRadius: 20,
      padding: 14, alignItems: "center", justifyContent: "center", gap: 4,
      borderWidth: 3, borderColor: "transparent",
    },
    phraseBtnActive: {
      backgroundColor: "#FFE66D",
      transform: [{ scale: 0.97 }],
    },
    phraseBtnUsed: {
      backgroundColor: "rgba(255,255,255,0.85)",
      borderColor: "rgba(255,255,255,0.5)",
    },
    phraseBtnSelected: {
      borderColor: WHITE,
      backgroundColor: "#FFF8F8",
      shadowColor: WHITE,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 12,
      elevation: 12,
    },
    pointerEmoji: {
      position: "absolute", top: 6, left: 8,
      fontSize: 16, lineHeight: 20,
    },
    phraseEmoji: { fontSize: 28 },
    phraseText: {
      fontSize: 13, fontWeight: "700" as const, color: CORAL,
      fontFamily: "Inter_700Bold", textAlign: "center",
    },
    phraseTextActive: { color: DARK_RED },
    speakingLabel: { fontSize: 11, color: DARK_RED, fontFamily: "Inter_400Regular" },

    // Call 112
    callBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, backgroundColor: WHITE, borderRadius: 20,
      height: 80, marginBottom: 12,
      borderWidth: 3, borderColor: "transparent",
    },
    callBtnSelected: {
      borderColor: WHITE,
      shadowColor: WHITE,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 12,
      elevation: 12,
      backgroundColor: "#FFFDF0",
    },
    callBtnEmoji: { fontSize: 28 },
    callBtnText: {
      fontSize: 24, fontWeight: "700" as const, color: CORAL,
      fontFamily: "Inter_700Bold", letterSpacing: 1,
    },
    pointerEmojiLarge: { fontSize: 22, marginRight: 4 },

    // Location button
    locationBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, borderWidth: 3, borderColor: WHITE, borderRadius: 16,
      height: 56, marginBottom: 12,
    },
    locationBtnDisabled: { opacity: 0.6 },
    locationBtnSelected: {
      borderColor: "#FFE66D",
      shadowColor: "#FFE66D",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 12,
      elevation: 12,
    },
    locationBtnEmoji: { fontSize: 18 },
    locationBtnText: {
      fontSize: 15, fontWeight: "600" as const, color: WHITE,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
