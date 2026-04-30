import { useEffect, useMemo } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { PaperProvider, MD3DarkTheme } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Outfit_400Regular, Outfit_700Bold } from "@expo-google-fonts/outfit";
import { StatusBar } from "expo-status-bar";
import { BuildUpdateNotice } from "@/components/BuildUpdateNotice";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useAuthStore } from "@/store/authStore";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const authReady = useAuthStore((state) => state.authReady);
  const activePalette = useActivePalette();
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_700Bold });
  const paperTheme = useMemo(
    () => ({
      ...MD3DarkTheme,
      roundness: 2,
      colors: {
        ...MD3DarkTheme.colors,
        primary: activePalette.primary,
        secondary: activePalette.secondary,
        background: activePalette.background,
        surface: activePalette.surface,
        surfaceVariant: activePalette.surfaceRaised,
        onSurface: activePalette.text,
        onBackground: activePalette.text,
        outline: activePalette.border
      },
      fonts: {
        ...MD3DarkTheme.fonts,
        bodyLarge: { ...MD3DarkTheme.fonts.bodyLarge, fontFamily: "Outfit_400Regular" },
        bodyMedium: { ...MD3DarkTheme.fonts.bodyMedium, fontFamily: "Outfit_400Regular" },
        titleLarge: { ...MD3DarkTheme.fonts.titleLarge, fontFamily: "Outfit_700Bold" },
        headlineSmall: { ...MD3DarkTheme.fonts.headlineSmall, fontFamily: "Outfit_700Bold" }
      }
    }),
    [activePalette]
  );

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded && authReady) {
      SplashScreen.hideAsync();
    }
  }, [authReady, fontsLoaded]);

  if (!fontsLoaded || !authReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <StatusBar style="light" />
        <BuildUpdateNotice />
        <Stack screenOptions={{ headerShown: false, animation: "fade_from_bottom" }} />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
