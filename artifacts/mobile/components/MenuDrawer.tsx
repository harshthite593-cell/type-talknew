import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const PHOTO_KEY = "typetalk_profile_photo";
const GUARDIAN_PURPLE = "#7C6AF7";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AppLogo = require("../assets/images/logo.png") as number;
const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = Math.min(SCREEN_W * 0.82, 320);

interface Props {
  visible: boolean;
  onClose: () => void;
  onSwitchPanel?: (panel: "history" | "settings") => void;
}

interface MenuItem {
  icon: string;
  label: string;
  color?: string;
  badge?: string;
  action: () => void;
}

export default function MenuDrawer({ visible, onClose, onSwitchPanel }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user, isGuest, profile, role, logout, setRole } = useAuth();

  const slideX = useRef(new Animated.Value(-DRAWER_W)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PHOTO_KEY).then(v => { if (v) setPhotoUri(v); });
  }, []);

  useEffect(() => {
    const native = Platform.OS !== "web";
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, useNativeDriver: native, tension: 68, friction: 11 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: native }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: native }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: native }),
      ]).start();
    }
  }, [visible]);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      await AsyncStorage.setItem(PHOTO_KEY, uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const navigate = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as "/friends"), 250);
  };

  const switchPanel = (panel: "history" | "settings") => {
    onClose();
    setTimeout(() => onSwitchPanel?.(panel), 250);
  };

  const handleLogout = async () => {
    onClose();
    setTimeout(async () => {
      await logout();
      router.replace("/login");
    }, 300);
  };

  const handleSwitchToGuardian = async () => {
    onClose();
    setTimeout(async () => {
      await setRole("guardian");
      router.replace("/guardian-dashboard");
    }, 250);
  };

  const handleSwitchToUser = async () => {
    onClose();
    setTimeout(async () => {
      await setRole("user");
      router.replace("/");
    }, 250);
  };

  const displayName = profile?.name ?? user?.name ?? (isGuest ? "Guest" : "—");
  const displaySub = user?.email ?? (isGuest ? "Using without account" : "");
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const userMenuItems: MenuItem[] = [
    { icon: "zap", label: "Typing Test", action: () => navigate("/typing-test") },
    { icon: "users", label: "Friends", action: () => navigate("/friends") },
    { icon: "bookmark", label: "Saved Phrases", action: () => navigate("/saved-phrases") },
    { icon: "clock", label: "History", action: () => switchPanel("history") },
    { icon: "bar-chart-2", label: "Analytics", action: () => navigate("/analytics") },
    { icon: "sliders", label: "Voice Settings", action: () => switchPanel("settings") },
    { icon: "alert-triangle", label: "Emergency", color: "#FF6B6B", action: () => navigate("/emergency") },
  ];

  const guardianMenuItems: MenuItem[] = [
    { icon: "shield", label: "Guardian Dashboard", color: GUARDIAN_PURPLE, action: () => navigate("/guardian-dashboard") },
    { icon: "bar-chart-2", label: "Analytics", action: () => navigate("/analytics") },
    { icon: "alert-triangle", label: "Emergency", color: "#FF6B6B", action: () => navigate("/emergency") },
  ];

  const menuItems = role === "guardian" ? guardianMenuItems : userMenuItems;

  const s = makeStyles(colors, topPad, DRAWER_W);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity }]} />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <Animated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
        {/* App branding */}
        <View style={s.brandRow}>
          <Image source={AppLogo} style={s.brandLogo} resizeMode="contain" />
        </View>

        <View style={s.divider} />

        {/* Profile section */}
        <View style={s.profileSection}>
          <TouchableOpacity style={s.avatarWrap} onPress={handlePickPhoto} activeOpacity={0.8}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={s.cameraBtn}>
              <Feather name="camera" size={12} color="#000" />
            </View>
          </TouchableOpacity>
          <View style={s.profileInfo}>
            <View style={s.profileNameRow}>
              <Text style={s.profileName} numberOfLines={1}>{displayName}</Text>
              {role === "guardian" && (
                <View style={s.roleBadge}>
                  <Feather name="shield" size={10} color="#fff" />
                  <Text style={s.roleBadgeText}>Guardian</Text>
                </View>
              )}
            </View>
            {displaySub ? <Text style={s.profileSub} numberOfLines={1}>{displaySub}</Text> : null}
            {profile && (
              <Text style={s.profileMeta}>{profile.age} yrs · {profile.gender}</Text>
            )}
            {isGuest && (
              <TouchableOpacity onPress={() => { onClose(); setTimeout(() => router.replace("/login"), 250); }}>
                <Text style={s.signInLink}>Sign in for more features →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={s.divider} />

        {/* Role switcher — only for authenticated users */}
        {!isGuest && (
          <View style={s.roleSwitcher}>
            <TouchableOpacity
              style={[s.roleTab, role === "user" && s.roleTabActive]}
              onPress={handleSwitchToUser}
              activeOpacity={0.8}
            >
              <Feather name="mic" size={14} color={role === "user" ? "#000" : colors.mutedForeground} />
              <Text style={[s.roleTabText, role === "user" && s.roleTabTextActive]}>User</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.roleTab, role === "guardian" && s.roleTabGuardian]}
              onPress={handleSwitchToGuardian}
              activeOpacity={0.8}
            >
              <Feather name="shield" size={14} color={role === "guardian" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.roleTabText, role === "guardian" && s.roleTabTextGuardian]}>Guardian</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.divider} />

        {/* Nav items */}
        <View style={s.nav}>
          {menuItems.map(item => (
            <TouchableOpacity key={item.label} style={s.navItem} onPress={() => { Haptics.selectionAsync(); item.action(); }} activeOpacity={0.7}>
              <View style={[s.navIconWrap, item.color ? { backgroundColor: `${item.color}20` } : {}]}>
                <Feather name={item.icon as "zap"} size={18} color={item.color ?? colors.foreground} />
              </View>
              <Text style={[s.navLabel, item.color ? { color: item.color } : {}]}>{item.label}</Text>
              <Feather name="chevron-right" size={15} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* Bottom: logout */}
        <View style={s.bottomSection}>
          <View style={s.divider} />
          <TouchableOpacity style={s.navItem} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[s.navIconWrap, { backgroundColor: "#FF6B6B20" }]}>
              <Feather name={isGuest ? "log-in" : "log-out"} size={18} color="#FF6B6B" />
            </View>
            <Text style={[s.navLabel, { color: "#FF6B6B" }]}>{isGuest ? "Sign in" : "Log out"}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, drawerW: number) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
    drawer: {
      position: "absolute", left: 0, top: 0, bottom: 0, width: drawerW,
      backgroundColor: colors.background, paddingTop: topPad,
      borderRightWidth: 1, borderRightColor: colors.border,
    },
    brandRow: { alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    brandLogo: { width: 150, height: 125 },
    profileSection: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
    avatarWrap: { position: "relative" },
    avatarImg: { width: 60, height: 60, borderRadius: 30 },
    avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: `${colors.primary}30`, alignItems: "center", justifyContent: "center" },
    avatarInitials: { fontSize: 22, fontWeight: "700", color: colors.primary },
    cameraBtn: { position: "absolute", bottom: 0, right: 0, backgroundColor: colors.primary, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    profileInfo: { flex: 1 },
    profileNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    profileName: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    roleBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: GUARDIAN_PURPLE, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
    roleBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    profileSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
    profileMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 3 },
    signInLink: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 4 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 20, marginVertical: 4 },

    // Role switcher
    roleSwitcher: { flexDirection: "row", gap: 8, marginHorizontal: 20, marginVertical: 10 },
    roleTab: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background,
    },
    roleTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    roleTabGuardian: { backgroundColor: GUARDIAN_PURPLE, borderColor: GUARDIAN_PURPLE },
    roleTabText: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
    roleTabTextActive: { color: "#000" },
    roleTabTextGuardian: { color: "#fff" },

    nav: { paddingTop: 8 },
    navItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
    navIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: `${colors.foreground}10`, alignItems: "center", justifyContent: "center" },
    navLabel: { fontSize: 15, fontWeight: "500", color: colors.foreground },
    bottomSection: { paddingBottom: 24 },
  });
}
