import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const expoEnv = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined>; }; };

export const API_URL = expoEnv.process?.env?.EXPO_PUBLIC_API_URL ?? "/api";

const NGROK_SKIP_WARNING_HEADER = "ngrok-skip-browser-warning";
const ACCESS_TOKEN_KEY = "vce_access_token";
const REFRESH_TOKEN_KEY = "vce_refresh_token";

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const getStorageItem = async (key: string) => {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
};

const setStorageItem = async (key: string, value: string) => {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const deleteStorageItem = async (key: string) => {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
};

export const getStoredAccessToken = () => getStorageItem(ACCESS_TOKEN_KEY);
export const getStoredRefreshToken = () => getStorageItem(REFRESH_TOKEN_KEY);

export const setAuthTokens = async (accessToken: string, refreshToken: string) => {
  await setStorageItem(ACCESS_TOKEN_KEY, accessToken);
  await setStorageItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearAuthTokens = async () => {
  await deleteStorageItem(ACCESS_TOKEN_KEY);
  await deleteStorageItem(REFRESH_TOKEN_KEY);
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const isJson = contentType.includes("application/json");
  const fallbackMessage =
    response.status === 404
      ? "API route not found. The backend may need to be updated or restarted."
      : "The server returned something the app could not read. Try again after the backend is restarted.";

  if (!isJson) {
    if (!response.ok) {
      throw new ApiRequestError(response.status, fallbackMessage);
    }
    throw new ApiRequestError(response.status, fallbackMessage);
  }

  let data: { message?: string } & Record<string, unknown>;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiRequestError(response.status, fallbackMessage);
  }

  if (!response.ok) {
    throw new ApiRequestError(response.status, data.message ?? "Request failed");
  }
  return data as T;
};

const refreshAccessToken = async () => {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.set(NGROK_SKIP_WARNING_HEADER, "true");

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers,
    body: JSON.stringify({ refreshToken })
  });
  if (!response.ok) {
    await clearAuthTokens();
    return null;
  }

  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  await setAuthTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
};

export const apiFetch = async <T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> => {
  const token = options.skipAuth ? null : await getStoredAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set(NGROK_SKIP_WARNING_HEADER, "true");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (response.status === 401 && retry && !options.skipAuth) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiFetch<T>(path, options, false);
    }
  }

  return parseResponse<T>(response);
};

export const apiUpload = async <T>(path: string, formData: FormData, retry = true): Promise<T> => {
  const token = await getStoredAccessToken();
  const headers = new Headers();
  headers.set(NGROK_SKIP_WARNING_HEADER, "true");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData
  });

  if (response.status === 401 && retry) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiUpload<T>(path, formData, false);
    }
  }

  return parseResponse<T>(response);
};
