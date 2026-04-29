import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { palette } from "@/constants/theme";

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 6
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  body: {
    color: palette.muted,
    lineHeight: 20
  }
});

