import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { PaperProvider, MD3DarkTheme } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Outfit_400Regular, Outfit_700Bold } from "@expo-google-fonts/outfit";
import { StatusBar } from "expo-status-bar";
import { palette } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";

SplashScreen.preventAutoHideAsync();

const paperTheme = {
  ...MD3DarkTheme,
  roundness: 2,
  colors: {
    ...MD3DarkTheme.colors,
    primary: palette.primary,
    secondary: palette.secondary,
    background: palette.background,
    surface: palette.surface,
    surfaceVariant: palette.surfaceRaised,
    onSurface: palette.text,
    onBackground: palette.text,
    outline: palette.border
  },
  fonts: {
    ...MD3DarkTheme.fonts,
    bodyLarge: { ...MD3DarkTheme.fonts.bodyLarge, fontFamily: "Outfit_400Regular" },
    bodyMedium: { ...MD3DarkTheme.fonts.bodyMedium, fontFamily: "Outfit_400Regular" },
    titleLarge: { ...MD3DarkTheme.fonts.titleLarge, fontFamily: "Outfit_700Bold" },
    headlineSmall: { ...MD3DarkTheme.fonts.headlineSmall, fontFamily: "Outfit_700Bold" }
  }
};

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const authReady = useAuthStore((state) => state.authReady);
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_700Bold });

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
        <Stack screenOptions={{ headerShown: false, animation: "fade_from_bottom" }} />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

