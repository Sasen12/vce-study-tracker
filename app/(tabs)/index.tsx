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
import { PERK_SHOP_ITEMS, hasUnlockedPerk, perkCosmeticId } from "@/constants/gamification";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { studyApi } from "@/services/studyApi";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import type {
  AdaptiveStudyTask,
  DailyInspiration,
  SavedQuestion,
  StudyEvent,
  StudyNote,
  StudyResource,
  StudySession,
  UserGiftMessage,
  UserSubject
} from "@/types";
import { isStudyTimeEvent } from "@/utils/studyEvents";
import {
  buildSacPanicPlan,
  buildWeaknessSummary,
  globalStudySearch,
  sacPanicTag
} from "@/utils/vceCoach";
import { buildPersonalRituals, buildUserStudySignature, type PersonalRitual } from "@/utils/personalization";
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

type ParkingLotItem = {
  id: string;
  text: string;
  createdAt: string;
};

type DeadlineRadar = {
  urgent: number;
  week: number;
  runway: number;
  nearest?: StudyEvent | null;
};

type TonightPlanItem = {
  id: string;
  label: string;
  title: string;
  body: string;
  subjectId?: string | null;
  topic?: string | null;
  minutes: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
};

type RevisionDebtItem = {
  subject: UserSubject;
  staleQuestions: number;
  mistakeLogs: number;
  recentMinutes: number;
  score: number;
};

type EvidenceItem = {
  subject: UserSubject;
  weekMinutes: number;
  notesCount: number;
  questionCount: number;
  resourceCount: number;
  score: number;
  verdict: string;
};

const parkingLotKeyFor = (userId?: string) => `vce_quiet_parking_lot_${userId ?? "guest"}`;

const weekStartDate = () => {
  const date = new Date();
  const dayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOffset);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const clampStudyMinutes = (minutes?: number | null) => {
  const safe = Number.isFinite(minutes ?? NaN) ? Math.round(minutes ?? 25) : 25;
  return Math.min(90, Math.max(10, safe));
};

const topicFromEvent = (event?: StudyEvent | null) =>
  event?.description?.trim() || event?.title.replace(/\b(SAC|SAT|exam|task)\b/gi, "").trim() || null;

const subjectForPlanTask = (task: AdaptiveStudyTask, subjects: UserSubject[]) => {
  const subjectLabel = normaliseLabel(task.subject ?? "");
  return (
    subjects.find((subject) => {
      const subjectName = normaliseLabel(subject.subjectName);
      return Boolean(subjectName) && (subjectLabel.includes(subjectName) || subjectName.includes(subjectLabel));
    }) ?? null
  );
};

const isMistakeEvidence = (note: StudyNote) =>
  note.noteType === "mistake_log" || note.tags.includes("mistake-log") || note.tags.includes("timer-check");

const weekMinutesForSubject = (sessions: StudySession[], subjectId: string, start: Date) =>
  Math.round(
    sessions
      .filter((session) => session.subjectId === subjectId && new Date(session.createdAt) >= start)
      .reduce((sum, session) => sum + session.durationSeconds, 0) / 60
  );

const buildDeadlineRadar = (events: StudyEvent[]): DeadlineRadar => {
  const active = events.filter((event) => !event.completed && !isStudyTimeEvent(event) && daysUntil(event.eventDate) >= 0);
  return active.reduce<DeadlineRadar>(
    (radar, event) => {
      const days = daysUntil(event.eventDate);
      if (days <= 2) radar.urgent += 1;
      else if (days <= 7) radar.week += 1;
      else if (days <= 21) radar.runway += 1;
      if (!radar.nearest || event.eventDate.localeCompare(radar.nearest.eventDate) < 0) radar.nearest = event;
      return radar;
    },
    { urgent: 0, week: 0, runway: 0, nearest: null }
  );
};

const buildRevisionDebt = ({
  subjects,
  sessions,
  notes,
  savedQuestions
}: {
  subjects: UserSubject[];
  sessions: StudySession[];
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
}) => {
  const weekStart = weekStartDate();
  const staleCutoff = addDays(new Date(), -7);

  return subjects
    .map<RevisionDebtItem>((subject) => {
      const staleQuestions = savedQuestions.filter(
        (question) => question.subjectId === subject.id && new Date(question.createdAt) < staleCutoff
      ).length;
      const mistakeLogs = notes.filter((note) => note.subjectId === subject.id && isMistakeEvidence(note)).length;
      const recentMinutes = weekMinutesForSubject(sessions, subject.id, weekStart);
      const score = staleQuestions * 2 + mistakeLogs + (recentMinutes === 0 && (staleQuestions || mistakeLogs) ? 2 : 0);
      return { subject, staleQuestions, mistakeLogs, recentMinutes, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
};

const buildEvidenceItems = ({
  subjects,
  sessions,
  goals,
  notes,
  savedQuestions,
  resources
}: {
  subjects: UserSubject[];
  sessions: StudySession[];
  goals: { subjectId?: string | null; weeklyHoursTarget?: number | null }[];
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  resources: StudyResource[];
}) => {
  const weekStart = weekStartDate();

  return subjects
    .map<EvidenceItem>((subject) => {
      const weekMinutes = weekMinutesForSubject(sessions, subject.id, weekStart);
      const targetMinutes = Math.max(Number(goals.find((goal) => goal.subjectId === subject.id)?.weeklyHoursTarget ?? 4) * 60, 60);
      const notesCount = notes.filter((note) => note.subjectId === subject.id).length;
      const questionCount = savedQuestions.filter((question) => question.subjectId === subject.id).length;
      const resourceCount = resources.filter((resource) => resource.subjectId === subject.id).length;
      const score = Math.min(
        100,
        Math.round(
          Math.min(45, (weekMinutes / targetMinutes) * 45) +
            Math.min(18, notesCount * 6) +
            Math.min(18, questionCount * 6) +
            Math.min(12, resourceCount * 6) +
            (weekMinutes > 0 ? 7 : 0)
        )
      );
      const verdict = score >= 75 ? "Covered" : score >= 45 ? "Building" : "Needs proof";
      return { subject, weekMinutes, notesCount, questionCount, resourceCount, score, verdict };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
};

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
    latestPlan,
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
  const [winText, setWinText] = useState("");
  const [winNotice, setWinNotice] = useState<string | null>(null);
  const [savingWin, setSavingWin] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [perksOpen, setPerksOpen] = useState(false);
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
  const searchResults = useMemo(
    () => globalStudySearch({ query: searchQuery, notes, savedQuestions, events, resources }),
    [events, notes, resources, savedQuestions, searchQuery]
  );
  const deadlineRadar = useMemo(() => buildDeadlineRadar(events), [events]);
  const revisionDebt = useMemo(
    () => buildRevisionDebt({ subjects, sessions, notes, savedQuestions }),
    [notes, savedQuestions, sessions, subjects]
  );
  const evidenceItems = useMemo(
    () => buildEvidenceItems({ subjects, sessions, goals, notes, savedQuestions, resources }),
    [goals, notes, resources, savedQuestions, sessions, subjects]
  );
  const evidenceAverage = useMemo(
    () => Math.round(evidenceItems.reduce((sum, item) => sum + item.score, 0) / Math.max(evidenceItems.length, 1)),
    [evidenceItems]
  );
  const studySignature = useMemo(
    () => buildUserStudySignature({ subjects, sessions, events, goals, notes, savedQuestions, resources }),
    [events, goals, notes, resources, savedQuestions, sessions, subjects]
  );
  const personalRituals = useMemo(
    () => buildPersonalRituals({ subjects, sessions, events, goals, notes, savedQuestions, resources }),
    [events, goals, notes, resources, savedQuestions, sessions, subjects]
  );
  const primaryRitual = personalRituals[0] ?? null;
  const tonightPlan = useMemo(() => {
    const items: TonightPlanItem[] = [];
    const addItem = (item: TonightPlanItem) => {
      if (items.some((current) => current.title === item.title && current.label === item.label)) return;
      items.push(item);
    };

    latestPlan?.tasks?.slice(0, 2).forEach((task, index) => {
      const taskSubject = subjectForPlanTask(task, subjects);
      addItem({
        id: `coach-${index}-${task.title}`,
        label: "Coach plan",
        title: task.title,
        body: `${formatMinutes(clampStudyMinutes(task.minutes))} - ${task.reason}`,
        subjectId: taskSubject?.id ?? null,
        topic: task.topic ?? task.title,
        minutes: clampStudyMinutes(task.minutes),
        icon: "clipboard-list-outline",
        accent: palette.primary
      });
    });

    if (nextDeadline) {
      addItem({
        id: `deadline-${nextDeadline.id}`,
        label: "Deadline shield",
        title: nextDeadline.title,
        body: `${countdownLabel(nextDeadline)}. Do the smallest piece that reduces tomorrow's panic.`,
        subjectId: nextDeadlineSubject?.id ?? nextDeadline.subjectId ?? null,
        topic: topicFromEvent(nextDeadline),
        minutes: daysUntil(nextDeadline.eventDate) <= 2 ? 25 : 35,
        icon: "shield-alert-outline",
        accent: palette.warning
      });
    }

    if (weaknessSummary.weakSubject) {
      addItem({
        id: `weak-${weaknessSummary.weakSubject.id}`,
        label: "Weakness repair",
        title: weaknessSummary.weakSubject.subjectName,
        body: weaknessSummary.nextAction,
        subjectId: weaknessSummary.weakSubject.id,
        topic: weaknessSummary.weakTopic ?? weaknessSummary.weakSubject.subjectName,
        minutes: 25,
        icon: "brain",
        accent: palette.info
      });
    }

    if (revisionDebt[0]) {
      addItem({
        id: `debt-${revisionDebt[0].subject.id}`,
        label: "Debt clear",
        title: revisionDebt[0].subject.subjectName,
        body: `${revisionDebt[0].staleQuestions} old drill${revisionDebt[0].staleQuestions === 1 ? "" : "s"}, ${revisionDebt[0].mistakeLogs} mistake log${revisionDebt[0].mistakeLogs === 1 ? "" : "s"}.`,
        subjectId: revisionDebt[0].subject.id,
        topic: "revision debt",
        minutes: 20,
        icon: "backup-restore",
        accent: palette.secondary
      });
    }

    if (!items.length && defaultSubject) {
      addItem({
        id: `starter-${defaultSubject.id}`,
        label: "First move",
        title: defaultSubject.subjectName,
        body: "Open the timer and create one visible piece of evidence.",
        subjectId: defaultSubject.id,
        topic: defaultSubject.subjectName,
        minutes: 25,
        icon: "timer-outline",
        accent: palette.success
      });
    }

    return items.slice(0, 3);
  }, [
    defaultSubject,
    latestPlan?.tasks,
    nextDeadline,
    nextDeadlineSubject?.id,
    revisionDebt,
    subjects,
    weaknessSummary.nextAction,
    weaknessSummary.weakSubject,
    weaknessSummary.weakTopic
  ]);
  const primaryPlan = tonightPlan[0] ?? null;
  const secondaryPlan = tonightPlan.slice(1, 3);
  const rescueSubject = weaknessSummary.weakSubject ?? nextDeadlineSubject ?? revisionDebt[0]?.subject ?? defaultSubject;
  const rescueTopic = weaknessSummary.weakTopic ?? topicFromEvent(nextDeadline) ?? revisionDebt[0]?.subject.subjectName ?? rescueSubject?.subjectName ?? "one weak area";
  const rescueModeBody = rescueSubject
    ? `Quick pressure block for ${rescueSubject.subjectName}${rescueTopic ? ` - ${rescueTopic}` : ""}. No setup spiral.`
    : "Add a subject first, then rescue mode can choose the repair.";
  const unlockedCosmetics = gamification?.unlockedCosmetics ?? [];
  const rescuePlusUnlocked = hasUnlockedPerk(unlockedCosmetics, "rescue_plus");
  const focusAuraUnlocked = hasUnlockedPerk(unlockedCosmetics, "focus_aura");
  const streakShieldUnlocked = hasUnlockedPerk(unlockedCosmetics, "streak_shield");
  const victoryVaultUnlocked = hasUnlockedPerk(unlockedCosmetics, "victory_vault");
  const bossBattleUnlocked = hasUnlockedPerk(unlockedCosmetics, "boss_battle");
  const unlockedPerkCount = PERK_SHOP_ITEMS.filter((perk) => unlockedCosmetics.includes(perkCosmeticId(perk.id))).length;
  const rescuePresets = rescuePlusUnlocked ? [8, 12, 18] : [12];
  const studiedToday = (stats?.todaySeconds ?? 0) > 0;
  const recentWinLogs = useMemo(
    () =>
      notes
        .filter((note) => note.tags.includes("win-log"))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3),
    [notes]
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

  const openTimerForPlan = (item: TonightPlanItem) => {
    router.push({
      pathname: "/(tabs)/study",
      params: {
        mode: "timer",
        targetMinutes: String(clampStudyMinutes(item.minutes)),
        ...(item.subjectId ? { subjectId: item.subjectId } : {}),
        ...(item.topic ? { rescueTopic: item.topic } : {})
      }
    });
  };

  const openPersonalizedMove = () => {
    router.push({
      pathname: "/(tabs)/study",
      params: {
        mode: "timer",
        targetMinutes: String(clampStudyMinutes(studySignature.nextMove.minutes)),
        ...(studySignature.nextMove.subjectId ? { subjectId: studySignature.nextMove.subjectId } : {}),
        ...(studySignature.nextMove.topic ? { rescueTopic: studySignature.nextMove.topic } : {})
      }
    });
  };

  const openRitual = (ritual: PersonalRitual) => {
    router.push({
      pathname: "/(tabs)/study",
      params: {
        mode: "timer",
        targetMinutes: String(clampStudyMinutes(ritual.minutes)),
        ritualTitle: ritual.title,
        ritualReason: ritual.reason,
        ritualSteps: JSON.stringify(ritual.steps),
        ...(ritual.priority >= 90 ? { ritualFocus: "1" } : {}),
        ...(ritual.subjectId ? { subjectId: ritual.subjectId } : {}),
        ...(ritual.topic ? { rescueTopic: ritual.topic } : {})
      }
    });
  };

  const startRescueMode = (minutes = 12) => {
    if (!rescueSubject) return;
    router.push({
      pathname: "/(tabs)/study",
      params: {
        mode: "timer",
        targetMinutes: String(minutes),
        subjectId: rescueSubject.id,
        rescueTopic,
        rescue: "1"
      }
    });
  };

  const openBossBattle = () => {
    if (!rescueSubject) return;
    router.push({
      pathname: "/(tabs)/questions",
      params: {
        mode: "game",
        subjectId: rescueSubject.id,
        topic: rescueTopic,
        difficulty: "hard",
        count: "5"
      }
    });
  };

  const saveWinLog = async () => {
    const cleanText = winText.trim();
    if (!cleanText) return;
    setSavingWin(true);
    setWinNotice(null);
    try {
      const now = new Date();
      await createNote({
        subjectId: rescueSubject?.id,
        title: `Win log - ${now.toISOString().slice(0, 10)}`,
        noteType: "general",
        tags: ["win-log", "evidence"],
        body: cleanText
      });
      setWinText("");
      setWinNotice("Logged. Tiny proof counts.");
      await fetchAll();
    } catch (error) {
      setWinNotice(error instanceof Error ? error.message : "Could not log that win.");
    } finally {
      setSavingWin(false);
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
                Today Command
              </Text>
              <Text style={styles.muted}>
                {nextDeadline
                  ? `${nextDeadline.title} is ${countdownLabel(nextDeadline)}.`
                  : weaknessSummary.title}
              </Text>
            </View>
            <MaterialCommunityIcons name="rocket-launch-outline" color={palette.info} size={24} />
          </View>

          <Pressable
            accessibilityRole="button"
            style={styles.personalSignal}
            onPress={primaryRitual ? () => openRitual(primaryRitual) : openPersonalizedMove}
          >
            <View
              style={[
                styles.personalSignalIcon,
                { backgroundColor: `${primaryRitual?.accent ?? studySignature.nextMove.accent}18` }
              ]}
            >
              <MaterialCommunityIcons
                name={primaryRitual?.icon ?? studySignature.nextMove.icon}
                color={primaryRitual?.accent ?? studySignature.nextMove.accent}
                size={20}
              />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.personalSignalLabel}>{primaryRitual ? "Forge ritual" : studySignature.profileName}</Text>
              <Text style={styles.personalSignalTitle} numberOfLines={1}>
                {primaryRitual?.title ?? studySignature.nextMove.title}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {primaryRitual?.reason ?? studySignature.nextMove.body}
              </Text>
            </View>
            <Text style={styles.personalSignalDepth}>
              {primaryRitual ? formatMinutes(clampStudyMinutes(primaryRitual.minutes)) : studySignature.depthLabel}
            </Text>
          </Pressable>

          {primaryPlan ? (
            <Pressable accessibilityRole="button" style={styles.planRow} onPress={() => openTimerForPlan(primaryPlan)}>
              <View style={[styles.planIcon, { backgroundColor: `${primaryPlan.accent}18` }]}>
                <MaterialCommunityIcons name={primaryPlan.icon} color={primaryPlan.accent} size={19} />
              </View>
              <View style={styles.flexText}>
                <Text style={[styles.briefLabel, { color: primaryPlan.accent }]}>{primaryPlan.label}</Text>
                <Text style={styles.planTitle}>{primaryPlan.title}</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {primaryPlan.body}
                </Text>
              </View>
              <Text style={styles.planMinutes}>{formatMinutes(clampStudyMinutes(primaryPlan.minutes))}</Text>
            </Pressable>
          ) : (
            <Text style={styles.muted}>Add a subject, deadline, or saved question and Home will choose a cleaner next move.</Text>
          )}

          {secondaryPlan.length ? (
            <View style={styles.nextUpRow}>
              <Text style={styles.nextUpLabel}>Next</Text>
              <Text style={styles.nextUpText} numberOfLines={1}>
                {secondaryPlan.map((item) => item.title).join(" / ")}
              </Text>
            </View>
          ) : null}

          <View style={styles.commandActions}>
            <Button
              mode="contained"
              compact
              icon="timer-play-outline"
              disabled={!subjects.length}
              onPress={() =>
                primaryPlan
                  ? openTimerForPlan(primaryPlan)
                  : router.push({
                      pathname: "/(tabs)/study",
                      params: rescueSubject?.id ? { subjectId: rescueSubject.id } : {}
                    })
              }
            >
              Start
            </Button>
            <Button mode="outlined" compact icon="lifebuoy" disabled={!rescueSubject} onPress={() => startRescueMode(12)}>
              Rescue
            </Button>
            <Button mode="outlined" compact icon="cards-outline" onPress={() => router.push("/(tabs)/questions")}>
              Drill
            </Button>
            <Button mode="text" compact icon="alert" disabled={!subjects.length} onPress={() => openPanicForEvent(nextDeadline ?? undefined)}>
              Panic plan
            </Button>
          </View>

          {streakShieldUnlocked && !studiedToday ? (
            <View style={styles.commandAlert}>
              <MaterialCommunityIcons name="shield-check-outline" color={palette.warning} size={18} />
              <Text style={styles.commandAlertText}>Streak Shield is ready.</Text>
              <Button mode="contained-tonal" compact onPress={() => startRescueMode(8)}>
                8m
              </Button>
            </View>
          ) : null}

          <View style={styles.commandMetrics}>
            <View style={styles.commandMetric}>
              <Text style={styles.commandMetricValue}>{deadlineRadar.urgent + deadlineRadar.week}</Text>
              <Text style={styles.commandMetricLabel}>deadlines</Text>
            </View>
            <View style={styles.commandMetric}>
              <Text style={styles.commandMetricValue}>{revisionDebt.length}</Text>
              <Text style={styles.commandMetricLabel}>repairs</Text>
            </View>
            <View style={styles.commandMetric}>
              <Text style={styles.commandMetricValue}>{evidenceAverage}</Text>
              <Text style={styles.commandMetricLabel}>evidence</Text>
            </View>
            <View style={styles.commandMetric}>
              <Text style={styles.commandMetricValue}>{unlockedPerkCount}</Text>
              <Text style={styles.commandMetricLabel}>perks</Text>
            </View>
          </View>

          <View style={styles.commandToggles}>
            <Button compact mode={captureOpen ? "contained-tonal" : "outlined"} icon="playlist-edit" onPress={() => setCaptureOpen((value) => !value)}>
              Capture
            </Button>
            <Button compact mode={detailsOpen ? "contained-tonal" : "outlined"} icon="view-dashboard-outline" onPress={() => setDetailsOpen((value) => !value)}>
              Details
            </Button>
            <Button compact mode={perksOpen ? "contained-tonal" : "outlined"} icon="star-four-points-outline" onPress={() => setPerksOpen((value) => !value)}>
              Perks
            </Button>
          </View>

          {captureOpen ? (
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

              <View style={styles.winLogBox}>
                <Text style={styles.consoleSectionTitle}>Tiny win log</Text>
                <View style={styles.winInputRow}>
                  <TextInput
                    mode="outlined"
                    dense
                    label="What changed after studying?"
                    value={winText}
                    onChangeText={setWinText}
                    style={styles.winInput}
                    onSubmitEditing={saveWinLog}
                  />
                  <Button mode="contained-tonal" compact icon="check" loading={savingWin} disabled={!winText.trim() || savingWin} onPress={saveWinLog}>
                    Log
                  </Button>
                </View>
                {winNotice ? <Text style={winNotice.includes("Logged") ? styles.successText : styles.error}>{winNotice}</Text> : null}
                {victoryVaultUnlocked ? (
                  <View style={styles.vaultList}>
                    {recentWinLogs.length ? (
                      recentWinLogs.map((note) => (
                        <View key={note.id} style={styles.vaultItem}>
                          <MaterialCommunityIcons name="archive-star-outline" color={palette.warning} size={16} />
                          <View style={styles.flexText}>
                            <Text style={styles.vaultTitle} numberOfLines={1}>
                              {note.body}
                            </Text>
                            <Text style={styles.muted}>{note.createdAt.slice(0, 10)}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.muted}>Victory Vault unlocked. Log a tiny win and it will stay visible here.</Text>
                    )}
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {perksOpen ? (
            <View style={styles.parkingBox}>
              <View style={styles.perkRail}>
                {PERK_SHOP_ITEMS.map((perk) => {
                  const unlockedPerk = unlockedCosmetics.includes(perkCosmeticId(perk.id));
                  return (
                    <Pressable
                      key={perk.id}
                      accessibilityRole="button"
                      style={[styles.perkChip, unlockedPerk && styles.perkChipUnlocked]}
                      onPress={() => router.push({ pathname: "/(tabs)/shop", params: { mode: "perks" } })}
                    >
                      <MaterialCommunityIcons
                        name={perk.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                        color={unlockedPerk ? palette.info : palette.muted}
                        size={16}
                      />
                      <Text style={unlockedPerk ? styles.perkChipTextUnlocked : styles.perkChipText} numberOfLines={1}>
                        {perk.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.perkCountText}>{unlockedPerkCount}/{PERK_SHOP_ITEMS.length} perks unlocked in Shop.</Text>
              {focusAuraUnlocked ? (
                <View style={styles.focusAuraNotice}>
                  <MaterialCommunityIcons name="radar" color={palette.info} size={17} />
                  <Text style={styles.focusAuraText}>Focus Aura is armed for timer sessions.</Text>
                </View>
              ) : null}
              {bossBattleUnlocked ? (
                <Button mode="contained-tonal" compact icon="sword-cross" disabled={!rescueSubject} onPress={openBossBattle}>
                  Boss Battle Deck
                </Button>
              ) : null}
            </View>
          ) : null}
        </AppCard>
      </Animated.View>

      {detailsOpen ? (
        <Animated.View entering={motion.card(38)}>
          <AppCard style={styles.consoleCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Study Command Console
              </Text>
              <Text style={styles.muted}>Five quiet unlockable tools that make the next move obvious.</Text>
            </View>
            <View style={styles.consoleScore}>
              <Text style={styles.consoleScoreValue}>{evidenceAverage}</Text>
              <Text style={styles.consoleScoreLabel}>evidence</Text>
            </View>
          </View>

          <View style={styles.radarGrid}>
            <View style={[styles.radarCell, styles.radarHot]}>
              <Text style={styles.radarValue}>{deadlineRadar.urgent}</Text>
              <Text style={styles.radarLabel}>0-2 days</Text>
            </View>
            <View style={[styles.radarCell, styles.radarWarm]}>
              <Text style={styles.radarValue}>{deadlineRadar.week}</Text>
              <Text style={styles.radarLabel}>this week</Text>
            </View>
            <View style={[styles.radarCell, styles.radarCool]}>
              <Text style={styles.radarValue}>{deadlineRadar.runway}</Text>
              <Text style={styles.radarLabel}>next 21</Text>
            </View>
          </View>
          <Text style={styles.consoleHint}>
            {deadlineRadar.nearest
              ? `Radar: ${deadlineRadar.nearest.title} is ${countdownLabel(deadlineRadar.nearest)}.`
              : "Radar: no deadline pressure logged yet."}
          </Text>

          <View style={styles.perkRail}>
            {PERK_SHOP_ITEMS.map((perk) => {
              const unlockedPerk = unlockedCosmetics.includes(perkCosmeticId(perk.id));
              return (
                <Pressable
                  key={perk.id}
                  accessibilityRole="button"
                  style={[styles.perkChip, unlockedPerk && styles.perkChipUnlocked]}
                  onPress={() => router.push({ pathname: "/(tabs)/shop", params: { mode: "perks" } })}
                >
                  <MaterialCommunityIcons
                    name={perk.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    color={unlockedPerk ? palette.info : palette.muted}
                    size={16}
                  />
                  <Text style={unlockedPerk ? styles.perkChipTextUnlocked : styles.perkChipText} numberOfLines={1}>
                    {perk.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.perkCountText}>{unlockedPerkCount}/{PERK_SHOP_ITEMS.length} perks unlocked in Shop.</Text>

          {focusAuraUnlocked ? (
            <View style={styles.focusAuraNotice}>
              <MaterialCommunityIcons name="radar" color={palette.info} size={17} />
              <Text style={styles.focusAuraText}>Focus Aura is armed for timer sessions.</Text>
            </View>
          ) : null}

          <View style={styles.consoleSection}>
            <View style={styles.rowBetween}>
              <Text style={styles.consoleSectionTitle}>Tonight plan</Text>
              <Button compact mode="text" icon="auto-fix" onPress={() => router.push({ pathname: "/(tabs)/study", params: { mode: "coach" } })}>
                Coach
              </Button>
            </View>
            {tonightPlan.length ? (
              <View style={styles.planList}>
                {tonightPlan.map((item) => (
                  <Pressable key={item.id} accessibilityRole="button" style={styles.planRow} onPress={() => openTimerForPlan(item)}>
                    <View style={[styles.planIcon, { backgroundColor: `${item.accent}18` }]}>
                      <MaterialCommunityIcons name={item.icon} color={item.accent} size={19} />
                    </View>
                    <View style={styles.flexText}>
                      <Text style={[styles.briefLabel, { color: item.accent }]}>{item.label}</Text>
                      <Text style={styles.planTitle}>{item.title}</Text>
                      <Text style={styles.muted} numberOfLines={2}>
                        {item.body}
                      </Text>
                    </View>
                    <Text style={styles.planMinutes}>{formatMinutes(clampStudyMinutes(item.minutes))}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Add a subject or deadline and this becomes a clean nightly checklist.</Text>
            )}
          </View>

          <View style={styles.consoleSplit}>
            <View style={styles.consolePane}>
              <View style={styles.rowBetween}>
                <Text style={styles.consoleSectionTitle}>Revision debt</Text>
                <MaterialCommunityIcons name="backup-restore" color={palette.secondary} size={19} />
              </View>
              {revisionDebt.length ? (
                revisionDebt.map((item) => (
                  <Pressable
                    key={item.subject.id}
                    accessibilityRole="button"
                    style={styles.debtRow}
                    onPress={() => router.push("/(tabs)/questions")}
                  >
                    <View style={[styles.subjectDot, { backgroundColor: item.subject.color || palette.secondary }]} />
                    <View style={styles.flexText}>
                      <Text style={styles.debtTitle}>{item.subject.subjectName}</Text>
                      <Text style={styles.muted} numberOfLines={1}>
                        {item.staleQuestions} old drills, {item.mistakeLogs} mistake logs
                      </Text>
                    </View>
                    <Text style={styles.debtScore}>{item.score}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.muted}>No stale drills waiting. Keep saving marked mistakes as you find them.</Text>
              )}
            </View>

            <View style={styles.consolePane}>
              <View style={styles.rowBetween}>
                <Text style={styles.consoleSectionTitle}>Evidence meter</Text>
                <MaterialCommunityIcons name="chart-timeline-variant" color={palette.success} size={19} />
              </View>
              {evidenceItems.length ? (
                evidenceItems.map((item) => (
                  <View key={item.subject.id} style={styles.evidenceRow}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.evidenceSubject} numberOfLines={1}>
                        {item.subject.subjectName}
                      </Text>
                      <Text style={styles.evidenceVerdict}>{item.verdict}</Text>
                    </View>
                    <View style={styles.evidenceTrack}>
                      <View
                        style={[
                          styles.evidenceFill,
                          { width: `${item.score}%`, backgroundColor: item.subject.color || palette.success }
                        ]}
                      />
                    </View>
                    <Text style={styles.muted} numberOfLines={1}>
                      {formatMinutes(item.weekMinutes)} studied, {item.notesCount} notes, {item.questionCount} drills, {item.resourceCount} files
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.muted}>Evidence appears when subjects, notes, questions or files exist.</Text>
              )}
            </View>
          </View>

          <View style={styles.rescuePanel}>
            <View style={styles.rescueIcon}>
              <MaterialCommunityIcons name="lifebuoy" color={palette.text} size={20} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.rescueTitle}>Rescue mode</Text>
              <Text style={styles.muted}>{rescueModeBody}</Text>
            </View>
            <View style={styles.rescueActions}>
              {rescuePresets.map((minutes) => (
                <Button key={minutes} mode={minutes === 12 ? "contained" : "outlined"} compact disabled={!rescueSubject} onPress={() => startRescueMode(minutes)}>
                  {minutes}m
                </Button>
              ))}
              {!rescuePlusUnlocked ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.lockedPerkButton}
                  onPress={() => router.push({ pathname: "/(tabs)/shop", params: { mode: "perks" } })}
                >
                  <MaterialCommunityIcons name="lock-outline" color={palette.muted} size={15} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {streakShieldUnlocked ? (
            <View style={styles.streakShieldPanel}>
              <View style={styles.shieldIcon}>
                <MaterialCommunityIcons name="shield-check-outline" color={studiedToday ? palette.success : palette.warning} size={20} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.rescueTitle}>Streak Shield</Text>
                <Text style={styles.muted}>
                  {studiedToday ? "Shield quiet. Today already has study evidence." : "No study logged today. Launch an 8 minute shield block."}
                </Text>
              </View>
              <Button mode={studiedToday ? "outlined" : "contained"} compact disabled={!rescueSubject} onPress={() => startRescueMode(8)}>
                {studiedToday ? "Ready" : "8m"}
              </Button>
            </View>
          ) : null}

          {bossBattleUnlocked ? (
            <View style={styles.bossBattlePanel}>
              <View style={styles.bossIcon}>
                <MaterialCommunityIcons name="sword-cross" color={palette.text} size={20} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.rescueTitle}>Boss Battle Deck</Text>
                <Text style={styles.muted}>Hard-mode battle drill from the topic that needs pressure testing.</Text>
              </View>
              <Button mode="contained-tonal" compact disabled={!rescueSubject} onPress={openBossBattle}>
                Battle
              </Button>
            </View>
          ) : null}

          <View style={styles.winLogBox}>
            <Text style={styles.consoleSectionTitle}>Tiny win log</Text>
            <View style={styles.winInputRow}>
              <TextInput
                mode="outlined"
                dense
                label="What changed after studying?"
                value={winText}
                onChangeText={setWinText}
                style={styles.winInput}
                onSubmitEditing={saveWinLog}
              />
              <Button mode="contained-tonal" compact icon="check" loading={savingWin} disabled={!winText.trim() || savingWin} onPress={saveWinLog}>
                Log
              </Button>
            </View>
            {winNotice ? <Text style={winNotice.includes("Logged") ? styles.successText : styles.error}>{winNotice}</Text> : null}
            {victoryVaultUnlocked ? (
              <View style={styles.vaultList}>
                {recentWinLogs.length ? (
                  recentWinLogs.map((note) => (
                    <View key={note.id} style={styles.vaultItem}>
                      <MaterialCommunityIcons name="archive-star-outline" color={palette.warning} size={16} />
                      <View style={styles.flexText}>
                        <Text style={styles.vaultTitle} numberOfLines={1}>
                          {note.body}
                        </Text>
                        <Text style={styles.muted}>{note.createdAt.slice(0, 10)}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>Victory Vault unlocked. Log a tiny win and it will stay visible here.</Text>
                )}
              </View>
            ) : null}
          </View>
          </AppCard>
        </Animated.View>
      ) : null}

      {detailsOpen ? (
        <>
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
        </>
      ) : null}

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
  personalSignal: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  personalSignalIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  personalSignalLabel: {
    color: palette.info,
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    textTransform: "uppercase"
  },
  personalSignalTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  personalSignalDepth: {
    overflow: "hidden",
    maxWidth: 94,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.24)",
    backgroundColor: "rgba(56,189,248,0.08)",
    color: palette.info,
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  nextUpRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  nextUpLabel: {
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  nextUpText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  commandActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8
  },
  commandAlert: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.26)",
    backgroundColor: "rgba(245,158,11,0.09)",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  commandAlertText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  commandMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  commandMetric: {
    flex: 1,
    minWidth: 80,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  commandMetricValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 22
  },
  commandMetricLabel: {
    color: palette.muted,
    fontSize: 11,
    fontFamily: "Outfit_700Bold"
  },
  commandToggles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
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
  consoleCard: {
    gap: 14,
    borderColor: "rgba(124,110,255,0.24)",
    backgroundColor: "rgba(124,110,255,0.06)"
  },
  consoleScore: {
    width: 82,
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.34)",
    backgroundColor: "rgba(74,222,128,0.1)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  consoleScoreValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 20,
    lineHeight: 24
  },
  consoleScoreLabel: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    fontSize: 10
  },
  radarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  radarCell: {
    flex: 1,
    minWidth: 92,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  radarHot: {
    borderColor: "rgba(255,107,107,0.28)",
    backgroundColor: "rgba(255,107,107,0.09)"
  },
  radarWarm: {
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: "rgba(245,158,11,0.09)"
  },
  radarCool: {
    borderColor: "rgba(56,189,248,0.28)",
    backgroundColor: "rgba(56,189,248,0.08)"
  },
  radarValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 21
  },
  radarLabel: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    textTransform: "uppercase"
  },
  consoleHint: {
    color: palette.info,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  perkRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  perkChip: {
    minHeight: 34,
    maxWidth: 170,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  perkChipUnlocked: {
    borderColor: "rgba(56,189,248,0.28)",
    backgroundColor: "rgba(56,189,248,0.09)"
  },
  perkChipText: {
    flexShrink: 1,
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  perkChipTextUnlocked: {
    flexShrink: 1,
    color: palette.text,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  perkCountText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18
  },
  focusAuraNotice: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(56,189,248,0.07)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  focusAuraText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  consoleSection: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12
  },
  consoleSectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  planList: {
    gap: 8
  },
  planRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  planIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  planTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  planMinutes: {
    minWidth: 46,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    textAlign: "right"
  },
  consoleSplit: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  consolePane: {
    flex: 1,
    minWidth: 260,
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12
  },
  debtRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 8
  },
  debtTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  debtScore: {
    minWidth: 30,
    color: palette.secondary,
    textAlign: "right",
    fontFamily: "Outfit_700Bold"
  },
  evidenceRow: {
    gap: 6
  },
  evidenceSubject: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  evidenceVerdict: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  evidenceTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  evidenceFill: {
    height: "100%",
    borderRadius: 8
  },
  rescuePanel: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(56,189,248,0.07)",
    padding: 12
  },
  rescueActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8
  },
  lockedPerkButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  rescueIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,189,248,0.2)"
  },
  rescueTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  streakShieldPanel: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.22)",
    backgroundColor: "rgba(74,222,128,0.07)",
    padding: 12
  },
  shieldIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,222,128,0.14)"
  },
  bossBattlePanel: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.24)",
    backgroundColor: "rgba(255,107,107,0.08)",
    padding: 12
  },
  bossIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,107,107,0.14)"
  },
  winLogBox: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12
  },
  winInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  winInput: {
    flex: 1,
    minWidth: 0
  },
  vaultList: {
    gap: 8
  },
  vaultItem: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  vaultTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
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
