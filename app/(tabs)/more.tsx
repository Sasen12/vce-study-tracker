import { useEffect, useState } from "react";
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

const moreItems = [
  {
    title: "Insights",
    detail: "Weak spots",
    icon: "map-search-outline",
    accent: palette.primary,
    route: "/(tabs)/insights"
  },
  {
    title: "Shop",
    detail: "Themes and badges",
    icon: "shopping-outline",
    accent: palette.success,
    route: "/(tabs)/shop"
  },
  {
    title: "Profile",
    detail: "Subjects and defaults",
    icon: "account-circle-outline",
    accent: "#60A5FA",
    route: "/(tabs)/profile"
  },
  {
    title: "Guide",
    detail: "Guided start",
    icon: "compass-outline",
    accent: palette.warning,
    route: "/(tabs)/onboarding"
  },
  {
    title: "Chess break",
    detail: "Reset tool",
    icon: "chess-knight",
    accent: palette.info,
    route: "/(tabs)/study"
  }
] as const;

const studyDiceMissions = [
  {
    label: "10 minute repair",
    title: "Fix one mistake properly.",
    detail: "Pick a recent mistake, rewrite the rule, then do one similar question.",
    icon: "wrench-outline",
    accent: palette.secondary
  },
  {
    label: "Command term snap",
    title: "Write one answer with a verb.",
    detail: "Choose analyse, evaluate or explain. Write the answer, then underline the evidence.",
    icon: "lightning-bolt-outline",
    accent: palette.warning
  },
  {
    label: "SAC pressure check",
    title: "Find the next date that can hurt you.",
    detail: "Open Calendar, pick the closest SAC, and plan one block backwards from it.",
    icon: "calendar-alert",
    accent: palette.info
  },
  {
    label: "Low energy mode",
    title: "Make one clean note.",
    detail: "Turn one messy page into five bullet points. No perfection, just usable evidence.",
    icon: "note-edit-outline",
    accent: palette.success
  },
  {
    label: "Question forge",
    title: "Make the topic answer back.",
    detail: "Generate or save three questions from the topic you keep avoiding.",
    icon: "cards-outline",
    accent: palette.primary
  }
] as const;

const commandTerms = [
  {
    term: "Explain",
    move: "Give the reason, then link it to the result.",
    frame: "Because -> this means -> therefore",
    accent: palette.info
  },
  {
    term: "Analyse",
    move: "Break the idea into parts and show how they connect.",
    frame: "Cause -> effect -> consequence",
    accent: palette.primary
  },
  {
    term: "Evaluate",
    move: "Make a judgement after weighing strength and limitation.",
    frame: "Benefit -> limit -> final judgement",
    accent: palette.warning
  },
  {
    term: "Discuss",
    move: "Show both sides before landing on a clear position.",
    frame: "For -> against -> depends on",
    accent: palette.success
  }
] as const;

const sacChecklist = [
  "SAC date checked",
  "One weak topic picked",
  "One timed question done",
  "Teacher feedback reviewed",
  "Formula/quote/criteria ready"
] as const;

export default function MoreScreen() {
  const activePalette = useActivePalette();
  const [missionIndex, setMissionIndex] = useState(0);
  const [commandIndex, setCommandIndex] = useState(0);
  const [resetSeconds, setResetSeconds] = useState(60);
  const [resetRunning, setResetRunning] = useState(false);
  const [checkedSacItems, setCheckedSacItems] = useState<string[]>([]);
  const activeMission = studyDiceMissions[missionIndex] ?? studyDiceMissions[0];
  const activeCommand = commandTerms[commandIndex] ?? commandTerms[0];
  const checklistProgress = checkedSacItems.length;
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

  const rollStudyDice = () => {
    setMissionIndex((current) => {
      if (studyDiceMissions.length <= 1) return current;
      const offset = 1 + Math.floor(Math.random() * (studyDiceMissions.length - 1));
      return (current + offset) % studyDiceMissions.length;
    });
  };

  const toggleSacItem = (item: string) => {
    setCheckedSacItems((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  const resetBreather = () => {
    setResetRunning(false);
    setResetSeconds(60);
  };

  return (
    <Screen>
      <Animated.View entering={motion.card(0)} style={styles.header}>
        <Text style={styles.eyebrow}>More</Text>
        <Text variant="headlineLarge" style={styles.title}>
          Extra tools
        </Text>
      </Animated.View>

      <Animated.View entering={motion.card(20)}>
        <AppCard style={[styles.studyDiceCard, { borderColor: `${activeMission.accent}35` }]}>
          <View style={styles.studyDiceTop}>
            <View style={[styles.diceIconBox, { backgroundColor: `${activeMission.accent}18` }]}>
              <MaterialCommunityIcons name="dice-d20-outline" color={activeMission.accent} size={24} />
            </View>
            <View style={styles.toolCopy}>
              <Text style={[styles.diceLabel, { color: activeMission.accent }]}>{activeMission.label}</Text>
              <Text style={styles.diceTitle}>{activeMission.title}</Text>
              <Text style={[styles.toolDetail, { color: activePalette.muted }]}>{activeMission.detail}</Text>
            </View>
          </View>
          <View style={styles.diceActions}>
            <Button compact mode="contained-tonal" icon="dice-5-outline" onPress={rollStudyDice}>
              Roll
            </Button>
            <Button compact mode="outlined" icon={activeMission.icon} onPress={() => router.push("/(tabs)/study")}>
              Start
            </Button>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(45)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pocket tools</Text>
        <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>Small helpers for weird study moments.</Text>
      </Animated.View>

      <View style={styles.featureGrid}>
        <Animated.View entering={motion.card(70)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: `${activeCommand.accent}35` }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: `${activeCommand.accent}18` }]}>
                <MaterialCommunityIcons name="text-box-check-outline" color={activeCommand.accent} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: activeCommand.accent }]}>Command decoder</Text>
                <Text style={styles.featureTitle}>{activeCommand.term}</Text>
              </View>
            </View>
            <Text style={[styles.toolDetail, { color: activePalette.muted }]}>{activeCommand.move}</Text>
            <Text style={styles.commandFrame}>{activeCommand.frame}</Text>
            <View style={styles.termRail}>
              {commandTerms.map((item, index) => (
                <Pressable
                  key={item.term}
                  accessibilityRole="button"
                  style={[styles.termChip, commandIndex === index && { borderColor: item.accent, backgroundColor: `${item.accent}16` }]}
                  onPress={() => setCommandIndex(index)}
                >
                  <Text style={[styles.termChipText, commandIndex === index && { color: item.accent }]}>{item.term}</Text>
                </Pressable>
              ))}
            </View>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(95)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(74,222,128,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(74,222,128,0.16)" }]}>
                <MaterialCommunityIcons name="timer-sand" color={palette.success} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.success }]}>60-second reset</Text>
                <Text style={styles.featureTitle}>{resetSeconds}s</Text>
              </View>
            </View>
            <Text style={[styles.toolDetail, { color: activePalette.muted }]}>
              Breathe, unclench, then pick one tiny next move.
            </Text>
            <View style={styles.resetBarTrack}>
              <View style={[styles.resetBarFill, { width: `${((60 - resetSeconds) / 60) * 100}%` }]} />
            </View>
            <View style={styles.diceActions}>
              <Button
                compact
                mode="contained-tonal"
                icon={resetRunning ? "pause" : "play"}
                onPress={() => {
                  if (resetSeconds === 0) {
                    setResetSeconds(60);
                    setResetRunning(true);
                    return;
                  }
                  setResetRunning((value) => !value);
                }}
              >
                {resetRunning ? "Pause" : resetSeconds === 0 ? "Again" : "Start"}
              </Button>
              <Button compact mode="outlined" icon="restart" onPress={resetBreather}>
                Reset
              </Button>
            </View>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(120)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(245,158,11,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(245,158,11,0.16)" }]}>
                <MaterialCommunityIcons name="clipboard-check-outline" color={palette.warning} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.warning }]}>Pre-SAC check</Text>
                <Text style={styles.featureTitle}>{checklistProgress}/{sacChecklist.length} ready</Text>
              </View>
            </View>
            <View style={styles.checkList}>
              {sacChecklist.map((item) => {
                const checked = checkedSacItems.includes(item);
                return (
                  <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.checkRow} onPress={() => toggleSacItem(item)}>
                    <MaterialCommunityIcons
                      name={checked ? "check-circle" : "checkbox-blank-circle-outline"}
                      color={checked ? palette.success : activePalette.muted}
                      size={18}
                    />
                    <Text style={[styles.checkText, checked && styles.checkTextDone]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </AppCard>
        </Animated.View>
      </View>

      <View style={styles.grid}>
        {moreItems.map((item, index) => (
          <Animated.View key={item.title} entering={motion.card(index * 35)} style={styles.gridItem}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                item.title === "Guide"
                  ? router.push({ pathname: "/(tabs)", params: { guide: "1" } })
                  : item.title === "Chess break"
                    ? router.push({ pathname: "/(tabs)/study", params: { mode: "chess" } })
                  : router.push(item.route)
              }
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <AppCard style={styles.toolCard}>
                <View style={[styles.iconBox, { backgroundColor: `${item.accent}18` }]}>
                  <MaterialCommunityIcons name={item.icon} color={item.accent} size={24} />
                </View>
                <View style={styles.toolCopy}>
                  <Text style={styles.toolTitle}>{item.title}</Text>
                  <Text style={[styles.toolDetail, { color: activePalette.muted }]}>{item.detail}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" color={activePalette.muted} size={22} />
              </AppCard>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 0
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  studyDiceCard: {
    gap: 14,
    borderWidth: 1,
    backgroundColor: "rgba(124,110,255,0.08)"
  },
  studyDiceTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  diceIconBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  diceLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    textTransform: "uppercase"
  },
  diceTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 23
  },
  diceActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sectionHeader: {
    gap: 3
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  sectionMeta: {
    fontSize: 13,
    lineHeight: 18
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  featureItem: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 0
  },
  featureCard: {
    minHeight: 224,
    gap: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  featureTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  smallIconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  featureTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 17,
    lineHeight: 22
  },
  commandFrame: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.045)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  termRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  termChip: {
    minHeight: 32,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 9
  },
  termChipText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  resetBarTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  resetBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.success
  },
  checkList: {
    gap: 6
  },
  checkRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  checkText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 17
  },
  checkTextDone: {
    color: palette.success,
    textDecorationLine: "line-through"
  },
  gridItem: {
    width: "100%",
    maxWidth: 460
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }]
  },
  toolCard: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  toolCopy: {
    flex: 1,
    gap: 2
  },
  toolTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  toolDetail: {
    fontSize: 14,
    lineHeight: 19
  }
});
