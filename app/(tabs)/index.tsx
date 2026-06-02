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
  CommunityChessTournament,
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
import {
  DEFAULT_STUDY_PREFERENCES,
  loadStudyPreferences,
  saveStudyPreferences,
  type CoachTone,
  type StudyPreferences
} from "@/utils/studyPreferences";
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
  giftType === "leaderboard" ? "trophy-outline" : giftType === "coins" ? "cash-multiple" : "gift-outline";

const messageIconColorFor = (giftType: string) => (giftType === "leaderboard" ? palette.warning : giftType === "coins" ? palette.success : palette.warning);

const messageActionFor = (giftType: string) => (giftType === "leaderboard" ? "Got it" : giftType === "coins" ? "Claimed" : "Nice");

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

type WeakTopicMemory = {
  subject?: UserSubject | null;
  topic: string;
  count: number;
  latestAt: string;
  fixed: boolean;
};

type StarterPathStep = {
  id: string;
  label: string;
  body: string;
  actionLabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  complete: boolean;
  onPress: () => void;
};

const parkingLotKeyFor = (userId?: string) => `vce_quiet_parking_lot_${userId ?? "guest"}`;
const commandChecklistKeyFor = (userId?: string, date = new Date()) =>
  `vce_command_checklist_${userId ?? "guest"}_${date.toISOString().slice(0, 10)}`;
const starterPathDismissedKeyFor = (userId?: string) => `vce_starter_path_dismissed_${userId ?? "guest"}`;

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

const formatChessHour = (value?: string | null) => {
  if (!value) return "TBC";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBC";
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const chessStatusLabel = (status: string) =>
  status === "live" ? "live now" : status === "done" ? "done" : status === "signup" ? "signup" : "upcoming";

const clampStudyMinutes = (minutes?: number | null) => {
  const safe = Number.isFinite(minutes ?? NaN) ? Math.round(minutes ?? 25) : 25;
  return Math.min(90, Math.max(10, safe));
};

const topicFromEvent = (event?: StudyEvent | null) =>
  event?.description?.trim() || event?.title.replace(/\b(SAC|SAT|exam|task)\b/gi, "").trim() || null;

const autopsyTagFor = (eventId: string) => `event-${eventId}`;

const isAssessmentDeadline = (event: StudyEvent) => !isStudyTimeEvent(event) && event.eventType !== "TASK";

const pastDeadlineLabel = (event: StudyEvent) => {
  const days = daysUntil(event.eventDate);
  if (days === -1) return "yesterday";
  if (days < -1) return `${Math.abs(days)} days ago`;
  return countdownLabel(event);
};

const subjectForPlanTask = (task: AdaptiveStudyTask, subjects: UserSubject[]) => {
  const subjectLabel = normaliseLabel(task.subject ?? "");
  return (
    subjects.find((subject) => {
      const subjectName = normaliseLabel(subject.subjectName);
      return Boolean(subjectName) && (subjectLabel.includes(subjectName) || subjectName.includes(subjectLabel));
    }) ?? null
  );
};

const usefulDeadlineTokens = (value: string) =>
  normaliseLabel(value)
    .split(" ")
    .filter((token) => token.length >= 5 && !["actual", "practice"].includes(token));

const deadlineForPlanTask = (task: AdaptiveStudyTask, activeEvents: StudyEvent[], subjects: UserSubject[]) => {
  const taskSubject = subjectForPlanTask(task, subjects);
  const taskText = normaliseLabel([task.title, task.topic, task.reason, task.assessment_title, task.subject].filter(Boolean).join(" "));
  const assessmentTitle = normaliseLabel(task.assessment_title ?? "");

  return activeEvents
    .map((event) => {
      const eventSubject = subjectForDeadline(event, subjects);
      const eventTitle = normaliseLabel(event.title);
      const eventText = normaliseLabel([event.title, event.description, eventSubject?.subjectName].filter(Boolean).join(" "));
      const subjectMatch = Boolean(taskSubject?.id && eventSubject?.id && taskSubject.id === eventSubject.id);
      const directAssessmentMatch = Boolean(
        assessmentTitle && (eventText.includes(assessmentTitle) || assessmentTitle.includes(eventTitle))
      );
      const directTitleMatch = Boolean(eventTitle && taskText.includes(eventTitle));
      const overlap = usefulDeadlineTokens(event.title).filter((token) => taskText.includes(token)).length;
      const score = (directAssessmentMatch ? 8 : 0) + (directTitleMatch ? 6 : 0) + (subjectMatch ? 2 : 0) + overlap;
      return { event, score };
    })
    .filter(({ score }) => score >= 4)
    .sort((a, b) => b.score - a.score || a.event.eventDate.localeCompare(b.event.eventDate))[0]?.event ?? null;
};

const planReasonWithFreshDeadline = (reason: string, event?: StudyEvent | null) => {
  if (!event) return reason;
  const freshLabel = countdownLabel(event);
  if (/\bis\s+(today|tomorrow|in\s+\d+\s+days?)\b/i.test(reason)) {
    return reason.replace(/\bis\s+(today|tomorrow|in\s+\d+\s+days?)\b/i, `is ${freshLabel}`);
  }
  if (/\b(today|tomorrow|in\s+\d+\s+days?)\b/i.test(reason)) {
    return reason.replace(/\b(today|tomorrow|in\s+\d+\s+days?)\b/i, freshLabel);
  }
  return `${event.title} is ${freshLabel}. ${reason}`;
};

const isMistakeEvidence = (note: StudyNote) =>
  note.noteType === "mistake_log" || note.tags.includes("mistake-log") || note.tags.includes("timer-check");

const topicFromNote = (note: StudyNote) =>
  note.tags.find((tag) => tag.length > 3 && !["timer-check", "mistake-log", "roadmap", "sac-autopsy", "weak-topic-memory"].includes(tag)) ??
  note.title.replace(/\b(timer gap|mistake|log|sac autopsy|session notes)\b/gi, "").trim() ??
  "weak topic";

const buildWeakTopicMemory = ({
  subjects,
  sessions,
  notes,
  savedQuestions
}: {
  subjects: UserSubject[];
  sessions: StudySession[];
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
}): WeakTopicMemory | null => {
  const groups = new Map<string, WeakTopicMemory>();
  notes
    .filter((note) => isMistakeEvidence(note) || note.tags.includes("sac-autopsy") || note.tags.includes("weak-topic-memory"))
    .forEach((note) => {
      const topic = topicFromNote(note);
      const normalizedTopic = normaliseLabel(topic || "weak topic");
      const key = `${note.subjectId ?? "general"}-${normalizedTopic}`;
      const current = groups.get(key);
      const subject = subjects.find((item) => item.id === note.subjectId) ?? null;
      groups.set(key, {
        subject,
        topic: topic || subject?.subjectName || "weak topic",
        count: (current?.count ?? 0) + 1,
        latestAt: current && current.latestAt > note.updatedAt ? current.latestAt : note.updatedAt,
        fixed: false
      });
    });

  const candidates = [...groups.values()].map((memory) => {
    const normalizedTopic = normaliseLabel(memory.topic);
    const fixedByQuestion = savedQuestions.some(
      (question) =>
        (!memory.subject?.id || question.subjectId === memory.subject.id) &&
        question.createdAt > memory.latestAt &&
        normaliseLabel(question.topic ?? "").includes(normalizedTopic)
    );
    const fixedBySession = sessions.some(
      (session) =>
        (!memory.subject?.id || session.subjectId === memory.subject.id) &&
        session.createdAt > memory.latestAt &&
        normaliseLabel(session.notes ?? "").includes(normalizedTopic) &&
        /correct|fixed|redo|marked/i.test(session.notes ?? "")
    );
    return { ...memory, fixed: fixedByQuestion || fixedBySession };
  });

  return (
    candidates
      .filter((memory) => !memory.fixed && (memory.count >= 2 || memory.topic.length > 0))
      .sort((a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt))[0] ?? null
  );
};

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
    updateEvent,
    setLeaderboardPreference
  } = useAppStore();
  const [dailyInspiration, setDailyInspiration] = useState<DailyInspiration>(fallbackDailyInspiration);
  const [giftMessages, setGiftMessages] = useState<UserGiftMessage[]>([]);
  const [studyPreferences, setStudyPreferences] = useState<StudyPreferences>(DEFAULT_STUDY_PREFERENCES);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandDoneIds, setCommandDoneIds] = useState<string[]>([]);
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
  const [autopsyOpen, setAutopsyOpen] = useState(false);
  const [autopsyEvent, setAutopsyEvent] = useState<StudyEvent | null>(null);
  const [autopsyResult, setAutopsyResult] = useState("");
  const [autopsyLostMarks, setAutopsyLostMarks] = useState("");
  const [autopsySurprise, setAutopsySurprise] = useState("");
  const [autopsyNext, setAutopsyNext] = useState("");
  const [autopsySaving, setAutopsySaving] = useState(false);
  const [autopsyMessage, setAutopsyMessage] = useState<string | null>(null);
  const [chessTournament, setChessTournament] = useState<CommunityChessTournament | null>(null);
  const [joiningChessTournament, setJoiningChessTournament] = useState(false);
  const [chessNotice, setChessNotice] = useState<string | null>(null);
  const [starterPathDismissed, setStarterPathDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const parkingKey = parkingLotKeyFor(user?.id);
      const commandKey = commandChecklistKeyFor(user?.id);
      const starterPathKey = starterPathDismissedKeyFor(user?.id);
      fetchAll();
      loadStudyPreferences(user?.id)
        .then((preferences) => {
          if (active) setStudyPreferences(preferences);
        })
        .catch(() => undefined);
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
      studyApi
        .chessTournament()
        .then(({ chessTournament }) => {
          if (active) setChessTournament(chessTournament);
        })
        .catch(() => undefined);
      AsyncStorage.getItem(commandKey)
        .then((value) => {
          if (!active) return;
          if (!value) {
            setCommandDoneIds([]);
            return;
          }
          const parsed = JSON.parse(value) as unknown;
          setCommandDoneIds(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
        })
        .catch(() => {
          if (active) setCommandDoneIds([]);
        });
      AsyncStorage.getItem(starterPathKey)
        .then((value) => {
          if (active) setStarterPathDismissed(value === "1");
        })
        .catch(() => {
          if (active) setStarterPathDismissed(false);
        });

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
  const coachTone = studyPreferences.coachTone;
  const examWeekMode = studyPreferences.examWeekMode;
  const focusHome = studyPreferences.homeDensity === "focus";
  const toneCopy = useMemo(() => {
    const copy: Record<CoachTone, { exam: string; weak: string; autopsy: string }> = {
      calm: {
        exam: "Only the next useful move is showing. Keep the load light and specific.",
        weak: "Still waiting for one clean repair.",
        autopsy: "Capture what happened while it is still fresh."
      },
      sharp: {
        exam: "Noise off. Next deadline, next block, weakest repair.",
        weak: "Not fixed yet. Turn it into evidence.",
        autopsy: "Lock the lesson before the next SAC repeats it."
      },
      brutal: {
        exam: "No drift. Do the block, mark the work, move.",
        weak: "Still leaking marks. Fix it properly.",
        autopsy: "Do not waste the SAC. Extract the marks you dropped."
      }
    };
    return copy[coachTone];
  }, [coachTone]);
  const weakTopicMemory = useMemo(
    () => buildWeakTopicMemory({ subjects, sessions, notes, savedQuestions }),
    [notes, savedQuestions, sessions, subjects]
  );
  const autopsiedEventIds = useMemo(
    () =>
      new Set(
        notes
          .filter((note) => note.tags.includes("sac-autopsy"))
          .flatMap((note) => note.tags.filter((tag) => tag.startsWith("event-")).map((tag) => tag.replace(/^event-/, "")))
      ),
    [notes]
  );
  const autopsyCandidate = useMemo(
    () =>
      events
        .filter((event) => {
          const days = daysUntil(event.eventDate);
          return isAssessmentDeadline(event) && days < 0 && days >= -21 && !autopsiedEventIds.has(event.id);
        })
        .sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0] ?? null,
    [autopsiedEventIds, events]
  );
  const tonightPlan = useMemo(() => {
    const items: TonightPlanItem[] = [];
    const addItem = (item: TonightPlanItem) => {
      if (items.some((current) => current.title === item.title && current.label === item.label)) return;
      items.push(item);
    };

    latestPlan?.tasks?.slice(0, 2).forEach((task, index) => {
      const taskSubject = subjectForPlanTask(task, subjects);
      const matchingDeadline = deadlineForPlanTask(task, upcomingEvents, subjects);
      const planReason = planReasonWithFreshDeadline(task.reason, matchingDeadline);
      addItem({
        id: `coach-${index}-${task.title}`,
        label: "Coach plan",
        title: task.title,
        body: `${formatMinutes(clampStudyMinutes(task.minutes))} - ${planReason}`,
        subjectId: taskSubject?.id ?? null,
        topic: task.topic ?? topicFromEvent(matchingDeadline) ?? task.title,
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

    if (weakTopicMemory) {
      addItem({
        id: `memory-${weakTopicMemory.subject?.id ?? "general"}-${normaliseLabel(weakTopicMemory.topic)}`,
        label: "Not fixed yet",
        title: weakTopicMemory.subject?.subjectName ?? weakTopicMemory.topic,
        body: `${toneCopy.weak} ${weakTopicMemory.count} signal${weakTopicMemory.count === 1 ? "" : "s"} around ${weakTopicMemory.topic}.`,
        subjectId: weakTopicMemory.subject?.id ?? null,
        topic: weakTopicMemory.topic,
        minutes: 20,
        icon: "alert-decagram-outline",
        accent: palette.warning
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
    upcomingEvents,
    toneCopy.weak,
    weaknessSummary.nextAction,
    weaknessSummary.weakSubject,
    weaknessSummary.weakTopic,
    weakTopicMemory
  ]);
  const primaryPlan = tonightPlan[0] ?? null;
  const secondaryPlan = tonightPlan.slice(1, 3);
  const commandDoneSet = useMemo(() => new Set(commandDoneIds), [commandDoneIds]);
  const commandDoneCount = tonightPlan.filter((item) => commandDoneSet.has(item.id)).length;
  const showHomeTools = !focusHome || detailsOpen;
  const nowView = focusHome && !detailsOpen;
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
  const nextChessRound = chessTournament?.rounds?.find((round) => round.status !== "done") ?? chessTournament?.rounds?.[0] ?? null;
  const currentChessMatch = chessTournament?.tournamentMatches?.find(
    (match) => match.canOpen && match.matchCode && (match.status === "scheduled" || match.status === "active")
  ) ?? null;
  const nextChessMatch =
    chessTournament?.viewerMatches?.find((match) => match.status === "paired") ??
    chessTournament?.viewerMatches?.find((match) => match.status === "waiting" || match.status === "bye" || match.status === "champion" || match.status === "eliminated") ??
    null;
  const chessSignupOpen = chessTournament?.signupOpen === true;
  const chessTournamentAvailable = chessTournament?.tournamentAvailable !== false;
  const chessCommunityMinutes = chessTournament?.communityMinutes ?? 0;
  const chessCommunityGoalMinutes = chessTournament?.communityGoalMinutes ?? 600;
  const showChessSignupCard = Boolean(chessTournament && !examWeekMode && (chessTournament.signupOpen !== false || chessTournament.joined));
  const showChessHomeStrip = Boolean(!examWeekMode && nowView && chessTournament);
  const chessHomeTitle = chessTournament?.joined
    ? "Chess knockout: you're in"
    : chessSignupOpen
      ? "Join this chess knockout"
      : chessTournamentAvailable
        ? "Chess signups closed"
        : "Chess unlock goal";
  const chessHomeMeta = chessTournament
    ? chessTournament.joined
      ? nextChessMatch?.status === "paired"
        ? `Next match ${nextChessMatch.matchCode ?? "soon"}`
        : nextChessMatch?.status === "bye"
          ? "Bye round locked"
          : nextChessMatch?.status === "champion"
            ? "Champion"
            : nextChessMatch?.status === "eliminated"
              ? "Knocked out"
              : "Bracket updates after winners"
      : chessSignupOpen
        ? `${chessTournament.joinedCount} signed - join before ${formatChessHour(chessTournament.signupClosesAt)}`
        : chessTournamentAvailable
          ? `Next bracket ${formatChessHour(chessTournament.nextRoundAt)}`
          : `${chessCommunityMinutes}/${chessCommunityGoalMinutes} community study minutes`
    : "Knockout opens on schedule or after the community study goal.";
  const todayStudyMinutes = Math.round((stats?.todaySeconds ?? 0) / 60);
  const weekStudyMinutes = Math.round((stats?.weekSeconds ?? 0) / 60);
  const homeSignalTiles: {
    id: string;
    label: string;
    value: string;
    meta: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    accent: string;
    onPress: () => void;
  }[] = [
    {
      id: "today",
      label: "today",
      value: todayStudyMinutes ? formatMinutes(todayStudyMinutes) : "0m",
      meta: todayStudyMinutes ? `${formatMinutes(weekStudyMinutes)} this week` : "first block waiting",
      icon: "timer-outline",
      accent: palette.success,
      onPress: () => {
        if (primaryPlan) {
          openTimerForPlan(primaryPlan);
          return;
        }
        router.push("/(tabs)/study");
      }
    },
    {
      id: "deadline",
      label: "deadline",
      value: nextDeadline ? countdownLabel(nextDeadline) : `${deadlineRadar.week}`,
      meta: nextDeadline?.title ?? "dates protected",
      icon: nextDeadline ? eventIconName(nextDeadline) : "calendar-check-outline",
      accent: nextDeadline && daysUntil(nextDeadline.eventDate) <= 2 ? palette.secondary : palette.warning,
      onPress: () => router.push("/(tabs)/calendar")
    },
    {
      id: "evidence",
      label: "evidence",
      value: `${evidenceAverage}`,
      meta: revisionDebt.length ? `${revisionDebt.length} repair${revisionDebt.length === 1 ? "" : "s"}` : "clean board",
      icon: "chart-timeline-variant",
      accent: palette.info,
      onPress: () => router.push("/(tabs)/insights")
    },
    {
      id: "chess",
      label: "community",
      value: chessTournament ? `${chessTournament.joinedCount}` : "live",
      meta: chessTournament ? (chessSignupOpen ? "chess signups" : chessTournamentAvailable ? "chess bracket" : "chess goal") : "rooms open",
      icon: chessTournament?.joined ? "chess-king" : "forum-outline",
      accent: chessTournament ? palette.warning : palette.primary,
      onPress: () => router.push("/(tabs)/community")
    }
  ];
  const morePreviewItems: {
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    accent: string;
    route: "/(tabs)/more" | "/(tabs)/insights" | "/(tabs)/shop" | "/(tabs)/profile";
  }[] = [
    { label: "Insights", icon: "map-search-outline", accent: palette.primary, route: "/(tabs)/insights" },
    { label: "Shop", icon: "shopping-outline", accent: palette.success, route: "/(tabs)/shop" },
    { label: "Profile", icon: "account-circle-outline", accent: "#60A5FA", route: "/(tabs)/profile" },
    { label: "Study dice", icon: "dice-d20-outline", accent: palette.warning, route: "/(tabs)/more" }
  ];
  const hasAssessmentDeadline = events.some(isAssessmentDeadline);
  const hasFirstStudyBlock = sessions.length > 0;
  const hasFirstMemory = notes.length > 0 || savedQuestions.length > 0 || resources.length > 0;
  const hasTouchedCommunity = Boolean(gamification?.leaderboardOptIn || gamification?.leaderboardPromptedAt || chessTournament?.joined);
  const starterPathSteps: StarterPathStep[] = [
    {
      id: "subjects",
      label: "Add subjects",
      body: subjects.length ? `${subjects.length} active subject${subjects.length === 1 ? "" : "s"}.` : "Tell the app what you actually study.",
      actionLabel: "Subjects",
      icon: "book-open-variant",
      accent: palette.primary,
      complete: subjects.length > 0,
      onPress: () => router.push("/(tabs)/profile")
    },
    {
      id: "deadlines",
      label: "Log a SAC",
      body: hasAssessmentDeadline ? "Calendar pressure is visible." : "Add one SAC, SAT or exam so Home can plan backwards.",
      actionLabel: "Calendar",
      icon: "calendar-alert",
      accent: palette.warning,
      complete: hasAssessmentDeadline,
      onPress: () => router.push("/(tabs)/calendar")
    },
    {
      id: "study",
      label: "Run a block",
      body: hasFirstStudyBlock ? "The app has real study evidence." : "Start one timer, even if it is short.",
      actionLabel: "Timer",
      icon: "timer-outline",
      accent: palette.success,
      complete: hasFirstStudyBlock,
      onPress: () => (primaryPlan ? openTimerForPlan(primaryPlan) : router.push({ pathname: "/(tabs)/study", params: { mode: "timer" } }))
    },
    {
      id: "memory",
      label: "Save evidence",
      body: hasFirstMemory ? "Notes, drills or files are feeding memory." : "Save one note, question or resource so Insights has proof.",
      actionLabel: "Questions",
      icon: "brain",
      accent: palette.info,
      complete: hasFirstMemory,
      onPress: () => router.push("/(tabs)/questions")
    },
    {
      id: "community",
      label: "Join the grind",
      body: hasTouchedCommunity ? "Community is connected." : "Join squads, rooms or chess when you want momentum around you.",
      actionLabel: "Community",
      icon: "account-group",
      accent: "#A78BFA",
      complete: hasTouchedCommunity,
      onPress: () => router.push("/(tabs)/community")
    }
  ];
  const starterPathCompleteCount = starterPathSteps.filter((step) => step.complete).length;
  const starterPathNext = starterPathSteps.find((step) => !step.complete) ?? null;
  const showStarterPath = !examWeekMode && !starterPathDismissed && starterPathCompleteCount < starterPathSteps.length;

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

  const updateHomePreferences = async (patch: Partial<StudyPreferences>) => {
    const nextPreferences = { ...studyPreferences, ...patch };
    setStudyPreferences(nextPreferences);
    try {
      const saved = await saveStudyPreferences(user?.id, nextPreferences);
      setStudyPreferences(saved);
      if (saved.examWeekMode) {
        setCaptureOpen(false);
        setDetailsOpen(false);
        setPerksOpen(false);
      }
    } catch {
      setStudyPreferences(studyPreferences);
    }
  };

  const openAutopsyForEvent = (event: StudyEvent) => {
    setAutopsyEvent(event);
    setAutopsyResult("");
    setAutopsyLostMarks("");
    setAutopsySurprise("");
    setAutopsyNext("");
    setAutopsyMessage(null);
    setAutopsyOpen(true);
  };

  const saveAutopsy = async () => {
    if (!autopsyEvent) return;
    const result = autopsyResult.trim();
    const lostMarks = autopsyLostMarks.trim();
    const surprise = autopsySurprise.trim();
    const next = autopsyNext.trim();
    if (!result && !lostMarks && !surprise && !next) {
      setAutopsyMessage("Add at least one useful detail before saving.");
      return;
    }

    const eventSubject = subjectForDeadline(autopsyEvent, subjects);
    const topic = topicFromEvent(autopsyEvent) ?? autopsyEvent.title;
    setAutopsySaving(true);
    setAutopsyMessage(null);
    try {
      await createNote({
        subjectId: eventSubject?.id ?? autopsyEvent.subjectId ?? undefined,
        title: `SAC Autopsy: ${autopsyEvent.title}`.slice(0, 140),
        noteType: "mistake_log",
        tags: ["sac-autopsy", autopsyTagFor(autopsyEvent.id), "weak-topic-memory", normaliseLabel(topic).slice(0, 36)],
        body: [
          `${autopsyEvent.title} happened ${pastDeadlineLabel(autopsyEvent)}.`,
          result ? `Result or feeling: ${result}` : "",
          lostMarks ? `Lost marks on: ${lostMarks}` : "",
          surprise ? `Surprised by: ${surprise}` : "",
          next ? `Next repair: ${next}` : `Next repair: turn ${topic} into one drill and one correction.`
        ]
          .filter(Boolean)
          .join("\n\n")
      });
      if (!autopsyEvent.completed) {
        await updateEvent(autopsyEvent.id, { completed: true });
      }
      setAutopsyOpen(false);
      setAutopsyEvent(null);
      await fetchAll();
    } catch (error) {
      setAutopsyMessage(error instanceof Error ? error.message : "Could not save that autopsy.");
    } finally {
      setAutopsySaving(false);
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

  const joinChessTournament = async () => {
    if (chessTournament?.joined) {
      if (currentChessMatch?.matchCode) {
        router.push({ pathname: "/chess-match", params: { code: currentChessMatch.matchCode } });
      } else {
        router.push("/(tabs)/community");
      }
      return;
    }
    if (chessTournament && chessTournament.signupOpen === false) {
      setChessNotice(chessTournament.statusCopy ?? "Chess tournament signups are closed for this week.");
      router.push("/(tabs)/community");
      return;
    }
    setJoiningChessTournament(true);
    setChessNotice(null);
    try {
      const data = await studyApi.joinChessTournament();
      setChessTournament(data.chessTournament);
      setChessNotice("Signed up. The knockout bracket will appear in Community.");
    } catch (error) {
      setChessNotice(error instanceof Error ? error.message : "Could not sign up for chess.");
    } finally {
      setJoiningChessTournament(false);
    }
  };

  const dismissStarterPath = async () => {
    setStarterPathDismissed(true);
    try {
      await AsyncStorage.setItem(starterPathDismissedKeyFor(user?.id), "1");
    } catch {
      // Local guidance can disappear even if storage is temporarily unavailable.
    }
  };

  const persistParkingLot = async (items: ParkingLotItem[]) => {
    setParkingLot(items);
    await AsyncStorage.setItem(parkingLotKeyFor(user?.id), JSON.stringify(items));
  };

  const persistCommandDoneIds = async (ids: string[]) => {
    const nextIds = Array.from(new Set(ids));
    setCommandDoneIds(nextIds);
    await AsyncStorage.setItem(commandChecklistKeyFor(user?.id), JSON.stringify(nextIds));
  };

  const toggleCommandDone = async (id: string) => {
    const nextIds = commandDoneSet.has(id)
      ? commandDoneIds.filter((currentId) => currentId !== id)
      : [...commandDoneIds, id];
    await persistCommandDoneIds(nextIds);
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
        {showHomeTools ? (
          <View style={styles.headerActions}>
            {focusHome ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: searchOpen }}
                style={[styles.guideButton, searchOpen && styles.guideButtonActive]}
                onPress={() => setSearchOpen((value) => !value)}
              >
                <MaterialCommunityIcons name="magnify" color={searchOpen ? palette.text : palette.info} size={18} />
                <Text style={[styles.guideButtonText, searchOpen && styles.guideButtonTextActive]}>Search</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              style={styles.guideButton}
              onPress={() => router.push({ pathname: "/(tabs)", params: { guide: "1" } })}
            >
              <MaterialCommunityIcons name="compass-outline" color={palette.info} size={18} />
              <Text style={styles.guideButtonText}>Guide</Text>
            </Pressable>
            <StreakWidget streak={activeStreak} />
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!examWeekMode && (!focusHome || searchOpen || searchQuery.trim().length > 0) ? (
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
      ) : null}

      {!examWeekMode && !focusHome ? (
        <Animated.View entering={motion.card(25)}>
          <AppCard style={styles.inspirationCard}>
            <View style={styles.inspirationBadge}>
              <MaterialCommunityIcons name="lightbulb-on-outline" color={palette.warning} size={18} />
              <Text style={styles.inspirationLabel}>Daily spark</Text>
            </View>
            <View style={styles.flexText}>
              <Text style={styles.quote} numberOfLines={1}>
                {dailyInspiration.quote}
              </Text>
              <Text style={styles.actionText} numberOfLines={1}>
                {dailyInspiration.action}
              </Text>
            </View>
          </AppCard>
        </Animated.View>
      ) : null}

      <Animated.View entering={motion.card(34)}>
        <AppCard style={styles.launchpadCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexText}>
              <Text variant="titleMedium" style={nowView ? styles.nowTitle : styles.cardTitle}>
                {nowView ? "Now" : "Today Command"}
              </Text>
              <Text style={nowView ? styles.nowPressure : styles.muted}>
                {nextDeadline
                  ? `${nextDeadline.title} is ${countdownLabel(nextDeadline)}.`
                  : weaknessSummary.title}
              </Text>
            </View>
            <MaterialCommunityIcons name="rocket-launch-outline" color={palette.info} size={24} />
          </View>

          {nowView ? (
            <>
              <View style={styles.homePulseRail}>
                {homeSignalTiles.map((tile) => (
                  <Pressable
                    key={tile.id}
                    accessibilityRole="button"
                    style={[styles.homePulseTile, { borderColor: `${tile.accent}33` }]}
                    onPress={tile.onPress}
                  >
                    <View style={[styles.homePulseIcon, { backgroundColor: `${tile.accent}18` }]}>
                      <MaterialCommunityIcons name={tile.icon} color={tile.accent} size={18} />
                    </View>
                    <View style={styles.flexText}>
                      <Text style={[styles.homePulseLabel, { color: tile.accent }]}>{tile.label}</Text>
                      <Text style={styles.homePulseValue} numberOfLines={1}>
                        {tile.value}
                      </Text>
                      <Text style={styles.homePulseMeta} numberOfLines={1}>
                        {tile.meta}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <Pressable accessibilityRole="button" style={styles.commandSpark} onPress={() => setDetailsOpen(true)}>
                <MaterialCommunityIcons name="lightbulb-on-outline" color={palette.warning} size={18} />
                <Text style={styles.commandSparkText} numberOfLines={1}>
                  {dailyInspiration.action}
                </Text>
                <MaterialCommunityIcons name="chevron-right" color={palette.warning} size={18} />
              </Pressable>
              {showChessHomeStrip ? (
                <View style={styles.homeChessStrip}>
                  <View style={styles.homeChessCopy}>
                    <View style={styles.homeChessTopline}>
                      <MaterialCommunityIcons name="chess-knight" color={palette.warning} size={18} />
                      <Text style={styles.homeChessLabel}>Community event</Text>
                    </View>
                    <Text style={styles.homeChessTitle}>{chessHomeTitle}</Text>
                    <Text style={styles.homeChessMeta} numberOfLines={1}>
                      {chessHomeMeta}
                    </Text>
                  </View>
                  <Button
                    mode="contained"
                    icon={chessTournament?.joined ? "chess-king" : chessSignupOpen ? "account-plus" : "target"}
                    loading={joiningChessTournament}
                    onPress={joinChessTournament}
                  >
                    {chessTournament?.joined ? "Open bracket" : chessSignupOpen ? "Join tournament" : "Community goal"}
                  </Button>
                </View>
              ) : null}
            </>
          ) : null}

          {showHomeTools ? (
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
          ) : null}

          {primaryPlan ? (
            nowView ? (
              <View
                style={[
                  styles.focusCommand,
                  {
                    borderColor: `${primaryPlan.accent}44`,
                    backgroundColor: `${primaryPlan.accent}0f`
                  }
                ]}
              >
                <View style={[styles.focusCommandIcon, { backgroundColor: `${primaryPlan.accent}18` }]}>
                  <MaterialCommunityIcons name={primaryPlan.icon} color={primaryPlan.accent} size={24} />
                </View>
                <View style={styles.focusCommandText}>
                  <Text style={[styles.briefLabel, { color: primaryPlan.accent }]}>{primaryPlan.label}</Text>
                  <Text style={styles.focusCommandTitle}>{primaryPlan.title}</Text>
                  <Text style={styles.focusCommandBody} numberOfLines={3}>
                    {primaryPlan.body}
                  </Text>
                </View>
                <Button mode="contained" icon="timer-play-outline" disabled={!subjects.length} onPress={() => openTimerForPlan(primaryPlan)}>
                  Start studying
                </Button>
              </View>
            ) : (
              <View style={[styles.commandPlanRow, commandDoneSet.has(primaryPlan.id) && styles.commandPlanRowDone]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: commandDoneSet.has(primaryPlan.id) }}
                  style={styles.commandCheck}
                  onPress={() => void toggleCommandDone(primaryPlan.id)}
                >
                  <MaterialCommunityIcons
                    name={commandDoneSet.has(primaryPlan.id) ? "check-circle" : "checkbox-blank-circle-outline"}
                    color={commandDoneSet.has(primaryPlan.id) ? palette.success : primaryPlan.accent}
                    size={22}
                  />
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.commandPlanButton} onPress={() => openTimerForPlan(primaryPlan)}>
                  <View style={[styles.planIcon, { backgroundColor: `${primaryPlan.accent}18` }]}>
                    <MaterialCommunityIcons name={primaryPlan.icon} color={primaryPlan.accent} size={19} />
                  </View>
                  <View style={styles.flexText}>
                    <Text style={[styles.briefLabel, { color: primaryPlan.accent }]}>{primaryPlan.label}</Text>
                    <Text style={[styles.planTitle, commandDoneSet.has(primaryPlan.id) && styles.planTitleDone]}>{primaryPlan.title}</Text>
                    <Text style={styles.muted} numberOfLines={2}>
                      {primaryPlan.body}
                    </Text>
                  </View>
                  <Text style={styles.planMinutes}>{formatMinutes(clampStudyMinutes(primaryPlan.minutes))}</Text>
                </Pressable>
              </View>
            )
          ) : (
            <Text style={styles.muted}>Add a subject, deadline, or saved question and Home will choose a cleaner next move.</Text>
          )}

          {secondaryPlan.length && showHomeTools ? (
            <View style={styles.commandQueue}>
              <View style={styles.queueHeader}>
                <Text style={styles.nextUpLabel}>Command queue</Text>
                <Text style={styles.queueCount}>{commandDoneCount}/{tonightPlan.length} done</Text>
              </View>
              {secondaryPlan.map((item) => {
                const done = commandDoneSet.has(item.id);
                return (
                  <View key={item.id} style={[styles.queueItem, done && styles.queueItemDone]}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      style={styles.queueCheck}
                      onPress={() => void toggleCommandDone(item.id)}
                    >
                      <MaterialCommunityIcons
                        name={done ? "check-circle" : "checkbox-blank-circle-outline"}
                        color={done ? palette.success : item.accent}
                        size={19}
                      />
                    </Pressable>
                    <Pressable accessibilityRole="button" style={styles.queueButton} onPress={() => openTimerForPlan(item)}>
                      <Text style={[styles.queueTitle, done && styles.planTitleDone]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.queueMeta} numberOfLines={1}>
                        {item.label} - {formatMinutes(clampStudyMinutes(item.minutes))}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          {showHomeTools ? (
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
          ) : (
            <View style={styles.focusMorePanel}>
              <View style={styles.morePreviewHeader}>
                <View style={styles.morePreviewCopy}>
                  <Text style={styles.morePreviewTitle}>More has the extras.</Text>
                  <Text style={styles.morePreviewBody}>Insights, Shop, Profile, Guide, chess and quick tools live there.</Text>
                </View>
                <Button compact mode="text" icon="dots-grid" onPress={() => router.push("/(tabs)/more")}>
                  Open
                </Button>
              </View>
              <View style={styles.moreMiniRail}>
                {morePreviewItems.map((item) => (
                  <Pressable
                    key={item.label}
                    accessibilityRole="button"
                    style={[styles.moreMiniChip, { borderColor: `${item.accent}2e` }]}
                    onPress={() => router.push(item.route)}
                  >
                    <MaterialCommunityIcons name={item.icon} color={item.accent} size={15} />
                    <Text style={styles.moreMiniText} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {streakShieldUnlocked && !studiedToday && showHomeTools ? (
            <View style={styles.commandAlert}>
              <MaterialCommunityIcons name="shield-check-outline" color={palette.warning} size={18} />
              <Text style={styles.commandAlertText}>Streak Shield is ready.</Text>
              <Button mode="contained-tonal" compact onPress={() => startRescueMode(8)}>
                8m
              </Button>
            </View>
          ) : null}

          {examWeekMode ? (
            <View style={styles.commandAlert}>
              <MaterialCommunityIcons name="weather-lightning" color={palette.warning} size={18} />
              <Text style={styles.commandAlertText}>{toneCopy.exam}</Text>
            </View>
          ) : null}

          {!examWeekMode && showHomeTools ? (
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
          ) : null}

          {showHomeTools ? (
            <View style={styles.commandToggles}>
              <Button
                compact
                mode={examWeekMode ? "contained-tonal" : "outlined"}
                icon="weather-lightning"
                onPress={() => void updateHomePreferences({ examWeekMode: !examWeekMode })}
              >
                Exam Week
              </Button>
              {!examWeekMode ? (
                <>
                  <Button
                    compact
                    mode={focusHome ? "contained-tonal" : "outlined"}
                    icon={focusHome ? "eye-off-outline" : "view-dashboard-outline"}
                    onPress={() => void updateHomePreferences({ homeDensity: focusHome ? "full" : "focus" })}
                  >
                    {focusHome ? "Focus" : "Full"}
                  </Button>
                  <Button compact mode={captureOpen ? "contained-tonal" : "outlined"} icon="playlist-edit" onPress={() => setCaptureOpen((value) => !value)}>
                    Capture
                  </Button>
                  <Button compact mode={detailsOpen ? "contained-tonal" : "outlined"} icon="view-dashboard-outline" onPress={() => setDetailsOpen((value) => !value)}>
                    {focusHome && detailsOpen ? "Less" : focusHome ? "More" : "Details"}
                  </Button>
                  <Button compact mode={perksOpen ? "contained-tonal" : "outlined"} icon="star-four-points-outline" onPress={() => setPerksOpen((value) => !value)}>
                    Perks
                  </Button>
                </>
              ) : null}
            </View>
          ) : null}

          {captureOpen && !examWeekMode && showHomeTools ? (
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

          {perksOpen && !examWeekMode && showHomeTools ? (
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

      {showStarterPath && starterPathNext ? (
        <Animated.View entering={motion.card(35)}>
          <AppCard style={styles.starterPathCard}>
            <View style={styles.starterPathTop}>
              <View style={styles.flexText}>
                <Text style={styles.starterPathKicker}>First week path</Text>
                <Text style={styles.starterPathTitle}>Set up the app by using it.</Text>
              </View>
              <View style={styles.starterProgressPill}>
                <Text style={styles.starterProgressText}>
                  {starterPathCompleteCount}/{starterPathSteps.length}
                </Text>
              </View>
            </View>
            <View style={styles.starterTrack}>
              <View style={[styles.starterTrackFill, { width: `${(starterPathCompleteCount / starterPathSteps.length) * 100}%` }]} />
            </View>
            <View style={styles.starterStepRail}>
              {starterPathSteps.map((step) => (
                <Pressable
                  key={step.id}
                  accessibilityRole="button"
                  style={[styles.starterStepDot, step.complete && styles.starterStepDotDone, { borderColor: `${step.accent}55` }]}
                  onPress={step.onPress}
                >
                  <MaterialCommunityIcons
                    name={step.complete ? "check" : step.icon}
                    color={step.complete ? palette.success : step.accent}
                    size={15}
                  />
                </Pressable>
              ))}
            </View>
            <View style={styles.starterNextRow}>
              <View style={[styles.starterNextIcon, { backgroundColor: `${starterPathNext.accent}18` }]}>
                <MaterialCommunityIcons name={starterPathNext.icon} color={starterPathNext.accent} size={21} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.starterNextLabel}>{starterPathNext.label}</Text>
                <Text style={styles.starterNextBody}>{starterPathNext.body}</Text>
              </View>
              <Button compact mode="contained" icon="arrow-right" onPress={starterPathNext.onPress}>
                {starterPathNext.actionLabel}
              </Button>
            </View>
            <View style={styles.starterFooter}>
              <Text style={styles.starterFooterText}>Short path, no popup. Finish it once and Home gets quieter.</Text>
              <Button compact mode="text" icon="close" onPress={dismissStarterPath}>
                Hide
              </Button>
            </View>
          </AppCard>
        </Animated.View>
      ) : null}

      {showChessSignupCard && chessTournament && !nowView ? (
        <Animated.View entering={motion.card(36)}>
          <AppCard style={styles.chessSignupCard}>
            <View style={styles.chessSignupTop}>
              <View style={styles.chessSignupIcon}>
                <MaterialCommunityIcons name="chess-knight" color={palette.warning} size={22} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.chessSignupLabel}>Community event</Text>
                <Text style={styles.chessSignupTitle}>Chess knockout signup</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {chessTournament.statusCopy ?? "Sign up early in the week. Winners advance through the bracket."}
                </Text>
              </View>
              <View style={styles.chessSignupPill}>
                <Text style={styles.chessSignupPillText}>{chessTournament.joinedCount} signed</Text>
              </View>
            </View>

            <View style={styles.chessSignupBody}>
              <View style={styles.chessSignupTile}>
                <Text style={styles.nextUpLabel}>Next round</Text>
                <Text style={styles.chessSignupValue}>
                  {nextChessRound ? formatChessHour(nextChessRound.startsAt) : formatChessHour(chessTournament.nextRoundAt)}
                </Text>
                <Text style={styles.mutedSmall}>{nextChessRound ? chessStatusLabel(nextChessRound.status) : "upcoming"}</Text>
              </View>
              <View style={styles.chessSignupTile}>
                <Text style={styles.nextUpLabel}>{chessTournament.joined ? "Your match" : "Signup closes"}</Text>
                <Text style={styles.chessSignupValue} numberOfLines={1}>
                  {chessTournament.joined
                    ? nextChessMatch?.status === "paired"
                      ? `vs ${nextChessMatch.opponent?.displayName ?? "opponent"}`
                      : nextChessMatch?.status === "bye"
                        ? "Bye round"
                        : "Waiting"
                    : formatChessHour(chessTournament.signupClosesAt)}
                </Text>
                <Text style={styles.mutedSmall} numberOfLines={1}>
                  {chessTournament.joined ? nextChessMatch?.matchCode ?? "Bracket updates live" : "Tuesday 8pm"}
                </Text>
              </View>
            </View>

            {chessNotice ? <Text style={chessNotice.includes("Signed") ? styles.successText : styles.error}>{chessNotice}</Text> : null}

            <View style={styles.actionRow}>
              <Button mode="contained" compact icon="chess-king" loading={joiningChessTournament} onPress={joinChessTournament}>
                {chessTournament.joined ? (currentChessMatch ? "Open match" : "Bracket") : "Join tournament"}
              </Button>
              <Button mode="outlined" compact icon="forum-outline" onPress={() => router.push("/(tabs)/community")}>
                Community
              </Button>
            </View>
          </AppCard>
        </Animated.View>
      ) : null}

      {autopsyCandidate && showHomeTools ? (
        <Animated.View entering={motion.card(36)}>
          <AppCard style={styles.autopsyCard}>
            <View style={styles.rowBetween}>
              <View style={styles.flexText}>
                <Text style={styles.autopsyLabel}>SAC Autopsy</Text>
                <Text style={styles.autopsyTitle}>{autopsyCandidate.title}</Text>
                <Text style={styles.muted}>
                  {pastDeadlineLabel(autopsyCandidate)}. {toneCopy.autopsy}
                </Text>
              </View>
              <Button mode="contained-tonal" compact icon="clipboard-search-outline" onPress={() => openAutopsyForEvent(autopsyCandidate)}>
                Review
              </Button>
            </View>
          </AppCard>
        </Animated.View>
      ) : null}

      {detailsOpen && !examWeekMode ? (
        <Animated.View entering={motion.card(38)}>
          <AppCard style={styles.consoleCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Study Command Console
              </Text>
              <Text style={styles.muted}>Open this when you want the deeper deadline, debt and evidence view.</Text>
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

      {detailsOpen && !examWeekMode ? (
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

      {!examWeekMode && (!focusHome || detailsOpen) ? (
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
      ) : null}

      {!examWeekMode && showHomeTools ? giftMessages.map((gift) => (
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
      )) : null}

      {showThemeRequestThankYou && !examWeekMode && showHomeTools ? (
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

        <Dialog visible={autopsyOpen} onDismiss={() => setAutopsyOpen(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>SAC Autopsy</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogBody}>
              {autopsyEvent
                ? `${autopsyEvent.title} happened ${pastDeadlineLabel(autopsyEvent)}. Turn the result into the next repair.`
                : "Turn the result into the next repair."}
            </Text>
            <TextInput
              mode="outlined"
              label="Result or feeling"
              value={autopsyResult}
              onChangeText={setAutopsyResult}
              placeholder="Score, confidence, or rough feeling"
            />
            <TextInput
              mode="outlined"
              label="Lost marks on"
              value={autopsyLostMarks}
              onChangeText={setAutopsyLostMarks}
              placeholder="Command terms, timing, examples, definitions..."
            />
            <TextInput
              mode="outlined"
              label="What surprised you?"
              value={autopsySurprise}
              onChangeText={setAutopsySurprise}
              placeholder="The part you did not expect"
            />
            <TextInput
              mode="outlined"
              label="Next repair"
              value={autopsyNext}
              onChangeText={setAutopsyNext}
              placeholder="Redo one question, make a correction, drill..."
            />
            {autopsyMessage ? <Text style={styles.error}>{autopsyMessage}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={autopsySaving} onPress={() => setAutopsyOpen(false)}>
              Close
            </Button>
            <Button mode="contained" loading={autopsySaving} disabled={autopsySaving} onPress={saveAutopsy}>
              Save autopsy
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
    alignItems: "center",
    gap: 12
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10
  },
  guideButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.info}44`,
    backgroundColor: `${palette.info}10`,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  guideButtonActive: {
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}18`
  },
  guideButtonText: {
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  guideButtonTextActive: {
    color: palette.text
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
  autopsyCard: {
    gap: 10,
    borderColor: "rgba(245,158,11,0.32)",
    backgroundColor: "rgba(245,158,11,0.09)"
  },
  autopsyLabel: {
    color: palette.warning,
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  autopsyTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    lineHeight: 21
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
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
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
    gap: 8,
    minWidth: 126
  },
  inspirationLabel: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    textTransform: "uppercase"
  },
  quote: {
    color: palette.text,
    fontSize: 17,
    lineHeight: 22,
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
    lineHeight: 18
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
  mutedSmall: {
    color: palette.muted,
    fontSize: 12
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
    borderColor: "rgba(56,189,248,0.3)",
    backgroundColor: "rgba(8,20,38,0.58)"
  },
  starterPathCard: {
    gap: 12,
    borderColor: "rgba(124,110,255,0.28)",
    backgroundColor: "rgba(124,110,255,0.08)"
  },
  starterPathTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  starterPathKicker: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    textTransform: "uppercase"
  },
  starterPathTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 23
  },
  starterProgressPill: {
    minWidth: 46,
    minHeight: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.35)",
    backgroundColor: "rgba(124,110,255,0.14)",
    paddingHorizontal: 9
  },
  starterProgressText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  starterTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  starterTrackFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary
  },
  starterStepRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  starterStepDot: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)"
  },
  starterStepDotDone: {
    borderColor: "rgba(74,222,128,0.4)",
    backgroundColor: "rgba(74,222,128,0.1)"
  },
  starterNextRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.13)",
    padding: 10
  },
  starterNextIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  starterNextLabel: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  starterNextBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18
  },
  starterFooter: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  starterFooterText: {
    flex: 1,
    minWidth: 0,
    color: palette.muted,
    fontSize: 12
  },
  homePulseRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  homePulseTile: {
    flexGrow: 1,
    flexBasis: 145,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)"
  },
  homePulseIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  homePulseLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    textTransform: "uppercase"
  },
  homePulseValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  homePulseMeta: {
    color: palette.muted,
    fontSize: 12
  },
  chessSignupCard: {
    gap: 12,
    borderColor: "rgba(245,158,11,0.3)",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  chessSignupTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10
  },
  chessSignupIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.16)"
  },
  chessSignupLabel: {
    color: palette.warning,
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  chessSignupTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 17
  },
  chessSignupPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(245,158,11,0.16)"
  },
  chessSignupPillText: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  chessSignupBody: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chessSignupTile: {
    flexGrow: 1,
    flexBasis: 180,
    gap: 2,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.18)",
    backgroundColor: "rgba(0,0,0,0.14)"
  },
  chessSignupValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  homeChessStrip: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.5)",
    backgroundColor: "rgba(245,158,11,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  homeChessCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  homeChessTopline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  homeChessLabel: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    textTransform: "uppercase"
  },
  homeChessTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  homeChessMeta: {
    color: palette.muted,
    fontSize: 12
  },
  nowTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    marginBottom: 2
  },
  nowPressure: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20
  },
  commandSpark: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.24)",
    backgroundColor: "rgba(245,158,11,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  commandSparkText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
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
  focusCommand: {
    minHeight: 230,
    alignItems: "stretch",
    justifyContent: "center",
    gap: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.24)",
    backgroundColor: "rgba(3,7,18,0.24)",
    padding: 18
  },
  focusCommandIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  focusCommandText: {
    gap: 5
  },
  focusCommandTitle: {
    color: palette.text,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Outfit_700Bold"
  },
  focusCommandBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22
  },
  commandPlanRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 8
  },
  commandPlanRowDone: {
    borderColor: `${palette.success}44`,
    backgroundColor: `${palette.success}10`
  },
  commandCheck: {
    width: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  commandPlanButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  planTitleDone: {
    color: palette.muted,
    textDecorationLine: "line-through"
  },
  commandQueue: {
    gap: 8
  },
  queueHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  queueCount: {
    color: palette.success,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  queueItem: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  queueItemDone: {
    borderColor: `${palette.success}33`,
    backgroundColor: `${palette.success}08`
  },
  queueCheck: {
    width: 26,
    alignItems: "center",
    justifyContent: "center"
  },
  queueButton: {
    flex: 1,
    minWidth: 0
  },
  queueTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    lineHeight: 19
  },
  queueMeta: {
    color: palette.muted,
    fontSize: 12
  },
  commandActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8
  },
  focusMoreRow: {
    minHeight: 32,
    alignItems: "flex-end"
  },
  focusMorePanel: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.24)",
    backgroundColor: "rgba(124,110,255,0.08)",
    padding: 10
  },
  morePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  morePreviewCopy: {
    flex: 1,
    minWidth: 0
  },
  morePreviewTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  morePreviewBody: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17
  },
  moreMiniRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  moreMiniChip: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 9
  },
  moreMiniText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
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
