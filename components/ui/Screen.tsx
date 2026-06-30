import { useCallback } from "react";
import type { RefObject } from "react";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ThemeAmbientMotion } from "@/components/ui/ThemeAmbientMotion";
import { motion } from "@/constants/motion";
import { useActivePalette } from "@/hooks/useActiveTheme";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  scrollRef?: RefObject<ScrollView>;
};

export function Screen({ children, scroll = true, scrollRef }: ScreenProps) {
  const activePalette = useActivePalette();
  const { width } = useWindowDimensions();
  const wideLayout = width >= 900;
  const contentStyle = wideLayout ? styles.contentWide : styles.content;
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
    <ScrollView
      ref={scrollRef}
      style={styles.viewport}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator
    >
      {stack}
    </ScrollView>
  ) : (
    <View style={[styles.viewport, contentStyle]}>{stack}</View>
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
    overflow: "hidden",
    position: "relative"
  },
  viewport: {
    flex: 1,
    zIndex: 1
  },
  content: {
    padding: 20,
    paddingBottom: 110
  },
  contentWide: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 48
  },
  stack: {
    gap: 16
  }
});
