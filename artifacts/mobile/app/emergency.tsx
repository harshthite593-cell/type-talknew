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

export default function EmergencyScreen() {
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [speakingPhrase,  setSpeakingPhrase]  = useState<string | null>(null);
  const [usedPhrases,     setUsedPhrases]     = useState<Set<string>>(new Set());
  const [sendingLocation, setSendingLocation] = useState(false);
  const [statusMsg,       setStatusMsg]       = useState<string | null>(null);

  const lastPhraseRef  = useRef<string | null>(null);
  const pulseAnim      = useRef(new Animated.Value(1)).current;
  const statusOpacity  = useRef(new Animated.Value(0)).current;

  // Per-card entrance animations
  const cardAnims = useRef(
    [...Array(EMERGENCY_PHRASES.length + 2)].map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Staggered card entrance
    const animations = cardAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        delay: i * 60,
        useNativeDriver: true,
      })
    );
    Animated.stagger(60, animations).start();

    // Pulsing header
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();

    logEmergencyEvent({
      timestamp: Date.now(), phraseUsed: "",
      locationLat: null, locationLng: null,
      contactsNotified: "", resolved: false,
    });

    return () => {
      pulse.stop();
      Speech.stop();
    };
  }, []);

  const showStatus = useCallback((msg: string) => {
    setStatusMsg(msg);
    Animated.sequence([
      Animated.timing(statusOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(statusOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setStatusMsg(null));
  }, [statusOpacity]);

  const speakPhrase = useCallback(async (phrase: string) => {
    try { await Speech.stop(); } catch {}
    setSpeakingPhrase(phrase);
    lastPhraseRef.current = phrase;
    setUsedPhrases((prev) => new Set([...prev, phrase]));
    Speech.speak(phrase, {
      rate: 0.85, pitch: 1.0,
      onDone:    () => setSpeakingPhrase(null),
      onStopped: () => setSpeakingPhrase(null),
      onError:   () => setSpeakingPhrase(null),
    });
  }, []);

  const callEmergency = useCallback(() => {
    const url = "tel:112";
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else Alert.alert("Unable to call", "Please call 112 manually.");
    });
  }, []);

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
      let locationText = "", lat: number | null = null, lng: number | null = null;
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
        locationText = `https://maps.google.com/?q=${lat},${lng}`;
      } else {
        locationText = "(Location permission denied)";
      }
      const phrase    = lastPhraseRef.current ?? "Emergency alert";
      const timestamp = new Date().toLocaleString();
      const message   =
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

  const confirmSafe = () => {
    Alert.alert("Are you safe?", "Confirm that you are no longer in danger.", [
      { text: "No, stay here", style: "cancel" },
      {
        text: "Yes, I'm safe",
        onPress: async () => {
          await logEmergencyEvent({
            timestamp: Date.now(),
            phraseUsed: lastPhraseRef.current ?? "",
            locationLat: null, locationLng: null,
            contactsNotified: "", resolved: true,
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
        <Text style={s.headerSub}>Tap a phrase to speak it loudly</Text>
      </Animated.View>

      {/* Status toast */}
      {statusMsg && (
        <Animated.View style={[s.statusBar, { opacity: statusOpacity }]}>
          <Text style={s.statusText}>{statusMsg}</Text>
        </Animated.View>
      )}

      {/* Scrollable content */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Phrase grid — staggered entrance */}
        <View style={s.grid}>
          {(EMERGENCY_PHRASES as ReadonlyArray<{ emoji: string; text: string }>).map(({ emoji, text }, idx) => {
            const isActive = speakingPhrase === text;
            const wasUsed  = usedPhrases.has(text);
            return (
              <Animated.View
                key={text}
                style={[
                  s.phraseCardWrap,
                  {
                    opacity: cardAnims[idx],
                    transform: [{ translateY: cardAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    s.phraseBtn,
                    isActive && s.phraseBtnActive,
                    wasUsed && !isActive && s.phraseBtnUsed,
                  ]}
                  onPress={() => speakPhrase(text)}
                  activeOpacity={0.72}
                >
                  <Text style={s.phraseEmoji}>{emoji}</Text>
                  <Text style={[s.phraseText, isActive && s.phraseTextActive]} numberOfLines={2}>
                    {text}
                  </Text>
                  {isActive && <Text style={s.speakingLabel}>Speaking…</Text>}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* CALL 112 */}
        <Animated.View
          style={{
            opacity: cardAnims[EMERGENCY_PHRASES.length],
            transform: [{ translateY: cardAnims[EMERGENCY_PHRASES.length].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }}
        >
          <TouchableOpacity style={s.callBtn} onPress={callEmergency} activeOpacity={0.85}>
            <Text style={s.callBtnEmoji}>📞</Text>
            <Text style={s.callBtnText}>CALL 112</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Send location */}
        <Animated.View
          style={{
            opacity: cardAnims[EMERGENCY_PHRASES.length + 1],
            transform: [{ translateY: cardAnims[EMERGENCY_PHRASES.length + 1].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }}
        >
          <TouchableOpacity
            style={[s.locationBtn, sendingLocation && s.locationBtnDisabled]}
            onPress={sendLocation}
            disabled={sendingLocation}
            activeOpacity={0.8}
          >
            <Text style={s.locationBtnEmoji}>📍</Text>
            <Text style={s.locationBtnText}>
              {sendingLocation ? "Sending…" : "Send My Location to Contacts"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: bottomPad + 16 }} />
      </ScrollView>

      <GlobalKeyShortcuts />
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
    safeBtnText:  { fontSize: 13, color: WHITE, fontFamily: "Inter_500Medium" },
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
      fontSize: 13, color: "rgba(255,255,255,0.8)",
      fontFamily: "Inter_400Regular", marginTop: 4,
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

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
    phraseCardWrap: { width: "48%" },
    phraseBtn: {
      minHeight: 100, backgroundColor: WHITE, borderRadius: 20,
      padding: 14, alignItems: "center", justifyContent: "center", gap: 6,
    },
    phraseBtnActive: { backgroundColor: "#FFE66D", transform: [{ scale: 0.97 }] },
    phraseBtnUsed: {
      backgroundColor: "rgba(255,255,255,0.85)",
      borderWidth: 2, borderColor: "rgba(255,255,255,0.5)",
    },
    phraseEmoji:     { fontSize: 28 },
    phraseText: {
      fontSize: 13, fontWeight: "700" as const, color: CORAL,
      fontFamily: "Inter_700Bold", textAlign: "center",
    },
    phraseTextActive: { color: DARK_RED },
    speakingLabel:    { fontSize: 11, color: DARK_RED, fontFamily: "Inter_400Regular" },

    callBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, backgroundColor: WHITE, borderRadius: 20,
      height: 80, marginBottom: 12,
    },
    callBtnEmoji: { fontSize: 28 },
    callBtnText: {
      fontSize: 24, fontWeight: "700" as const, color: CORAL,
      fontFamily: "Inter_700Bold", letterSpacing: 1,
    },

    locationBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, borderWidth: 2, borderColor: WHITE, borderRadius: 16,
      height: 56, marginBottom: 12,
    },
    locationBtnDisabled: { opacity: 0.6 },
    locationBtnEmoji:    { fontSize: 18 },
    locationBtnText: {
      fontSize: 15, fontWeight: "600" as const, color: WHITE,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
