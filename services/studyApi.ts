import { apiFetch, apiUpload } from "./api";
import type {
  AdaptiveStudyPlan,
  AnswerFeedback,
  ClassNoteChunk,
  ClassNoteDraft,
  DailyInspiration,
  Gamification,
  GeneratedQuestion,
  Goal,
  SavedQuestion,
  StudyAnswer,
  StudyEvent,
  StudyNote,
  StudyReflection,
  StudyResource,
  StudySession,
  EventRecurrence,
  EventType,
  UserSubject
} from "@/types";

export const studyApi = {
  subjects: () => apiFetch<{ subjects: UserSubject[] }>("/subjects"),
  createSubject: (body: Partial<UserSubject>) =>
    apiFetch<{ subject: UserSubject }>("/subjects", { method: "POST", body }),
  deleteSubject: (id: string) => apiFetch<void>(`/subjects/${id}`, { method: "DELETE" }),
  sessions: () => apiFetch<{ sessions: StudySession[] }>("/sessions"),
  sessionStats: () =>
    apiFetch<{
      stats: {
        todaySeconds: number;
        weekSeconds: number;
        monthSeconds: number;
        perSubject: Record<string, { subjectName: string; color: string; seconds: number }>;
      };
    }>("/sessions/stats"),
  createSession: (body: { subjectId: string; durationSeconds: number; notes?: string | null; bonusXp?: number }) =>
    apiFetch<{ session: StudySession; gamification: Gamification }>("/sessions", {
      method: "POST",
      body
    }),
  events: () => apiFetch<{ events: StudyEvent[] }>("/events"),
  createEvent: (body: {
    subjectId?: string | null;
    title: string;
    eventType: EventType;
    eventDate: string;
    startTime?: string | null;
    endTime?: string | null;
    recurrence?: EventRecurrence;
    recurrenceUntil?: string | null;
    notificationMinutes?: number;
    source?: string;
    googleCalendarId?: string | null;
    googleEventId?: string | null;
    description?: string | null;
  }) => apiFetch<{ event: StudyEvent; gamification: Gamification }>("/events", { method: "POST", body }),
  updateEvent: (id: string, body: Partial<StudyEvent>) =>
    apiFetch<{ event: StudyEvent; gamification: Gamification }>(`/events/${id}`, {
      method: "PATCH",
      body
    }),
  deleteEvent: (id: string) => apiFetch<void>(`/events/${id}`, { method: "DELETE" }),
  goals: () => apiFetch<{ goals: Goal[] }>("/goals"),
  saveGoal: (body: { subjectId: string; targetStudyScore?: number | null; weeklyHoursTarget?: number | null }) =>
    apiFetch<{ goal: Goal; gamification: Gamification }>("/goals", { method: "POST", body }),
  updateGoal: (id: string, body: { targetStudyScore?: number | null; weeklyHoursTarget?: number | null }) =>
    apiFetch<{ goal: Goal; gamification: Gamification }>(`/goals/${id}`, { method: "PUT", body }),
  savedQuestions: () => apiFetch<{ savedQuestions: SavedQuestion[] }>("/questions/saved"),
  generateQuestions: (body: {
    subjectId: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    count: 1 | 3 | 5;
    sourceMode?: "balanced" | "exam_bank";
  }) =>
    apiFetch<{ questions: GeneratedQuestion[]; gamification: Gamification }>("/questions/generate", {
      method: "POST",
      body
    }),
  timerCheckQuestion: (body: {
    subjectId: string;
    topic: string;
    difficulty?: "easy" | "medium" | "hard";
  }) => apiFetch<{ question: GeneratedQuestion }>("/questions/timer-check", { method: "POST", body }),
  saveQuestion: (body: {
    subjectId?: string | null;
    question: string;
    modelAnswer: string;
    topic?: string | null;
    difficulty?: string | null;
    marks?: number | null;
    markingCriteria?: string[];
  }) =>
    apiFetch<{ savedQuestion: SavedQuestion; gamification: Gamification }>("/questions/save", {
      method: "POST",
      body
    }),
  checkAnswer: (body: {
    subjectId?: string | null;
    question: string;
    studentAnswer: string;
    modelAnswer: string;
    topic?: string | null;
    marks: number;
    markingCriteria?: string[];
  }) =>
    apiFetch<{ feedback: AnswerFeedback; gamification: Gamification; xpEarned: number }>("/questions/check-answer", {
      method: "POST",
      body
    }),
  askCoach: (formData: FormData) => apiUpload<{ answer: StudyAnswer; gamification: Gamification }>("/coach/ask", formData),
  dailyInspiration: () => apiFetch<{ inspiration: DailyInspiration }>("/coach/daily-inspiration"),
  createClassNote: (formData: FormData) =>
    apiUpload<{ note: StudyNote; transcript: string; classNotes: ClassNoteDraft; gamification: Gamification }>(
      "/coach/notetaker",
      formData
    ),
  createClassNoteChunk: (body: {
    subjectId: string;
    transcript: string;
    elapsedSeconds?: number;
    chunkIndex?: number;
    classDate?: string | null;
    consentAcknowledged: true;
  }) => apiFetch<{ chunk: ClassNoteChunk }>("/coach/notetaker/chunk", { method: "POST", body }),
  reflections: () => apiFetch<{ reflections: StudyReflection[] }>("/coach/reflections"),
  createReflection: (body: {
    subjectId?: string | null;
    classDate: string;
    classSummary: string;
    understood: string;
    confused: string;
    nextAction?: string | null;
  }) => apiFetch<{ reflection: StudyReflection }>("/coach/reflections", { method: "POST", body }),
  notes: () => apiFetch<{ notes: StudyNote[] }>("/coach/notes"),
  createNote: (body: {
    subjectId?: string | null;
    title: string;
    body: string;
    noteType?: StudyNote["noteType"];
    tags?: string[];
  }) => apiFetch<{ note: StudyNote }>("/coach/notes", { method: "POST", body }),
  updateNote: (id: string, body: Partial<Pick<StudyNote, "subjectId" | "title" | "body" | "noteType" | "tags">>) =>
    apiFetch<{ note: StudyNote }>(`/coach/notes/${id}`, { method: "PUT", body }),
  deleteNote: (id: string) => apiFetch<void>(`/coach/notes/${id}`, { method: "DELETE" }),
  resources: () => apiFetch<{ resources: StudyResource[] }>("/coach/resources"),
  uploadResources: (formData: FormData) =>
    apiUpload<{ resources: StudyResource[] }>("/coach/resources/upload", formData),
  deleteResource: (id: string) => apiFetch<void>(`/coach/resources/${id}`, { method: "DELETE" }),
  latestPlan: () => apiFetch<{ plan: AdaptiveStudyPlan | null }>("/coach/plans/latest"),
  generatePlan: (body: { planDate: string; availableMinutes: number; horizonDays?: number; priority?: string | null }) =>
    apiFetch<{ plan: AdaptiveStudyPlan }>("/coach/plans/generate", { method: "POST", body }),
  gamification: () => apiFetch<{ gamification: Gamification }>("/gamification"),
  checkGamification: () => apiFetch<{ gamification: Gamification }>("/gamification/check", { method: "POST" })
};
