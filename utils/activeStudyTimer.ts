import AsyncStorage from "@react-native-async-storage/async-storage";

export const activeTimerStoragePrefix = "vce_active_study_timer_v1";
export const maxBackgroundTimerSeconds = 8 * 60 * 60;

export type StoredActiveTimer = {
  userId?: string;
  subjectId: string;
  studyTopic: string;
  sessionGoal: string;
  targetMinutes: string;
  checkInsEnabled: boolean;
  checkInIntervalMinutes: string;
  timerBonusXp: number;
  nextCheckpointAt: number;
  focusMode: boolean;
  externalWorkMode?: boolean;
  startedAtMs: number;
  elapsedBeforeRun: number;
};

export const activeTimerStorageKey = (userId?: string | null) => `${activeTimerStoragePrefix}:${userId ?? "local"}`;

export const clearStoredActiveTimer = (userId?: string | null) =>
  AsyncStorage.removeItem(activeTimerStorageKey(userId)).catch(() => undefined);

export const writeStoredActiveTimer = (userId: string | null | undefined, payload: StoredActiveTimer) =>
  AsyncStorage.setItem(activeTimerStorageKey(userId), JSON.stringify(payload)).catch(() => undefined);

export const readStoredActiveTimer = async (userId?: string | null) => {
  const raw = await AsyncStorage.getItem(activeTimerStorageKey(userId)).catch(() => null);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredActiveTimer>;
    if (
      typeof parsed.subjectId !== "string" ||
      typeof parsed.startedAtMs !== "number" ||
      typeof parsed.elapsedBeforeRun !== "number"
    ) {
      await clearStoredActiveTimer(userId);
      return null;
    }

    const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - parsed.startedAtMs) / 1000));
    if (parsed.elapsedBeforeRun + elapsedSinceStart > maxBackgroundTimerSeconds + 60) {
      await clearStoredActiveTimer(userId);
      return null;
    }

    return parsed as StoredActiveTimer;
  } catch {
    await clearStoredActiveTimer(userId);
    return null;
  }
};

export const hasRecoverableActiveTimer = async (userId?: string | null) => Boolean(await readStoredActiveTimer(userId));
