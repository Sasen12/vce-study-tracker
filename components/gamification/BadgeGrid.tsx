import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BADGES } from "@/constants/gamification";
import { palette } from "@/constants/theme";

export function BadgeGrid({ unlocked }: { unlocked: string[] }) {
  return (
    <View style={styles.grid}>
      {BADGES.map((badge) => {
        const active = unlocked.includes(badge.id);
        return (
          <View key={badge.id} style={[styles.badge, !active && styles.locked]}>
            <MaterialCommunityIcons
              name={active ? "medal" : "lock-outline"}
              size={24}
              color={active ? palette.primary : palette.muted}
            />
            <Text style={[styles.label, !active && styles.lockedText]} numberOfLines={2}>
              {badge.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  badge: {
    width: "31%",
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}16`,
    padding: 8
  },
  locked: {
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  label: {
    color: palette.text,
    fontSize: 12,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  },
  lockedText: {
    color: palette.muted
  }
});

