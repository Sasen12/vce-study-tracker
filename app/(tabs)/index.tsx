import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import Animated from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SubjectSelector } from "@/components/ui/SubjectSelector";
import { XPBar } from "@/components/gamification/XPBar";
import { StreakWidget } from "@/components/gamification/StreakWidget";
import { WeeklyChart } from "@/components/charts/WeeklyChart";
import { motion } from "@/constants/motion";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { studyApi } from "@/services/studyApi";
import type { DailyInspiration, LeaderboardEntry, StudyEvent } from "@/types";
import { isStudyTimeEvent } from "@/utils/studyEvents";

const dateKey = (value: string | Date) => (typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10));

const daysUntil = (eventDate: string) => {
  const today = new Date();
  const target = new Date(`${eventDate.slice(0, 10)}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const countdownLabel = (event: StudyEvent) => {
  const days = daysUntil(event.eventDate);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
};

const eventIconName = (event: StudyEvent): keyof typeof MaterialCommunityIcons.glyphMap => {
  if (isStudyTimeEvent(event)) return "calendar-clock";
  if (event.eventType === "EXAM") return "school";
  if (event.eventType === "SAC" || event.eventType === "PRACTICE_SAC") return "file-document-edit";
  if (event.eventType === "SAT" || event.eventType === "PRACTICE_SAT") return "clipboard-text-clock";
  return "checkbox-marked-circle-outline";
};

const formatWeekRange = (start?: string, end?: string) => {
  if (!start || !end) return "This week";
  const formatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1);
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
};

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={[styles.leaderboardRow, entry.isCurrentUser && styles.leaderboardRowActive]}>
      <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
      <View style={styles.leaderboardName}>
        <Text style={styles.leaderboardDisplayName} numberOfLines={1}>
          {entry.displayName}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {entry.weekMinutes} min - {entry.sessionCount} sessions
        </Text>
      </View>
      <Text style={styles.leaderboardXp}>{entry.weekXp} XP</Text>
    </View>
  );
}

const fallbackDailyInspiration: DailyInspiration = {
  quote: "Small honest effort beats dramatic panic.",
  tip: "Pick one thing you can mark or check. Evidence beats vague revision.",
  action: "Do 12 focused minutes, then write the correction."
};

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const {
    subjects,
    sessions,
    events,
    stats,
    goals,
    gamification,
    leaderboard,
    loading,
    error,
    fetchAll,
    setLeaderboardPreference
  } = useAppStore();
  const [quickSubjectId, setQuickSubjectId] = useState<string | null>(null);
  const [dailyInspiration, setDailyInspiration] = useState<DailyInspiration>(fallbackDailyInspiration);
  const [leaderboardSaving, setLeaderboardSaving] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchAll();
      studyApi
        .dailyInspiration()
        .then(({ inspiration }) => {
          if (active) setDailyInspiration(inspiration);
        })
        .catch(() => undefined);

      return () => {
        active = false;
      };
    }, [fetchAll])
  );

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long"
      }).format(new Date()),
    []
  );

  const todayMinutes = Math.round((stats?.todaySeconds ?? 0) / 60);
  const subjectNamesToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return Array.from(
      new Set(
        sessions
          .filter((session) => dateKey(session.createdAt) === today)
          .map((session) => session.subject?.subjectName)
          .filter(Boolean)
      )
    ) as string[];
  }, [sessions]);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => !event.completed && !isStudyTimeEvent(event) && daysUntil(event.eventDate) >= 0)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
        .slice(0, 3),
    [events]
  );

  const dailyTargetMinutes = useMemo(() => {
    const weeklyHours = goals.reduce((sum, goal) => sum + Number(goal.weeklyHoursTarget ?? 0), 0);
    return weeklyHours ? Math.round((weeklyHours * 60) / 7) : 120;
  }, [goals]);

  const chartData = useMemo(
    () =>
      Object.values(stats?.perSubject ?? {}).map((item) => ({
        label: item.subjectName,
        value: item.seconds / 3600,
        color: item.color
      })),
    [stats?.perSubject]
  );

  const quickSubject = subjects.find((subject) => subject.id === quickSubjectId) ?? subjects[0];
  const leaderboardPromptVisible = Boolean(gamification && gamification.leaderboardPromptedAt === null);
  const leaderboardEntries = leaderboard?.entries.slice(0, 5) ?? [];
  const viewerRank = leaderboard?.viewer?.rank;

  const chooseLeaderboard = async (optIn: boolean) => {
    setLeaderboardSaving(true);
    setLeaderboardError(null);
    try {
      await setLeaderboardPreference(optIn);
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : "Could not update leaderboard choice");
    } finally {
      setLeaderboardSaving(false);
    }
  };

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
        <View>
          <Text style={styles.date}>{todayLabel}</Text>
          <Text variant="headlineLarge" style={styles.greeting}>
            Hey {user?.displayName ?? "there"}
          </Text>
        </View>
        <StreakWidget streak={gamification?.currentStreak ?? 0} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Animated.View entering={motion.card(25)}>
        <AppCard style={styles.inspirationCard}>
          <View style={styles.inspirationTop}>
            <View style={styles.inspirationBadge}>
              <MaterialCommunityIcons name="lightbulb-on-outline" color={palette.warning} size={18} />
              <Text style={styles.inspirationLabel}>Daily spark</Text>
            </View>
          </View>
          <Text style={styles.quote}>{dailyInspiration.quote}</Text>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="school-outline" color={palette.info} size={18} />
            <Text style={styles.inspirationTip}>{dailyInspiration.tip}</Text>
          </View>
          <Text style={styles.actionText}>Try today: {dailyInspiration.action}</Text>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(40)}>
        <AppCard style={styles.summary}>
          <View style={styles.summaryText}>
            <Text style={styles.label}>Today</Text>
            <Text variant="displaySmall" style={styles.minutes}>
              {todayMinutes}
            </Text>
            <Text style={styles.muted}>
              minutes studied{subjectNamesToday.length ? ` across ${subjectNamesToday.join(", ")}` : ""}
            </Text>
          </View>
          <ProgressRing
            progress={todayMinutes / dailyTargetMinutes}
            label={`${Math.min(100, Math.round((todayMinutes / dailyTargetMinutes) * 100))}%`}
            sublabel="daily"
            color={palette.success}
          />
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(90)}>
        <AppCard>
          <XPBar gamification={gamification} />
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(115)}>
        <AppCard style={styles.leaderboardCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Weekly leaderboard
              </Text>
              <Text style={styles.muted}>{formatWeekRange(leaderboard?.weekStart, leaderboard?.weekEnd)}</Text>
            </View>
            <View style={styles.leaderboardBadge}>
              <MaterialCommunityIcons name="trophy-outline" color={palette.warning} size={16} />
              <Text style={styles.leaderboardBadgeText}>XP</Text>
            </View>
          </View>

          {gamification?.leaderboardOptIn ? (
            <View style={styles.leaderboardStatus}>
              <Text style={styles.leaderboardStatusText}>
                {viewerRank ? `You are #${viewerRank} this week.` : "You are in for this week."}
              </Text>
              <Button compact mode="text" disabled={leaderboardSaving} onPress={() => chooseLeaderboard(false)}>
                Opt out
              </Button>
            </View>
          ) : (
            <View style={styles.leaderboardStatus}>
              <Text style={styles.muted}>Not competing right now.</Text>
              <Button compact mode="contained-tonal" disabled={leaderboardSaving} onPress={() => chooseLeaderboard(true)}>
                Join
              </Button>
            </View>
          )}

          {leaderboardError ? <Text style={styles.error}>{leaderboardError}</Text> : null}

          {leaderboardEntries.length ? (
            <View style={styles.leaderboardList}>
              {leaderboardEntries.map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} />
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>No one has posted weekly XP yet.</Text>
          )}
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(140)}>
        <AppCard style={styles.quickStart}>
          <View style={styles.rowBetween}>
            <View>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Quick start
              </Text>
              <Text style={styles.muted}>Jump straight into focused minutes.</Text>
            </View>
            <Button
              mode="contained"
              icon="play"
              disabled={!quickSubject}
              onPress={() =>
                quickSubject &&
                router.push({
                  pathname: "/(tabs)/study",
                  params: { subjectId: quickSubject.id }
                })
              }
            >
              Start
            </Button>
          </View>
          {subjects.length ? (
            <SubjectSelector
              subjects={subjects}
              selectedId={quickSubject?.id}
              onSelect={(subject) => setQuickSubjectId(subject.id)}
            />
          ) : (
            <EmptyState title="No subjects yet" body="Add subjects when registering or through the backend seed data." />
          )}
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(190)}>
        <AppCard style={styles.section}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Upcoming
          </Text>
          {upcomingEvents.length ? (
            upcomingEvents.map((event) => (
              <Pressable key={event.id} style={styles.eventRow}>
                <View
                  style={[
                    styles.eventIcon,
                    event.eventType === "EXAM"
                      ? styles.exam
                      : event.eventType === "SAC"
                        ? styles.sac
                        : event.eventType === "SAT"
                          ? styles.sat
                          : event.eventType === "PRACTICE_SAC"
                            ? styles.practiceSac
                            : event.eventType === "PRACTICE_SAT"
                              ? styles.practiceSat
                          : isStudyTimeEvent(event)
                            ? styles.studyTime
                            : styles.task
                  ]}
                >
                  <MaterialCommunityIcons name={eventIconName(event)} color={palette.text} size={18} />
                </View>
                <View style={styles.eventText}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {isStudyTimeEvent(event)
                      ? `${event.subject?.subjectName ?? "Flexible"} - ${event.startTime}-${event.endTime}`
                      : `${event.subject?.subjectName ?? "Deleted subject"} - ${countdownLabel(event)}`}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyState title="No upcoming dates" body="Add SACs, SATs, exams, and tasks from the calendar tab." />
          )}
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(240)}>
        <AppCard>
          <View style={styles.rowBetween}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Subject mix
            </Text>
            <Text style={styles.muted}>{Math.round((stats?.weekSeconds ?? 0) / 3600)}h this week</Text>
          </View>
          <WeeklyChart data={chartData} />
        </AppCard>
      </Animated.View>

      <Portal>
        <Dialog visible={leaderboardPromptVisible} onDismiss={() => undefined} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Join the weekly leaderboard?</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBody}>
              Compete on weekly XP with other students who opt in. Your display name, weekly XP, study minutes and
              session count will be visible on the leaderboard.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={leaderboardSaving} onPress={() => chooseLeaderboard(false)}>
              Not now
            </Button>
            <Button mode="contained" loading={leaderboardSaving} disabled={leaderboardSaving} onPress={() => chooseLeaderboard(true)}>
              Join
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  date: {
    color: palette.muted,
    marginBottom: 4
  },
  greeting: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  error: {
    color: palette.secondary
  },
  inspirationCard: {
    gap: 12,
    borderColor: "rgba(96,165,250,0.22)",
    backgroundColor: "rgba(96,165,250,0.08)"
  },
  inspirationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  inspirationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  inspirationLabel: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    textTransform: "uppercase"
  },
  quote: {
    color: palette.text,
    fontSize: 20,
    lineHeight: 27,
    fontFamily: "Outfit_700Bold"
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  inspirationTip: {
    flex: 1,
    color: palette.text,
    lineHeight: 20
  },
  actionText: {
    color: palette.muted,
    lineHeight: 20
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14
  },
  summaryText: {
    flex: 1
  },
  label: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold"
  },
  minutes: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  quickStart: {
    gap: 16
  },
  leaderboardCard: {
    gap: 12
  },
  leaderboardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.14)"
  },
  leaderboardBadgeText: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  leaderboardStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  leaderboardStatusText: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  leaderboardList: {
    gap: 8
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  leaderboardRowActive: {
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.45)",
    backgroundColor: "rgba(124,110,255,0.1)"
  },
  leaderboardRank: {
    width: 38,
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  leaderboardName: {
    flex: 1,
    minWidth: 0
  },
  leaderboardDisplayName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  leaderboardXp: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  section: {
    gap: 12
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  sac: {
    backgroundColor: palette.warning
  },
  exam: {
    backgroundColor: palette.secondary
  },
  sat: {
    backgroundColor: "#F472B6"
  },
  practiceSac: {
    backgroundColor: "#FBBF24"
  },
  practiceSat: {
    backgroundColor: "#F9A8D4"
  },
  task: {
    backgroundColor: palette.info
  },
  studyTime: {
    backgroundColor: palette.success
  },
  eventText: {
    flex: 1
  },
  eventTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  dialog: {
    backgroundColor: palette.surface,
    borderRadius: 8
  },
  dialogTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  dialogBody: {
    color: palette.muted,
    lineHeight: 21
  }
});
