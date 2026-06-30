import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, Text } from "react-native-paper";
import Animated from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { Screen } from "@/components/ui/Screen";
import { motion } from "@/constants/motion";
import { palette } from "@/constants/theme";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useTrackScreen } from "@/hooks/useTrackScreen";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type MainRoute = "/(tabs)/insights" | "/(tabs)/shop" | "/(tabs)/profile" | "/(tabs)/study";
type HelperCategory = "Pinned" | "SAC" | "Exam" | "Reset";

const mainRooms: {
  title: string;
  detail: string;
  icon: IconName;
  accent: string;
  route?: MainRoute;
  action?: "guide" | "chess";
}[] = [
  {
    title: "Insights",
    detail: "Weak spots and evidence",
    icon: "map-search-outline",
    accent: palette.primary,
    route: "/(tabs)/insights"
  },
  {
    title: "Profile",
    detail: "Subjects and defaults",
    icon: "account-circle-outline",
    accent: "#60A5FA",
    route: "/(tabs)/profile"
  },
  {
    title: "Shop",
    detail: "Themes and badges",
    icon: "shopping-outline",
    accent: palette.success,
    route: "/(tabs)/shop"
  },
  {
    title: "Guide",
    detail: "Restart the app tour",
    icon: "compass-outline",
    accent: palette.warning,
    action: "guide"
  },
  {
    title: "Chess break",
    detail: "Short study reset",
    icon: "chess-knight",
    accent: palette.info,
    action: "chess"
  }
];

const studyMissions = [
  {
    label: "10 minute repair",
    title: "Fix one mistake properly.",
    detail: "Pick a recent mistake, rewrite the rule, then do one similar question.",
    icon: "wrench-outline" as IconName,
    accent: palette.secondary
  },
  {
    label: "SAC pressure check",
    title: "Find the next date that can hurt you.",
    detail: "Open Calendar, pick the closest SAC, and plan one block backwards from it.",
    icon: "calendar-alert" as IconName,
    accent: palette.warning
  },
  {
    label: "Low energy mode",
    title: "Make one clean note.",
    detail: "Turn one messy page into five bullet points. No perfection, just usable evidence.",
    icon: "note-edit-outline" as IconName,
    accent: palette.success
  },
  {
    label: "Question forge",
    title: "Make the topic answer back.",
    detail: "Generate or save three questions from the topic you keep avoiding.",
    icon: "cards-outline" as IconName,
    accent: palette.primary
  }
];

const helperCategories: HelperCategory[] = ["Pinned", "SAC", "Exam", "Reset"];

const helperItems: {
  category: HelperCategory;
  title: string;
  detail: string;
  icon: IconName;
  accent: string;
  route?: MainRoute | "/(tabs)/questions" | "/(tabs)/calendar";
  actionLabel?: string;
}[] = [
  {
    category: "Pinned",
    title: "Start a focus block",
    detail: "Go straight to the timer and leave evidence.",
    icon: "timer-outline",
    accent: palette.success,
    route: "/(tabs)/study",
    actionLabel: "Study"
  },
  {
    category: "Pinned",
    title: "Generate practice",
    detail: "Turn a weak topic into questions.",
    icon: "cards-outline",
    accent: palette.primary,
    route: "/(tabs)/questions",
    actionLabel: "Drill"
  },
  {
    category: "Pinned",
    title: "Check weak spots",
    detail: "Open the evidence map before guessing.",
    icon: "map-search-outline",
    accent: palette.info,
    route: "/(tabs)/insights",
    actionLabel: "Inspect"
  },
  {
    category: "SAC",
    title: "Backplan a deadline",
    detail: "Pick the closest SAC and plan backwards.",
    icon: "calendar-range",
    accent: palette.warning,
    route: "/(tabs)/calendar",
    actionLabel: "Calendar"
  },
  {
    category: "SAC",
    title: "Pre-SAC check",
    detail: "Date, weak topic, timed question, feedback, formula/quote.",
    icon: "clipboard-check-outline",
    accent: palette.warning
  },
  {
    category: "Exam",
    title: "Command decoder",
    detail: "Explain: reason and result. Analyse: parts and links. Evaluate: judgement.",
    icon: "text-box-check-outline",
    accent: palette.info
  },
  {
    category: "Exam",
    title: "Answer skeleton",
    detail: "Define, apply, explain effect, link back to the question.",
    icon: "format-list-numbered",
    accent: palette.primary
  },
  {
    category: "Reset",
    title: "Mistake autopsy",
    detail: "What was asked? Where did marks leak? What rule fixes it?",
    icon: "clipboard-search-outline",
    accent: palette.secondary,
    route: "/(tabs)/study",
    actionLabel: "Repair"
  },
  {
    category: "Reset",
    title: "Memory spark",
    detail: "Cover notes and write everything you remember in 90 seconds.",
    icon: "brain",
    accent: palette.primary,
    route: "/(tabs)/questions",
    actionLabel: "Drill"
  }
];

export default function MoreScreen() {
  const activePalette = useActivePalette();
  const [missionIndex, setMissionIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<HelperCategory>("Pinned");
  const [resetSeconds, setResetSeconds] = useState(60);
  const [resetRunning, setResetRunning] = useState(false);
  const activeMission = studyMissions[missionIndex] ?? studyMissions[0];
  const visibleHelpers = useMemo(
    () => helperItems.filter((item) => item.category === activeCategory),
    [activeCategory]
  );
  useTrackScreen("more");

  useEffect(() => {
    if (!resetRunning) return undefined;
    if (resetSeconds <= 0) {
      setResetRunning(false);
      return undefined;
    }

    const interval = setInterval(() => {
      setResetSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetRunning, resetSeconds]);

  const navigateRoom = (item: (typeof mainRooms)[number]) => {
    if (item.action === "guide") {
      router.push({ pathname: "/(tabs)", params: { guide: "1" } });
      return;
    }
    if (item.action === "chess") {
      router.push({ pathname: "/(tabs)/study", params: { mode: "chess" } });
      return;
    }
    if (item.route) router.push(item.route);
  };

  const rollMission = () => {
    setMissionIndex((current) => {
      if (studyMissions.length <= 1) return current;
      const offset = 1 + Math.floor(Math.random() * (studyMissions.length - 1));
      return (current + offset) % studyMissions.length;
    });
  };

  const toggleReset = () => {
    if (resetSeconds === 0) {
      setResetSeconds(60);
      setResetRunning(true);
      return;
    }
    setResetRunning((running) => !running);
  };

  return (
    <Screen>
      <Animated.View entering={motion.card(0)}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>More</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Keep it simple.
          </Text>
          <Text style={[styles.headerBody, { color: activePalette.muted }]}>
            Main rooms first. Tiny rescue tools underneath. No wall of widgets.
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={motion.card(35)}>
        <View style={styles.roomGrid}>
          {mainRooms.map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              onPress={() => navigateRoom(item)}
              style={({ pressed }) => [styles.roomTile, pressed && styles.pressed]}
            >
              <View style={[styles.roomIcon, { backgroundColor: `${item.accent}18` }]}>
                <MaterialCommunityIcons name={item.icon} color={item.accent} size={22} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.roomTitle}>{item.title}</Text>
                <Text style={[styles.roomDetail, { color: activePalette.muted }]} numberOfLines={1}>
                  {item.detail}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" color={activePalette.muted} size={20} />
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={motion.card(70)}>
        <AppCard style={[styles.missionCard, { borderColor: `${activeMission.accent}35` }]}>
          <View style={styles.cardTop}>
            <View style={[styles.largeIcon, { backgroundColor: `${activeMission.accent}18` }]}>
              <MaterialCommunityIcons name={activeMission.icon} color={activeMission.accent} size={25} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.label, { color: activeMission.accent }]}>{activeMission.label}</Text>
              <Text style={styles.cardTitle}>{activeMission.title}</Text>
              <Text style={[styles.cardBody, { color: activePalette.muted }]}>{activeMission.detail}</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <Button compact mode="contained-tonal" icon="dice-5-outline" onPress={rollMission}>
              New mission
            </Button>
            <Button compact mode="outlined" icon="timer-outline" onPress={() => router.push("/(tabs)/study")}>
              Start
            </Button>
          </View>
        </AppCard>
      </Animated.View>

      <View style={styles.twoColumn}>
        <Animated.View entering={motion.card(105)} style={styles.columnItem}>
          <AppCard style={styles.resetCard}>
            <View style={styles.cardTop}>
              <View style={[styles.largeIcon, { backgroundColor: "rgba(74,222,128,0.16)" }]}>
                <MaterialCommunityIcons name="timer-sand" color={palette.success} size={24} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.label, { color: palette.success }]}>60-second reset</Text>
                <Text style={styles.cardTitle}>{resetSeconds}s</Text>
                <Text style={[styles.cardBody, { color: activePalette.muted }]}>Breathe, unclench, choose one next move.</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((60 - resetSeconds) / 60) * 100}%` }]} />
            </View>
            <View style={styles.actionRow}>
              <Button compact mode="contained-tonal" icon={resetRunning ? "pause" : "play"} onPress={toggleReset}>
                {resetRunning ? "Pause" : resetSeconds === 0 ? "Again" : "Start"}
              </Button>
              <Button
                compact
                mode="outlined"
                icon="restart"
                onPress={() => {
                  setResetRunning(false);
                  setResetSeconds(60);
                }}
              >
                Reset
              </Button>
            </View>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(130)} style={styles.columnItem}>
          <AppCard style={styles.tipCard}>
            <Text style={styles.sectionTitle}>Tonight's rule</Text>
            <Text style={[styles.tipText, { color: activePalette.muted }]}>
              If a tool does not create evidence in 15 minutes, leave it and start a study block.
            </Text>
            <Button compact mode="outlined" icon="timer-outline" onPress={() => router.push("/(tabs)/study")}>
              Open study
            </Button>
          </AppCard>
        </Animated.View>
      </View>

      <Animated.View entering={motion.card(160)}>
        <View style={styles.sectionHeader}>
          <View style={styles.copy}>
            <Text style={styles.sectionTitle}>Quick helpers</Text>
            <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>Pick one category. Use one helper.</Text>
          </View>
          <View style={styles.categoryRail}>
            {helperCategories.map((category) => {
              const active = activeCategory === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveCategory(category)}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>

      <View style={styles.helperList}>
        {visibleHelpers.map((item, index) => (
          <Animated.View key={`${item.category}-${item.title}`} entering={motion.card(185 + index * 20)}>
            <Pressable
              accessibilityRole={item.route ? "button" : "text"}
              disabled={!item.route}
              onPress={() => {
                if (item.route) router.push(item.route);
              }}
              style={({ pressed }) => [styles.helperRow, pressed && item.route && styles.pressed]}
            >
              <View style={[styles.helperIcon, { backgroundColor: `${item.accent}18` }]}>
                <MaterialCommunityIcons name={item.icon} color={item.accent} size={20} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.helperTitle}>{item.title}</Text>
                <Text style={[styles.helperDetail, { color: activePalette.muted }]}>{item.detail}</Text>
              </View>
              {item.route ? (
                <Text style={[styles.helperAction, { color: item.accent }]}>{item.actionLabel ?? "Open"}</Text>
              ) : null}
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    textTransform: "uppercase"
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 0
  },
  headerBody: {
    maxWidth: 620,
    fontSize: 15,
    lineHeight: 22
  },
  roomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  roomTile: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 230,
    minHeight: 74,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12
  },
  roomIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  copy: {
    flex: 1,
    minWidth: 0
  },
  roomTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    lineHeight: 19
  },
  roomDetail: {
    fontSize: 12,
    lineHeight: 17
  },
  missionCard: {
    gap: 14,
    borderWidth: 1,
    backgroundColor: "rgba(8,20,38,0.58)"
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13
  },
  largeIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  label: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    textTransform: "uppercase"
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 24
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  twoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  columnItem: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 250
  },
  resetCard: {
    height: "100%",
    gap: 12,
    borderColor: "rgba(74,222,128,0.26)",
    backgroundColor: "rgba(74,222,128,0.055)"
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.success
  },
  tipCard: {
    height: "100%",
    justifyContent: "center",
    gap: 12,
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(56,189,248,0.055)"
  },
  tipText: {
    fontSize: 15,
    lineHeight: 23
  },
  sectionHeader: {
    gap: 12
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 23
  },
  sectionMeta: {
    fontSize: 13,
    lineHeight: 18
  },
  categoryRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  categoryChip: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 12
  },
  categoryChipActive: {
    borderColor: "rgba(56,189,248,0.5)",
    backgroundColor: "rgba(56,189,248,0.14)"
  },
  categoryText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  categoryTextActive: {
    color: palette.info
  },
  helperList: {
    gap: 9
  },
  helperRow: {
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.032)",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12
  },
  helperIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  helperTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    lineHeight: 20
  },
  helperDetail: {
    fontSize: 13,
    lineHeight: 18
  },
  helperAction: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.045)",
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }]
  }
});
