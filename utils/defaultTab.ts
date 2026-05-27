import AsyncStorage from "@react-native-async-storage/async-storage";

export type DefaultTabId = "home" | "study" | "calendar" | "community" | "more";
export type DefaultTabRoute =
  | "/(tabs)"
  | "/(tabs)/study"
  | "/(tabs)/calendar"
  | "/(tabs)/community"
  | "/(tabs)/more";

export type DefaultTabOption = {
  id: DefaultTabId;
  label: string;
  route: DefaultTabRoute;
  icon: string;
  description: string;
};

export const DEFAULT_TAB_OPTIONS: DefaultTabOption[] = [
  {
    id: "home",
    label: "Home",
    route: "/(tabs)",
    icon: "view-dashboard",
    description: "Dashboard brief"
  },
  {
    id: "study",
    label: "Study",
    route: "/(tabs)/study",
    icon: "timer-outline",
    description: "Timer and questions"
  },
  {
    id: "calendar",
    label: "Calendar",
    route: "/(tabs)/calendar",
    icon: "calendar-month",
    description: "Deadlines first"
  },
  {
    id: "community",
    label: "Community",
    route: "/(tabs)/community",
    icon: "forum-outline",
    description: "Chat and board"
  },
  {
    id: "more",
    label: "More",
    route: "/(tabs)/more",
    icon: "dots-grid",
    description: "Account and extras"
  }
];

const defaultTabIds = new Set(DEFAULT_TAB_OPTIONS.map((option) => option.id));
const legacyMoreTabs = new Set(["insights", "shop", "profile"]);

const defaultTabKeyFor = (userId?: string | null) => `vce_default_tab_${userId ?? "guest"}`;

export const normalizeDefaultTab = (value?: string | null): DefaultTabId =>
  defaultTabIds.has(value as DefaultTabId)
    ? (value as DefaultTabId)
    : value === "questions"
      ? "study"
      : legacyMoreTabs.has(value ?? "")
        ? "more"
        : "home";

export const defaultTabRouteFor = (tab?: string | null): DefaultTabRoute => {
  const normalized = normalizeDefaultTab(tab);
  return DEFAULT_TAB_OPTIONS.find((option) => option.id === normalized)?.route ?? "/(tabs)";
};

export const defaultTabLabelFor = (tab?: string | null) => {
  const normalized = normalizeDefaultTab(tab);
  return DEFAULT_TAB_OPTIONS.find((option) => option.id === normalized)?.label ?? "Home";
};

export const loadDefaultTab = async (userId?: string | null): Promise<DefaultTabId> => {
  const stored = await AsyncStorage.getItem(defaultTabKeyFor(userId));
  return normalizeDefaultTab(stored);
};

export const saveDefaultTab = async (userId: string | null | undefined, tab: DefaultTabId) => {
  await AsyncStorage.setItem(defaultTabKeyFor(userId), normalizeDefaultTab(tab));
};
