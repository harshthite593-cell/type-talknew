import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE, useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

interface UserCard {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  bio: string | null;
  friendshipStatus?: "none" | "pending_sent" | "pending_received" | "accepted";
}

type Tab = "discover" | "friends";

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, isGuest, profile } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [tab, setTab] = useState<Tab>("discover");
  const [users, setUsers] = useState<UserCard[]>([]);
  const [friends, setFriends] = useState<UserCard[]>([]);
  const [pending, setPending] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token ?? ""}` };

  const loadDiscover = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/browse`, { headers });
      if (res.ok) setUsers(await res.json() as UserCard[]);
    } catch { showToast("Could not load users"); }
    setLoading(false);
  }, [token]);

  const loadFriends = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/friends`, { headers });
      if (res.ok) {
        const data = await res.json() as { accepted: UserCard[]; pending: UserCard[] };
        setFriends(data.accepted);
        setPending(data.pending);
      }
    } catch { showToast("Could not load friends"); }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (tab === "discover") loadDiscover();
    else loadFriends();
  }, [tab, loadDiscover, loadFriends]);

  const sendRequest = async (userId: string) => {
    if (!token) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: "POST", headers, body: JSON.stringify({ receiverId: userId }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, friendshipStatus: "pending_sent" } : u));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Friend request sent! 👋");
      } else {
        const d = await res.json() as { error?: string };
        showToast(d.error ?? "Could not send request");
      }
    } catch { showToast("Connection error"); }
    setActionLoading(null);
  };

  const acceptRequest = async (userId: string) => {
    if (!token) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`${API_BASE}/friends/${userId}/accept`, { method: "PATCH", headers });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Friend accepted! 🎉");
        loadFriends();
      }
    } catch { showToast("Connection error"); }
    setActionLoading(null);
  };

  const s = makeStyles(colors, topPad, bottomPad);

  const renderUser = ({ item }: { item: UserCard }) => {
    const initials = item.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const isRequesting = actionLoading === item.id;
    return (
      <View style={s.userCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={s.userInfo}>
          <Text style={s.userName}>{item.name}</Text>
          <Text style={s.userMeta}>
            {[item.age && `${item.age} yrs`, item.gender].filter(Boolean).join(" · ")}
          </Text>
          {item.bio ? <Text style={s.userBio} numberOfLines={2}>{item.bio}</Text> : null}
        </View>
        {tab === "discover" && (
          <TouchableOpacity
            style={[
              s.addBtn,
              item.friendshipStatus === "pending_sent" && s.addBtnSent,
              item.friendshipStatus === "accepted" && s.addBtnAccepted,
            ]}
            onPress={() => item.friendshipStatus === "none" && sendRequest(item.id)}
            disabled={item.friendshipStatus !== "none" || isRequesting}
          >
            {isRequesting ? <ActivityIndicator size="small" color={colors.primary} /> : (
              <Feather
                name={item.friendshipStatus === "accepted" ? "check" : item.friendshipStatus === "pending_sent" ? "clock" : "user-plus"}
                size={16}
                color={item.friendshipStatus === "none" ? colors.primary : colors.mutedForeground}
              />
            )}
          </TouchableOpacity>
        )}
        {tab === "friends" && item.friendshipStatus === "pending_received" && (
          <TouchableOpacity style={s.acceptBtn} onPress={() => acceptRequest(item.id)} disabled={isRequesting}>
            {isRequesting ? <ActivityIndicator size="small" color="#000" /> : (
              <Text style={s.acceptBtnText}>Accept</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const listData = tab === "discover" ? users : [...pending, ...friends];

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
        <Text style={s.headerTitle}>Friends</Text>
        <View style={s.backBtn} />
      </View>

      {/* Guest wall */}
      {isGuest && (
        <View style={s.guestWall}>
          <Feather name="users" size={40} color={colors.mutedForeground} />
          <Text style={s.guestTitle}>Create an account to make friends</Text>
          <Text style={s.guestSub}>The friends feature requires a free account so others can find you.</Text>
          <TouchableOpacity style={s.guestBtn} onPress={() => router.replace("/login")}>
            <Text style={s.guestBtnText}>Sign up — it's free</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isGuest && (
        <>
          {/* Profile preview */}
          {profile && (
            <View style={s.myProfile}>
              <Feather name="user-check" size={14} color={colors.primary} />
              <Text style={s.myProfileText}>
                You · {profile.age} yrs · {profile.gender}
              </Text>
            </View>
          )}

          {/* Tabs */}
          <View style={s.tabBar}>
            {(["discover", "friends"] as Tab[]).map(t => (
              <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                  {t === "discover" ? "Discover" : `Friends${pending.length > 0 && tab !== "friends" ? ` (${pending.length})` : ""}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={s.loader}><ActivityIndicator color={colors.primary} size="large" /></View>
          ) : listData.length === 0 ? (
            <View style={s.empty}>
              <Feather name={tab === "discover" ? "users" : "heart"} size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>{tab === "discover" ? "No users found yet" : "No friends yet"}</Text>
              <Text style={s.emptySub}>{tab === "discover" ? "Check back soon as more users join" : "Discover people and send friend requests"}</Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={i => i.id}
              renderItem={renderUser}
              contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 16 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            />
          )}
        </>
      )}

      {toast && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, _bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: topPad + 12, paddingBottom: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    myProfile: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
    myProfileText: { fontSize: 13, color: colors.mutedForeground },
    tabBar: { flexDirection: "row", marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
    tabTextActive: { color: "#000" },
    loader: { flex: 1, alignItems: "center", justifyContent: "center" },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
    emptyText: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    emptySub: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 19 },
    userCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.primary}30`, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 15, fontWeight: "700", color: colors.primary },
    userInfo: { flex: 1 },
    userName: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    userMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
    userBio: { fontSize: 12, color: colors.mutedForeground, marginTop: 4, lineHeight: 16 },
    addBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
    addBtnSent: { borderColor: colors.mutedForeground },
    addBtnAccepted: { borderColor: colors.mutedForeground, backgroundColor: `${colors.primary}20` },
    acceptBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    acceptBtnText: { fontSize: 13, fontWeight: "700", color: "#000" },
    guestWall: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
    guestTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, textAlign: "center" },
    guestSub: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 19 },
    guestBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 13, marginTop: 8 },
    guestBtnText: { fontSize: 15, fontWeight: "700", color: "#000" },
    toast: { position: "absolute", bottom: 40, alignSelf: "center", backgroundColor: colors.card, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
    toastText: { fontSize: 13, color: colors.foreground },
  });
}
