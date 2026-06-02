import { apiFetch, apiUpload } from "./api";
import type {
  AdaptiveStudyPlan,
  AdminEmailAudience,
  AdminEmailResult,
  AdminUsageAnalytics,
  AnswerFeedback,
  ClassNoteChunk,
  ClassNoteDraft,
  ChatAllowance,
  CommunityBoards,
  CommunityChatMessage,
  CommunityChessMatchState,
  CommunityChessTournament,
  CommunityLiveRoom,
  CommunityMission,
  CommunityMutedUserSummary,
  CommunityPulse,
  CommunityQuestionWallItem,
  CommunityReportSummary,
  CommunitySquad,
  CommunitySubjectRoom,
  CommunityUserSummary,
  DailyInspiration,
  Gamification,
  GeneratedQuestion,
  Goal,
  Leaderboard,
  PublicContactSubmission,
  SavedQuestion,
  StudyAnswer,
  StudyEvent,
  StudentMemoryEvent,
  LearningSignal,
  StudentSubjectMemory,
  UserFeedback,
  StudyNote,
  StudyReflection,
  StudyResource,
  StudySession,
  ThemeShopItem,
  TitleShopItem,
  BadgeShopItem,
  PerkShopItem,
  EventRecurrence,
  EventType,
  UserGiftMessage,
  UsageScreen,
  UserSubject
} from "@/types";

export const studyApi = {
  subjects: () => apiFetch<{ subjects: UserSubject[] }>("/subjects"),
  createSubject: (body: Partial<UserSubject>) =>
    apiFetch<{ subject: UserSubject; gamification: Gamification }>("/subjects", { method: "POST", body }),
  archiveSubject: (id: string, body?: { reason?: string | null; completeFutureEvents?: boolean }) =>
    apiFetch<{ subject: UserSubject }>(`/subjects/${id}/archive`, { method: "PATCH", body: body ?? {} }),
  deleteSubject: (id: string) => apiFetch<void>(`/subjects/${id}`, { method: "DELETE" }),
  rolloverSubject: (
    id: string,
    body?: {
      subjectName?: string;
      unit?: "1/2" | "3/4";
      targetScore?: number | null;
      color?: string;
      completeFutureEvents?: boolean;
    }
  ) =>
    apiFetch<{ subject: UserSubject; archivedSubject: UserSubject; gamification: Gamification }>(`/subjects/${id}/rollover`, {
      method: "POST",
      body: body ?? {}
    }),
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
    visualMode?: "auto" | "visual";
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
  resource: (id: string) => apiFetch<{ resource: StudyResource }>(`/coach/resources/${id}`),
  uploadResources: (formData: FormData) =>
    apiUpload<{ resources: StudyResource[] }>("/coach/resources/upload", formData),
  deleteResource: (id: string) => apiFetch<void>(`/coach/resources/${id}`, { method: "DELETE" }),
  latestPlan: () => apiFetch<{ plan: AdaptiveStudyPlan | null }>("/coach/plans/latest"),
  generatePlan: (body: { planDate: string; availableMinutes: number; horizonDays?: number; priority?: string | null }) =>
    apiFetch<{ plan: AdaptiveStudyPlan }>("/coach/plans/generate", { method: "POST", body }),
  memoryEvents: (limit = 50) => apiFetch<{ events: StudentMemoryEvent[] }>(`/memory/events?limit=${limit}`),
  learningSignals: (limit = 50) => apiFetch<{ signals: LearningSignal[] }>(`/memory/signals?limit=${limit}`),
  studentMemoryMap: () => apiFetch<{ subjectMemories: StudentSubjectMemory[] }>("/memory/student-map"),
  rebuildStudentMemoryMap: () =>
    apiFetch<{ subjectMemories: StudentSubjectMemory[] }>("/memory/student-map/rebuild", { method: "POST" }),
  gamification: () => apiFetch<{ gamification: Gamification }>("/gamification"),
  community: () =>
    apiFetch<{
      isAdmin: boolean;
      feedback: UserFeedback[];
      landingContacts?: PublicContactSubmission[];
      chat: CommunityChatMessage[];
      allowance: ChatAllowance;
      users: CommunityUserSummary[];
      pulse: CommunityPulse;
      squads: CommunitySquad[];
      liveRooms: CommunityLiveRoom[];
      questionWall: CommunityQuestionWallItem[];
      mission: CommunityMission;
      boards: CommunityBoards;
      chessTournament: CommunityChessTournament;
      reports?: CommunityReportSummary[];
      mutedUsers?: CommunityMutedUserSummary[];
    }>("/community"),
  updateContactSubmissionStatus: (id: string, adminStatus: PublicContactSubmission["adminStatus"]) =>
    apiFetch<{ submission: PublicContactSubmission }>(`/contact/${id}/status`, {
      method: "PATCH",
      body: { adminStatus }
    }),
  giftMessages: () => apiFetch<{ gifts: UserGiftMessage[] }>("/community/gifts"),
  markGiftMessageRead: (id: string) =>
    apiFetch<{ gift: UserGiftMessage }>(`/community/gifts/${id}/read`, { method: "PATCH" }),
  resendLeaderboardInvite: () =>
    apiFetch<{ resentCount: number }>("/community/leaderboard/resend-invite", { method: "POST" }),
  trackUsage: (screen: UsageScreen) =>
    apiFetch<{ throttled: boolean }>("/community/usage-events", {
      method: "POST",
      body: { screen, action: "view" }
    }),
  usageAnalytics: () => apiFetch<{ analytics: AdminUsageAnalytics }>("/community/analytics"),
  sendFeedback: (body: { category: UserFeedback["category"]; message: string }) =>
    apiFetch<{ feedback: UserFeedback }>("/community/feedback", { method: "POST", body }),
  sendCommunityChat: (body: { message: string }) =>
    apiFetch<{ chatMessage: CommunityChatMessage; allowance: ChatAllowance }>("/community/chat", {
      method: "POST",
      body
    }),
  subjectRooms: () => apiFetch<{ rooms: CommunitySubjectRoom[] }>("/community/subject-rooms"),
  subjectRoomChat: (roomId: string) =>
    apiFetch<{ room: CommunitySubjectRoom; chat: CommunityChatMessage[] }>(`/community/subject-rooms/${roomId}/chat`),
  sendSubjectRoomChat: (roomId: string, body: { message: string }) =>
    apiFetch<{ room: CommunitySubjectRoom; chatMessage: CommunityChatMessage; allowance: ChatAllowance }>(
      `/community/subject-rooms/${roomId}/chat`,
      {
        method: "POST",
        body
      }
    ),
  liveRoomHeartbeat: (roomId: string) =>
    apiFetch<{ liveRooms: CommunityLiveRoom[] }>(`/community/live-rooms/${roomId}/heartbeat`, {
      method: "POST",
      body: { roomId }
    }),
  sendQuestionWallQuestion: (body: { subjectName?: string | null; questionType?: string | null; message: string }) =>
    apiFetch<{ questionWall: CommunityQuestionWallItem[] }>("/community/question-wall", { method: "POST", body }),
  sendQuestionWallAnswer: (questionId: string, body: { message: string }) =>
    apiFetch<{ questionWall: CommunityQuestionWallItem[]; allowance: ChatAllowance }>(
      `/community/question-wall/${questionId}/answers`,
      {
        method: "POST",
        body
      }
    ),
  saveQuestionWallQuestion: (questionId: string) =>
    apiFetch<{ questionWall: CommunityQuestionWallItem[] }>(`/community/question-wall/${questionId}/save`, { method: "POST" }),
  unsaveQuestionWallQuestion: (questionId: string) =>
    apiFetch<{ questionWall: CommunityQuestionWallItem[] }>(`/community/question-wall/${questionId}/save`, { method: "DELETE" }),
  helpfulQuestionWallAnswer: (answerId: string) =>
    apiFetch<{ questionWall: CommunityQuestionWallItem[] }>(`/community/question-wall/answers/${answerId}/helpful`, { method: "POST" }),
  reportCommunityItem: (body: {
    contentType: "chat" | "room-chat" | "question" | "answer";
    contentId: string;
    reason?: string | null;
    messageId?: string | null;
    reportedUserId?: string | null;
  }) => apiFetch<{ report: CommunityReportSummary }>("/community/reports", { method: "POST", body }),
  updateCommunityReportStatus: (id: string, status: CommunityReportSummary["status"]) =>
    apiFetch<{ report: CommunityReportSummary }>(`/community/reports/${id}/status`, {
      method: "PATCH",
      body: { status }
    }),
  muteCommunityUser: (userId: string) => apiFetch<{ mutedUserId: string }>(`/community/users/${userId}/mute`, { method: "POST" }),
  unmuteCommunityUser: (userId: string) => apiFetch<void>(`/community/users/${userId}/mute`, { method: "DELETE" }),
  chessTournament: () => apiFetch<{ chessTournament: CommunityChessTournament }>("/community/chess-tournament"),
  joinChessTournament: () =>
    apiFetch<{ chessTournament: CommunityChessTournament }>("/community/chess-tournament/join", { method: "POST" }),
  chessTournamentMatch: (matchCode: string) =>
    apiFetch<{ match: CommunityChessMatchState }>(`/community/chess-tournament/matches/${encodeURIComponent(matchCode)}`),
  playChessTournamentMove: (matchCode: string, body: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" }) =>
    apiFetch<{ match: CommunityChessMatchState }>(`/community/chess-tournament/matches/${encodeURIComponent(matchCode)}/move`, {
      method: "POST",
      body
    }),
  deleteCommunityChat: (id: string) => apiFetch<void>(`/community/chat/${id}`, { method: "DELETE" }),
  giftTheme: (userId: string, body: { themeId: string; equip?: boolean }) =>
    apiFetch<{ user: CommunityUserSummary }>(`/community/users/${userId}/gifts/theme`, {
      method: "POST",
      body
    }),
  giftCoins: (userId: string, body: { amount: number; message?: string | null }) =>
    apiFetch<{ user: CommunityUserSummary }>(`/community/users/${userId}/gifts/coins`, {
      method: "POST",
      body
    }),
  sendAdminEmail: (body: {
    audience: AdminEmailAudience;
    userId?: string | null;
    subject: string;
    message: string;
  }) =>
    apiFetch<AdminEmailResult>("/community/admin-email", {
      method: "POST",
      body
    }),
  checkGamification: () => apiFetch<{ gamification: Gamification }>("/gamification/check", { method: "POST" }),
  leaderboard: () => apiFetch<{ leaderboard: Leaderboard }>("/gamification/leaderboard"),
  setLeaderboardPreference: (optIn: boolean) =>
    apiFetch<{ gamification: Gamification; leaderboard: Leaderboard }>("/gamification/leaderboard-preference", {
      method: "POST",
      body: { optIn }
    }),
  themeShop: () =>
    apiFetch<{
      items: ThemeShopItem[];
      themes: ThemeShopItem[];
      titles: TitleShopItem[];
      badges: BadgeShopItem[];
      perks: PerkShopItem[];
    }>(
      "/gamification/shop"
    ),
  unlockTheme: (themeId: string) =>
    apiFetch<{ gamification: Gamification }>(`/gamification/themes/${themeId}/unlock`, { method: "POST" }),
  applyTheme: (themeId: string) =>
    apiFetch<{ gamification: Gamification }>(`/gamification/themes/${themeId}/apply`, { method: "POST" }),
  unlockTitle: (titleId: string) =>
    apiFetch<{ gamification: Gamification }>(`/gamification/titles/${titleId}/unlock`, { method: "POST" }),
  applyTitle: (titleId: string) =>
    apiFetch<{ gamification: Gamification }>(`/gamification/titles/${titleId}/apply`, { method: "POST" }),
  unlockBadge: (badgeId: string) =>
    apiFetch<{ gamification: Gamification }>(`/gamification/badges/${badgeId}/unlock`, { method: "POST" }),
  unlockPerk: (perkId: string) =>
    apiFetch<{ gamification: Gamification }>(`/gamification/perks/${perkId}/unlock`, { method: "POST" })
};
