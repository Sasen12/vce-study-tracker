import { useState } from "react";
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

export default function MoreScreen() {
  const activePalette = useActivePalette();
  const [missionIndex, setMissionIndex] = useState(0);
  const activeMission = studyDiceMissions[missionIndex] ?? studyDiceMissions[0];
  useTrackScreen("more");

  const rollStudyDice = () => {
    setMissionIndex((current) => {
      if (studyDiceMissions.length <= 1) return current;
      const offset = 1 + Math.floor(Math.random() * (studyDiceMissions.length - 1));
      return (current + offset) % studyDiceMissions.length;
    });
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
