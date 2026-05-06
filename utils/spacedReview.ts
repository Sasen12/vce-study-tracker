import AsyncStorage from "@react-native-async-storage/async-storage";

export type ReviewQuality = "again" | "good" | "easy";

export type ReviewState = {
  dueAt: string;
  reviewedAt: string;
  intervalIndex: number;
  repetitions: number;
  lapses: number;
};

export type ReviewStatus = {
  due: boolean;
  dueAt: string;
  reviewedAt?: string;
  repetitions: number;
  label: string;
  intervalLabel: string;
};

export type ReviewStateMap = Record<string, ReviewState>;

const storageKey = "vce-study-tracker:spaced-review:v1";
const intervalDays = [1, 3, 7, 14, 30, 60];

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));

export const loadReviewStates = async (): Promise<ReviewStateMap> => {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const saveReviewStates = (states: ReviewStateMap) => AsyncStorage.setItem(storageKey, JSON.stringify(states));

export const getReviewStatus = (key: string, createdAt: string, states: ReviewStateMap): ReviewStatus => {
  const state = states[key];
  const dueAt = state?.dueAt ?? createdAt;
  const due = new Date(dueAt).getTime() <= Date.now();
  const nextInterval = intervalDays[Math.min((state?.intervalIndex ?? -1) + 1, intervalDays.length - 1)];

  return {
    due,
    dueAt,
    reviewedAt: state?.reviewedAt,
    repetitions: state?.repetitions ?? 0,
    label: state ? (due ? "Due now" : `Next ${formatDate(dueAt)}`) : "New review",
    intervalLabel: state ? `${state.repetitions} review${state.repetitions === 1 ? "" : "s"}` : `First pass, then ${nextInterval}d`
  };
};

export const nextReviewState = (current: ReviewState | undefined, quality: ReviewQuality): ReviewState => {
  const now = new Date();
  const currentIndex = current?.intervalIndex ?? -1;
  const intervalIndex =
    quality === "again" ? 0 : Math.min(currentIndex + (quality === "easy" ? 2 : 1), intervalDays.length - 1);
  const dueAt = addDays(now, intervalDays[intervalIndex]);

  return {
    dueAt: dueAt.toISOString(),
    reviewedAt: now.toISOString(),
    intervalIndex,
    repetitions: (current?.repetitions ?? 0) + 1,
    lapses: (current?.lapses ?? 0) + (quality === "again" ? 1 : 0)
  };
};

export const reviewKeyFor = (kind: "flashcard" | "question", id: string) => `${kind}:${id}`;
