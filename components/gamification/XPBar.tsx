import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { LEVELS } from "@/constants/gamification";
import { useActivePalette } from "@/hooks/useActiveTheme";
import type { Gamification } from "@/types";

export function XPBar({ gamification }: { gamification: Gamification | null }) {
  const activePalette = useActivePalette();
  const xp = gamification?.totalXp ?? 0;
  const level = LEVELS.find((item) => item.level === (gamification?.level ?? 1)) ?? LEVELS[0];
  const next = LEVELS.find((item) => item.xp > xp) ?? LEVELS[LEVELS.length - 1];
  const previous = LEVELS.filter((item) => item.xp <= xp).at(-1) ?? LEVELS[0];
  const progress = next.xp === previous.xp ? 1 : (xp - previous.xp) / (next.xp - previous.xp);
  const scale = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    scale.value = withSpring(Math.max(0, Math.min(1, progress)), { damping: 14, stiffness: 120 });
  }, [progress, scale]);

  const fillStyle = useAnimatedStyle(() => ({
    width: trackWidth * scale.value
  }), [trackWidth]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.level, { color: activePalette.primary }]}>Lvl {gamification?.level ?? 1}</Text>
        <Text style={[styles.title, { color: activePalette.text }]}>{level.title}</Text>
        <Text style={[styles.xp, { color: activePalette.muted }]}>{xp} XP</Text>
      </View>
      <View style={styles.track} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
        <Animated.View
          style={[styles.fill, { backgroundColor: activePalette.primary, shadowColor: activePalette.primary }, fillStyle]}
        />
      </View>
      <Text style={[styles.caption, { color: activePalette.muted }]}>
        {next.xp > xp ? `${next.xp - xp} XP to ${next.title}` : "Max level unlocked"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  level: {
    fontFamily: "Outfit_700Bold"
  },
  title: {
    flex: 1,
    fontFamily: "Outfit_700Bold"
  },
  xp: {
    fontSize: 12
  },
  track: {
    height: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  fill: {
    height: 12,
    borderRadius: 8,
    shadowOpacity: 0.55,
    shadowRadius: 10
  },
  caption: {
    fontSize: 12
  }
});
