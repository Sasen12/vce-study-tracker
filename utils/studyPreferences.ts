import AsyncStorage from "@react-native-async-storage/async-storage";
import { STUDY_SESSION_PRESETS, type StudySessionPresetId } from "@/constants/studySessionPresets";

export type CheckInRhythmMinutes = "8" | "10" | "15";

export type StudyPreferences = {
  defaultPresetId: StudySessionPresetId;
  checkInsEnabled: boolean;
  checkInIntervalMinutes: CheckInRhythmMinutes;
  focusFilterByDefault: boolean;
  defaultAim: string;
};

export const DEFAULT_STUDY_PREFERENCES: StudyPreferences = {
  defaultPresetId: "mistake",
  checkInsEnabled: true,
  checkInIntervalMinutes: "10",
  focusFilterByDefault: false,
  defaultAim: ""
};

const allowedPresetIds = new Set(STUDY_SESSION_PRESETS.map((preset) => preset.id));
const allowedRhythms = new Set(["8", "10", "15"]);

const studyPreferencesKeyFor = (userId?: string | null) => `vce_study_preferences_${userId ?? "guest"}`;

export const normalizeStudyPreferences = (input: unknown): StudyPreferences => {
  if (!input || typeof input !== "object") return DEFAULT_STUDY_PREFERENCES;
  const value = input as Partial<StudyPreferences>;
  const defaultPresetId = allowedPresetIds.has(value.defaultPresetId as StudySessionPresetId)
    ? (value.defaultPresetId as StudySessionPresetId)
    : DEFAULT_STUDY_PREFERENCES.defaultPresetId;
  const checkInIntervalMinutes = allowedRhythms.has(value.checkInIntervalMinutes ?? "")
    ? (value.checkInIntervalMinutes as CheckInRhythmMinutes)
    : DEFAULT_STUDY_PREFERENCES.checkInIntervalMinutes;

  return {
    defaultPresetId,
    checkInsEnabled: typeof value.checkInsEnabled === "boolean" ? value.checkInsEnabled : DEFAULT_STUDY_PREFERENCES.checkInsEnabled,
    checkInIntervalMinutes,
    focusFilterByDefault:
      typeof value.focusFilterByDefault === "boolean"
        ? value.focusFilterByDefault
        : DEFAULT_STUDY_PREFERENCES.focusFilterByDefault,
    defaultAim: typeof value.defaultAim === "string" ? value.defaultAim.slice(0, 180) : DEFAULT_STUDY_PREFERENCES.defaultAim
  };
};

export const loadStudyPreferences = async (userId?: string | null): Promise<StudyPreferences> => {
  const stored = await AsyncStorage.getItem(studyPreferencesKeyFor(userId));
  if (!stored) return DEFAULT_STUDY_PREFERENCES;
  try {
    return normalizeStudyPreferences(JSON.parse(stored));
  } catch {
    return DEFAULT_STUDY_PREFERENCES;
  }
};

export const saveStudyPreferences = async (userId: string | null | undefined, preferences: StudyPreferences) => {
  const normalized = normalizeStudyPreferences(preferences);
  await AsyncStorage.setItem(studyPreferencesKeyFor(userId), JSON.stringify(normalized));
  return normalized;
};
