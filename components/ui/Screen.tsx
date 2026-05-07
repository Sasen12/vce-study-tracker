import { useCallback, useState } from "react";
import type { RefObject } from "react";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
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
  const hasMoreToScroll = scroll && contentHeight > viewportHeight + 36 && scrollOffset + viewportHeight < contentHeight - 52;
  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.viewport}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContentHeight(height)}
      onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={96}
    >
      {stack}
    </ScrollView>
  ) : (
    <View style={[styles.viewport, styles.content]}>{stack}</View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: activePalette.background }]}>
      <ThemeAmbientMotion />
      {content}
      {hasMoreToScroll ? (
        <View pointerEvents="none" style={styles.scrollCueLayer}>
          <LinearGradient colors={[`${activePalette.background}00`, activePalette.background]} style={styles.scrollFade} />
          <View
            style={[
              styles.scrollCue,
              {
                backgroundColor: activePalette.surfaceRaised,
                borderColor: `${activePalette.primary}66`
              }
            ]}
          >
            <MaterialCommunityIcons name="chevron-down" color={activePalette.primary} size={22} />
          </View>
        </View>
      ) : null}
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
  stack: {
    gap: 16
  },
  scrollCueLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 78,
    zIndex: 5,
    alignItems: "center"
  },
  scrollFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -78,
    height: 130
  },
  scrollCue: {
    width: 38,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4
  }
});
