import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import type { ThemeMotion } from "@/constants/theme";
import { useActiveTheme } from "@/hooks/useActiveTheme";

const durationByMotion: Record<ThemeMotion, number> = {
  blossom: 5600,
  spring: 5200,
  glow: 4400,
  pastel: 6200,
  lights: 2800,
  snow: 7000
};

export function ThemeAmbientMotion() {
  const theme = useActiveTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    if (!theme.motion) {
      progress.value = 0;
      return;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: durationByMotion[theme.motion],
        easing: Easing.inOut(Easing.sin)
      }),
      -1,
      true
    );

    return () => cancelAnimation(progress);
  }, [progress, theme.motion]);

  const primaryLine = useAnimatedStyle(() => ({
    opacity: 0.08 + progress.value * 0.1,
    transform: [{ translateX: progress.value * 34 }, { scaleX: 0.95 + progress.value * 0.08 }]
  }));

  const secondaryLine = useAnimatedStyle(() => ({
    opacity: 0.06 + (1 - progress.value) * 0.1,
    transform: [{ translateX: -progress.value * 28 }, { scaleX: 1.04 - progress.value * 0.08 }]
  }));

  const lowerLine = useAnimatedStyle(() => ({
    opacity: 0.05 + progress.value * 0.08,
    transform: [{ translateX: progress.value * 20 }]
  }));

  if (!theme.motion) return null;

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View
        style={[styles.line, styles.primaryLine, { backgroundColor: theme.colors.primary }, primaryLine]}
      />
      <Animated.View
        style={[styles.line, styles.secondaryLine, { backgroundColor: theme.colors.secondary }, secondaryLine]}
      />
      <Animated.View style={[styles.line, styles.lowerLine, { backgroundColor: theme.colors.info }, lowerLine]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  line: {
    position: "absolute",
    height: 2,
    borderRadius: 2
  },
  primaryLine: {
    top: 14,
    left: -24,
    width: "48%"
  },
  secondaryLine: {
    top: 28,
    right: -24,
    width: "38%"
  },
  lowerLine: {
    bottom: 14,
    left: "18%",
    width: "36%"
  }
});
