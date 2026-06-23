import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

import { useAuth, type UserProfile } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function ProfileSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isGuest, updateProfile, skipProfile } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [name, setName] = useState(user?.name ?? "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const finalName = name.trim();
    const ageNum = parseInt(age, 10);

    if (isGuest && !finalName) { setError("Please enter your name"); return; }
    if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 120) { setError("Please enter a valid age"); return; }
    if (!gender) { setError("Please select your gender"); return; }
    if (!birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) { setError("Please enter birth date as YYYY-MM-DD"); return; }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const profile: UserProfile = {
      name: finalName || user?.name || "User",
      age: ageNum,
      gender,
      birthDate,
      bio: bio.trim() || undefined,
    };

    await updateProfile(profile);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/");
  };

  const s = makeStyles(colors, topPad, bottomPad);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Skip button top-right */}
        <TouchableOpacity
          style={s.skipBtn}
          onPress={async () => { await skipProfile(); router.replace("/"); }}
        >
          <Text style={s.skipText}>Skip</Text>
          <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={s.headerWrap}>
          <View style={s.iconCircle}>
            <Feather name="user" size={28} color={colors.primary} />
          </View>
          <Text style={s.title}>Tell us about yourself</Text>
          <Text style={s.subtitle}>Optional — helps us match you with the right friends</Text>
        </View>

        <View style={s.card}>
          {/* Name (only for guests since auth users already have a name) */}
          {isGuest && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>Your Name</Text>
              <View style={s.inputRow}>
                <Feather name="user" size={15} color={colors.mutedForeground} style={s.icon} />
                <TextInput style={s.input} value={name} onChangeText={setName}
                  placeholder="What should we call you?" placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words" returnKeyType="next" />
              </View>
            </View>
          )}

          {/* Age */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>Age</Text>
            <View style={s.inputRow}>
              <Feather name="calendar" size={15} color={colors.mutedForeground} style={s.icon} />
              <TextInput style={s.input} value={age} onChangeText={setAge}
                placeholder="e.g. 28" placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric" returnKeyType="next" maxLength={3} />
            </View>
          </View>

          {/* Birth Date */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>Date of Birth</Text>
            <View style={s.inputRow}>
              <Feather name="gift" size={15} color={colors.mutedForeground} style={s.icon} />
              <TextInput style={s.input} value={birthDate} onChangeText={setBirthDate}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric" returnKeyType="next" maxLength={10} />
            </View>
          </View>

          {/* Gender */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>Gender</Text>
            <View style={s.genderRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[s.genderPill, gender === g && s.genderPillActive]}
                  onPress={() => { setGender(g); Haptics.selectionAsync(); }}
                >
                  <Text style={[s.genderText, gender === g && s.genderTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Bio */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>About me <Text style={s.optional}>(optional)</Text></Text>
            <View style={[s.inputRow, { height: 80, alignItems: "flex-start", paddingTop: 10 }]}>
              <Feather name="edit-3" size={15} color={colors.mutedForeground} style={[s.icon, { marginTop: 2 }]} />
              <TextInput style={[s.input, { height: 60 }]} value={bio} onChangeText={setBio}
                placeholder="A short intro about yourself..." placeholderTextColor={colors.mutedForeground}
                multiline textAlignVertical="top" maxLength={200} />
            </View>
            <Text style={s.charCount}>{bio.length}/200</Text>
          </View>

          {error && (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={14} color="#FF6B6B" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={[s.saveBtn, loading && s.disabled]} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#000" size="small" /> : (
              <>
                <Text style={s.saveBtnText}>Let's go!</Text>
                <Feather name="arrow-right" size={18} color="#000" />
              </>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, _bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, paddingTop: topPad + 20, paddingBottom: 40, paddingHorizontal: 20 },
    skipBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 2, paddingVertical: 6, paddingHorizontal: 4, marginBottom: 8 },
    skipText: { fontSize: 14, color: colors.mutedForeground },
    headerWrap: { alignItems: "center", marginBottom: 24 },
    iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.primary}20`, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    title: { fontSize: 22, fontWeight: "700", color: colors.foreground, textAlign: "center" },
    subtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", marginTop: 6, lineHeight: 19 },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
    fieldWrap: { marginBottom: 16 },
    label: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 },
    optional: { fontWeight: "400", textTransform: "none" },
    inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 46 },
    icon: { marginRight: 8 },
    input: { flex: 1, fontSize: 15, color: colors.foreground },
    genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    genderPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    genderPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    genderText: { fontSize: 13, color: colors.mutedForeground, fontWeight: "500" },
    genderTextActive: { color: "#000", fontWeight: "700" },
    charCount: { fontSize: 11, color: colors.mutedForeground, textAlign: "right", marginTop: 4 },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FF6B6B20", borderRadius: 10, padding: 10, marginBottom: 10 },
    errorText: { fontSize: 13, color: "#FF6B6B", flex: 1 },
    saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 13, height: 50, marginTop: 4 },
    disabled: { opacity: 0.6 },
    saveBtnText: { fontSize: 16, fontWeight: "700", color: "#000" },
  });
}
