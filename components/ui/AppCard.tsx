import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useActivePalette } from "@/hooks/useActiveTheme";

type AppCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({ children, style }: AppCardProps) {
  const activePalette = useActivePalette();
  return <View style={[styles.card, { backgroundColor: activePalette.surface, borderColor: activePalette.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20
  }
});
