import { router } from "expo-router";
import GlobalKeyShortcuts from "@/components/GlobalKeyShortcuts";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  addContact,
  deleteContact,
  loadContacts,
  RELATIONSHIPS,
  updateContact,
  type EmergencyContact,
} from "@/utils/emergency";

export default function EmergencyContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("Parent");
  const [showRelPicker, setShowRelPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadContacts().then(setContacts);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAdd = async () => {
    if (!name.trim()) { showToast("Enter a name"); return; }
    if (!phone.trim()) { showToast("Enter a phone number"); return; }
    if (contacts.length >= 5) { showToast("Maximum 5 contacts allowed"); return; }

    const result = await addContact({
      name: name.trim(),
      phone: phone.trim(),
      relationship,
      isActive: true,
    });
    if (result) {
      setContacts(result);
      setName("");
      setPhone("");
      setRelationship("Parent");
      setShowForm(false);
      showToast("Contact added ✅");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const updated = await updateContact(id, { isActive });
    setContacts(updated);
  };

  const handleDelete = async (id: string) => {
    const updated = await deleteContact(id);
    setContacts(updated);
    showToast("Contact removed");
  };

  const s = makeStyles(colors, topPad, bottomPad);

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
        <View>
          <Text style={s.headerTitle}>Emergency Contacts</Text>
          <Text style={s.headerSub}>Notified during emergencies</Text>
        </View>
        {contacts.length < 5 && (
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => setShowForm(!showForm)}
          >
            <Feather name={showForm ? "x" : "plus"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Add form */}
          {showForm && (
            <View style={s.formCard}>
              <Text style={s.formTitle}>Add Contact</Text>

              <Text style={s.fieldLabel}>Name</Text>
              <TextInput
                style={s.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
              />

              <Text style={s.fieldLabel}>Phone</Text>
              <TextInput
                style={s.textInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 000 0000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />

              <Text style={s.fieldLabel}>Relationship</Text>
              <TouchableOpacity
                style={s.relBtn}
                onPress={() => setShowRelPicker(!showRelPicker)}
              >
                <Text style={s.relBtnText}>{relationship}</Text>
                <Feather
                  name={showRelPicker ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
              {showRelPicker && (
                <View style={s.relList}>
                  {RELATIONSHIPS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[s.relOption, relationship === r && s.relOptionActive]}
                      onPress={() => { setRelationship(r); setShowRelPicker(false); }}
                    >
                      <Text style={s.relOptionText}>{r}</Text>
                      {relationship === r && (
                        <Feather name="check" size={14} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={s.saveBtn} onPress={handleAdd}>
                <Text style={s.saveBtnText}>Save Contact</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Contacts list */}
          {contacts.length === 0 && !showForm ? (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Feather name="users" size={32} color="#FF6B6B" />
              </View>
              <Text style={s.emptyTitle}>No contacts yet</Text>
              <Text style={s.emptySub}>
                Add contacts who will be{"\n"}notified in an emergency
              </Text>
              <TouchableOpacity
                style={s.emptyAddBtn}
                onPress={() => setShowForm(true)}
              >
                <Text style={s.emptyAddBtnText}>Add First Contact</Text>
              </TouchableOpacity>
            </View>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={s.contactCard}>
                <View style={s.contactAvatar}>
                  <Text style={s.contactAvatarText}>
                    {contact.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={s.contactInfo}>
                  <Text style={s.contactName}>{contact.name}</Text>
                  <Text style={s.contactPhone}>{contact.phone}</Text>
                  <View style={s.contactRelBadge}>
                    <Text style={s.contactRelText}>{contact.relationship}</Text>
                  </View>
                </View>
                <View style={s.contactActions}>
                  <Switch
                    value={contact.isActive}
                    onValueChange={(v) => handleToggle(contact.id, v)}
                    trackColor={{ false: colors.border, true: "#4ECDC4" }}
                    thumbColor="#FFFFFF"
                  />
                  <TouchableOpacity
                    style={s.deleteBtn}
                    onPress={() => handleDelete(contact.id)}
                  >
                    <Feather name="trash-2" size={16} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {contacts.length > 0 && (
            <Text style={s.footerNote}>
              {contacts.filter((c) => c.isActive).length} of {contacts.length} contacts active
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toast */}
      {toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
      <GlobalKeyShortcuts />
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  topPad: number,
  _bottomPad: number
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
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
      fontSize: 16,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    headerSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    addBtn: {
      marginLeft: "auto",
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#FF6B6B",
      alignItems: "center",
      justifyContent: "center",
    },

    // Form
    formCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginBottom: 16,
    },
    formTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 16,
    },
    fieldLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      marginBottom: 6,
      marginTop: 12,
    },
    textInput: {
      backgroundColor: colors.secondary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      borderWidth: 1,
      borderColor: colors.border,
    },
    relBtn: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.secondary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    relBtnText: {
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    relList: {
      marginTop: 4,
      borderRadius: 10,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    relOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
    },
    relOptionActive: { backgroundColor: colors.secondary },
    relOptionText: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    saveBtn: {
      marginTop: 18,
      height: 48,
      backgroundColor: "#4ECDC4",
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: "#FFFFFF",
      fontFamily: "Inter_600SemiBold",
    },

    // Contacts
    contactCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      gap: 12,
    },
    contactAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,107,107,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    contactAvatarText: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: "#FF6B6B",
      fontFamily: "Inter_700Bold",
    },
    contactInfo: { flex: 1 },
    contactName: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    contactPhone: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    contactRelBadge: {
      marginTop: 4,
      alignSelf: "flex-start",
      backgroundColor: colors.secondary,
      borderRadius: 100,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    contactRelText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    contactActions: {
      alignItems: "center",
      gap: 10,
    },
    deleteBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },

    // Empty state
    emptyState: {
      alignItems: "center",
      paddingVertical: 48,
      gap: 12,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "rgba(255,107,107,0.1)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    emptySub: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 20,
    },
    emptyAddBtn: {
      marginTop: 8,
      height: 48,
      paddingHorizontal: 24,
      backgroundColor: "#FF6B6B",
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyAddBtnText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: "#FFFFFF",
      fontFamily: "Inter_600SemiBold",
    },

    footerNote: {
      textAlign: "center",
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 8,
    },

    // Toast
    toast: {
      position: "absolute",
      bottom: _bottomPad + 20,
      alignSelf: "center",
      backgroundColor: "#1E2338",
      borderRadius: 100,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toastText: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
  });
}
