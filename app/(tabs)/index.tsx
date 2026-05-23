import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, Dialog, Portal, Text, TextInput } from "react-native-paper";
import Animated from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubjectSelector } from "@/components/ui/SubjectSelector";
import { StreakWidget } from "@/components/gamification/StreakWidget";
import { motion } from "@/constants/motion";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { studyApi } from "@/services/studyApi";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import type { DailyInspiration, StudyEvent, UserGiftMessage, UserSubject } from "@/types";
import { isStudyTimeEvent } from "@/utils/studyEvents";
import {
  buildSacPanicPlan,
  buildWeaknessSummary,
  globalStudySearch,
  sacPanicTag
} from "@/utils/vceCoach";
import { getActiveStreak } from "@/utils/streaks";

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

const normaliseLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const subjectForDeadline = (event: StudyEvent, subjects: UserSubject[]) => {
  const title = normaliseLabel(event.title);
  const titleMatch = subjects.find((subject) => {
    const subjectName = normaliseLabel(subject.subjectName);
    return Boolean(subjectName) && title.includes(subjectName);
  });

  return titleMatch ?? event.subject ?? null;
};

const fallbackDailyInspiration: DailyInspiration = {
  quote: "Small honest effort beats dramatic panic.",
  tip: "Pick one thing you can mark or check. Evidence beats vague revision.",
  action: "Do 12 focused minutes, then write the correction."
};

const themeRequestThankYouEmail = "lakeeshahaffi@yahoo.com";
const themeRequestThankYouThemeId = "cherry_blossom";

const messageIconFor = (giftType: string): keyof typeof MaterialCommunityIcons.glyphMap =>
  giftType === "leaderboard" ? "trophy-outline" : "gift-outline";

const messageIconColorFor = (giftType: string) => (giftType === "leaderboard" ? palette.warning : palette.warning);

const messageActionFor = (giftType: string) => (giftType === "leaderboard" ? "Got it" : "Nice");

type BriefItem = {
  label: string;
  title: string;
  body: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
};

type ParkingLotItem = {
  id: string;
  text: string;
  createdAt: string;
};

const parkingLotKeyFor = (userId?: string) => `vce_quiet_parking_lot_${userId ?? "guest"}`;

const briefFallback = (subjects: UserSubject[]): BriefItem => ({
  label: "Warm-up",
  title: subjects.length ? "Start with the subject that feels easiest to open." : "Add subjects when you are ready.",
  body: subjects.length ? "A small clean start beats waiting for perfect motivation." : "Once subjects exist, Home can build a sharper brief.",
  icon: subjects.length ? "timer-outline" : "book-plus-outline",
  accent: subjects.length ? palette.success : palette.info
});

export default function DashboardScreen() {
  useTrackScreen("home");
  const user = useAuthStore((state) => state.user);
  const {
    subjects,
    sessions,
    events,
    stats,
    goals,
    savedQuestions,
    notes,
    resources,
    gamification,
    loading,
    error,
    fetchAll,
    createNote,
    setLeaderboardPreference
  } = useAppStore();
  const [dailyInspiration, setDailyInspiration] = useState<DailyInspiration>(fallbackDailyInspiration);
  const [giftMessages, setGiftMessages] = useState<UserGiftMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [panicOpen, setPanicOpen] = useState(false);
  const [panicSubjectId, setPanicSubjectId] = useState<string | null>(null);
  const [panicTopic, setPanicTopic] = useState("");
  const [panicDate, setPanicDate] = useState("");
  const [panicConfidenceBefore, setPanicConfidenceBefore] = useState("2");
  const [panicConfidenceAfter, setPanicConfidenceAfter] = useState("3");
  const [panicMessage, setPanicMessage] = useState<string | null>(null);
  const [savingPanicPlan, setSavingPanicPlan] = useState(false);
  const [parkingText, setParkingText] = useState("");
  const [parkingLot, setParkingLot] = useState<ParkingLotItem[]>([]);
  const [parkingNotice, setParkingNotice] = useState<string | null>(null);
  const [savingParkingNote, setSavingParkingNote] = useState(false);
  const [leaderboardSaving, setLeaderboardSaving] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const parkingKey = parkingLotKeyFor(user?.id);
      fetchAll();
      AsyncStorage.getItem(parkingKey)
        .then((value) => {
          if (!active) return;
          if (!value) {
            setParkingLot([]);
            return;
          }
          const parsed = JSON.parse(value) as unknown;
          if (Array.isArray(parsed)) {
            setParkingLot(
              parsed.filter(
                (item): item is ParkingLotItem =>
                  Boolean(item) &&
                  typeof item === "object" &&
                  "id" in item &&
                  "text" in item &&
                  "createdAt" in item &&
                  typeof item.id === "string" &&
                  typeof item.text === "string" &&
                  typeof item.createdAt === "string"
              )
            );
            return;
          }
          setParkingLot([]);
        })
        .catch(() => {
          if (active) setParkingLot([]);
        });
      studyApi
        .dailyInspiration()
        .then(({ inspiration }) => {
          if (active) setDailyInspiration(inspiration);
        })
        .catch(() => undefined);
      studyApi
        .giftMessages()
        .then(({ gifts }) => {
          if (active) setGiftMessages(gifts.filter((gift) => !gift.readAt));
        })
        .catch(() => undefined);

      return () => {
        active = false;
      };
    }, [fetchAll, user?.id])
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

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => !event.completed && !isStudyTimeEvent(event) && daysUntil(event.eventDate) >= 0)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
        .slice(0, 3),
    [events]
  );

  const defaultSubject = subjects[0] ?? null;
  const panicSubject = subjects.find((subject) => subject.id === panicSubjectId) ?? defaultSubject;
  const nextDeadline = upcomingEvents[0] ?? null;
  const nextDeadlineSubject = nextDeadline ? subjectForDeadline(nextDeadline, subjects) : null;
  const leaderboardPromptVisible = Boolean(
    gamification && !gamification.leaderboardOptIn && gamification.leaderboardPromptedAt == null
  );
  const showThemeRequestThankYou =
    user?.email?.trim().toLowerCase() === themeRequestThankYouEmail &&
    Boolean(gamification?.unlockedCosmetics.includes(themeRequestThankYouThemeId));
  const activeStreak = getActiveStreak(gamification);
  const weaknessSummary = useMemo(
    () => buildWeaknessSummary({ subjects, sessions, goals, notes, savedQuestions, events }),
    [events, goals, notes, savedQuestions, sessions, subjects]
  );
  const quietBrief = useMemo(() => {
    const items: BriefItem[] = [];

    if (nextDeadline) {
      items.push({
        label: "Protect",
        title: nextDeadline.title,
        body: `${countdownLabel(nextDeadline)}. Start with one thing you can finish tonight.`,
        icon: "calendar-alert",
        accent: palette.warning
      });
    }

    if (weaknessSummary.weakSubject) {
      items.push({
        label: "Repair",
        title: weaknessSummary.weakSubject.subjectName,
        body: weaknessSummary.nextAction,
        icon: "brain",
        accent: palette.info
      });
    }

    if (subjects.length) {
      const todaySeconds = stats?.todaySeconds ?? 0;
      items.push({
        label: todaySeconds > 0 ? "Keep warm" : "Start",
        title: todaySeconds > 0 ? "Bank one more clean block." : "Do the first 25 minutes.",
        body: todaySeconds > 0 ? "Momentum is already open. Add one focused repair before stopping." : "No drama: timer on, one topic, one visible result.",
        icon: "timer-sand",
        accent: palette.success
      });
    }

    if (!items.length) items.push(briefFallback(subjects));
    return items.slice(0, 3);
  }, [nextDeadline, stats?.todaySeconds, subjects, weaknessSummary.nextAction, weaknessSummary.weakSubject]);
  const searchResults = useMemo(
    () => globalStudySearch({ query: searchQuery, notes, savedQuestions, events, resources }),
    [events, notes, resources, savedQuestions, searchQuery]
  );

  const openPanicForEvent = (event?: StudyEvent) => {
    const eventSubject = event ? subjectForDeadline(event, subjects) : defaultSubject;
    setPanicSubjectId(eventSubject?.id ?? defaultSubject?.id ?? null);
    setPanicTopic(event?.description?.trim() || event?.title || "");
    setPanicDate(event?.eventDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setPanicConfidenceBefore("2");
    setPanicConfidenceAfter("3");
    setPanicMessage(null);
    setPanicOpen(true);
  };

  const savePanicPlan = async () => {
    if (!panicSubject || !panicTopic.trim() || !panicDate.trim()) {
      setPanicMessage("Pick a subject, topic and SAC date first.");
      return;
    }
    setSavingPanicPlan(true);
    setPanicMessage(null);
    try {
      const plan = buildSacPanicPlan({
        subject: panicSubject,
        topic: panicTopic.trim(),
        sacDate: panicDate.trim(),
        notes,
        savedQuestions,
        sessions
      });
      await createNote({
        subjectId: panicSubject.id,
        title: `SAC Panic: ${panicSubject.subjectName} - ${panicTopic.trim()}`.slice(0, 140),
        noteType: "general",
        tags: [sacPanicTag, "sac-plan", panicTopic.trim().toLowerCase()],
        body: [
          plan.body,
          "",
          `Confidence before: ${panicConfidenceBefore}/5`,
          `Confidence after plan: ${panicConfidenceAfter}/5`
        ].join("\n")
      });
      setPanicMessage("Saved. It will show in Continue and Notes.");
      await fetchAll();
    } catch (error) {
      setPanicMessage(error instanceof Error ? error.message : "Could not save the SAC plan.");
    } finally {
      setSavingPanicPlan(false);
    }
  };

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

  const dismissGiftMessage = async (id: string) => {
    setGiftMessages((current) => current.filter((gift) => gift.id !== id));
    try {
      await studyApi.markGiftMessageRead(id);
    } catch {
      // The message can safely stay dismissed locally; it will retry on next login if the server update failed.
    }
  };

  const persistParkingLot = async (items: ParkingLotItem[]) => {
    setParkingLot(items);
    await AsyncStorage.setItem(parkingLotKeyFor(user?.id), JSON.stringify(items));
  };

  const addParkingItem = async () => {
    const cleanText = parkingText.trim();
    if (!cleanText) return;
    const nextItems = [
      { id: `${Date.now()}`, text: cleanText, createdAt: new Date().toISOString() },
      ...parkingLot
    ].slice(0, 6);
    setParkingText("");
    setParkingNotice(null);
    await persistParkingLot(nextItems);
  };

  const removeParkingItem = async (id: string) => {
    setParkingNotice(null);
    await persistParkingLot(parkingLot.filter((item) => item.id !== id));
  };

  const saveParkingLotAsNote = async () => {
    if (!parkingLot.length) return;
    setSavingParkingNote(true);
    setParkingNotice(null);
    try {
      const title = `Parking Lot - ${new Date().toISOString().slice(0, 10)}`;
      const body = parkingLot
        .map((item) => {
          const time = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(new Date(item.createdAt));
          return `- ${item.text} (${time})`;
        })
        .join("\n");
      await createNote({
        title,
        noteType: "general",
        tags: ["parking-lot", "quick-capture"],
        body
      });
      await persistParkingLot([]);
      setParkingNotice("Saved to Notes and cleared.");
      await fetchAll();
    } catch (error) {
      setParkingNotice(error instanceof Error ? error.message : "Could not save parking lot.");
    } finally {
      setSavingParkingNote(false);
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
        <StreakWidget streak={activeStreak} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Animated.View entering={motion.card(14)}>
        <AppCard style={styles.searchCard}>
          <View style={styles.browserSearchRow}>
            <MaterialCommunityIcons name="magnify" color={palette.muted} size={22} />
            <TextInput
              mode="flat"
              dense
              placeholder="Search notes, questions, files, events"
              value={searchQuery}
              onChangeText={setSearchQuery}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              style={styles.browserSearchInput}
              contentStyle={styles.browserSearchContent}
            />
            <Pressable style={styles.levelChip} onPress={() => router.push("/(tabs)/insights")}>
              <MaterialCommunityIcons name="map-search-outline" color={palette.warning} size={18} />
              <View style={styles.levelChipText}>
                <Text style={styles.levelChipTitle}>Lvl {gamification?.level ?? 1}</Text>
                <Text style={styles.levelChipSub} numberOfLines={1}>
                  Student Map
                </Text>
              </View>
            </Pressable>
          </View>
          {searchResults.length ? (
            <View style={styles.searchResults}>
              {searchResults.map((result) => (
                <Pressable key={`${result.type}-${result.id}`} style={styles.searchResultRow} onPress={() => router.push(result.route)}>
                  <Text style={styles.searchType}>{result.type}</Text>
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchTitle} numberOfLines={1}>
                      {result.title}
                    </Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {result.detail}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : searchQuery.trim().length > 1 ? (
            <Text style={styles.muted}>No match yet. Try a subject, topic, file name, or command term.</Text>
          ) : null}
        </AppCard>
      </Animated.View>

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

      <Animated.View entering={motion.card(34)}>
        <AppCard style={styles.launchpadCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Quiet Launchpad
              </Text>
              <Text style={styles.muted}>A clean brief plus a place to park distracting thoughts.</Text>
            </View>
            <MaterialCommunityIcons name="rocket-launch-outline" color={palette.info} size={24} />
          </View>

          <View style={styles.briefList}>
            {quietBrief.map((item) => (
              <View key={`${item.label}-${item.title}`} style={styles.briefItem}>
                <View style={[styles.briefIcon, { backgroundColor: `${item.accent}18` }]}>
                  <MaterialCommunityIcons name={item.icon} color={item.accent} size={20} />
                </View>
                <View style={styles.flexText}>
                  <Text style={[styles.briefLabel, { color: item.accent }]}>{item.label}</Text>
                  <Text style={styles.briefTitle}>{item.title}</Text>
                  <Text style={styles.muted}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Button
              mode="contained"
              icon="timer-play-outline"
              disabled={!subjects.length}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/study",
                  params: nextDeadlineSubject?.id ? { subjectId: nextDeadlineSubject.id } : {}
                })
              }
            >
              Start block
            </Button>
            <Button mode="outlined" icon="cards-outline" onPress={() => router.push("/(tabs)/questions")}>
              Make drill
            </Button>
          </View>

          <View style={styles.parkingBox}>
            <View style={styles.rowBetween}>
              <Text style={styles.parkingTitle}>Parking lot</Text>
              {parkingLot.length ? (
                <Button compact mode="text" icon="note-plus-outline" loading={savingParkingNote} disabled={savingParkingNote} onPress={saveParkingLotAsNote}>
                  Save
                </Button>
              ) : null}
            </View>
            <View style={styles.parkingInputRow}>
              <TextInput
                mode="outlined"
                dense
                label="Park a thought"
                value={parkingText}
                onChangeText={setParkingText}
                style={styles.parkingInput}
                onSubmitEditing={addParkingItem}
              />
              <Button mode="contained-tonal" compact icon="plus" disabled={!parkingText.trim()} onPress={addParkingItem}>
                Add
              </Button>
            </View>
            {parkingLot.length ? (
              <View style={styles.parkingList}>
                {parkingLot.map((item) => (
                  <View key={item.id} style={styles.parkingItem}>
                    <Text style={styles.parkingText}>{item.text}</Text>
                    <Pressable accessibilityRole="button" onPress={() => removeParkingItem(item.id)} style={styles.parkingRemove}>
                      <MaterialCommunityIcons name="check" color={palette.success} size={17} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Dump distractions here, then keep studying. They stay local until you save them.</Text>
            )}
            {parkingNotice ? <Text style={parkingNotice.includes("Saved") ? styles.successText : styles.error}>{parkingNotice}</Text> : null}
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(40)}>
        <AppCard style={styles.panicCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                SAC Panic Mode
              </Text>
              <Text style={styles.muted}>Build a survival plan from your notes, mistakes, questions and date pressure.</Text>
            </View>
            <Button mode="contained" icon="alert" disabled={!subjects.length} onPress={() => openPanicForEvent(nextDeadline ?? undefined)}>
              Start
            </Button>
          </View>
          {nextDeadline ? (
            <Text style={styles.panicHint}>
              Fast pick: {nextDeadline.title} is {countdownLabel(nextDeadline)}.
            </Text>
          ) : null}
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(82)}>
        <AppCard style={styles.weaknessCard}>
          <View style={styles.nextMoveTop}>
            <View style={styles.weaknessIcon}>
              <MaterialCommunityIcons name="brain" color={palette.warning} size={22} />
            </View>
            <View style={styles.nextMoveText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                VCE Weakness Coach
              </Text>
              <Text style={styles.weaknessTitle}>{weaknessSummary.title}</Text>
              <Text style={styles.muted}>{weaknessSummary.body}</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <Button
              mode="contained"
              icon="timer-play-outline"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/study",
                  params: weaknessSummary.weakSubject ? { subjectId: weaknessSummary.weakSubject.id } : {}
                })
              }
            >
              Fix it
            </Button>
            <Button mode="outlined" icon="cards-outline" onPress={() => router.push("/(tabs)/questions")}>
              Practise
            </Button>
          </View>
          <Text style={styles.nextActionText}>{weaknessSummary.nextAction}</Text>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(96)}>
        <AppCard style={styles.deadlineCard}>
          <View style={styles.nextMoveTop}>
            <View style={styles.nextMoveIcon}>
              <MaterialCommunityIcons name="calendar-alert" color={palette.primary} size={22} />
            </View>
            <View style={styles.nextMoveText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Protect the next deadline
              </Text>
              <Text style={styles.muted}>
                {nextDeadline
                  ? `${nextDeadline.title} is ${countdownLabel(nextDeadline)}. Start with one focused block for ${
                      nextDeadlineSubject?.subjectName ?? "that deadline"
                    }.`
                  : "No assessment deadlines are logged yet. Add SACs, SATs, exams or tasks so Home can protect the nearest one."}
              </Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <Button
              mode="contained"
              icon="play"
              disabled={!nextDeadline}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/study",
                  params: nextDeadlineSubject?.id ? { subjectId: nextDeadlineSubject.id } : {}
                })
              }
            >
              Study it
            </Button>
            <Button mode="outlined" icon="calendar-month" onPress={() => router.push("/(tabs)/calendar")}>
              Calendar
            </Button>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(118)}>
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
                      : `${subjectForDeadline(event, subjects)?.subjectName ?? "No subject"} - ${countdownLabel(event)}`}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyState title="No upcoming dates" body="Add SACs, SATs, exams, and tasks from the calendar tab." />
          )}
        </AppCard>
      </Animated.View>

      {giftMessages.map((gift) => (
        <Animated.View key={gift.id} entering={motion.card(140)}>
          <AppCard style={styles.giftCard}>
            <View style={styles.giftIcon}>
              <MaterialCommunityIcons name={messageIconFor(gift.giftType)} color={messageIconColorFor(gift.giftType)} size={22} />
            </View>
            <View style={styles.giftText}>
              <Text style={styles.giftTitle}>{gift.title}</Text>
              <Text style={styles.giftBody}>{gift.message}</Text>
            </View>
            <Button mode="outlined" compact onPress={() => dismissGiftMessage(gift.id)}>
              {messageActionFor(gift.giftType)}
            </Button>
          </AppCard>
        </Animated.View>
      ))}

      {showThemeRequestThankYou ? (
        <Animated.View entering={motion.card(150)}>
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

      <Portal>
        <Dialog visible={panicOpen} onDismiss={() => setPanicOpen(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>SAC Panic Mode</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {subjects.length ? (
              <SubjectSelector
                subjects={subjects}
                selectedId={panicSubject?.id}
                onSelect={(subject) => setPanicSubjectId(subject.id)}
              />
            ) : null}
            <TextInput mode="outlined" label="Topic" value={panicTopic} onChangeText={setPanicTopic} />
            <TextInput mode="outlined" label="SAC date YYYY-MM-DD" value={panicDate} onChangeText={setPanicDate} />
            <View style={styles.confidenceGrid}>
              <TextInput
                mode="outlined"
                dense
                label="Before /5"
                keyboardType="number-pad"
                value={panicConfidenceBefore}
                onChangeText={setPanicConfidenceBefore}
                style={styles.confidenceInput}
              />
              <TextInput
                mode="outlined"
                dense
                label="After plan /5"
                keyboardType="number-pad"
                value={panicConfidenceAfter}
                onChangeText={setPanicConfidenceAfter}
                style={styles.confidenceInput}
              />
            </View>
            {panicMessage ? <Text style={panicMessage.includes("Saved") ? styles.successText : styles.error}>{panicMessage}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={savingPanicPlan} onPress={() => setPanicOpen(false)}>
              Close
            </Button>
            <Button mode="contained" loading={savingPanicPlan} disabled={savingPanicPlan} onPress={savePanicPlan}>
              Build plan
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={leaderboardPromptVisible} onDismiss={() => undefined} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Join the weekly leaderboard?</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBody}>
              Optional public mode: if you join, other opted-in students can see your display name, weekly XP, study
              minutes and session count in Community. Choose Not now to stay private.
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
  giftCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderColor: "rgba(245,158,11,0.24)",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  giftIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.14)"
  },
  giftText: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  giftTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  giftBody: {
    color: palette.text,
    lineHeight: 20
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
  flexText: {
    flex: 1,
    minWidth: 0
  },
  searchCard: {
    gap: 10,
    paddingVertical: 10,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(255,255,255,0.045)"
  },
  browserSearchRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  browserSearchInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "transparent"
  },
  browserSearchContent: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  levelChip: {
    width: 108,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.34)",
    backgroundColor: "rgba(245,158,11,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8
  },
  levelChipText: {
    flex: 1,
    minWidth: 0
  },
  levelChipTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  levelChipSub: {
    color: palette.warning,
    fontSize: 10,
    fontFamily: "Outfit_700Bold"
  },
  searchResults: {
    gap: 8
  },
  searchResultRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  searchType: {
    width: 74,
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  searchResultText: {
    flex: 1,
    minWidth: 0
  },
  searchTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  launchpadCard: {
    gap: 14,
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(56,189,248,0.07)"
  },
  briefList: {
    gap: 10
  },
  briefItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingVertical: 2
  },
  briefIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  briefLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 2
  },
  briefTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  parkingBox: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12
  },
  parkingTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  parkingInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  parkingInput: {
    flex: 1,
    minWidth: 0
  },
  parkingList: {
    gap: 8
  },
  parkingItem: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.045)",
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  parkingText: {
    flex: 1,
    color: palette.text,
    lineHeight: 19
  },
  parkingRemove: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,222,128,0.12)"
  },
  weaknessCard: {
    gap: 12,
    borderColor: "rgba(245,158,11,0.24)",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  weaknessIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.warning}18`
  },
  weaknessTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    marginBottom: 2
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  nextActionText: {
    color: palette.info,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  panicCard: {
    gap: 12,
    borderColor: "rgba(255,107,107,0.24)",
    backgroundColor: "rgba(255,107,107,0.08)"
  },
  panicHint: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold"
  },
  deadlineCard: {
    gap: 14,
    borderColor: "rgba(124,110,255,0.22)",
    backgroundColor: "rgba(124,110,255,0.08)"
  },
  continueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8
  },
  continueIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.info}18`
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
  dialogContent: {
    gap: 12
  },
  dialogBody: {
    color: palette.muted,
    lineHeight: 21
  },
  confidenceGrid: {
    flexDirection: "row",
    gap: 10
  },
  confidenceInput: {
    flex: 1
  },
  successText: {
    color: palette.success,
    fontFamily: "Outfit_700Bold"
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
  }
});
