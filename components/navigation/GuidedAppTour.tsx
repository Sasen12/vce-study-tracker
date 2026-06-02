import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { palette } from "@/constants/theme";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useAuthStore } from "@/store/authStore";
import { hasSeenAppGuide, markAppGuideSeen } from "@/utils/appGuide";

type TourRoute = "/(tabs)" | "/(tabs)/study" | "/(tabs)/calendar" | "/(tabs)/community" | "/(tabs)/more";
type RouteKey = "home" | "study" | "calendar" | "community" | "more";
type Target = { kind: "none" } | { kind: "bird" } | { kind: "tab"; index: number; routeKey: RouteKey; route: TourRoute };
type TargetRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type TourStep = {
  eyebrow: string;
  title: string;
  body: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  target: Target;
  actionHint?: string;
  route?: TourRoute;
  advanceOnRoute?: RouteKey;
};

const tourSteps: TourStep[] = [
  {
    eyebrow: "Home",
    title: "This is the Now view.",
    body: "Start here when you feel lost. Home picks the next useful study move instead of showing every feature at once.",
    icon: "view-dashboard",
    accent: palette.info,
    target: { kind: "none" },
    actionHint: "The goal is simple: one best move, then work."
  },
  {
    eyebrow: "Study",
    title: "Timer, coach, questions.",
    body: "Use Study when you are ready to do work. Timer, coach, question forge, notes and files live together.",
    icon: "timer-outline",
    accent: palette.success,
    target: { kind: "tab", index: 1, routeKey: "study", route: "/(tabs)/study" },
    actionHint: "Tap Open or the highlighted Study tab.",
    route: "/(tabs)/study",
    advanceOnRoute: "study"
  },
  {
    eyebrow: "Calendar",
    title: "Put dates here first.",
    body: "SACs, SATs, exams and study blocks belong in Calendar. Once the date is saved, Home can plan backwards.",
    icon: "calendar-month",
    accent: palette.warning,
    target: { kind: "tab", index: 2, routeKey: "calendar", route: "/(tabs)/calendar" },
    actionHint: "Tap Open or the highlighted Calendar tab.",
    route: "/(tabs)/calendar",
    advanceOnRoute: "calendar"
  },
  {
    eyebrow: "Community",
    title: "Your subjects, rooms and tournament.",
    body: "Community shows squads for subjects you actually take, subject rooms, Q&A and the weekly chess knockout bracket. Winners advance; eliminated players can still follow the board.",
    icon: "forum-outline",
    accent: palette.primary,
    target: { kind: "tab", index: 3, routeKey: "community", route: "/(tabs)/community" },
    actionHint: "Tap Open or the highlighted Community tab.",
    route: "/(tabs)/community",
    advanceOnRoute: "community"
  },
  {
    eyebrow: "More",
    title: "Extra tools live here.",
    body: "Insights, Shop, Profile, Guide and break tools are grouped behind More so the main app stays calm.",
    icon: "dots-grid",
    accent: "#60A5FA",
    target: { kind: "tab", index: 4, routeKey: "more", route: "/(tabs)/more" },
    actionHint: "Tap Open or the highlighted More tab.",
    route: "/(tabs)/more",
    advanceOnRoute: "more"
  },
  {
    eyebrow: "Study bird",
    title: "Ask without changing pages.",
    body: "Click the bird when it lands, choose Ask VCE Forge, and ask a quick question from wherever you are. If it is not your thing, hide it in Profile.",
    icon: "message-question-outline",
    accent: palette.warning,
    target: { kind: "bird" },
    actionHint: "The guide will highlight the bird when it is on screen."
  },
  {
    eyebrow: "Done",
    title: "That is the loop.",
    body: "Home tells you what matters. Study does the work. Calendar protects deadlines. Community keeps your subject squads, rooms and tournaments in one place.",
    icon: "check-circle-outline",
    accent: palette.info,
    target: { kind: "none" },
    actionHint: "Finish once. You can replay this from More."
  }
];

const POCKET_BIRD_HOST_ID = "birb-shadow-host";

const routeKeyForPath = (pathname: string): RouteKey => {
  if (pathname.includes("study")) return "study";
  if (pathname.includes("calendar")) return "calendar";
  if (pathname.includes("community")) return "community";
  if (pathname.includes("more")) return "more";
  return "home";
};

const routeForKey = (routeKey: RouteKey): TourRoute => {
  if (routeKey === "study") return "/(tabs)/study";
  if (routeKey === "calendar") return "/(tabs)/calendar";
  if (routeKey === "community") return "/(tabs)/community";
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
  const [birdTargetStyle, setBirdTargetStyle] = useState<TargetRect | null>(null);
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

  const tabTargetStyle = useMemo(() => {
    if (step.target.kind !== "tab") {
      return null;
    }

    const tabWidth = width / 5;
    const targetWidth = Math.min(168, Math.max(66, tabWidth - 18));
    return {
      left: tabWidth * step.target.index + (tabWidth - targetWidth) / 2,
      top: Math.max(0, height - 70),
      width: targetWidth,
      height: 62
    };
  }, [height, step.target, width]);

  useEffect(() => {
    if (!visible || step.target.kind !== "bird" || typeof document === "undefined") {
      setBirdTargetStyle(null);
      return;
    }

    let frame = 0;
    const updateBirdTarget = () => {
      const host = document.getElementById(POCKET_BIRD_HOST_ID);
      const bird = host?.shadowRoot?.querySelector("#birb");
      const rect = bird?.getBoundingClientRect();

      if (rect && rect.width > 0 && rect.height > 0) {
        setBirdTargetStyle({
          left: Math.max(8, rect.left - 12),
          top: Math.max(80, rect.top - 12),
          width: rect.width + 24,
          height: rect.height + 24
        });
      } else {
        setBirdTargetStyle(null);
      }

      frame = window.requestAnimationFrame(updateBirdTarget);
    };

    updateBirdTarget();
    return () => window.cancelAnimationFrame(frame);
  }, [step.target.kind, visible]);

  const targetStyle = step.target.kind === "bird" ? birdTargetStyle : tabTargetStyle;
  const dimPanels = useMemo(() => {
    if (!targetStyle) return null;
    const gap = 8;
    const top = Math.max(0, targetStyle.top - gap);
    const left = Math.max(0, targetStyle.left - gap);
    const bottomTop = Math.min(height, targetStyle.top + targetStyle.height + gap);
    const rightLeft = Math.min(width, targetStyle.left + targetStyle.width + gap);
    const cutoutHeight = Math.max(0, bottomTop - top);

    return [
      { key: "top", style: { left: 0, right: 0, top: 0, height: top } },
      { key: "bottom", style: { left: 0, right: 0, top: bottomTop, bottom: 0 } },
      { key: "left", style: { left: 0, top, width: left, height: cutoutHeight } },
      { key: "right", style: { left: rightLeft, right: 0, top, height: cutoutHeight } }
    ];
  }, [height, targetStyle, width]);
  const coachPositionStyle = useMemo(() => {
    if (!targetStyle) {
      return { bottom: 96 };
    }

    const gap = 16;
    const targetMiddle = targetStyle.top + targetStyle.height / 2;
    if (targetMiddle > height * 0.56) {
      return { bottom: Math.max(96, height - targetStyle.top + gap) };
    }

    return { top: Math.min(Math.max(96, targetStyle.top + targetStyle.height + gap), Math.max(96, height - 250)) };
  }, [height, targetStyle]);

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
      {dimPanels ? (
        dimPanels.map((panel) => <View key={panel.key} pointerEvents="none" style={[styles.dimPanel, panel.style]} />)
      ) : (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dimPanel]} />
      )}
      {targetStyle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${step.eyebrow}`}
          onPress={openTarget}
          style={[styles.spotlight, targetStyle, { borderColor: step.accent, shadowColor: step.accent }]}
        />
      ) : null}
      <View pointerEvents="auto" style={[styles.coachWrap, coachPositionStyle]}>
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
          <View style={styles.progressRail}>
            {tourSteps.map((tourStep, index) => (
              <View
                key={`${tourStep.eyebrow}-${index}`}
                style={[
                  styles.progressSegment,
                  index <= stepIndex && { backgroundColor: step.accent },
                  index === stepIndex && { flex: 1.4 }
                ]}
              />
            ))}
          </View>
          {step.actionHint ? <Text style={[styles.hint, { color: step.accent }]}>{step.actionHint}</Text> : null}
          <View style={styles.actions}>
            <Button compact mode="text" icon="close" onPress={finish}>
              Skip
            </Button>
            <Pressable accessibilityRole="button" onPress={openTarget} style={[styles.primaryAction, { backgroundColor: step.accent }]}>
              <Text style={styles.primaryActionText}>{step.route ? "Open" : isLast ? "Finish" : "Next"}</Text>
              <MaterialCommunityIcons name={step.route ? "arrow-right" : "arrow-right"} color="#03111F" size={18} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dimPanel: {
    position: "absolute",
    backgroundColor: "rgba(2, 6, 23, 0.48)"
  },
  spotlight: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 10,
    backgroundColor: "rgba(56, 189, 248, 0.03)",
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
  coachCard: {
    width: "100%",
    maxWidth: 520,
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
  progressRail: {
    flexDirection: "row",
    gap: 6
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.18)"
  },
  hint: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    lineHeight: 17
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
