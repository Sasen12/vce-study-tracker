import { useCallback } from "react";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ThemeAmbientMotion } from "@/components/ui/ThemeAmbientMotion";
import { motion } from "@/constants/motion";
import { useActivePalette } from "@/hooks/useActiveTheme";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
};

export function Screen({ children, scroll = true }: ScreenProps) {
  const activePalette = useActivePalette();
  const focusProgress = useSharedValue(1);
  const focusStyle = useAnimatedStyle(() => ({
    opacity: focusProgress.value,
    transform: [{ translateY: (1 - focusProgress.value) * 8 }]
  }));

  useFocusEffect(
    useCallback(() => {
      focusProgress.value = 0;
      focusProgress.value = withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.cubic)
      });
    }, [focusProgress])
  );

  const stack = (
    <Animated.View entering={motion.screen()} style={[styles.stack, focusStyle]}>
      {children}
    </Animated.View>
  );
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {stack}
    </ScrollView>
  ) : (
    <View style={styles.content}>{stack}</View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: activePalette.background }]}>
      <ThemeAmbientMotion />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden"
  },
  content: {
    padding: 20,
    paddingBottom: 110
  },
  stack: {
    gap: 16
  }
});
