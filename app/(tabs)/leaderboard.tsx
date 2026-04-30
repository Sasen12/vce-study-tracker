import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import type { LeaderboardEntry } from "@/types";

const formatWeekRange = (start?: string, end?: string) => {
  if (!start || !end) return "This week";
  const formatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1);
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
};

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={[styles.podiumCard, entry.isCurrentUser && styles.activeCard]}>
      <Text style={styles.podiumRank}>#{entry.rank}</Text>
      <Text style={styles.podiumName} numberOfLines={1}>
        {entry.displayName}
      </Text>
      <Text style={styles.podiumXp}>{entry.weekXp} XP</Text>
      <Text style={styles.muted}>{entry.weekMinutes} min</Text>
    </View>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={[styles.row, entry.isCurrentUser && styles.activeRow]}>
      <Text style={styles.rank}>#{entry.rank}</Text>
      <View style={styles.nameBlock}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.displayName}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {entry.weekMinutes} min - {entry.sessionCount} sessions - level {entry.level}
        </Text>
      </View>
      <Text style={styles.xp}>{entry.weekXp} XP</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { gamification, leaderboard, loading, error, fetchAll, setLeaderboardPreference } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const entries = leaderboard?.entries ?? [];
  const topThree = entries.slice(0, 3);
  const viewerRank = leaderboard?.viewer?.rank;

  const chooseLeaderboard = async (optIn: boolean) => {
    setSaving(true);
    setLocalError(null);
    try {
      await setLeaderboardPreference(optIn);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not update leaderboard choice");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !leaderboard) {
    return (
      <Screen>
        <SkeletonStack />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{formatWeekRange(leaderboard?.weekStart, leaderboard?.weekEnd)}</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Leaderboard
          </Text>
        </View>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="trophy-outline" color={palette.warning} size={20} />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {localError ? <Text style={styles.error}>{localError}</Text> : null}

      <AppCard style={styles.statusCard}>
        <View style={styles.statusTop}>
          <View style={styles.statusText}>
            <Text style={styles.cardTitle}>{gamification?.leaderboardOptIn ? "You are competing" : "You are opted out"}</Text>
            <Text style={styles.muted}>
              {gamification?.leaderboardOptIn
                ? viewerRank
                  ? `Your current weekly rank is #${viewerRank}.`
                  : "Log a study session to land on the board."
                : "Join when you want your weekly XP to count against other opted-in students."}
            </Text>
          </View>
          <Button
            mode={gamification?.leaderboardOptIn ? "outlined" : "contained"}
            disabled={saving}
            loading={saving}
            onPress={() => chooseLeaderboard(!gamification?.leaderboardOptIn)}
          >
            {gamification?.leaderboardOptIn ? "Opt out" : "Join"}
          </Button>
        </View>
        <Text style={styles.privacy}>
          Shows display name, weekly XP, weekly minutes and session count. It only includes students who opt in.
        </Text>
      </AppCard>

      {topThree.length ? (
        <View style={styles.podium}>
          {topThree.map((entry) => (
            <PodiumCard key={entry.userId} entry={entry} />
          ))}
        </View>
      ) : null}

      <AppCard style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.cardTitle}>Weekly rankings</Text>
          <Text style={styles.muted}>{entries.length} competing</Text>
        </View>
        {entries.length ? (
          <View style={styles.list}>
            {entries.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} />
            ))}
          </View>
        ) : (
          <EmptyState title="No competitors yet" body="Once students opt in and log study sessions, the rankings appear here." />
        )}
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  eyebrow: {
    color: palette.muted,
    marginBottom: 4
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.14)"
  },
  error: {
    color: palette.secondary
  },
  statusCard: {
    gap: 12
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  statusText: {
    flex: 1,
    gap: 4
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  privacy: {
    color: palette.muted,
    lineHeight: 20,
    fontSize: 13
  },
  podium: {
    flexDirection: "row",
    gap: 10
  },
  podiumCard: {
    flex: 1,
    minHeight: 124,
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 8,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border
  },
  activeCard: {
    borderColor: palette.primary,
    backgroundColor: "rgba(124,110,255,0.1)"
  },
  podiumRank: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 20
  },
  podiumName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  podiumXp: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  listCard: {
    gap: 12
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  list: {
    gap: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  activeRow: {
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.5)",
    backgroundColor: "rgba(124,110,255,0.1)"
  },
  rank: {
    width: 40,
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  nameBlock: {
    flex: 1,
    minWidth: 0
  },
  name: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  xp: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  }
});
