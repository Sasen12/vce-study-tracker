import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Text } from "react-native-paper";
import Animated from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { WeeklyChart } from "@/components/charts/WeeklyChart";
import { LEVELS, titleLabelById } from "@/constants/gamification";
import { motion } from "@/constants/motion";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import { buildWeeklyReport, isFlashcardNote, isMistakeNote, isSacPanicNote } from "@/utils/vceCoach";
import { getActiveStreak } from "@/utils/streaks";

const startOfWeek = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
};

export default function InsightsScreen() {
  useTrackScreen("insights");
  const { subjects, sessions, events, stats, goals, savedQuestions, notes, gamification, loading, fetchAll } = useAppStore();

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const xp = gamification?.totalXp ?? 0;
  const level = LEVELS.find((item) => item.level === (gamification?.level ?? 1)) ?? LEVELS[0];
  const nextLevel = LEVELS.find((item) => item.xp > xp) ?? LEVELS[LEVELS.length - 1];
  const previousLevel = LEVELS.filter((item) => item.xp <= xp).at(-1) ?? LEVELS[0];
  const xpProgress = nextLevel.xp === previousLevel.xp ? 1 : (xp - previousLevel.xp) / (nextLevel.xp - previousLevel.xp);
  const xpCaption = nextLevel.xp > xp ? `${nextLevel.xp - xp} XP to ${nextLevel.title}` : "Max level unlocked";
  const todayMinutes = Math.round((stats?.todaySeconds ?? 0) / 60);
  const weekMinutes = Math.round((stats?.weekSeconds ?? 0) / 60);
  const monthMinutes = Math.round((stats?.monthSeconds ?? 0) / 60);
  const activeStreak = getActiveStreak(gamification);
  const dailyTargetMinutes = useMemo(() => {
    const weeklyHours = goals.reduce((sum, goal) => sum + Number(goal.weeklyHoursTarget ?? 0), 0);
    return weeklyHours ? Math.round((weeklyHours * 60) / 7) : 120;
  }, [goals]);
  const weekStart = useMemo(startOfWeek, []);
  const weeklyReport = useMemo(
    () => buildWeeklyReport({ subjects, sessions, goals, notes, savedQuestions, gamification }),
    [gamification, goals, notes, savedQuestions, sessions, subjects]
  );
  const chartData = useMemo(
    () =>
      Object.values(stats?.perSubject ?? {}).map((item) => ({
        label: item.subjectName,
        value: item.seconds / 3600,
        color: item.color
      })),
    [stats?.perSubject]
  );
  const weeklySecondsBySubject = useMemo(
    () =>
      sessions.reduce<Record<string, number>>((acc, session) => {
        if (!session.subjectId || new Date(session.createdAt) < weekStart) return acc;
        acc[session.subjectId] = (acc[session.subjectId] ?? 0) + session.durationSeconds;
        return acc;
      }, {}),
    [sessions, weekStart]
  );
  const subjectPace = useMemo(
    () =>
      subjects
        .map((subject) => {
          const goal = goals.find((item) => item.subjectId === subject.id);
          const targetHours = Number(goal?.weeklyHoursTarget ?? 5);
          const weekHours = (weeklySecondsBySubject[subject.id] ?? 0) / 3600;
          const progress = targetHours ? weekHours / targetHours : 0;
          return { subject, targetHours, weekHours, progress };
        })
        .sort((a, b) => a.progress - b.progress || a.subject.subjectName.localeCompare(b.subject.subjectName)),
    [goals, subjects, weeklySecondsBySubject]
  );
  const continueItems = useMemo(() => {
    const latestPanicPlan = notes.filter(isSacPanicNote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const latestMistake = notes.filter(isMistakeNote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const latestFlashcard = notes.filter(isFlashcardNote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

    return [
      latestPanicPlan
        ? {
            icon: "calendar-alert" as const,
            title: "Resume SAC plan",
            body: latestPanicPlan.title.replace(/^SAC Panic:\s*/, ""),
            route: "/(tabs)/study" as const
          }
        : null,
      latestMistake
        ? {
            icon: "alert-circle-check-outline" as const,
            title: "Review latest mistake",
            body: latestMistake.title.replace(/^Mistake:\s*/, ""),
            route: "/(tabs)/questions" as const
          }
        : null,
      latestFlashcard
        ? {
            icon: "cards-outline" as const,
            title: "Flip flashcards",
            body: latestFlashcard.title.replace(/^Flashcard:\s*/, ""),
            route: "/(tabs)/questions" as const
          }
        : null
    ].filter(Boolean) as {
      icon: keyof typeof MaterialCommunityIcons.glyphMap;
      title: string;
      body: string;
      route: "/(tabs)/study" | "/(tabs)/questions";
    }[];
  }, [notes]);

  if (loading && !stats) {
    return (
      <Screen>
        <SkeletonStack />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Insights</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Study report
          </Text>
        </View>
        <Button mode="outlined" icon="home-outline" onPress={() => router.push("/(tabs)")}>
          Home
        </Button>
      </View>

      <Animated.View entering={motion.card(16)}>
        <AppCard style={styles.levelCard}>
          <ProgressRing
            size={104}
            stroke={9}
            progress={xpProgress}
            label={`Lvl ${gamification?.level ?? 1}`}
            sublabel={`${gamification?.xpBalance ?? 0} coins`}
            color={palette.warning}
          />
          <View style={styles.levelText}>
            <Text style={styles.levelTitle}>{level.title}</Text>
            <Text style={styles.muted}>{titleLabelById(gamification?.activeTitle)}</Text>
            <Text style={styles.xpCaption}>{xpCaption}</Text>
            <View style={styles.xpStats}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{xp}</Text>
                <Text style={styles.statLabel}>total XP</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{activeStreak}</Text>
                <Text style={styles.statLabel}>day streak</Text>
              </View>
            </View>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(38)}>
        <AppCard style={styles.reportCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Weekly study report
              </Text>
              <Text style={styles.muted}>The heavier read on what your week is doing.</Text>
            </View>
            <View style={styles.reportBadge}>
              <Text style={styles.reportBadgeValue}>{weeklyReport.totalMinutes}</Text>
              <Text style={styles.reportBadgeLabel}>min</Text>
            </View>
          </View>
          {weeklyReport.lines.map((line) => (
            <Text key={line} style={styles.reportLine}>
              - {line}
            </Text>
          ))}
          <Text style={styles.nextActionText}>{weeklyReport.nextMove}</Text>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(58)}>
        <AppCard style={styles.metricCard}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Study pulse
          </Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{todayMinutes}</Text>
              <Text style={styles.metricLabel}>today min</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{weekMinutes}</Text>
              <Text style={styles.metricLabel}>week min</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{monthMinutes}</Text>
              <Text style={styles.metricLabel}>month min</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{notes.length + savedQuestions.length}</Text>
              <Text style={styles.metricLabel}>learning items</Text>
            </View>
          </View>
          <View style={styles.todayTargetRow}>
            <ProgressRing
              size={84}
              stroke={8}
              progress={todayMinutes / dailyTargetMinutes}
              label={`${Math.min(100, Math.round((todayMinutes / dailyTargetMinutes) * 100))}%`}
              sublabel="today"
              color={palette.success}
            />
            <View style={styles.flexText}>
              <Text style={styles.targetTitle}>Daily target</Text>
              <Text style={styles.muted}>
                {todayMinutes}/{dailyTargetMinutes} minutes logged. Upcoming assessments tracked: {events.filter((event) => !event.completed).length}.
              </Text>
            </View>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(78)}>
        <AppCard style={styles.chartCard}>
          <View style={styles.rowBetween}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Subject mix
            </Text>
            <Text style={styles.muted}>{Math.round((stats?.weekSeconds ?? 0) / 3600)}h this week</Text>
          </View>
          <WeeklyChart data={chartData} />
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(98)}>
        <AppCard style={styles.section}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Weekly pace
          </Text>
          {subjectPace.length ? (
            subjectPace.map((item) => (
              <View key={item.subject.id} style={styles.paceRow}>
                <View style={[styles.subjectDot, { backgroundColor: item.subject.color }]} />
                <View style={styles.paceText}>
                  <Text style={styles.paceTitle} numberOfLines={1}>
                    {item.subject.subjectName}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {Math.round(item.weekHours * 10) / 10}/{item.targetHours || 0}h target
                  </Text>
                </View>
                <Text style={[styles.paceValue, item.progress >= 1 ? styles.paceDone : styles.paceBehind]}>
                  {Math.round(item.progress * 100)}%
                </Text>
              </View>
            ))
          ) : (
            <EmptyState title="No subject goals yet" body="Add subjects and weekly targets from Profile." />
          )}
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(118)}>
        <AppCard style={styles.section}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Continue
          </Text>
          {continueItems.length ? (
            continueItems.map((item) => (
              <Pressable key={item.title} style={styles.continueRow} onPress={() => router.push(item.route)}>
                <View style={styles.continueIcon}>
                  <MaterialCommunityIcons name={item.icon} color={palette.info} size={18} />
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.paceTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {item.body}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyState title="Nothing paused" body="SAC plans, mistakes and flashcards will appear here after you use them." />
          )}
        </AppCard>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    marginBottom: 4
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  flexText: {
    flex: 1,
    minWidth: 0
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  levelCard: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    borderColor: "rgba(245,158,11,0.24)",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  levelText: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  levelTitle: {
    color: palette.text,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Outfit_700Bold"
  },
  xpCaption: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  xpStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statTile: {
    minWidth: 104,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10
  },
  statValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12
  },
  reportCard: {
    gap: 10,
    borderColor: "rgba(74,222,128,0.22)",
    backgroundColor: "rgba(74,222,128,0.07)"
  },
  reportBadge: {
    minWidth: 78,
    minHeight: 58,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.success}18`,
    borderWidth: 1,
    borderColor: `${palette.success}55`,
    paddingHorizontal: 10
  },
  reportBadgeValue: {
    color: palette.text,
    fontSize: 20,
    fontFamily: "Outfit_700Bold"
  },
  reportBadgeLabel: {
    color: palette.success,
    fontSize: 11,
    fontFamily: "Outfit_700Bold"
  },
  reportLine: {
    color: palette.text,
    lineHeight: 20
  },
  nextActionText: {
    color: palette.info,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  metricCard: {
    gap: 14
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metricTile: {
    minWidth: 126,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12
  },
  metricValue: {
    color: palette.text,
    fontSize: 22,
    fontFamily: "Outfit_700Bold"
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18
  },
  todayTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  targetTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    marginBottom: 2
  },
  chartCard: {
    gap: 8
  },
  section: {
    gap: 12
  },
  paceRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  subjectDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  paceText: {
    flex: 1,
    minWidth: 0
  },
  paceTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  paceValue: {
    width: 54,
    textAlign: "right",
    fontFamily: "Outfit_700Bold"
  },
  paceDone: {
    color: palette.success
  },
  paceBehind: {
    color: palette.warning
  },
  continueRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  continueIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.info}18`
  }
});
