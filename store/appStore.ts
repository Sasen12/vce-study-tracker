import { create } from "zustand";
import { studyApi } from "@/services/studyApi";
import type {
  AdaptiveStudyPlan,
  AnswerFeedback,
  ClassNoteChunk,
  ClassNoteDraft,
  Gamification,
  GeneratedQuestion,
  Goal,
  Leaderboard,
  SavedQuestion,
  StudyAnswer,
  StudyEvent,
  StudyNote,
  StudyReflection,
  StudyResource,
  StudySession,
  StudentSubjectMemory,
  EventRecurrence,
  EventType,
  UserSubject
} from "@/types";

type Stats = {
  todaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  perSubject: Record<string, { subjectName: string; color: string; seconds: number }>;
};

type AppState = {
  subjects: UserSubject[];
  sessions: StudySession[];
  events: StudyEvent[];
  goals: Goal[];
  savedQuestions: SavedQuestion[];
  generatedQuestions: GeneratedQuestion[];
  reflections: StudyReflection[];
  notes: StudyNote[];
  resources: StudyResource[];
  subjectMemories: StudentSubjectMemory[];
  latestPlan: AdaptiveStudyPlan | null;
  gamification: Gamification | null;
  leaderboard: Leaderboard | null;
  stats: Stats | null;
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  refreshStats: () => Promise<void>;
  createSubject: (input: {
    subjectName: string;
    unit: string;
    targetScore?: number | null;
    color: string;
  }) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  saveSession: (input: { subjectId: string; durationSeconds: number; notes?: string | null; bonusXp?: number }) => Promise<void>;
  createEvent: (input: {
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
  }) => Promise<void>;
  updateEvent: (id: string, input: Partial<StudyEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  saveGoal: (input: { subjectId: string; targetStudyScore?: number | null; weeklyHoursTarget?: number | null }) => Promise<void>;
  generateQuestions: (input: {
    subjectId: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    count: 1 | 3 | 5;
    sourceMode?: "balanced" | "exam_bank";
    visualMode?: "auto" | "visual";
  }) => Promise<GeneratedQuestion[]>;
  timerCheckQuestion: (input: {
    subjectId: string;
    topic: string;
    difficulty?: "easy" | "medium" | "hard";
  }) => Promise<GeneratedQuestion>;
  saveQuestion: (input: {
    subjectId?: string | null;
    question: string;
    modelAnswer: string;
    topic?: string | null;
    difficulty?: string | null;
    marks?: number | null;
    markingCriteria?: string[];
  }) => Promise<void>;
  checkAnswer: (input: {
    subjectId?: string | null;
    question: string;
    studentAnswer: string;
    modelAnswer: string;
    topic?: string | null;
    marks: number;
    markingCriteria?: string[];
  }) => Promise<{ feedback: AnswerFeedback; xpEarned: number }>;
  askStudyQuestion: (formData: FormData) => Promise<StudyAnswer>;
  createClassNote: (formData: FormData) => Promise<{ note: StudyNote; transcript: string; classNotes: ClassNoteDraft }>;
  createClassNoteChunk: (input: {
    subjectId: string;
    transcript: string;
    elapsedSeconds?: number;
    chunkIndex?: number;
    classDate?: string | null;
    consentAcknowledged: true;
  }) => Promise<ClassNoteChunk>;
  createReflection: (input: {
    subjectId?: string | null;
    classDate: string;
    classSummary: string;
    understood: string;
    confused: string;
    nextAction?: string | null;
  }) => Promise<StudyReflection>;
  createNote: (input: {
    subjectId?: string | null;
    title: string;
    body: string;
    noteType?: StudyNote["noteType"];
    tags?: string[];
  }) => Promise<StudyNote>;
  updateNote: (
    id: string,
    input: Partial<Pick<StudyNote, "subjectId" | "title" | "body" | "noteType" | "tags">>
  ) => Promise<StudyNote>;
  deleteNote: (id: string) => Promise<void>;
  uploadResources: (formData: FormData) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  generatePlan: (input: { planDate: string; availableMinutes: number; horizonDays?: number; priority?: string | null }) => Promise<void>;
  refreshStudentMemoryMap: () => Promise<void>;
  refreshCoach: () => Promise<void>;
  setLeaderboardPreference: (optIn: boolean) => Promise<void>;
  unlockTheme: (themeId: string) => Promise<void>;
  applyTheme: (themeId: string) => Promise<void>;
  unlockTitle: (titleId: string) => Promise<void>;
  applyTitle: (titleId: string) => Promise<void>;
  unlockBadge: (badgeId: string) => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  subjects: [],
  sessions: [],
  events: [],
  goals: [],
  savedQuestions: [],
  generatedQuestions: [],
  reflections: [],
  notes: [],
  resources: [],
  subjectMemories: [],
  latestPlan: null,
  gamification: null,
  leaderboard: null,
  stats: null,
  loading: false,
  error: null,
  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [
        subjects,
        sessions,
        stats,
        events,
        goals,
        savedQuestions,
        gamification,
        leaderboard,
        reflections,
        notes,
        resources,
        studentMemoryMap,
        latestPlan
      ] = await Promise.all([
        studyApi.subjects(),
        studyApi.sessions(),
        studyApi.sessionStats(),
        studyApi.events(),
        studyApi.goals(),
        studyApi.savedQuestions(),
        studyApi.gamification(),
        studyApi.leaderboard().catch(() => ({ leaderboard: null })),
        studyApi.reflections(),
        studyApi.notes(),
        studyApi.resources(),
        studyApi.studentMemoryMap().catch(() => ({ subjectMemories: [] })),
        studyApi.latestPlan()
      ]);
      set({
        subjects: subjects.subjects,
        sessions: sessions.sessions,
        stats: stats.stats,
        events: events.events,
        goals: goals.goals,
        savedQuestions: savedQuestions.savedQuestions,
        reflections: reflections.reflections,
        notes: notes.notes,
        resources: resources.resources,
        subjectMemories: studentMemoryMap.subjectMemories,
        latestPlan: latestPlan.plan,
        gamification: gamification.gamification,
        leaderboard: leaderboard.leaderboard,
        loading: false
      });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "Could not load study data" });
    }
  },
  refreshStats: async () => {
    const [sessions, stats, gamification, leaderboard] = await Promise.all([
      studyApi.sessions(),
      studyApi.sessionStats(),
      studyApi.gamification(),
      studyApi.leaderboard().catch(() => ({ leaderboard: null }))
    ]);
    set({
      sessions: sessions.sessions,
      stats: stats.stats,
      gamification: gamification.gamification,
      leaderboard: leaderboard.leaderboard
    });
  },
  createSubject: async (input) => {
    const data = await studyApi.createSubject(input);
    set({
      subjects: [...get().subjects, data.subject].sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
      gamification: data.gamification
    });
  },
  deleteSubject: async (id) => {
    await studyApi.deleteSubject(id);
    await get().fetchAll();
  },
  saveSession: async (input) => {
    const data = await studyApi.createSession(input);
    set({
      sessions: [data.session, ...get().sessions],
      gamification: data.gamification
    });
    await get().refreshStats();
  },
  createEvent: async (input) => {
    const data = await studyApi.createEvent(input);
    set({
      events: [...get().events, data.event].sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
      gamification: data.gamification
    });
  },
  updateEvent: async (id, input) => {
    const data = await studyApi.updateEvent(id, input);
    set({
      events: get()
        .events.map((event) => (event.id === id ? data.event : event))
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
      gamification: data.gamification
    });
  },
  deleteEvent: async (id) => {
    await studyApi.deleteEvent(id);
    set({ events: get().events.filter((event) => event.id !== id) });
  },
  saveGoal: async (input) => {
    const existing = get().goals.find((goal) => goal.subjectId === input.subjectId);
    const data = existing ? await studyApi.updateGoal(existing.id, input) : await studyApi.saveGoal(input);
    set({
      goals: [...get().goals.filter((goal) => goal.id !== data.goal.id), data.goal],
      gamification: data.gamification
    });
  },
  generateQuestions: async (input) => {
    const data = await studyApi.generateQuestions(input);
    set({ generatedQuestions: data.questions, gamification: data.gamification });
    return data.questions;
  },
  timerCheckQuestion: async (input) => {
    const data = await studyApi.timerCheckQuestion(input);
    return data.question;
  },
  saveQuestion: async (input) => {
    const data = await studyApi.saveQuestion(input);
    set({
      savedQuestions: [data.savedQuestion, ...get().savedQuestions],
      gamification: data.gamification
    });
  },
  checkAnswer: async (input) => {
    const data = await studyApi.checkAnswer(input);
    set({ gamification: data.gamification });
    return { feedback: data.feedback, xpEarned: data.xpEarned };
  },
  askStudyQuestion: async (formData) => {
    const data = await studyApi.askCoach(formData);
    set({ gamification: data.gamification });
    return data.answer;
  },
  createClassNote: async (formData) => {
    const data = await studyApi.createClassNote(formData);
    set({
      notes: [data.note, ...get().notes],
      gamification: data.gamification
    });
    return { note: data.note, transcript: data.transcript, classNotes: data.classNotes };
  },
  createClassNoteChunk: async (input) => {
    const data = await studyApi.createClassNoteChunk(input);
    return data.chunk;
  },
  createReflection: async (input) => {
    const data = await studyApi.createReflection(input);
    set({ reflections: [data.reflection, ...get().reflections] });
    return data.reflection;
  },
  createNote: async (input) => {
    const data = await studyApi.createNote(input);
    set({ notes: [data.note, ...get().notes] });
    return data.note;
  },
  updateNote: async (id, input) => {
    const data = await studyApi.updateNote(id, input);
    set({
      notes: get()
        .notes.map((note) => (note.id === id ? data.note : note))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    });
    return data.note;
  },
  deleteNote: async (id) => {
    await studyApi.deleteNote(id);
    set({ notes: get().notes.filter((note) => note.id !== id) });
  },
  uploadResources: async (formData) => {
    const data = await studyApi.uploadResources(formData);
    set({ resources: [...data.resources, ...get().resources] });
  },
  deleteResource: async (id) => {
    await studyApi.deleteResource(id);
    set({ resources: get().resources.filter((resource) => resource.id !== id) });
  },
  generatePlan: async (input) => {
    const data = await studyApi.generatePlan(input);
    set({ latestPlan: data.plan });
  },
  refreshStudentMemoryMap: async () => {
    const data = await studyApi.rebuildStudentMemoryMap();
    set({ subjectMemories: data.subjectMemories });
  },
  refreshCoach: async () => {
    const [reflections, notes, resources, studentMemoryMap, latestPlan] = await Promise.all([
      studyApi.reflections(),
      studyApi.notes(),
      studyApi.resources(),
      studyApi.studentMemoryMap().catch(() => ({ subjectMemories: [] })),
      studyApi.latestPlan()
    ]);
    set({
      reflections: reflections.reflections,
      notes: notes.notes,
      resources: resources.resources,
      subjectMemories: studentMemoryMap.subjectMemories,
      latestPlan: latestPlan.plan
    });
  },
  setLeaderboardPreference: async (optIn) => {
    const data = await studyApi.setLeaderboardPreference(optIn);
    set({ gamification: data.gamification, leaderboard: data.leaderboard });
  },
  unlockTheme: async (themeId) => {
    const data = await studyApi.unlockTheme(themeId);
    set({ gamification: data.gamification });
  },
  applyTheme: async (themeId) => {
    const data = await studyApi.applyTheme(themeId);
    set({ gamification: data.gamification });
  },
  unlockTitle: async (titleId) => {
    const data = await studyApi.unlockTitle(titleId);
    set({ gamification: data.gamification });
  },
  applyTitle: async (titleId) => {
    const data = await studyApi.applyTitle(titleId);
    set({ gamification: data.gamification });
  },
  unlockBadge: async (badgeId) => {
    const data = await studyApi.unlockBadge(badgeId);
    set({ gamification: data.gamification });
  }
}));
