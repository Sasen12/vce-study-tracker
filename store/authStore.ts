import { create } from "zustand";
import { apiFetch, clearAuthTokens, getStoredAccessToken, setAuthTokens } from "@/services/api";
import type { User } from "@/types";

type RegisterSubject = {
  subjectName: string;
  unit: string;
  targetScore?: number | null;
  color: string;
};

type AuthState = {
  user: User | null;
  authReady: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string>;
  resetPassword: (token: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    schoolName?: string | null;
    subjects: RegisterSubject[];
  }) => Promise<void>;
  setWeeklyDigestPreference: (optIn: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authReady: false,
  loading: false,
  error: null,
  hydrate: async () => {
    const token = await getStoredAccessToken();
    if (!token) {
      set({ authReady: true, user: null });
      return;
    }

    try {
      const data = await apiFetch<{ user: User }>("/auth/me");
      set({ user: data.user, authReady: true, error: null });
    } catch {
      await clearAuthTokens();
      set({ user: null, authReady: true });
    }
  },
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        skipAuth: true,
        body: { email, password }
      });
      await setAuthTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "Login failed" });
      throw error;
    }
  },
  requestPasswordReset: async (email) => {
    const data = await apiFetch<{ ok: boolean; message: string }>("/auth/password-reset/request", {
      method: "POST",
      skipAuth: true,
      body: { email }
    });
    return data.message;
  },
  resetPassword: async (token, password) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<AuthResponse>("/auth/password-reset/confirm", {
        method: "POST",
        skipAuth: true,
        body: { token, password }
      });
      await setAuthTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "Password reset failed" });
      throw error;
    }
  },
  register: async (input) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        skipAuth: true,
        body: input
      });
      await setAuthTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, loading: false, error: null });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "Registration failed" });
      throw error;
    }
  },
  setWeeklyDigestPreference: async (optIn) => {
    const data = await apiFetch<{ user: User }>("/auth/me/preferences", {
      method: "PATCH",
      body: { weeklyDigestOptIn: optIn }
    });
    set({ user: data.user });
  },
  logout: async () => {
    await clearAuthTokens();
    set({ user: null, error: null });
  }
}));
