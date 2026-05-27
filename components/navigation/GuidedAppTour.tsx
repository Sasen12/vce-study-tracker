import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { palette } from "@/constants/theme";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useAuthStore } from "@/store/authStore";
import { hasSeenAppGuide, markAppGuideSeen } from "@/utils/appGuide";

type TourRoute = "/(tabs)" | "/(tabs)/study" | "/(tabs)/calendar" | "/(tabs)/insights" | "/(tabs)/more";
type RouteKey = "home" | "study" | "calendar" | "insights" | "more";
type Target =
  | { kind: "content"; screen: RouteKey }
  | { kind: "tab"; index: number; routeKey: RouteKey; route: TourRoute };

type TourStep = {
  eyebrow: string;
  title: string;
  body: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  target: Target;
  route?: TourRoute;
  advanceOnRoute?: RouteKey;
};

const tourSteps: TourStep[] = [
  {
    eyebrow: "Home",
    title: "Start with one decision.",
    body: "Home is the calm version of the dashboard. It should answer: what deserves attention right now?",
    icon: "view-dashboard",
    accent: palette.info,
    target: { kind: "content", screen: "home" }
  },
  {
    eyebrow: "Tap Study",
    title: "Open the work room.",
    body: "The timer, coach, notes and files live behind Study. Tap the Study tab to continue.",
    icon: "timer-outline",
    accent: palette.success,
    target: { kind: "tab", index: 1, routeKey: "study", route: "/(tabs)/study" },
    route: "/(tabs)/study",
    advanceOnRoute: "study"
  },
  {
    eyebrow: "Study",
    title: "One focused block creates evidence.",
    body: "Use the timer first. The app learns from real sessions, not from a giant setup form.",
    icon: "timer-play-outline",
    accent: palette.success,
    target: { kind: "content", screen: "study" }
  },
  {
    eyebrow: "Tap Calendar",
    title: "Show the app what is coming.",
    body: "SAC dates and exam pressure belong in Calendar. Tap Calendar to continue.",
    icon: "calendar-month",
    accent: palette.warning,
    target: { kind: "tab", index: 2, routeKey: "calendar", route: "/(tabs)/calendar" },
    route: "/(tabs)/calendar",
    advanceOnRoute: "calendar"
  },
  {
    eyebrow: "Calendar",
    title: "Deadlines become plans.",
    body: "Once dates are here, Home can plan backwards instead of guessing.",
    icon: "calendar-alert",
    accent: palette.warning,
    target: { kind: "content", screen: "calendar" }
  },
  {
    eyebrow: "Tap Insights",
    title: "Find the weak spots.",
    body: "Insights is the Student Map: strengths, weak areas and what the app has learned. Tap Insights to continue.",
    icon: "map-search-outline",
    accent: palette.primary,
    target: { kind: "tab", index: 3, routeKey: "insights", route: "/(tabs)/insights" },
    route: "/(tabs)/insights",
    advanceOnRoute: "insights"
  },
  {
    eyebrow: "Insights",
    title: "Less guessing. More evidence.",
    body: "This is where repeated mistakes and useful patterns become visible.",
    icon: "map-search-outline",
    accent: palette.primary,
    target: { kind: "content", screen: "insights" }
  },
  {
    eyebrow: "Tap More",
    title: "Extra tools stay out of the way.",
    body: "Questions, Community, Shop, Profile and Guide are still here, just grouped behind More. Tap More to finish.",
    icon: "dots-grid",
    accent: "#60A5FA",
    target: { kind: "tab", index: 4, routeKey: "more", route: "/(tabs)/more" },
    route: "/(tabs)/more",
    advanceOnRoute: "more"
  },
  {
    eyebrow: "More",
    title: "Power tools when you need them.",
    body: "The advanced features are available without shouting at you every time you open the app.",
    icon: "dots-grid",
    accent: "#60A5FA",
    target: { kind: "content", screen: "more" }
  }
];

const routeKeyForPath = (pathname: string): RouteKey => {
  if (pathname.includes("study")) return "study";
  if (pathname.includes("calendar")) return "calendar";
  if (pathname.includes("insights")) return "insights";
  if (pathname.includes("more")) return "more";
  return "home";
};

const routeForKey = (routeKey: RouteKey): TourRoute => {
  if (routeKey === "study") return "/(tabs)/study";
  if (routeKey === "calendar") return "/(tabs)/calendar";
  if (routeKey === "insights") return "/(tabs)/insights";
  if (routeKey === "more") return "/(tabs)/more";
  return "/(tabs)";
};

export function GuidedAppTour() {
  const activePalette = useActivePalette();
  const userId = useAuthStore((state) => state.user?.id);
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ guide?: string }>();
  const { width, height } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const currentRouteKey = routeKeyForPath(pathname);
  const step = tourSteps[stepIndex] ?? tourSteps[0];
  const isLast = stepIndex >= tourSteps.length - 1;
  const guideParam = Array.isArray(params.guide) ? params.guide[0] : params.guide;

  useEffect(() => {
    let active = true;
    if (guideParam === "1") {
      setStepIndex(0);
      setVisible(true);
      router.replace("/(tabs)");
      return () => {
        active = false;
      };
    }

    hasSeenAppGuide(userId).then((seen) => {
      if (!active || seen) return;
      setStepIndex(0);
      setVisible(true);
      router.replace("/(tabs)");
    });

    return () => {
      active = false;
    };
  }, [guideParam, userId]);

  useEffect(() => {
    if (!visible || !step.advanceOnRoute || currentRouteKey !== step.advanceOnRoute) return;
    const timeout = setTimeout(() => setStepIndex((value) => Math.min(value + 1, tourSteps.length - 1)), 240);
    return () => clearTimeout(timeout);
  }, [currentRouteKey, step.advanceOnRoute, visible]);

  const targetStyle = useMemo(() => {
    if (step.target.kind === "tab") {
      const tabWidth = width / 5;
      return {
        left: tabWidth * step.target.index + 8,
        width: Math.max(54, tabWidth - 16),
        height: 62,
        bottom: 8
      };
    }

    const contentWidth = Math.min(width - 32, 760);
    const contentLeft = Math.max(16, (width - contentWidth) / 2);
    const compact = width < 720;
    const topByScreen: Record<RouteKey, number> = {
      home: compact ? 150 : 170,
      study: compact ? 260 : 310,
      calendar: compact ? 210 : 270,
      insights: compact ? 210 : 250,
      more: compact ? 125 : 145
    };
    const heightByScreen: Record<RouteKey, number> = {
      home: compact ? 250 : 290,
      study: compact ? 260 : 340,
      calendar: compact ? 230 : 300,
      insights: compact ? 230 : 300,
      more: compact ? 320 : 360
    };

    return {
      left: contentLeft,
      width: contentWidth,
      top: topByScreen[step.target.screen],
      height: Math.min(heightByScreen[step.target.screen], height - 230)
    };
  }, [height, step.target, width]);

  const cardAtTop = step.target.kind === "tab";

  const finish = async () => {
    await markAppGuideSeen(userId);
    setVisible(false);
    router.replace(routeForKey(currentRouteKey));
  };

  const next = () => {
    if (isLast) {
      void finish();
      return;
    }
    setStepIndex((value) => Math.min(value + 1, tourSteps.length - 1));
  };

  const openTarget = () => {
    if (step.route) {
      router.push(step.route);
      return;
    }
    next();
  };

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]} />
      <View pointerEvents="none" style={[styles.spotlight, targetStyle, { borderColor: step.accent, shadowColor: step.accent }]} />
      <View pointerEvents="auto" style={[styles.coachWrap, cardAtTop ? styles.coachTop : styles.coachBottom]}>
        <View style={[styles.coachCard, { backgroundColor: activePalette.surface, borderColor: `${step.accent}88` }]}>
          <View style={styles.coachHeader}>
            <View style={[styles.iconBox, { backgroundColor: `${step.accent}18` }]}>
              <MaterialCommunityIcons name={step.icon} color={step.accent} size={22} />
            </View>
            <View style={styles.flexText}>
              <Text style={[styles.eyebrow, { color: step.accent }]}>{step.eyebrow}</Text>
              <Text style={styles.title}>{step.title}</Text>
            </View>
            <Text style={styles.count}>
              {stepIndex + 1}/{tourSteps.length}
            </Text>
          </View>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.actions}>
            <Button compact mode="text" icon="close" onPress={finish}>
              Skip
            </Button>
            <Pressable accessibilityRole="button" onPress={openTarget} style={[styles.primaryAction, { backgroundColor: step.accent }]}>
              <Text style={styles.primaryActionText}>{step.route ? "Open" : isLast ? "Finish" : "Next"}</Text>
              <MaterialCommunityIcons name={step.route ? "cursor-default-click-outline" : "arrow-right"} color="#03111F" size={18} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    backgroundColor: "rgba(2, 6, 23, 0.58)"
  },
  spotlight: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.06)",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 }
  },
  coachWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center"
  },
  coachTop: {
    top: 18
  },
  coachBottom: {
    bottom: 96
  },
  coachCard: {
    width: "100%",
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 12
  },
  coachHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  flexText: {
    flex: 1
  },
  eyebrow: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    textTransform: "uppercase"
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 23
  },
  count: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  body: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 21
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  primaryAction: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryActionText: {
    color: "#03111F",
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  }
});
