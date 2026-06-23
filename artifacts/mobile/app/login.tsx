import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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

import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Mode = "login" | "register";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register, continueAsGuest, setRole } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [selectedRole, setSelectedRole] = useState<UserRole>("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setError(null);
    Haptics.selectionAsync();
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields"); return; }
    if (mode === "register" && !name.trim()) { setError("Please enter your name"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const err = mode === "login"
      ? await login(email.trim(), password)
      : await register(name.trim(), email.trim(), password);

    if (err) {
      setLoading(false);
      setError(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    await setRole(selectedRole);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/profile-setup");
  };

  const handleGuest = async () => {
    setGuestLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await continueAsGuest();
    await setRole("user");
    setGuestLoading(false);
    router.replace("/profile-setup");
  };

  const s = makeStyles(colors, topPad, bottomPad);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={s.logoWrap}>
          <Image source={require("../assets/images/logo.png")} style={s.logo} resizeMode="contain" />
          <Text style={s.tagline}>Your voice, amplified</Text>
        </View>

        {/* Role Selector */}
        <View style={s.roleCard}>
          <Text style={s.roleTitle}>Who are you signing in as?</Text>
          <View style={s.roleRow}>
            <TouchableOpacity
              style={[s.rolePill, selectedRole === "user" && s.rolePillActive]}
              onPress={() => handleRoleSelect("user")}
              activeOpacity={0.8}
            >
              <Feather
                name="mic"
                size={16}
                color={selectedRole === "user" ? "#000" : colors.mutedForeground}
              />
              <Text style={[s.rolePillText, selectedRole === "user" && s.rolePillTextActive]}>
                User
              </Text>
              <Text style={[s.rolePillSub, selectedRole === "user" && s.rolePillSubActive]}>
                I communicate
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.rolePill, selectedRole === "guardian" && s.rolePillGuardian]}
              onPress={() => handleRoleSelect("guardian")}
              activeOpacity={0.8}
            >
              <Feather
                name="shield"
                size={16}
                color={selectedRole === "guardian" ? "#fff" : colors.mutedForeground}
              />
              <Text style={[s.rolePillText, selectedRole === "guardian" && s.rolePillTextGuardian]}>
                Guardian
              </Text>
              <Text style={[s.rolePillSub, selectedRole === "guardian" && s.rolePillSubGuardian]}>
                I monitor & support
              </Text>
            </TouchableOpacity>
          </View>

          {selectedRole === "guardian" && (
            <View style={s.guardianNote}>
              <Feather name="info" size={13} color="#7C6AF7" />
              <Text style={s.guardianNoteText}>
                Guardian mode shows a monitoring dashboard with analytics about the user's communication patterns.
              </Text>
            </View>
          )}
        </View>

        {/* Auth Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{mode === "login" ? "Welcome back" : "Create account"}</Text>

          {mode === "register" && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>Name</Text>
              <View style={s.inputRow}>
                <Feather name="user" size={16} color={colors.mutedForeground} style={s.inputIcon} />
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your name"
                  placeholderTextColor={colors.mutedForeground} autoCapitalize="words" autoCorrect={false} returnKeyType="next" />
              </View>
            </View>
          )}

          <View style={s.fieldWrap}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputRow}>
              <Feather name="mail" size={16} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground} keyboardType="email-address"
                autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            </View>
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput style={[s.input, { flex: 1 }]} value={password} onChangeText={setPassword}
                placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
                placeholderTextColor={colors.mutedForeground} secureTextEntry={!showPassword}
                autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={handleSubmit} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={14} color="#FF6B6B" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.submitBtn, selectedRole === "guardian" && s.submitBtnGuardian, loading && s.disabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={selectedRole === "guardian" ? "#fff" : "#000"} size="small" /> : (
              <>
                <Feather
                  name={selectedRole === "guardian" ? "shield" : "mic"}
                  size={16}
                  color={selectedRole === "guardian" ? "#fff" : "#000"}
                />
                <Text style={[s.submitBtnText, selectedRole === "guardian" && s.submitBtnTextGuardian]}>
                  {mode === "login"
                    ? selectedRole === "guardian" ? "Sign in as Guardian" : "Sign in"
                    : selectedRole === "guardian" ? "Create Guardian account" : "Create account"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.switchBtn} onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
            <Text style={s.switchText}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <Text style={s.switchLink}>{mode === "login" ? "Sign up" : "Sign in"}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Guest — only for User role */}
        {selectedRole === "user" && (
          <>
            <TouchableOpacity style={[s.guestBtn, guestLoading && s.disabled]} onPress={handleGuest} disabled={guestLoading} activeOpacity={0.8}>
              {guestLoading ? <ActivityIndicator color={colors.mutedForeground} size="small" /> : (
                <>
                  <Feather name="user-x" size={18} color={colors.mutedForeground} />
                  <Text style={s.guestBtnText}>Continue without account</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={s.guestNote}>Guest mode — your data stays on this device only</Text>
          </>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, paddingTop: topPad + 16, paddingBottom: bottomPad + 24, paddingHorizontal: 20, justifyContent: "center" },
    logoWrap: { alignItems: "center", marginBottom: 20 },
    logo: { width: 140, height: 117, marginBottom: 6 },
    tagline: { fontSize: 13, color: colors.mutedForeground, marginTop: 3 },

    // Role selector
    roleCard: { backgroundColor: colors.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
    roleTitle: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
    roleRow: { flexDirection: "row", gap: 10 },
    rolePill: {
      flex: 1, alignItems: "center", gap: 4, paddingVertical: 14,
      borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.background,
    },
    rolePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    rolePillGuardian: { backgroundColor: "#7C6AF7", borderColor: "#7C6AF7" },
    rolePillText: { fontSize: 14, fontWeight: "700", color: colors.mutedForeground },
    rolePillTextActive: { color: "#000" },
    rolePillTextGuardian: { color: "#fff" },
    rolePillSub: { fontSize: 10, color: colors.mutedForeground, textAlign: "center" },
    rolePillSubActive: { color: "rgba(0,0,0,0.6)" },
    rolePillSubGuardian: { color: "rgba(255,255,255,0.75)" },
    guardianNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12, backgroundColor: "#7C6AF710", borderRadius: 10, padding: 10 },
    guardianNoteText: { flex: 1, fontSize: 12, color: "#7C6AF7", lineHeight: 17 },

    // Auth card
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.border },
    cardTitle: { fontSize: 19, fontWeight: "700", color: colors.foreground, marginBottom: 18 },
    fieldWrap: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
    inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 46 },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 15, color: colors.foreground },
    eyeBtn: { padding: 4 },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FF6B6B20", borderRadius: 10, padding: 10, marginBottom: 10 },
    errorText: { fontSize: 13, color: "#FF6B6B", flex: 1 },
    submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 13, height: 48, marginTop: 4 },
    submitBtnGuardian: { backgroundColor: "#7C6AF7" },
    disabled: { opacity: 0.6 },
    submitBtnText: { fontSize: 15, fontWeight: "700", color: "#000" },
    submitBtnTextGuardian: { color: "#fff" },
    switchBtn: { alignItems: "center", marginTop: 14 },
    switchText: { fontSize: 13, color: colors.mutedForeground },
    switchLink: { color: colors.primary, fontWeight: "600" },
    dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 12, color: colors.mutedForeground },
    guestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 13, height: 48 },
    guestBtnText: { fontSize: 15, color: colors.mutedForeground, fontWeight: "500" },
    guestNote: { textAlign: "center", fontSize: 11, color: colors.mutedForeground, marginTop: 8, opacity: 0.7 },
  });
}
