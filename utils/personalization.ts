import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { palette } from "@/constants/theme";
import type { Goal, SavedQuestion, StudyEvent, StudyNote, StudyResource, StudySession, UserSubject } from "@/types";
import { isStudyTimeEvent } from "@/utils/studyEvents";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type PersonalizationInput = {
  subjects: UserSubject[];
  sessions: StudySession[];
  events: StudyEvent[];
  goals: Goal[];
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  resources: StudyResource[];
};

export type PersonalTrait = {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  accent: string;
};

export type UserStudySignature = {
  profileName: string;
  depth: number;
  depthLabel: string;
  rhythm: PersonalTrait;
  learningStyle: PersonalTrait;
  pressureMode: PersonalTrait;
  preferredBlock: PersonalTrait & { minutes: number };
  focusSubject?: {
    id: string;
    name: string;
    color: string;
    reason: string;
    topic: string;
  } | null;
  nextMove: {
    title: string;
    body: string;
    subjectId?: string | null;
    topic?: string | null;
    minutes: number;
    icon: IconName;
    accent: string;
  };
  traits: PersonalTrait[];
};

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const startOfWeek = () => {
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

const daysUntil = (eventDate: string) => {
  const today = new Date();
  const target = new Date(`${eventDate.slice(0, 10)}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const clampMinutes = (minutes: number) => Math.min(90, Math.max(10, Math.round(minutes)));

const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const medianMinutes = (sessions: StudySession[]) => {
  if (!sessions.length) return 25;
  const minutes = sessions.map((session) => Math.round(session.durationSeconds / 60)).sort((a, b) => a - b);
  return clampMinutes(minutes[Math.floor(minutes.length / 2)] ?? 25);
};

const subjectForEvent = (event: StudyEvent, subjects: UserSubject[]) => {
  if (event.subjectId) {
    const subject = subjects.find((item) => item.id === event.subjectId);
    if (subject) return subject;
  }

  const title = normalise(event.title);
  return (
    subjects.find((subject) => {
      const subjectName = normalise(subject.subjectName);
      return Boolean(subjectName) && title.includes(subjectName);
    }) ?? null
  );
};

const rhythmTrait = (sessions: StudySession[]): PersonalTrait => {
  if (sessions.length < 3) {
    return {
      label: "Rhythm",
      value: "Still learning",
      detail: "Log a few blocks and Forge will lock onto your best study window.",
      icon: "radar",
      accent: palette.info
    };
  }

  const buckets = [
    { value: "Morning", detail: "Your strongest pattern is before lunch.", icon: "weather-sunset-up" as IconName, accent: palette.warning, min: 5, max: 11 },
    { value: "Afternoon", detail: "Your study evidence clusters after school.", icon: "weather-sunny" as IconName, accent: palette.info, min: 12, max: 16 },
    { value: "Evening", detail: "You tend to build momentum later in the day.", icon: "weather-night" as IconName, accent: palette.primary, min: 17, max: 21 },
    { value: "Late", detail: "Your blocks lean late. Keep them sharp and contained.", icon: "moon-waning-crescent" as IconName, accent: palette.secondary, min: 22, max: 28 }
  ].map((bucket) => ({
    ...bucket,
    count: sessions.filter((session) => {
      const hour = new Date(session.createdAt).getHours();
      const shifted = hour < 5 ? hour + 24 : hour;
      return shifted >= bucket.min && shifted <= bucket.max;
    }).length
  }));

  const best = buckets.sort((a, b) => b.count - a.count)[0];
  return {
    label: "Rhythm",
    value: best.value,
    detail: best.detail,
    icon: best.icon,
    accent: best.accent
  };
};

const learningStyleTrait = ({ sessions, notes, savedQuestions, resources }: PersonalizationInput): PersonalTrait => {
  const counts = [
    {
      value: "Timer-led",
      score: sessions.length,
      detail: "You create proof by starting blocks. Keep sessions visible and specific.",
      icon: "timer-outline" as IconName,
      accent: palette.primary
    },
    {
      value: "Note builder",
      score: notes.length * 1.4,
      detail: "Your app grows through notes, summaries and corrections.",
      icon: "notebook-outline" as IconName,
      accent: palette.info
    },
    {
      value: "Drill fighter",
      score: savedQuestions.length * 1.8,
      detail: "Practice questions are your strongest learning signal.",
      icon: "cards-outline" as IconName,
      accent: palette.warning
    },
    {
      value: "Resource miner",
      score: resources.length * 2,
      detail: "Uploaded material is shaping your context.",
      icon: "file-search-outline" as IconName,
      accent: palette.success
    }
  ];
  const best = counts.sort((a, b) => b.score - a.score)[0];
  if (best.score === 0) {
    return {
      label: "Style",
      value: "Blank slate",
      detail: "Start with a timer block, note, drill or uploaded resource.",
      icon: "map-plus",
      accent: palette.info
    };
  }
  return { label: "Style", value: best.value, detail: best.detail, icon: best.icon, accent: best.accent };
};

const pressureTrait = ({ events, notes, sessions }: PersonalizationInput): PersonalTrait => {
  const activeEvents = events.filter((event) => !event.completed && !isStudyTimeEvent(event) && daysUntil(event.eventDate) >= 0);
  const urgent = activeEvents.filter((event) => daysUntil(event.eventDate) <= 7).length;
  const mistakes = notes.filter((note) => note.noteType === "mistake_log" || note.tags.includes("timer-check")).length;
  const weekStart = startOfWeek();
  const weekSessions = sessions.filter((session) => new Date(session.createdAt) >= weekStart).length;

  if (urgent >= 2) {
    return {
      label: "Pressure",
      value: "Deadline heat",
      detail: "Calendar pressure should drive the next few study choices.",
      icon: "calendar-alert",
      accent: palette.warning
    };
  }
  if (mistakes >= 3) {
    return {
      label: "Pressure",
      value: "Repair mode",
      detail: "Your mistake log is rich enough to guide targeted drills.",
      icon: "backup-restore",
      accent: palette.secondary
    };
  }
  if (weekSessions >= 3) {
    return {
      label: "Pressure",
      value: "Momentum",
      detail: "Consistency is your current advantage. Protect it.",
      icon: "chart-line-variant",
      accent: palette.success
    };
  }
  return {
    label: "Pressure",
    value: "Setup phase",
    detail: "A few more signals will make the app more opinionated.",
    icon: "map-marker-path",
    accent: palette.info
  };
};

const focusSubjectFor = (input: PersonalizationInput) => {
  const { subjects, sessions, notes, savedQuestions, events, goals } = input;
  const weekStart = startOfWeek();
  const staleCutoff = addDays(new Date(), -8);
  const activeEvents = events.filter((event) => !event.completed && !isStudyTimeEvent(event) && daysUntil(event.eventDate) >= 0);

  return subjects
    .map((subject) => {
      const weekMinutes = Math.round(
        sessions
          .filter((session) => session.subjectId === subject.id && new Date(session.createdAt) >= weekStart)
          .reduce((sum, session) => sum + session.durationSeconds, 0) / 60
      );
      const targetMinutes = Math.max(Number(goals.find((goal) => goal.subjectId === subject.id)?.weeklyHoursTarget ?? 4) * 60, 60);
      const mistakeNotes = notes.filter((note) => note.subjectId === subject.id && (note.noteType === "mistake_log" || note.tags.includes("timer-check")));
      const staleQuestions = savedQuestions.filter(
        (question) => question.subjectId === subject.id && new Date(question.createdAt) < staleCutoff
      );
      const nearestEvent = activeEvents
        .filter((event) => subjectForEvent(event, subjects)?.id === subject.id)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
      const deadlineDays = nearestEvent ? daysUntil(nearestEvent.eventDate) : null;
      const targetGap = Math.max(0, targetMinutes - weekMinutes);
      const score =
        Math.min(24, targetGap / 15) +
        mistakeNotes.length * 5 +
        staleQuestions.length * 4 +
        (deadlineDays == null ? 0 : Math.max(0, 18 - deadlineDays * 2));
      const latestMistake = mistakeNotes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const latestQuestion = staleQuestions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const topic =
        latestQuestion?.topic?.trim() ||
        latestMistake?.title?.replace(/\b(timer gap|mistake|log)\b/gi, "").trim() ||
        nearestEvent?.description?.trim() ||
        nearestEvent?.title ||
        subject.subjectName;
      const reason =
        deadlineDays != null
          ? `${nearestEvent?.title ?? subject.subjectName} is ${deadlineDays === 0 ? "today" : `in ${deadlineDays} days`}.`
          : mistakeNotes.length
            ? `${mistakeNotes.length} saved mistake signal${mistakeNotes.length === 1 ? "" : "s"} waiting.`
            : staleQuestions.length
              ? `${staleQuestions.length} old drill${staleQuestions.length === 1 ? "" : "s"} need a second pass.`
              : `${formatMinutes(Math.round(targetGap))} left against this week's target.`;

      return { subject, score, reason, topic };
    })
    .sort((a, b) => b.score - a.score)[0];
};

export const buildUserStudySignature = (input: PersonalizationInput): UserStudySignature => {
  const { sessions, notes, savedQuestions, resources, events, goals } = input;
  const rhythm = rhythmTrait(sessions);
  const learningStyle = learningStyleTrait(input);
  const pressureMode = pressureTrait(input);
  const preferredMinutes = medianMinutes(sessions);
  const preferredBlock = {
    label: "Block",
    value: formatMinutes(preferredMinutes),
    detail: sessions.length ? "Based on your saved session lengths." : "Default until your history grows.",
    icon: "clock-time-four-outline" as IconName,
    accent: palette.primary,
    minutes: preferredMinutes
  };
  const totalSignals = sessions.length + notes.length + savedQuestions.length + resources.length + events.length + goals.length;
  const depth = Math.min(100, Math.round(totalSignals * 4));
  const focus = focusSubjectFor(input);
  const focusSubject =
    focus?.subject && focus.score > 0
      ? {
          id: focus.subject.id,
          name: focus.subject.subjectName,
          color: focus.subject.color || palette.info,
          reason: focus.reason,
          topic: focus.topic
        }
      : null;

  const nextMove = focusSubject
    ? {
        title: `${focusSubject.name}: ${focusSubject.topic}`,
        body: focusSubject.reason,
        subjectId: focusSubject.id,
        topic: focusSubject.topic,
        minutes: preferredMinutes,
        icon: pressureMode.value === "Deadline heat" ? ("calendar-alert" as IconName) : ("target" as IconName),
        accent: focusSubject.color
      }
    : {
        title: "Build the first signal",
        body: "Start one timer block so Forge can personalise the next move.",
        subjectId: input.subjects[0]?.id ?? null,
        topic: input.subjects[0]?.subjectName ?? "first study block",
        minutes: preferredMinutes,
        icon: "radar" as IconName,
        accent: palette.info
      };

  const profileName =
    totalSignals < 4
      ? "New Forge profile"
      : `${rhythm.value === "Still learning" ? "Adaptive" : rhythm.value} ${learningStyle.value}`;

  return {
    profileName,
    depth,
    depthLabel: depth >= 80 ? "Highly personal" : depth >= 45 ? "Learning fast" : depth >= 15 ? "Warming up" : "Needs signals",
    rhythm,
    learningStyle,
    pressureMode,
    preferredBlock,
    focusSubject,
    nextMove,
    traits: [rhythm, learningStyle, pressureMode, preferredBlock]
  };
};
