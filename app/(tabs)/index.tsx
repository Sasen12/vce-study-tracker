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
import type { DailyInspiration, StudyEvent } from "@/types";
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

const fallbackDailyInspiration: DailyInspiration = {
  quote: "Small honest effort beats dramatic panic.",
  tip: "Pick one thing you can mark or check. Evidence beats vague revision.",
  action: "Do 12 focused minutes, then write the correction."
};

const themeRequestThankYouEmail = "lakeeshahaffi@yahoo.com";

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const {
    subjects,
    sessions,
    events,
    stats,
    goals,
    gamification,
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

  const weekStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date;
  }, []);

  const weeklySecondsBySubject = useMemo(
    () =>
      sessions.reduce<Record<string, number>>((acc, session) => {
        if (!session.subjectId || new Date(session.createdAt) < weekStart) return acc;
        acc[session.subjectId] = (acc[session.subjectId] ?? 0) + session.durationSeconds;
        return acc;
      }, {}),
    [sessions, weekStart]
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

  const quickSubject = subjects.find((subject) => subject.id === quickSubjectId) ?? subjects[0];
  const leaderboardPromptVisible = Boolean(gamification && gamification.leaderboardPromptedAt == null);
  const showThemeRequestThankYou = user?.email?.trim().toLowerCase() === themeRequestThankYouEmail;
  const nextBestMove = useMemo(() => {
    const urgentEvent = upcomingEvents.find((event) => daysUntil(event.eventDate) <= 7);
    const weakestSubject = subjects
      .map((subject) => {
        const goal = goals.find((item) => item.subjectId === subject.id);
        const targetMinutes = Number(goal?.weeklyHoursTarget ?? 0) * 60;
        const weekMinutes = Math.round((weeklySecondsBySubject[subject.id] ?? 0) / 60);
        return {
          subject,
          targetMinutes,
          weekMinutes,
          ratio: targetMinutes ? weekMinutes / targetMinutes : 1
        };
      })
      .filter((item) => item.targetMinutes > 0)
      .sort((a, b) => a.ratio - b.ratio)[0];

    if (urgentEvent) {
      return {
        icon: "calendar-alert",
        title: "Protect the next deadline",
        body: `${urgentEvent.title} is ${countdownLabel(urgentEvent)}. Start with one focused block for ${
          urgentEvent.subject?.subjectName ?? "that subject"
        }.`,
        action: "Study it",
        route: "study" as const,
        subjectId: urgentEvent.subjectId ?? quickSubject?.id
      };
    }

    if (weakestSubject && weakestSubject.ratio < 0.75) {
      return {
        icon: "scale-balance",
        title: "Balance the week",
        body: `${weakestSubject.subject.subjectName} is at ${weakestSubject.weekMinutes}/${weakestSubject.targetMinutes} target minutes.`,
        action: "Start block",
        route: "study" as const,
        subjectId: weakestSubject.subject.id
      };
    }

    if (todayMinutes < dailyTargetMinutes) {
      return {
        icon: "timer-play-outline",
        title: "Hit today's floor",
        body: `${Math.max(0, dailyTargetMinutes - todayMinutes)} minutes gets you to today's target.`,
        action: "Start timer",
        route: "study" as const,
        subjectId: quickSubject?.id
      };
    }

    return {
      icon: "cards-outline",
      title: "Bank retrieval practice",
      body: "You are on pace. A short question drill will keep recall sharp without adding clutter.",
      action: "Practice",
      route: "questions" as const,
      subjectId: undefined
    };
  }, [dailyTargetMinutes, goals, quickSubject?.id, subjects, todayMinutes, upcomingEvents, weeklySecondsBySubject]);

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

      {showThemeRequestThankYou ? (
        <Animated.View entering={motion.card(18)}>
          <AppCard style={styles.thankYouCard}>
            <View style={styles.thankYouIcon}>
              <MaterialCommunityIcons name="flower-tulip-outline" color="#F9A8D4" size={22} />
            </View>
            <View style={styles.thankYouText}>
              <Text style={styles.thankYouTitle}>Thank you, Lakeesha</Text>
              <Text style={styles.thankYouBody}>
                Your seasonal theme idea helped shape the new cute theme drop, so Cherry Blossom has been unlocked for
                you as a thank-you.
              </Text>
            </View>
          </AppCard>
        </Animated.View>
      ) : null}

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

      <Animated.View entering={motion.card(65)}>
        <AppCard style={styles.nextMoveCard}>
          <View style={styles.nextMoveTop}>
            <View style={styles.nextMoveIcon}>
              <MaterialCommunityIcons
                name={nextBestMove.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                color={palette.primary}
                size={22}
              />
            </View>
            <View style={styles.nextMoveText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                {nextBestMove.title}
              </Text>
              <Text style={styles.muted}>{nextBestMove.body}</Text>
            </View>
          </View>
          <Button
            mode="contained"
            icon={nextBestMove.route === "questions" ? "cards-outline" : "play"}
            onPress={() =>
              nextBestMove.route === "questions"
                ? router.push("/(tabs)/questions")
                : router.push({
                    pathname: "/(tabs)/study",
                    params: nextBestMove.subjectId ? { subjectId: nextBestMove.subjectId } : {}
                  })
            }
          >
            {nextBestMove.action}
          </Button>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(90)}>
        <AppCard>
          <XPBar gamification={gamification} />
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
              session count will be visible in Community.
            </Text>
            {leaderboardError ? <Text style={styles.error}>{leaderboardError}</Text> : null}
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
  thankYouCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderColor: "rgba(249,168,212,0.24)",
    backgroundColor: "rgba(249,168,212,0.08)"
  },
  thankYouIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,168,212,0.14)"
  },
  thankYouText: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  thankYouTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  thankYouBody: {
    color: palette.muted,
    lineHeight: 20
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
  nextMoveCard: {
    gap: 14,
    borderColor: "rgba(124,110,255,0.22)",
    backgroundColor: "rgba(124,110,255,0.08)"
  },
  nextMoveTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  nextMoveIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.primary}18`
  },
  nextMoveText: {
    flex: 1,
    minWidth: 0
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
