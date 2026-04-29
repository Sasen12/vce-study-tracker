import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { LEVELS } from "@/constants/gamification";
import { palette } from "@/constants/theme";
import type { Gamification } from "@/types";

export function XPBar({ gamification }: { gamification: Gamification | null }) {
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
        <Text style={styles.level}>Lvl {gamification?.level ?? 1}</Text>
        <Text style={styles.title}>{level.title}</Text>
        <Text style={styles.xp}>{xp} XP</Text>
      </View>
      <View style={styles.track} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <Text style={styles.caption}>{next.xp > xp ? `${next.xp - xp} XP to ${next.title}` : "Max level unlocked"}</Text>
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
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  title: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  xp: {
    color: palette.muted,
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
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.55,
    shadowRadius: 10
  },
  caption: {
    color: palette.muted,
    fontSize: 12
  }
});
