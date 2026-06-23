import AsyncStorage from "@react-native-async-storage/async-storage";

const EMERGENCY_CONTACTS_KEY = "tts_emergency_contacts_v1";
const EMERGENCY_EVENTS_KEY = "tts_emergency_events_v1";
const MAX_CONTACTS = 5;

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isActive: boolean;
}

export interface EmergencyEvent {
  id: string;
  timestamp: number;
  phraseUsed: string;
  locationLat: number | null;
  locationLng: number | null;
  contactsNotified: string;
  resolved: boolean;
}

// ── Contacts ──────────────────────────────────────────────────────

export async function loadContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(EMERGENCY_CONTACTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveContacts(contacts: EmergencyContact[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EMERGENCY_CONTACTS_KEY, JSON.stringify(contacts));
  } catch {}
}

export async function addContact(
  contact: Omit<EmergencyContact, "id">
): Promise<EmergencyContact[] | null> {
  const contacts = await loadContacts();
  if (contacts.length >= MAX_CONTACTS) return null;
  const newContact: EmergencyContact = {
    ...contact,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
  };
  const updated = [...contacts, newContact];
  await saveContacts(updated);
  return updated;
}

export async function updateContact(
  id: string,
  changes: Partial<EmergencyContact>
): Promise<EmergencyContact[]> {
  const contacts = await loadContacts();
  const updated = contacts.map((c) => (c.id === id ? { ...c, ...changes } : c));
  await saveContacts(updated);
  return updated;
}

export async function deleteContact(id: string): Promise<EmergencyContact[]> {
  const contacts = await loadContacts();
  const updated = contacts.filter((c) => c.id !== id);
  await saveContacts(updated);
  return updated;
}

export async function getActiveContacts(): Promise<EmergencyContact[]> {
  const contacts = await loadContacts();
  return contacts.filter((c) => c.isActive);
}

// ── Emergency events ──────────────────────────────────────────────

export async function logEmergencyEvent(
  event: Omit<EmergencyEvent, "id">
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(EMERGENCY_EVENTS_KEY);
    const events: EmergencyEvent[] = raw ? JSON.parse(raw) : [];
    const newEvent: EmergencyEvent = {
      ...event,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    };
    const updated = [newEvent, ...events].slice(0, 200);
    await AsyncStorage.setItem(EMERGENCY_EVENTS_KEY, JSON.stringify(updated));
  } catch {}
}

export const EMERGENCY_PHRASES = [
  { emoji: "🚨", text: "I NEED HELP NOW" },
  { emoji: "🏥", text: "CALL AMBULANCE" },
  { emoji: "💊", text: "I NEED MY MEDICINE" },
  { emoji: "🤕", text: "I AM HURT" },
  { emoji: "😰", text: "I AM HAVING A PANIC ATTACK" },
  { emoji: "📞", text: "CALL MY EMERGENCY CONTACT" },
] as const;

export const RELATIONSHIPS = [
  "Parent",
  "Spouse",
  "Sibling",
  "Child",
  "Doctor",
  "Caregiver",
  "Friend",
  "Other",
];
