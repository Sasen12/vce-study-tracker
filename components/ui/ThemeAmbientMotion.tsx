import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { ThemeMotion, ThemePalette } from "@/constants/theme";
import { useActiveTheme } from "@/hooks/useActiveTheme";

type ColorKey = keyof Pick<ThemePalette, "primary" | "secondary" | "info" | "warning" | "success">;

type AmbientMark = {
  id: string;
  color: ColorKey;
  top: `${number}%`;
  left: `${number}%`;
  width: number;
  height: number;
  radius: number;
  opacity: number;
  travelX: number;
  travelY: number;
  rotation: number;
  spin: number;
  scale?: number;
  border?: boolean;
};

const durationByMotion: Record<ThemeMotion, number> = {
  blossom: 7600,
  spring: 7000,
  glow: 5200,
  pastel: 7800,
  lights: 3600,
  snow: 8600
};

const marksByMotion: Record<ThemeMotion, AmbientMark[]> = {
  blossom: [
    mark("blossom-1", "primary", 8, 12, 14, 5, 12, 0.42, 22, 86, -18, 64),
    mark("blossom-2", "secondary", 18, 78, 11, 4, 10, 0.34, -34, 76, 24, -78),
    mark("blossom-3", "primary", 34, 48, 16, 5, 12, 0.3, 30, 92, -38, 82),
    mark("blossom-4", "info", 56, 6, 10, 4, 10, 0.24, 38, 68, 12, -54),
    mark("blossom-5", "primary", 72, 88, 13, 5, 12, 0.32, -40, 58, 42, 74),
    mark("blossom-6", "secondary", 4, 52, 10, 4, 10, 0.26, -18, 78, -14, 58)
  ],
  spring: [
    mark("spring-1", "success", 10, 18, 18, 3, 8, 0.34, 34, 54, -8, 34),
    mark("spring-2", "primary", 24, 72, 22, 3, 8, 0.3, -42, 48, 18, -42),
    mark("spring-3", "secondary", 40, 8, 15, 3, 8, 0.28, 48, 52, -24, 48),
    mark("spring-4", "info", 58, 60, 18, 3, 8, 0.24, -28, 42, 12, -38),
    mark("spring-5", "success", 74, 30, 20, 3, 8, 0.32, 24, 38, -18, 30),
    mark("spring-6", "secondary", 86, 82, 14, 3, 8, 0.24, -36, 28, 28, -36)
  ],
  glow: [
    mark("glow-1", "primary", 16, 4, 156, 3, 3, 0.32, 70, 0, 0, 0),
    mark("glow-2", "warning", 34, 62, 112, 3, 3, 0.28, -74, 0, 0, 0),
    mark("glow-3", "info", 54, 18, 132, 3, 3, 0.22, 58, 0, 0, 0),
    mark("glow-4", "secondary", 76, 50, 96, 3, 3, 0.24, -52, 0, 0, 0),
    mark("glow-5", "primary", 90, 8, 124, 3, 3, 0.2, 48, 0, 0, 0)
  ],
  pastel: [
    mark("pastel-1", "primary", 9, 8, 12, 12, 4, 0.26, 42, 50, 0, 90, 1, true),
    mark("pastel-2", "secondary", 18, 70, 18, 4, 8, 0.32, -36, 52, 26, -64),
    mark("pastel-3", "info", 38, 18, 13, 13, 4, 0.2, 34, 46, 0, -76, 1, true),
    mark("pastel-4", "success", 54, 80, 20, 4, 8, 0.26, -42, 36, -18, 58),
    mark("pastel-5", "primary", 74, 42, 16, 4, 8, 0.3, 30, 34, 34, -46),
    mark("pastel-6", "secondary", 88, 10, 12, 12, 4, 0.22, 38, 22, 0, 68, 1, true)
  ],
  lights: [
    mark("lights-1", "primary", 12, 10, 18, 5, 5, 0.5, 18, 0, -8, 16),
    mark("lights-2", "warning", 12, 34, 18, 5, 5, 0.46, -12, 0, 10, -16),
    mark("lights-3", "secondary", 12, 58, 18, 5, 5, 0.5, 16, 0, -8, 16),
    mark("lights-4", "success", 12, 82, 18, 5, 5, 0.44, -16, 0, 10, -16),
    mark("lights-5", "warning", 82, 14, 16, 5, 5, 0.42, 16, 0, 8, 16),
    mark("lights-6", "primary", 82, 42, 16, 5, 5, 0.46, -18, 0, -10, -16),
    mark("lights-7", "secondary", 82, 70, 16, 5, 5, 0.42, 14, 0, 8, 16)
  ],
  snow: [
    mark("snow-1", "primary", 2, 10, 7, 2, 3, 0.48, 18, 96, 0, 180),
    mark("snow-2", "secondary", 8, 28, 6, 2, 3, 0.34, -20, 88, 0, -180),
    mark("snow-3", "info", 0, 46, 8, 2, 3, 0.42, 24, 100, 0, 180),
    mark("snow-4", "primary", 14, 66, 6, 2, 3, 0.34, -18, 78, 0, -180),
    mark("snow-5", "secondary", 4, 84, 7, 2, 3, 0.4, 14, 92, 0, 180),
    mark("snow-6", "info", 34, 18, 7, 2, 3, 0.28, 18, 62, 0, -180),
    mark("snow-7", "primary", 48, 76, 6, 2, 3, 0.3, -22, 58, 0, 180)
  ]
};

function mark(
  id: string,
  color: ColorKey,
  top: number,
  left: number,
  width: number,
  height: number,
  radius: number,
  opacity: number,
  travelX: number,
  travelY: number,
  rotation: number,
  spin: number,
  scale = 1,
  border = false
): AmbientMark {
  return {
    id,
    color,
    top: `${top}%`,
    left: `${left}%`,
    width,
    height,
    radius,
    opacity,
    travelX,
    travelY,
    rotation,
    spin,
    scale,
    border
  };
}

export function ThemeAmbientMotion() {
  const theme = useActiveTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const marks = useMemo(() => (theme.motion ? marksByMotion[theme.motion] : []), [theme.motion]);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);

    if (!theme.motion) {
      return;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: durationByMotion[theme.motion],
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true
      })
    );

    loop.start();

    return () => {
      loop.stop();
      progress.stopAnimation();
    };
  }, [progress, theme.id, theme.motion]);

  if (!theme.motion) return null;

  return (
    <View pointerEvents="none" style={styles.layer}>
      {marks.map((item, index) => {
        const offset = index / Math.max(marks.length, 1);
        const opacity = progress.interpolate({
          inputRange: [0, 0.18, 0.55, 1],
          outputRange: [item.opacity * 0.22, item.opacity * (0.76 + offset * 0.28), item.opacity, item.opacity * 0.22]
        });
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, item.travelX]
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, item.travelY]
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${item.rotation}deg`, `${item.rotation + item.spin}deg`]
        });
        const scale = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [item.scale ?? 1, (item.scale ?? 1) * 1.16, item.scale ?? 1]
        });

        return (
          <Animated.View
            key={item.id}
            style={[
              styles.mark,
              {
                top: item.top,
                left: item.left,
                width: item.width,
                height: item.height,
                borderRadius: item.radius,
                backgroundColor: item.border ? "transparent" : theme.colors[item.color],
                borderColor: theme.colors[item.color],
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }, { scale }]
              },
              item.border && styles.outlineMark
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: "hidden"
  },
  mark: {
    position: "absolute"
  },
  outlineMark: {
    borderWidth: 2
  }
});
