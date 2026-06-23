import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { hasGuardianPin, saveGuardianPin, verifyGuardianPin } from "@/utils/guardianPin";

const GUARDIAN_PURPLE = "#7C6AF7";
const PIN_LENGTH = 4;

interface Props {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = "verify" | "create-enter" | "create-confirm";

export default function GuardianPinModal({ visible, onSuccess, onCancel }: Props) {
  const colors = useColors();

  const [step, setStep] = useState<Step>("verify");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Determine initial step based on whether a PIN already exists
  useEffect(() => {
    if (!visible) return;
    setPin("");
    setConfirmPin("");
    setError(null);
    setLoading(true);
    hasGuardianPin().then((exists) => {
      setStep(exists ? "verify" : "create-enter");
      setLoading(false);
    });
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.85, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => onCancel());
  };

  const handleKeyPress = async (key: string) => {
    Haptics.selectionAsync();
    const current = step === "create-confirm" ? confirmPin : pin;
    if (key === "del") {
      if (step === "create-confirm") setConfirmPin(c => c.slice(0, -1));
      else setPin(p => p.slice(0, -1));
      setError(null);
      return;
    }
    if (current.length >= PIN_LENGTH) return;
    const next = current + key;

    if (step === "create-confirm") {
      setConfirmPin(next);
      if (next.length === PIN_LENGTH) {
        if (next === pin) {
          await saveGuardianPin(next);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onSuccess();
        } else {
          shake();
          setError("PINs don't match. Try again.");
          setTimeout(() => { setConfirmPin(""); setError(null); }, 1000);
        }
      }
    } else {
      setPin(next);
      if (next.length === PIN_LENGTH) {
        if (step === "verify") {
          const ok = await verifyGuardianPin(next);
          if (ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess();
          } else {
            shake();
            setError("Incorrect PIN. Try again.");
            setTimeout(() => { setPin(""); setError(null); }, 1000);
          }
        } else if (step === "create-enter") {
          setStep("create-confirm");
          setConfirmPin("");
          setError(null);
        }
      }
    }
  };

  const activePin = step === "create-confirm" ? confirmPin : pin;

  const title =
    step === "verify" ? "Guardian Access" :
    step === "create-enter" ? "Create Guardian PIN" :
    "Confirm Guardian PIN";

  const subtitle =
    step === "verify" ? "Enter your 4-digit PIN to continue" :
    step === "create-enter" ? "Choose a 4-digit PIN for Guardian mode" :
    "Re-enter your PIN to confirm";

  const s = makeStyles(colors);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <View style={s.overlay}>
        <Animated.View style={[s.card, {
          transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
          opacity: opacityAnim,
        }]}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.iconWrap}>
              <Feather name="shield" size={28} color="#fff" />
            </View>
            <Text style={s.title}>{loading ? "Checking…" : title}</Text>
            <Text style={s.subtitle}>{loading ? "" : subtitle}</Text>
          </View>

          {!loading && (
            <>
              {/* Dot indicators */}
              <View style={s.dotsRow}>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      s.dot,
                      i < activePin.length && s.dotFilled,
                      error && s.dotError,
                    ]}
                  />
                ))}
              </View>

              {/* Error */}
              <View style={s.errorWrap}>
                {error ? (
                  <Text style={s.errorText}>{error}</Text>
                ) : step === "create-confirm" ? (
                  <Text style={s.hintText}>Repeat the PIN you just entered</Text>
                ) : null}
              </View>

              {/* Numpad */}
              <View style={s.numpad}>
                {["1","2","3","4","5","6","7","8","9","","0","del"].map((key, idx) => (
                  key === "" ? <View key={`empty-${idx}`} style={s.numKey} /> : (
                    <TouchableOpacity
                      key={key}
                      style={[s.numKey, key === "del" && s.numKeyDel]}
                      onPress={() => handleKeyPress(key)}
                      activeOpacity={0.65}
                    >
                      {key === "del" ? (
                        <Feather name="delete" size={20} color={colors.foreground} />
                      ) : (
                        <Text style={s.numKeyText}>{key}</Text>
                      )}
                    </TouchableOpacity>
                  )
                ))}
              </View>

              {/* Cancel */}
              <TouchableOpacity style={s.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 340,
      backgroundColor: colors.card,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      paddingBottom: 28,
      overflow: "hidden",
    },
    header: {
      backgroundColor: GUARDIAN_PURPLE,
      alignItems: "center",
      paddingTop: 32,
      paddingBottom: 28,
      paddingHorizontal: 20,
    },
    iconWrap: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: "#fff",
      marginBottom: 5,
    },
    subtitle: {
      fontSize: 13,
      color: "rgba(255,255,255,0.75)",
      textAlign: "center",
    },
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 18,
      paddingTop: 28,
      paddingBottom: 8,
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.mutedForeground,
      backgroundColor: "transparent",
    },
    dotFilled: {
      backgroundColor: GUARDIAN_PURPLE,
      borderColor: GUARDIAN_PURPLE,
    },
    dotError: {
      borderColor: "#FF6B6B",
      backgroundColor: "#FF6B6B",
    },
    errorWrap: {
      height: 22,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    errorText: {
      fontSize: 13,
      color: "#FF6B6B",
      fontWeight: "500",
    },
    hintText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    numpad: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 8,
    },
    numKey: {
      width: `${(100 - 8) / 3}%` as `${number}%`,
      aspectRatio: 1.6,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    numKeyDel: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    numKeyText: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.foreground,
    },
    cancelBtn: {
      alignItems: "center",
      paddingTop: 10,
    },
    cancelText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
  });
}
