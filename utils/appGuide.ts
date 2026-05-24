import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultTabRouteFor, loadDefaultTab, type DefaultTabRoute } from "@/utils/defaultTab";

const APP_GUIDE_VERSION = "v3";
export type InitialAppRoute = DefaultTabRoute | "/(tabs)/onboarding";

export const appGuideKeyFor = (userId?: string | null) => `vce_app_guide_seen_${APP_GUIDE_VERSION}_${userId ?? "guest"}`;

export const hasSeenAppGuide = async (userId?: string | null) => {
  const value = await AsyncStorage.getItem(appGuideKeyFor(userId));
  return value === "seen";
};

export const markAppGuideSeen = async (userId?: string | null) => {
  await AsyncStorage.setItem(appGuideKeyFor(userId), "seen");
};

export const initialAppRouteFor = async (userId?: string | null): Promise<InitialAppRoute> => {
  const [defaultTab, guideSeen] = await Promise.all([loadDefaultTab(userId), hasSeenAppGuide(userId)]);
  return guideSeen ? defaultTabRouteFor(defaultTab) : "/(tabs)/onboarding";
};
