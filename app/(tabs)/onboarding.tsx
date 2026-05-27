import { useEffect } from "react";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Screen } from "@/components/ui/Screen";
import { palette } from "@/constants/theme";

export default function OnboardingScreen() {
  useEffect(() => {
    router.replace({ pathname: "/(tabs)", params: { guide: "1" } });
  }, []);

  return (
    <Screen scroll={false}>
      <View style={styles.wrap}>
        <ActivityIndicator color={palette.primary} />
        <Text style={styles.text}>Starting guide...</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  text: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold"
  }
});
