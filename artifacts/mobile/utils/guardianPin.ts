import AsyncStorage from "@react-native-async-storage/async-storage";

const PIN_KEY = "typetalk_guardian_pin";

export async function hasGuardianPin(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PIN_KEY);
    return val !== null && val.length === 4;
  } catch {
    return false;
  }
}

export async function verifyGuardianPin(pin: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(PIN_KEY);
    return stored === pin;
  } catch {
    return false;
  }
}

export async function saveGuardianPin(pin: string): Promise<void> {
  await AsyncStorage.setItem(PIN_KEY, pin);
}

export async function clearGuardianPin(): Promise<void> {
  await AsyncStorage.removeItem(PIN_KEY);
}
