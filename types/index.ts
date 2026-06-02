export type User = {
  id: string;
  email: string;
  displayName: string;
  schoolName?: string | null;
  avatarUrl?: string | null;
  weeklyDigestOptIn?: boolean;
  weeklyDigestUnsubscribedAt?: string | null;
  weeklyDigestLastSentAt?: string | null;
  createdAt?: string;
};

export type UserSubject = {
  id: string;
  userId: string;
  subjectName: string;
  unit: string;
  targetScore?: number | null;
  color: string;
  archivedAt?: string | null;
  archivedReason?: string | null;
  supersededBySubjectId?: string | null;
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
  activeTitle: string;
  leaderboardOptIn: boolean;
  leaderboardPromptedAt?: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  totalXp: number;
  level: number;
  activeTitle: string;
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

export type PublicContactSubmission = {
  id: string;
  name: string;
  email: string;
  yearLevel?: string | null;
  school?: string | null;
  subject?: string | null;
  question: string;
  deliveryStatus: string;
  deliveryError?: string | null;
  adminStatus: "new" | "replied" | "archived";
  createdAt: string;
};

export type CommunityChatMessage = {
  id: string;
  userId: string;
  message: string;
  subjectRoomId?: string | null;
  createdAt: string;
  user: {
    displayName: string;
  };
  isCurrentUser: boolean;
};

export type CommunitySubjectRoom = {
  id: string;
  subjectName: string;
  unit: string;
  color: string;
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
  unlockStudyMinutes?: number;
  unlockedMessages?: number;
  roomUnlimitedStudyMinutes?: number;
  unlimitedRoomChat?: boolean;
  bonusMessages?: number;
};

export type CommunityActivityItem = {
  id: string;
  type: "study" | "question" | "answer" | "squad" | "room" | "badge";
  title: string;
  detail: string;
  createdAt: string;
  color: string;
  icon: string;
};

export type CommunitySnapshot = {
  weeklyStudyMinutes: number;
  bestSquadRank?: number | null;
  questionsHelped: number;
  badgesEarned: number;
  currentStreak: number;
  joinedSquads: number;
};

export type CommunitySquad = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  identity: string;
  weeklyMinutes: number;
  weeklyGoalMinutes: number;
  goalProgress: number;
  todayMinutes: number;
  viewerMinutes: number;
  viewerRank?: number | null;
  momentum: string;
  openQuestionCount: number;
  activeTodayCount: number;
  nextNudge: string;
  topContributor?: {
    displayName: string;
    minutes: number;
  } | null;
  topHelper?: {
    displayName: string;
    answers: number;
  } | null;
  mostImproved?: {
    displayName: string;
    minutesGained: number;
  } | null;
  questionsAnswered: number;
  streakCount: number;
  memberCount: number;
  viewerJoined: boolean;
};

export type CommunityLiveRoom = {
  id: string;
  title: string;
  subjectHint: string;
  squadId: string;
  targetMinutes: number;
  color: string;
  description: string;
  focusPrompt: string;
  nextSessionAt: string;
  recentlyActiveAt?: string | null;
  activityPreview: string;
  emptyCta: string;
  weeklyMinutes: number;
  weeklyGoalMinutes: number;
  goalProgress: number;
  roomState: "live" | "warming" | "quiet";
  activeCount: number;
  activeStudents: {
    displayName: string;
    lastSeenAt: string;
  }[];
};

export type CommunityQuestionWallAnswer = {
  id: string;
  message: string;
  createdAt: string;
  user: {
    displayName: string;
  };
  isCurrentUser: boolean;
  helpfulVotes: number;
  votedHelpfulByViewer: boolean;
};

export type CommunityQuestionWallItem = {
  id: string;
  subjectName?: string | null;
  questionType: string;
  message: string;
  createdAt: string;
  answerCount: number;
  isCurrentUser: boolean;
  answeredByViewer: boolean;
  savedByViewer: boolean;
  lastActivityAt: string;
  status: "Open" | "Answered" | "Needs explanation";
  helpfulScore: number;
  answers: CommunityQuestionWallAnswer[];
};

export type CommunityChessTournament = {
  weekStart: string;
  requiredMinutes: number;
  viewerMinutes: number;
  eligible: boolean;
  joined: boolean;
  joinedCount: number;
  nextRoundAt: string;
  signupClosesAt?: string;
  signupOpen?: boolean;
  statusCopy?: string;
  pairingCount?: number;
  rounds?: {
    id: string;
    label: string;
    startsAt: string;
    status: "signup" | "upcoming" | "live" | "done";
  }[];
  viewerMatches?: {
    id: string;
    round: number;
    label: string;
    startsAt: string;
    status: "signup" | "waiting" | "paired" | "bye" | "eliminated" | "champion";
    color: "white" | "black" | "either";
    matchCode?: string | null;
    opponent?: {
      displayName: string;
    } | null;
  }[];
  tournamentMatches?: {
    id: string;
    round: number;
    label: string;
    startsAt: string;
    matchCode?: string | null;
    status: "scheduled" | "active" | "white_win" | "black_win" | "draw" | "bye" | "waiting";
    result?: string | null;
    resultCopy: string;
    canOpen: boolean;
    canTiebreak: boolean;
    viewerColor?: "white" | "black" | null;
    white?: {
      displayName: string;
    } | null;
    black?: {
      displayName: string;
    } | null;
  }[];
  standings?: {
    displayName: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    matchesRemaining: number;
    status: "alive" | "eliminated" | "champion";
    isCurrentUser: boolean;
  }[];
};

export type CommunityChessMatchState = {
  id: string;
  matchCode: string;
  weekStart: string;
  round: number;
  label: string;
  startsAt: string;
  fen: string;
  pgn?: string | null;
  status: "active" | "white_win" | "black_win" | "draw";
  result?: string | null;
  resultCopy?: string;
  viewerColor: "white" | "black";
  turn: "white" | "black";
  canMove: boolean;
  canTiebreak: boolean;
  signupOpen?: boolean;
  white: {
    displayName: string;
  };
  black: {
    displayName: string;
  };
  opponent: {
    displayName: string;
  };
  lastMove?: {
    from: string;
    to: string;
    san?: string | null;
    at?: string | null;
  } | null;
  inCheck: boolean;
  checkmate: boolean;
  draw: boolean;
};

export type CommunityReportSummary = {
  id: string;
  contentType: string;
  contentId: string;
  messageId?: string | null;
  reason: string;
  status: "new" | "reviewing" | "resolved" | "ignored";
  createdAt: string;
  reporter: {
    displayName: string;
    email: string;
  };
  reportedUser?: {
    displayName: string;
    email: string;
  } | null;
};

export type CommunityMutedUserSummary = {
  mutedUserId: string;
  displayName: string;
  email: string;
  schoolName?: string | null;
  createdAt: string;
};

export type CommunityPulse = {
  snapshot: CommunitySnapshot;
  activityFeed: CommunityActivityItem[];
  weeklyMinutes: number;
  activeNow: number;
  openQuestions: number;
  helpfulAnswers: number;
  topSquad?: {
    id: string;
    name: string;
    minutes: number;
    color: string;
  } | null;
};

export type CommunityMission = {
  id: string;
  title: string;
  reward: string;
  complete: boolean;
  rewardClaimed?: boolean;
  items: {
    id: string;
    label: string;
    target: number;
    progress: number;
    complete: boolean;
    action: "study" | "questions" | "notes" | "practice";
    actionLabel: string;
    helper: string;
  }[];
  nextAction?: {
    id: string;
    label: string;
    action: "study" | "questions" | "notes" | "practice";
  } | null;
};

export type CommunityLeaderboardEntry = LeaderboardEntry & {
  score: number;
  todayMinutes: number;
  previousMinutes: number;
  improvementMinutes: number;
  currentStreak: number;
  helpfulAnswers: number;
  challengeScore: number;
};

export type CommunityBoards = {
  weekStart: string;
  weekEnd: string;
  week: CommunityLeaderboardEntry[];
  today: CommunityLeaderboardEntry[];
  improved: CommunityLeaderboardEntry[];
  streaks: CommunityLeaderboardEntry[];
  helpful: CommunityLeaderboardEntry[];
  challenge: CommunityLeaderboardEntry[];
};

export type CommunityUserSummary = {
  id: string;
  email: string;
  displayName: string;
  schoolName?: string | null;
  createdAt: string;
  level: number;
  totalXp: number;
  xpBalance: number;
  leaderboardOptIn: boolean;
  unlockedCosmetics: string[];
  activeTheme: string;
  activeTitle: string;
  subjectCount: number;
  sessionCount: number;
  feedbackCount: number;
  chatMessageCount: number;
};

export type AdminEmailAudience = "opted_in" | "all" | "single";

export type AdminEmailResult = {
  attempted: number;
  sent: number;
  failed: number;
};

export type UserGiftMessage = {
  id: string;
  title: string;
  message: string;
  giftType: string;
  giftId: string;
  readAt?: string | null;
  createdAt: string;
};

export type UsageScreen = "home" | "insights" | "study" | "calendar" | "questions" | "community" | "shop" | "pro" | "profile" | "more";

export type UsageHourlyBucket = {
  hourStart: string;
  eventCount: number;
  uniqueUsers: number;
};

export type UsageScreenSummary = {
  screen: UsageScreen;
  label: string;
  eventCount: number;
  uniqueUsers: number;
  lastSeenAt?: string | null;
};

export type UsageUserSummary = {
  userId: string;
  displayName: string;
  email: string;
  schoolName?: string | null;
  lastSeenAt?: string | null;
  lastScreen?: UsageScreen | string | null;
  events24h: number;
  events7d: number;
  studyMinutes7d: number;
  chatMessages7d: number;
  feedback7d: number;
};

export type UsageRecentEvent = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  schoolName?: string | null;
  screen: UsageScreen | string;
  label: string;
  action: string;
  createdAt: string;
};

export type AdminUsageAnalytics = {
  generatedAt: string;
  totals: {
    activeNow: number;
    activeToday: number;
    active7Days: number;
    trackedEvents24h: number;
    studyMinutes7d: number;
    chatMessages7d: number;
    feedback7d: number;
  };
  hourly: UsageHourlyBucket[];
  screens: UsageScreenSummary[];
  users: UsageUserSummary[];
  recent: UsageRecentEvent[];
};

export type ThemeShopItem = {
  id: string;
  name: string;
  price: number;
  motion?: "blossom" | "spring" | "glow" | "pastel" | "lights" | "snow";
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
  };
};

export type TitleShopItem = {
  id: string;
  label: string;
  price: number;
  description: string;
};

export type BadgeShopItem = {
  id: string;
  label: string;
  price: number;
  description: string;
};

export type PerkShopItem = {
  id: string;
  label: string;
  price: number;
  icon: string;
  description: string;
};

export type GeneratedQuestion = {
  question: string;
  marks: number;
  topic: string;
  model_answer: string;
  marking_criteria: string[];
  answer_options?: GeneratedAnswerOption[];
  visual?: GeneratedQuestionVisual | null;
};

export type GeneratedAnswerOption = {
  text: string;
  correct: boolean;
};

export type GeneratedQuestionVisual = {
  type: "line_graph" | "scatter_plot" | "bar_chart" | "diagram" | "image_prompt";
  title: string;
  description: string;
  x_label: string;
  y_label: string;
  points: { x: number; y: number; label: string }[];
  bars: { label: string; value: number }[];
  labels: string[];
  image_data?: string;
  image_mime_type?: string;
  image_alt?: string;
  image_model?: string;
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
  tutor_plan?: {
    diagnosis: string;
    teaching_move: string;
    guided_steps: string[];
    your_turn: string;
    check_question: string;
    next_revision: string;
  };
  confidence: "low" | "medium" | "high";
  visuals?: GeneratedQuestionVisual[];
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
  extractedText?: string;
  createdAt: string;
  subject?: UserSubject | null;
};

export type StudentMemoryEvent = {
  id: string;
  userId: string;
  subjectId?: string | null;
  eventType: string;
  sourceType: string;
  sourceId?: string | null;
  title: string;
  summary: string;
  payload: unknown;
  importance: number;
  createdAt: string;
  subject?: UserSubject | null;
  signals?: LearningSignal[];
};

export type LearningSignal = {
  id: string;
  userId: string;
  subjectId?: string | null;
  subjectKey: string;
  subjectName: string;
  memoryEventId?: string | null;
  signalType:
    | "weakness"
    | "strength"
    | "mistake"
    | "topic_interest"
    | "study_behavior"
    | "assessment_risk"
    | "resource_context"
    | "next_action"
    | string;
  topic?: string | null;
  title: string;
  detail: string;
  evidence: string;
  confidence: "low" | "medium" | "high" | string;
  nextAction?: string | null;
  weight: number;
  sourceType: string;
  sourceId?: string | null;
  createdAt: string;
  subject?: UserSubject | null;
};

export type StudentSubjectMemory = {
  id: string;
  userId: string;
  subjectId?: string | null;
  subjectKey: string;
  subjectName: string;
  strengths: unknown[];
  weakAreas: unknown[];
  commonMistakes: unknown[];
  recentTopics: unknown[];
  upcomingAssessments: unknown[];
  bestStudyMethods: unknown[];
  evidenceTrail: unknown[];
  riskLevel: "low" | "medium" | "high" | string;
  predictedNextTask?: string | null;
  createdAt: string;
  updatedAt: string;
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
