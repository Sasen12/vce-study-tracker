export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt?: string;
};

export type UserSubject = {
  id: string;
  userId: string;
  subjectName: string;
  unit: string;
  targetScore?: number | null;
  color: string;
};

export type StudySession = {
  id: string;
  userId: string;
  subjectId?: string | null;
  durationSeconds: number;
  notes?: string | null;
  xpEarned: number;
  createdAt: string;
  subject?: UserSubject | null;
};

export type EventType = "SAC" | "SAT" | "PRACTICE_SAC" | "PRACTICE_SAT" | "EXAM" | "TASK" | "STUDY_TIME";
export type EventRecurrence = "NONE" | "WEEKLY" | "FORTNIGHTLY_WEEK_1" | "FORTNIGHTLY_WEEK_2";
export type ResourceSourceType = "textbook" | "obsidian" | "notes" | "exam" | "exam_report" | "practice_sac" | "practice_sat";

export type StudyEvent = {
  id: string;
  userId: string;
  subjectId?: string | null;
  title: string;
  eventType: EventType;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  recurrence: EventRecurrence;
  recurrenceUntil?: string | null;
  notificationMinutes: number;
  source: string;
  googleCalendarId?: string | null;
  googleEventId?: string | null;
  description?: string | null;
  completed: boolean;
  createdAt: string;
  subject?: UserSubject | null;
};

export type Goal = {
  id: string;
  userId: string;
  subjectId?: string | null;
  targetStudyScore?: number | null;
  weeklyHoursTarget?: number | null;
  createdAt: string;
  subject?: UserSubject | null;
};

export type Gamification = {
  userId: string;
  totalXp: number;
  xpBalance: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate?: string | null;
  badges: string[];
  unlockedCosmetics: string[];
  activeTheme: string;
  leaderboardOptIn: boolean;
  leaderboardPromptedAt?: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  totalXp: number;
  level: number;
  weekXp: number;
  weekMinutes: number;
  sessionCount: number;
  isCurrentUser: boolean;
};

export type Leaderboard = {
  weekStart: string;
  weekEnd: string;
  entries: LeaderboardEntry[];
  viewer?: LeaderboardEntry | null;
  optedIn: boolean;
  prompted: boolean;
};

export type UserFeedback = {
  id: string;
  userId: string;
  category: "bug" | "feature" | "content" | "other";
  message: string;
  status: string;
  createdAt: string;
  user?: {
    displayName: string;
    email: string;
  };
};

export type CommunityChatMessage = {
  id: string;
  userId: string;
  message: string;
  createdAt: string;
  user: {
    displayName: string;
  };
  isCurrentUser: boolean;
};

export type ChatAllowance = {
  baseMinutes: number;
  studiedMinutes: number;
  earnedMinutes: number;
  totalMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  minutesPerMessage: number;
  studyMinutesPerChatMinute: number;
};

export type CommunityUserSummary = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  level: number;
  totalXp: number;
  leaderboardOptIn: boolean;
  subjectCount: number;
  sessionCount: number;
  feedbackCount: number;
  chatMessageCount: number;
};

export type ThemeShopItem = {
  id: string;
  name: string;
  price: number;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
  };
};

export type GeneratedQuestion = {
  question: string;
  marks: number;
  topic: string;
  model_answer: string;
  marking_criteria: string[];
  answer_options?: GeneratedAnswerOption[];
};

export type GeneratedAnswerOption = {
  text: string;
  correct: boolean;
};

export type AnswerFeedback = {
  score: number;
  awarded_marks: number;
  max_marks: number;
  verdict: "needs_work" | "close" | "strong" | "excellent";
  strengths: string[];
  improvements: string[];
  next_step: string;
};

export type StudyAnswerSource = {
  title: string;
  source_type: string;
  detail?: string;
};

export type StudyAnswer = {
  answer: string;
  key_points: string[];
  sources_used: StudyAnswerSource[];
  follow_up_questions: string[];
  confidence: "low" | "medium" | "high";
};

export type DailyInspiration = {
  quote: string;
  tip: string;
  action: string;
};

export type ClassNoteDraft = {
  title: string;
  summary: string;
  key_points: string[];
  subject_terms: string[];
  confusion_flags: string[];
  questions_to_ask: string[];
  retrieval_prompts: string[];
  next_actions: string[];
};

export type ClassNoteChunk = {
  title: string;
  summary: string;
  bullets: string[];
  action: string;
  confidence: "low" | "medium" | "high";
  elapsedSeconds: number;
  chunkIndex: number;
};

export type SavedQuestion = {
  id: string;
  userId: string;
  subjectId?: string | null;
  question: string;
  modelAnswer: string;
  topic?: string | null;
  difficulty?: string | null;
  marks?: number | null;
  markingCriteria?: string[] | null;
  createdAt: string;
  subject?: UserSubject | null;
};

export type StudyReflection = {
  id: string;
  userId: string;
  subjectId?: string | null;
  classDate: string;
  classSummary: string;
  understood: string;
  confused: string;
  nextAction?: string | null;
  createdAt: string;
  subject?: UserSubject | null;
};

export type StudyNoteType = "general" | "worked_example" | "formula" | "mistake_log";

export type StudyNote = {
  id: string;
  userId: string;
  subjectId?: string | null;
  title: string;
  body: string;
  noteType: StudyNoteType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  subject?: UserSubject | null;
};

export type StudyResource = {
  id: string;
  userId: string;
  subjectId?: string | null;
  fileName: string;
  fileType: "pdf" | "docx" | "doc" | "markdown" | "text" | string;
  sourceType: ResourceSourceType | string;
  extractedTextPreview?: string;
  createdAt: string;
  subject?: UserSubject | null;
};

export type AdaptiveStudyTask = {
  date?: string;
  title: string;
  subject: string;
  minutes: number;
  mode: string;
  reason: string;
  topic?: string;
  assessment_title?: string;
  assessment_date?: string;
  event_type?: string;
  output?: string;
  time_window?: string;
};

export type DailyStudyPlan = {
  date: string;
  total_minutes: number;
  focus: string;
  tasks: AdaptiveStudyTask[];
  checkpoint?: string;
};

export type SubjectRoadmap = {
  subject: string;
  assessment_title: string;
  assessment_type: string;
  assessment_date: string;
  topic: string;
  days_until: number;
  recommended_total_minutes: number;
  study_design_focus: string;
  daily_focus: string[];
};

export type PlanSourceEvent = {
  id: string;
  title: string;
  subject: string;
  event_type: string;
  event_date: string;
  topic: string;
  days_until: number;
};

export type AdaptiveStudyPlan = {
  id: string;
  userId: string;
  planDate: string;
  summary: string;
  focusAreas: string[];
  tasks: AdaptiveStudyTask[];
  dailyPlan?: DailyStudyPlan[];
  subjectRoadmaps?: SubjectRoadmap[];
  sourceEvents?: PlanSourceEvent[];
  checkpoints: string[];
  createdAt: string;
};

export type ApiError = {
  message: string;
  status?: number;
};
