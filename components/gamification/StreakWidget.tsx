import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { palette } from "@/constants/theme";

export function StreakWidget({ streak }: { streak: number }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (streak > 3) {
      scale.value = withRepeat(withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false);
    } else {
      cancelAnimation(scale);
      scale.value = 1;
    }

    return () => cancelAnimation(scale);
  }, [scale, streak]);

  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const size = streak >= 30 ? 42 : streak >= 14 ? 36 : streak >= 7 ? 32 : 28;

  return (
    <View style={styles.wrap}>
      <Animated.View style={flameStyle}>
        <MaterialCommunityIcons name="fire" size={size} color={palette.success} />
      </Animated.View>
      <View>
        <Text variant="headlineSmall" style={styles.value}>
          {streak}
        </Text>
        <Text style={styles.label}>day streak</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  value: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  label: {
    color: palette.muted,
    fontSize: 12
  }
});
