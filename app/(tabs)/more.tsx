import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Text } from "react-native-paper";
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

export default function MoreScreen() {
  const activePalette = useActivePalette();
  useTrackScreen("more");

  return (
    <Screen>
      <Animated.View entering={motion.card(0)} style={styles.header}>
        <Text style={styles.eyebrow}>More</Text>
        <Text variant="headlineLarge" style={styles.title}>
          Extra tools
        </Text>
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
