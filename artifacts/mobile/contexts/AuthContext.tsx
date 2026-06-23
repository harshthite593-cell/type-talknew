import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const AUTH_TOKEN_KEY = "typetalk_auth_token";
const AUTH_USER_KEY = "typetalk_auth_user";
const GUEST_KEY = "typetalk_is_guest";
const PROFILE_KEY = "typetalk_profile";
const PHOTO_KEY = "typetalk_profile_photo";
const PROFILE_SEEN_KEY = "typetalk_profile_seen";
const ROLE_KEY = "typetalk_role";

const domain = process.env["EXPO_PUBLIC_DOMAIN"];
const API_BASE = domain
  ? `https://${domain}/api`
  : (process.env["EXPO_PUBLIC_API_BASE_URL"] ?? "http://localhost:8080/api");

export { API_BASE };

export type UserRole = "user" | "guardian";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface UserProfile {
  name: string;
  age: number;
  gender: string;
  birthDate: string;
  bio?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isGuest: boolean;
  profile: UserProfile | null;
  profileSeen: boolean;
  role: UserRole;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  continueAsGuest: () => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<string | null>;
  skipProfile: () => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, isGuest: false, profile: null, profileSeen: false, role: "user", loading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const [token, userRaw, guestRaw, profileRaw, seenRaw, roleRaw] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
          AsyncStorage.getItem(GUEST_KEY),
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(PROFILE_SEEN_KEY),
          AsyncStorage.getItem(ROLE_KEY),
        ]);
        const profile: UserProfile | null = profileRaw ? JSON.parse(profileRaw) : null;
        const profileSeen = seenRaw === "true" || !!profile;
        const role: UserRole = (roleRaw === "guardian") ? "guardian" : "user";
        if (token && userRaw) {
          setState({ user: JSON.parse(userRaw) as AuthUser, token, isGuest: false, profile, profileSeen, role, loading: false });
        } else if (guestRaw === "true") {
          setState({ user: null, token: null, isGuest: true, profile, profileSeen, role, loading: false });
        } else {
          setState({ user: null, token: null, isGuest: false, profile: null, profileSeen: false, role: "user", loading: false });
        }
      } catch {
        setState({ user: null, token: null, isGuest: false, profile: null, profileSeen: false, role: "user", loading: false });
      }
    })();
  }, []);

  const persistAuth = useCallback(async (token: string, user: AuthUser) => {
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user)),
      AsyncStorage.removeItem(GUEST_KEY),
    ]);
    setState(prev => ({ ...prev, user, token, isGuest: false, loading: false }));
  }, []);

  const setRole = useCallback(async (role: UserRole) => {
    await AsyncStorage.setItem(ROLE_KEY, role);
    setState(prev => ({ ...prev, role }));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; profile?: UserProfile; error?: string };
      if (!res.ok) return data.error ?? "Login failed";
      const profile: UserProfile | null = data.profile ?? null;
      if (profile) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      await persistAuth(data.token!, data.user!);
      setState(prev => ({ ...prev, profile }));
      return null;
    } catch {
      return "Could not connect to server. Check your connection.";
    }
  }, [persistAuth]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok) return data.error ?? "Registration failed";
      await persistAuth(data.token!, data.user!);
      return null;
    } catch {
      return "Could not connect to server. Check your connection.";
    }
  }, [persistAuth]);

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, "true");
    setState(prev => ({ ...prev, isGuest: true, loading: false }));
  }, []);

  const skipProfile = useCallback(async () => {
    await AsyncStorage.setItem(PROFILE_SEEN_KEY, "true");
    setState(prev => ({ ...prev, profileSeen: true }));
  }, []);

  const updateProfile = useCallback(async (profile: UserProfile): Promise<string | null> => {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    await AsyncStorage.setItem(PROFILE_SEEN_KEY, "true");
    setState(prev => ({ ...prev, profile, profileSeen: true }));
    const tokenRaw = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (tokenRaw) {
      try {
        await fetch(`${API_BASE}/auth/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenRaw}` },
          body: JSON.stringify(profile),
        });
      } catch { /* ignore */ }
    }
    return null;
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
      AsyncStorage.removeItem(GUEST_KEY),
      AsyncStorage.removeItem(PROFILE_KEY),
      AsyncStorage.removeItem(PROFILE_SEEN_KEY),
      AsyncStorage.removeItem(ROLE_KEY),
    ]);
    setState({ user: null, token: null, isGuest: false, profile: null, profileSeen: false, role: "user", loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, continueAsGuest, updateProfile, skipProfile, logout, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
