import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { palette } from "@/constants/theme";

type AppCardProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function AppCard({ children, style }: AppCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16
  }
});

