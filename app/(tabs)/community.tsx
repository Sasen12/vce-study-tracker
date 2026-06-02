import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, Dialog, IconButton, Portal, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { titleLabelById } from "@/constants/gamification";
import { palette, themeShopItems } from "@/constants/theme";
import { studyApi } from "@/services/studyApi";
import { useAppStore } from "@/store/appStore";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import type {
  AdminEmailAudience,
  AdminUsageAnalytics,
  ChatAllowance,
  CommunityBoards,
  CommunityChatMessage,
  CommunityLeaderboardEntry,
  CommunityLiveRoom,
  CommunityMission,
  CommunityMutedUserSummary,
  CommunityPulse,
  CommunityQuestionWallItem,
  CommunityReportSummary,
  CommunitySquad,
  CommunitySubjectRoom,
  CommunityUserSummary,
  CommunityChessTournament,
  PublicContactSubmission,
  UsageScreen,
  UserSubject,
  UserFeedback
} from "@/types";

type Mode = "squads" | "rooms" | "questions" | "chat" | "leaderboard" | "feedback" | "users" | "analytics";
type BoardScope = "week" | "today" | "improved" | "streaks" | "helpful" | "challenge";
type FeedbackCategory = UserFeedback["category"];
type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const SUBJECT_ROOM_INTRO_KEY = "vce_subject_rooms_intro_seen_v1";
const JOINED_SUBJECT_ROOMS_KEY = "vce_joined_subject_rooms_v1";
const COMMUNITY_GUIDE_KEY = "vce_community_guide_seen_v1";
const QUESTION_TYPES = ["Homework help", "SAC prep", "Exam revision", "Concept help", "Motivation"] as const;

const genericRoomPrompts = [
  "Ask a question",
  "Share a study tip",
  "Share a win",
  "Start a revision thread",
  "Ask for feedback",
  "Drop a resource"
];

const subjectStarterPrompts: Record<string, string[]> = {
  software: [
    "What part of your SAT are you working on?",
    "Need help with your SRS?",
    "Share one bug you fixed today.",
    "What criterion are you stuck on?"
  ],
  business: [
    "Which command term is costing marks?",
    "Drop a case study link you can use.",
    "Ask for help with a 10-marker.",
    "What dot point are you revising?"
  ],
  english: [
    "Share one quote you are using.",
    "Ask for feedback on a contention.",
    "What essay paragraph is weak?",
    "Drop a language analysis question."
  ],
  maths: [
    "Which method keeps breaking?",
    "Share a worked step you fixed.",
    "Ask about a finance model.",
    "What SAC topic needs reps?"
  ]
};

const categoryCopy: Record<FeedbackCategory, string> = {
  bug: "Bug",
  feature: "Feature",
  content: "Content",
  other: "Other"
};

const contactStatusCopy: Record<PublicContactSubmission["adminStatus"], string> = {
  new: "New",
  replied: "Replied",
  archived: "Archived"
};

const adminEmailTemplates = [
  {
    id: "service_update",
    label: "Service update",
    icon: "server-network",
    subject: "VCE Forge service update",
    message:
      "Quick update from VCE Forge.\n\nThe app is running again and I have tightened the backend setup so this should be more stable. Thanks for sticking with it while I keep improving the site.\n\nIf something looks off, reply with the page and what happened so I can fix it fast."
  },
  {
    id: "weekly_push",
    label: "Weekly push",
    icon: "calendar-star",
    subject: "Your VCE Forge week starts now",
    message:
      "New week, clean slate.\n\nYour best move is simple: add the next deadline, run one focused timer, then check your weak areas. Small sessions still count when they create evidence.\n\nCommunity squads and chess signups are open if you want some pressure around you."
  },
  {
    id: "community_event",
    label: "Community event",
    icon: "account-group",
    subject: "This week's VCE Forge community event",
    message:
      "This week's community event is live.\n\nJoin your subject squad, start a study room, or sign up for the chess tournament from Home or Community. You do not need to be top of the leaderboard. Showing up is enough to move the room."
  },
  {
    id: "outage_apology",
    label: "Outage note",
    icon: "heart-outline",
    subject: "Sorry VCE Forge was down",
    message:
      "Hey, quick apology from me.\n\nVCE Forge was unavailable for longer than it should have been. That is frustrating, especially when people are using it around SACs and real study pressure.\n\nI have fixed the issue I found and I am adding better admin tools so I can respond faster next time. Thanks for being early and helping shape this."
  }
] as const;

type AdminEmailTemplateId = (typeof adminEmailTemplates)[number]["id"];

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (value?: string | null) => {
  const date = safeDate(value);
  if (!date) return "Not yet";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const formatHour = (value?: string | null) => {
  const date = safeDate(value);
  if (!date) return "Soon";
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const formatRelativeTime = (value?: string | null) => {
  const date = safeDate(value);
  if (!date) return "No visits yet";
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
};

const formatWeekRange = (start?: string, end?: string) => {
  if (!start || !end) return "This week";
  const formatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1);
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
};

const themeNameById = (themeId?: string | null) =>
  themeShopItems.find((theme) => theme.id === themeId)?.name ?? "Midnight Focus";

const usageScreenLabels: Record<UsageScreen, string> = {
  home: "Home",
  insights: "Student Map",
  study: "Study",
  calendar: "Calendar",
  questions: "Questions",
  community: "Community",
  shop: "Shop",
  pro: "Pro",
  profile: "Profile",
  more: "More"
};

const usageScreenLabel = (screen?: string | null) =>
  screen && screen in usageScreenLabels ? usageScreenLabels[screen as UsageScreen] : screen ?? "Unknown";

const firstGiftThemeFor = (user: CommunityUserSummary) =>
  themeShopItems.find((theme) => theme.id === "cherry_blossom" && !user.unlockedCosmetics.includes(theme.id))?.id ??
  themeShopItems.find((theme) => theme.price > 0 && !user.unlockedCosmetics.includes(theme.id))?.id ??
  user.activeTheme ??
  "midnight";

const roomIdForSubject = (subjectName: string) =>
  subjectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "subject";

const roomsFromSubjects = (subjects: UserSubject[]): CommunitySubjectRoom[] => {
  const rooms = new Map<string, CommunitySubjectRoom>();
  subjects.forEach((subject) => {
    const id = roomIdForSubject(subject.subjectName);
    if (!rooms.has(id)) {
      rooms.set(id, {
        id,
        subjectName: subject.subjectName,
        unit: subject.unit,
        color: subject.color
      });
    }
  });
  return Array.from(rooms.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
};

function ChatBubble({
  item,
  canDelete,
  deleting,
  onDelete,
  onReply,
  onReact,
  onReport,
  onMute
}: {
  item: CommunityChatMessage;
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: (id: string) => void;
  onReply?: (item: CommunityChatMessage) => void;
  onReact?: (item: CommunityChatMessage) => void;
  onReport?: (item: CommunityChatMessage) => void;
  onMute?: (item: CommunityChatMessage) => void;
}) {
  return (
    <View style={[styles.chatBubble, item.isCurrentUser && styles.chatBubbleMine]}>
      <View style={styles.chatMeta}>
        <Text style={styles.chatName} numberOfLines={1}>
          {item.user.displayName}
        </Text>
        <View style={styles.chatMetaRight}>
          <Text style={styles.mutedSmall}>{formatTime(item.createdAt)}</Text>
          {canDelete ? (
            <IconButton
              icon="delete-outline"
              size={18}
              iconColor={palette.secondary}
              accessibilityLabel="Delete chat message"
              disabled={deleting}
              onPress={() => onDelete?.(item.id)}
              style={styles.deleteIconButton}
            />
          ) : null}
        </View>
      </View>
      <Text style={styles.chatText}>{item.message}</Text>
      <View style={styles.chatControls}>
        <Button mode="text" compact icon="reply-outline" onPress={() => onReply?.(item)}>
          Reply
        </Button>
        <Button mode="text" compact icon="thumb-up-outline" onPress={() => onReact?.(item)}>
          Helpful
        </Button>
        <Button mode="text" compact icon="flag-outline" onPress={() => onReport?.(item)}>
          Report
        </Button>
        {!item.isCurrentUser ? (
          <Button mode="text" compact icon="volume-off" onPress={() => onMute?.(item)}>
            Mute
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function FeedbackItem({ item, showSender }: { item: UserFeedback; showSender?: boolean }) {
  return (
    <View style={styles.feedbackItem}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackMeta}>
          <Text style={styles.feedbackCategory}>{categoryCopy[item.category]}</Text>
          <Text style={styles.feedbackStatus}>{item.status}</Text>
        </View>
        <Text style={styles.mutedSmall}>{formatTime(item.createdAt)}</Text>
      </View>
      {showSender ? (
        <View style={styles.senderRow}>
          <MaterialCommunityIcons name="account-circle-outline" color={palette.info} size={18} />
          <View style={styles.flexText}>
            <Text style={styles.feedbackSender} numberOfLines={1}>
              {item.user?.displayName ?? "Unknown student"}
            </Text>
            <Text style={styles.mutedSmall} numberOfLines={1}>
              {item.user?.email ?? "No email attached"}
            </Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.feedbackMessage}>{item.message}</Text>
    </View>
  );
}

function LandingContactItem({
  item,
  updating,
  onStatus
}: {
  item: PublicContactSubmission;
  updating?: boolean;
  onStatus: (id: string, status: PublicContactSubmission["adminStatus"]) => void;
}) {
  return (
    <View style={styles.feedbackItem}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackMeta}>
          <Text style={styles.feedbackCategory}>Landing page</Text>
          <Text style={styles.feedbackStatus}>{contactStatusCopy[item.adminStatus]}</Text>
        </View>
        <Text style={styles.mutedSmall}>{formatTime(item.createdAt)}</Text>
      </View>
      <View style={styles.senderRow}>
        <MaterialCommunityIcons name="account-question-outline" color={palette.info} size={18} />
        <View style={styles.flexText}>
          <Text style={styles.feedbackSender} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.mutedSmall} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
      </View>
      <View style={styles.contactMetaGrid}>
        {item.yearLevel ? <Text style={styles.userStat}>{item.yearLevel}</Text> : null}
        {item.school ? <Text style={styles.userStat}>{item.school}</Text> : null}
        {item.subject ? <Text style={styles.userStat}>{item.subject}</Text> : null}
        <Text style={styles.userStat}>Delivery: {item.deliveryStatus}</Text>
      </View>
      <Text style={styles.feedbackMessage}>{item.question}</Text>
      <View style={styles.contactActions}>
        <Button
          mode={item.adminStatus === "new" ? "contained" : "outlined"}
          compact
          icon="email-check-outline"
          disabled={updating || item.adminStatus === "replied"}
          onPress={() => onStatus(item.id, "replied")}
        >
          Replied
        </Button>
        <Button
          mode="outlined"
          compact
          icon="archive-outline"
          disabled={updating || item.adminStatus === "archived"}
          onPress={() => onStatus(item.id, "archived")}
        >
          Archive
        </Button>
        {item.adminStatus !== "new" ? (
          <Button mode="outlined" compact icon="restore" disabled={updating} onPress={() => onStatus(item.id, "new")}>
            Reopen
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function CommunityReportItem({
  item,
  updating,
  onStatus,
  onDeleteMessage
}: {
  item: CommunityReportSummary;
  updating?: boolean;
  onStatus: (id: string, status: CommunityReportSummary["status"]) => void;
  onDeleteMessage: (item: CommunityReportSummary) => void;
}) {
  const reportStatusTone = item.status === "new" || item.status === "reviewing" ? styles.feedbackStatusHot : styles.feedbackStatusCalm;

  return (
    <View style={styles.feedbackItem}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackMeta}>
          <Text style={styles.feedbackCategory}>{item.contentType}</Text>
          <Text style={[styles.feedbackStatus, reportStatusTone]}>{item.status}</Text>
        </View>
        <Text style={styles.mutedSmall}>{formatTime(item.createdAt)}</Text>
      </View>
      <Text style={styles.feedbackMessage}>{item.reason}</Text>
      <View style={styles.senderRow}>
        <MaterialCommunityIcons name="account-alert-outline" color={palette.warning} size={18} />
        <View style={styles.flexText}>
          <Text style={styles.feedbackSender} numberOfLines={1}>
            Reported by {item.reporter.displayName}
          </Text>
          <Text style={styles.mutedSmall} numberOfLines={1}>
            {item.reporter.email}
          </Text>
        </View>
      </View>
      {item.reportedUser ? (
        <Text style={styles.mutedSmall} numberOfLines={1}>
          About {item.reportedUser.displayName} - {item.reportedUser.email}
        </Text>
      ) : null}
      <View style={styles.contactActions}>
        {item.status !== "reviewing" ? (
          <Button mode="outlined" compact icon="eye-outline" disabled={updating} onPress={() => onStatus(item.id, "reviewing")}>
            Review
          </Button>
        ) : null}
        {item.messageId ? (
          <Button mode="outlined" compact icon="delete-outline" disabled={updating} onPress={() => onDeleteMessage(item)}>
            Delete content
          </Button>
        ) : null}
        <Button mode={item.status === "resolved" ? "contained" : "outlined"} compact icon="check-circle-outline" disabled={updating} onPress={() => onStatus(item.id, "resolved")}>
          Resolve
        </Button>
        <Button mode="text" compact icon="close-circle-outline" disabled={updating} onPress={() => onStatus(item.id, "ignored")}>
          Ignore
        </Button>
      </View>
    </View>
  );
}

const boardMetricLabel = (entry: CommunityLeaderboardEntry, scope: BoardScope) => {
  if (scope === "week") return `${entry.score} XP`;
  if (scope === "today") return `${entry.score} min`;
  if (scope === "improved") return `+${entry.score} min`;
  if (scope === "streaks") return `${entry.score} day${entry.score === 1 ? "" : "s"}`;
  if (scope === "helpful") return `${entry.score} help${entry.score === 1 ? "" : "s"}`;
  return `${entry.score}/7`;
};

const boardDetailLabel = (entry: CommunityLeaderboardEntry, scope: BoardScope) => {
  if (scope === "week") return `${entry.weekMinutes} min - ${entry.sessionCount} sessions`;
  if (scope === "today") return `${entry.weekXp} XP this week - ${entry.sessionCount} sessions`;
  if (scope === "improved") return `${entry.weekMinutes} min this week - ${entry.previousMinutes} min last week`;
  if (scope === "streaks") return `${entry.weekMinutes} min this week - ${entry.weekXp} XP`;
  if (scope === "helpful") return `${entry.weekMinutes} min - ${entry.helpfulAnswers} helpful answers`;
  return `${entry.challengeScore} mission points - ${entry.weekMinutes} min`;
};

const boardGapLabel = (scope: BoardScope, gap: number) => {
  if (scope === "week") return `${gap} XP`;
  if (scope === "today") return `${gap} min`;
  if (scope === "improved") return `${gap} more min`;
  if (scope === "streaks") return `${gap} day${gap === 1 ? "" : "s"}`;
  if (scope === "helpful") return `${gap} helpful answer${gap === 1 ? "" : "s"}`;
  return `${gap} mission point${gap === 1 ? "" : "s"}`;
};

function CommunityBoardRow({ entry, scope }: { entry: CommunityLeaderboardEntry; scope: BoardScope }) {
  return (
    <View style={[styles.leaderboardRow, entry.isCurrentUser && styles.leaderboardRowActive]}>
      <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
      <View style={styles.leaderboardNameBlock}>
        <Text style={styles.leaderboardName} numberOfLines={1}>
          {entry.displayName}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {titleLabelById(entry.activeTitle)} - {boardDetailLabel(entry, scope)}
        </Text>
      </View>
      <Text style={styles.leaderboardXp}>{boardMetricLabel(entry, scope)}</Text>
    </View>
  );
}

function CommunityPulseStrip({ pulse }: { pulse: CommunityPulse | null }) {
  if (!pulse) return null;

  const tiles: {
    icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
    value: string;
    label: string;
    color: string;
  }[] = [
    {
      icon: "timer-sand",
      value: `${pulse.weeklyMinutes}m`,
      label: "squad study this week",
      color: palette.info
    },
    {
      icon: "radio-tower",
      value: `${pulse.activeNow}`,
      label: "live now",
      color: palette.success
    },
    {
      icon: "comment-question-outline",
      value: `${pulse.openQuestions}`,
      label: "questions need help",
      color: palette.secondary
    },
    {
      icon: "trophy-outline",
      value: pulse.topSquad ? pulse.topSquad.name : "No leader",
      label: pulse.topSquad ? `${pulse.topSquad.minutes}m top squad` : "top squad waiting",
      color: pulse.topSquad?.color ?? palette.warning
    }
  ];

  return (
    <View style={styles.pulseGrid}>
      {tiles.map((tile) => (
        <View key={tile.label} style={styles.pulseTile}>
          <View style={[styles.pulseIcon, { backgroundColor: `${tile.color}18` }]}>
            <MaterialCommunityIcons name={tile.icon} color={tile.color} size={18} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.pulseValue} numberOfLines={1}>
              {tile.value}
            </Text>
            <Text style={styles.mutedSmall} numberOfLines={1}>
              {tile.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function CommunityGuideCard({ hidden, onDismiss }: { hidden: boolean; onDismiss: () => void }) {
  if (hidden) return null;

  const steps: { icon: IconName; title: string; body: string; color: string }[] = [
    { icon: "account-group-outline", title: "Subject squads", body: "Only squads matching your active subjects appear.", color: palette.primary },
    { icon: "door-open", title: "Use rooms", body: "Study beside people without needing to chat.", color: palette.success },
    { icon: "comment-question-outline", title: "Ask safely", body: "Anonymous Q&A keeps stuck points moving.", color: palette.info },
    { icon: "chess-knight", title: "Chess knockout", body: "Sign up, play your match, and advance by winning.", color: palette.warning }
  ];

  return (
    <AppCard style={styles.guideCard}>
      <View style={styles.feedbackHeader}>
        <View style={styles.flexText}>
          <Text style={styles.cardTitle}>How Community works</Text>
          <Text style={styles.muted}>Study helps your subject squads; Q&A and chess give students structured ways to compete or help.</Text>
        </View>
        <IconButton icon="close" size={18} iconColor={palette.muted} accessibilityLabel="Hide community guide" onPress={onDismiss} />
      </View>
      <View style={styles.guideGrid}>
        {steps.map((step) => (
          <View key={step.title} style={styles.guideStep}>
            <View style={[styles.guideIcon, { backgroundColor: `${step.color}18` }]}>
              <MaterialCommunityIcons name={step.icon} color={step.color} size={18} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.guideTitle}>{step.title}</Text>
              <Text style={styles.mutedSmall}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function CommunitySnapshotCard({ pulse }: { pulse: CommunityPulse | null }) {
  if (!pulse) return null;
  const rankLabel = pulse.snapshot.bestSquadRank ? `#${pulse.snapshot.bestSquadRank}` : "Start";
  const tiles = [
    { label: "your minutes", value: `${pulse.snapshot.weeklyStudyMinutes}m`, icon: "timer-outline" as IconName },
    { label: "best squad rank", value: rankLabel, icon: "podium" as IconName },
    { label: "questions helped", value: pulse.snapshot.questionsHelped, icon: "hand-heart-outline" as IconName },
    { label: "badges earned", value: pulse.snapshot.badgesEarned, icon: "medal-outline" as IconName },
    { label: "current streak", value: pulse.snapshot.currentStreak, icon: "fire" as IconName },
    { label: "joined squads", value: pulse.snapshot.joinedSquads, icon: "account-multiple-check-outline" as IconName }
  ];

  return (
    <AppCard style={styles.snapshotCard}>
      <View style={styles.feedbackHeader}>
        <View style={styles.flexText}>
          <Text style={styles.cardTitle}>Your community snapshot</Text>
          <Text style={styles.muted}>A quick read on where you fit this week.</Text>
        </View>
      </View>
      <View style={styles.snapshotGrid}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.snapshotTile}>
            <MaterialCommunityIcons name={tile.icon} color={palette.info} size={18} />
            <Text style={styles.metricValue}>{tile.value}</Text>
            <Text style={styles.mutedSmall}>{tile.label}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function ActivityFeedCard({ pulse }: { pulse: CommunityPulse | null }) {
  const items = pulse?.activityFeed ?? [];
  return (
    <AppCard style={styles.listCard}>
      <View style={styles.feedbackHeader}>
        <View style={styles.flexText}>
          <Text style={styles.cardTitle}>People are working on</Text>
          <Text style={styles.muted}>Privacy-safe signals from the last few days.</Text>
        </View>
        <Text style={styles.mutedSmall}>{items.length ? "Live-ish" : "Waiting"}</Text>
      </View>
      {items.length ? (
        <View style={styles.activityList}>
          {items.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: `${item.color}18` }]}>
                <MaterialCommunityIcons name={item.icon as IconName} color={item.color} size={18} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.mutedSmall}>{item.detail}</Text>
              </View>
              <Text style={styles.mutedSmall}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="No public activity yet" body="The first study session, answered question or room start will appear here." />
      )}
    </AppCard>
  );
}

function CommunityLoopCard() {
  const loop = [
    "Study session",
    "Squad progress",
    "Mission reward",
    "Helpful answers",
    "Board recognition"
  ];
  return (
    <AppCard style={styles.loopCard}>
      <View style={styles.roomHubHeader}>
        <View style={styles.loopIcon}>
          <MaterialCommunityIcons name="sync" color={palette.success} size={20} />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.cardTitle}>The community loop</Text>
          <Text style={styles.muted}>Work turns into progress, progress turns into recognition, recognition pulls people back.</Text>
        </View>
      </View>
      <View style={styles.loopRow}>
        {loop.map((item, index) => (
          <View key={item} style={styles.loopStep}>
            <Text style={styles.loopNumber}>{index + 1}</Text>
            <Text style={styles.loopText}>{item}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function SquadCard({
  squad,
  onStart,
  onAsk,
  onRoom
}: {
  squad: CommunitySquad;
  onStart: (squad: CommunitySquad) => void;
  onAsk: (squad: CommunitySquad) => void;
  onRoom: (squad: CommunitySquad) => void;
}) {
  const weeklyMinutes = squad.weeklyMinutes ?? 0;
  const weeklyGoalMinutes = Math.max(1, squad.weeklyGoalMinutes ?? 180);
  const todayMinutes = squad.todayMinutes ?? 0;
  const viewerMinutes = squad.viewerMinutes ?? 0;
  const goalProgress =
    typeof squad.goalProgress === "number"
      ? Math.min(100, Math.max(0, squad.goalProgress))
      : Math.min(100, Math.round((weeklyMinutes / weeklyGoalMinutes) * 100));
  const viewerJoined = Boolean(squad.viewerJoined);
  const viewerLine = viewerJoined
    ? viewerMinutes > 0
      ? `You: ${viewerMinutes}m${squad.viewerRank ? ` - #${squad.viewerRank}` : ""}`
      : "You: no minutes yet"
    : todayMinutes > 0
      ? `${todayMinutes}m today`
      : "No minutes today";

  return (
    <View style={[styles.squadCard, viewerJoined && { borderColor: `${squad.color}aa` }]}>
      <View style={styles.squadTop}>
        <View style={[styles.squadMark, { backgroundColor: `${squad.color}20` }]}>
          <MaterialCommunityIcons name="account-group-outline" color={squad.color} size={22} />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {squad.name}
          </Text>
          <Text style={styles.mutedSmall}>
            {squad.memberCount ?? 0} members {viewerJoined ? "- your squad" : ""}
          </Text>
        </View>
        <View style={[styles.pulsePill, { backgroundColor: `${squad.color}18` }]}>
          <Text style={[styles.pulseText, { color: squad.color }]}>{squad.momentum ?? "Open"}</Text>
        </View>
      </View>
      <View style={styles.squadGoalBlock}>
        <View style={styles.squadGoalHeader}>
          <Text style={styles.mutedSmall}>
            Squad goal {weeklyMinutes}/{weeklyGoalMinutes}m
          </Text>
          <Text style={styles.mutedSmall}>{viewerLine}</Text>
        </View>
        <View style={styles.squadProgressTrack}>
          <View style={[styles.squadProgressFill, { width: `${goalProgress}%`, backgroundColor: squad.color }]} />
        </View>
        <Text style={styles.squadNudge} numberOfLines={2}>
          {squad.nextNudge ?? squad.identity}
        </Text>
        {weeklyMinutes === 0 ? (
          <Text style={styles.mutedSmall}>No pressure: first session makes this squad feel alive.</Text>
        ) : null}
      </View>
      <View style={styles.squadStatGrid}>
        <View style={styles.squadStat}>
          <Text style={styles.metricValue}>{squad.activeTodayCount ?? 0}</Text>
          <Text style={styles.mutedSmall}>active today</Text>
        </View>
        <View style={styles.squadStat}>
          <Text style={styles.metricValue}>{squad.questionsAnswered ?? 0}</Text>
          <Text style={styles.mutedSmall}>Q&A helped</Text>
        </View>
        <View style={styles.squadStat}>
          <Text style={styles.metricValue}>{squad.streakCount ?? 0}</Text>
          <Text style={styles.mutedSmall}>on streak</Text>
        </View>
      </View>
      <View style={styles.squadRecognitionGrid}>
        <Text style={styles.userThemeText} numberOfLines={1}>
          Top minutes: {squad.topContributor ? `${squad.topContributor.displayName} - ${squad.topContributor.minutes}m` : "open"}
        </Text>
        <Text style={styles.userThemeText} numberOfLines={1}>
          Top helper: {squad.topHelper ? `${squad.topHelper.displayName} - ${squad.topHelper.answers}` : "open"}
        </Text>
        <Text style={styles.userThemeText} numberOfLines={1}>
          Most improved: {squad.mostImproved ? `${squad.mostImproved.displayName} +${squad.mostImproved.minutesGained}m` : "open"}
        </Text>
      </View>
      <View style={styles.cardActionRow}>
        <Button mode="contained" compact icon="timer-outline" onPress={() => onStart(squad)}>
          Join sprint
        </Button>
        <Button mode="outlined" compact icon="comment-question-outline" onPress={() => onAsk(squad)}>
          Ask squad
        </Button>
        <Button mode="outlined" compact icon="door-open" onPress={() => onRoom(squad)}>
          View room
        </Button>
      </View>
    </View>
  );
}

function MissionCard({ mission, onAction }: { mission: CommunityMission | null; onAction: (action: CommunityMission["items"][number]["action"]) => void }) {
  if (!mission) return null;
  return (
    <AppCard style={styles.missionCard}>
      <View style={styles.roomHubHeader}>
        <View style={styles.missionIcon}>
          <MaterialCommunityIcons name={mission.complete ? "check-decagram" : "flag-checkered"} color={palette.warning} size={22} />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.cardTitle}>{mission.title}</Text>
          <Text style={styles.muted}>{mission.reward}</Text>
        </View>
        {mission.nextAction ? (
          <Button mode="contained" compact icon="arrow-right" onPress={() => onAction(mission.nextAction?.action ?? "study")}>
            {mission.nextAction.label}
          </Button>
        ) : null}
      </View>
      <View style={styles.missionList}>
        {mission.items.map((item) => (
          <View key={item.id} style={styles.missionRow}>
            <MaterialCommunityIcons
              name={item.complete ? "check-circle" : "checkbox-blank-circle-outline"}
              color={item.complete ? palette.success : palette.muted}
              size={18}
            />
            <View style={styles.flexText}>
              <Text style={styles.missionLabel}>{item.label}</Text>
              <Text style={styles.mutedSmall}>{item.helper}</Text>
              <View style={styles.missionTrack}>
                <View style={[styles.missionFill, { width: `${Math.min(100, (item.progress / item.target) * 100)}%` }]} />
              </View>
            </View>
            <Text style={styles.mutedSmall}>
              {item.progress}/{item.target}
            </Text>
            <Button mode={item.complete ? "outlined" : "text"} compact onPress={() => onAction(item.action)}>
              {item.complete ? "Done" : item.actionLabel}
            </Button>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function LiveRoomCard({
  room,
  active,
  elapsedSeconds,
  onJoin,
  onLeave
}: {
  room: CommunityLiveRoom;
  active: boolean;
  elapsedSeconds: number;
  onJoin: (room: CommunityLiveRoom) => void;
  onLeave: () => void;
}) {
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedRemainder = `${elapsedSeconds % 60}`.padStart(2, "0");
  const targetMinutes = Math.max(1, room.targetMinutes ?? 25);
  const weeklyMinutes = room.weeklyMinutes ?? 0;
  const weeklyGoalMinutes = room.weeklyGoalMinutes ?? targetMinutes * 8;
  const activeStudents = room.activeStudents ?? [];
  const activeCount = room.activeCount ?? activeStudents.length;
  const roomColor = room.color ?? palette.primary;
  const goalProgress =
    typeof room.goalProgress === "number"
      ? room.goalProgress
      : Math.min(100, Math.round((weeklyMinutes / Math.max(1, weeklyGoalMinutes)) * 100));
  const progress = active ? Math.min(100, Math.round((elapsedMinutes / targetMinutes) * 100)) : goalProgress;
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  const roomStateCopy = room.roomState === "live" ? "Live now" : room.roomState === "warming" ? "Warming up" : "Quiet";
  return (
    <View style={[styles.liveRoomCard, active && { borderColor: `${roomColor}cc`, backgroundColor: `${roomColor}12` }]}>
      <View style={styles.squadTop}>
        <View style={[styles.squadMark, { backgroundColor: `${roomColor}20` }]}>
          <MaterialCommunityIcons name={active ? "timer-outline" : "door-open"} color={roomColor} size={22} />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {room.title ?? "Study room"}
          </Text>
          <Text style={styles.mutedSmall}>
            {room.subjectHint ?? "VCE"} - {weeklyMinutes}/{weeklyGoalMinutes}m room goal
          </Text>
          <Text style={styles.mutedSmall} numberOfLines={2}>
            {room.description ?? "Join a focused public study room when you want quiet pressure."}
          </Text>
        </View>
        <View style={[styles.pulsePill, { backgroundColor: `${roomColor}18` }]}>
          <Text style={[styles.pulseText, { color: roomColor }]}>{roomStateCopy}</Text>
        </View>
        <Button mode={active ? "outlined" : "contained"} compact onPress={() => (active ? onLeave() : onJoin(room))}>
          {active ? "Leave" : "Join"}
        </Button>
      </View>
      <View style={styles.squadProgressTrack}>
        <View style={[styles.squadProgressFill, { width: `${safeProgress}%`, backgroundColor: roomColor }]} />
      </View>
      <Text style={styles.roomPrompt}>{room.focusPrompt ?? "Start with one clear task and keep the room moving."}</Text>
      <View style={styles.roomInfoGrid}>
        <View style={styles.roomInfoTile}>
          <Text style={styles.mutedSmall}>Next session</Text>
          <Text style={styles.userThemeText}>{formatHour(room.nextSessionAt)}</Text>
        </View>
        <View style={styles.roomInfoTile}>
          <Text style={styles.mutedSmall}>Recently active</Text>
          <Text style={styles.userThemeText}>{formatRelativeTime(room.recentlyActiveAt)}</Text>
        </View>
        <View style={styles.roomInfoTile}>
          <Text style={styles.mutedSmall}>Room signal</Text>
          <Text style={styles.userThemeText} numberOfLines={1}>
            {room.activityPreview ?? "No signal yet. You can start the room."}
          </Text>
        </View>
      </View>
      <View style={styles.liveRoomFooter}>
        <Text style={styles.userThemeText}>
          {active ? `Your room timer ${elapsedMinutes}:${elapsedRemainder} / ${targetMinutes}:00` : `${activeCount} studying now`}
        </Text>
        <Text style={styles.mutedSmall} numberOfLines={1}>
          {activeStudents.length
            ? activeStudents.map((student) => student.displayName).slice(0, 3).join(", ")
            : room.emptyCta ?? `Start ${targetMinutes}m room`}
        </Text>
      </View>
    </View>
  );
}

function QuestionWallItem({
  item,
  answerDraft,
  onAnswerDraft,
  onAnswer,
  onReport,
  onReportAnswer,
  onSave,
  onHelpfulAnswer,
  sending
}: {
  item: CommunityQuestionWallItem;
  answerDraft: string;
  onAnswerDraft: (value: string) => void;
  onAnswer: (item: CommunityQuestionWallItem) => void;
  onReport: (item: CommunityQuestionWallItem) => void;
  onReportAnswer: (item: CommunityQuestionWallItem, answerId: string, message: string) => void;
  onSave: (item: CommunityQuestionWallItem) => void;
  onHelpfulAnswer: (item: CommunityQuestionWallItem, answerId: string) => void;
  sending: boolean;
}) {
  const canAnswer = !item.isCurrentUser && !item.answeredByViewer;
  const statusHot = item.status !== "Answered";

  return (
    <View style={styles.questionItem}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackMeta}>
          <Text style={styles.feedbackCategory}>{item.subjectName ?? "General"}</Text>
          <Text style={styles.questionType}>{item.questionType}</Text>
          <Text style={[styles.feedbackStatus, statusHot ? styles.feedbackStatusHot : styles.feedbackStatusCalm]}>
            {item.status}
          </Text>
        </View>
        <Text style={styles.mutedSmall}>{formatTime(item.lastActivityAt)}</Text>
      </View>
      <Text style={styles.feedbackMessage}>{item.message}</Text>
      <View style={styles.questionMetaRow}>
        <Text style={styles.userStat}>{item.answerCount} answer{item.answerCount === 1 ? "" : "s"}</Text>
        <Text style={styles.userStat}>{item.helpfulScore} helpful score</Text>
        {item.answeredByViewer ? <Text style={styles.userStat}>helped by you</Text> : null}
      </View>
      {item.answers.length ? (
        <View style={styles.answerList}>
          {item.answers.map((answer) => (
            <View key={answer.id} style={styles.answerItem}>
              <Text style={styles.feedbackSender}>{answer.user.displayName}</Text>
              <Text style={styles.mutedSmall}>{formatTime(answer.createdAt)}</Text>
              <Text style={styles.feedbackMessage}>{answer.message}</Text>
              <View style={styles.cardActionRow}>
                <Button
                  mode={answer.votedHelpfulByViewer ? "contained" : "outlined"}
                  compact
                  icon="thumb-up-outline"
                  disabled={answer.isCurrentUser || sending}
                  onPress={() => onHelpfulAnswer(item, answer.id)}
                >
                  Helpful{answer.helpfulVotes ? ` ${answer.helpfulVotes}` : ""}
                </Button>
                <Button mode="text" compact icon="flag-outline" onPress={() => onReportAnswer(item, answer.id, answer.message)}>
                  Report
                </Button>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.mutedSmall}>No answers yet. Be useful, earn XP and bonus messages.</Text>
      )}
      {canAnswer ? (
        <>
          <TextInput
            mode="outlined"
            label="Helpful answer"
            value={answerDraft}
            onChangeText={onAnswerDraft}
            multiline
            numberOfLines={2}
            maxLength={600}
            style={styles.input}
          />
          <Button mode="outlined" compact icon="reply-outline" disabled={!answerDraft.trim() || sending} loading={sending} onPress={() => onAnswer(item)}>
            Answer
          </Button>
        </>
      ) : (
        <Text style={styles.mutedSmall}>{item.isCurrentUser ? "Waiting for another student to answer." : "You have already helped on this one."}</Text>
      )}
      <View style={styles.cardActionRow}>
        <Button mode={item.savedByViewer ? "contained" : "outlined"} compact icon={item.savedByViewer ? "bookmark-check-outline" : "bookmark-outline"} disabled={sending} onPress={() => onSave(item)}>
          {item.savedByViewer ? "Saved" : "Save"}
        </Button>
        <Button mode="text" compact icon="flag-outline" onPress={() => onReport(item)}>
          Report
        </Button>
      </View>
    </View>
  );
}

function UserRow({
  item,
  onGiftTheme,
  onGiftCoins,
  onEmail
}: {
  item: CommunityUserSummary;
  onGiftTheme: (user: CommunityUserSummary) => void;
  onGiftCoins: (user: CommunityUserSummary) => void;
  onEmail: (user: CommunityUserSummary) => void;
}) {
  const unlockedThemeCount = themeShopItems.filter((theme) => item.unlockedCosmetics.includes(theme.id)).length;

  return (
    <View style={styles.userItem}>
      <View style={styles.userTop}>
        <View style={styles.flexText}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {item.email}
          </Text>
          {item.schoolName ? (
            <Text style={styles.mutedSmall} numberOfLines={1}>
              School: {item.schoolName}
            </Text>
          ) : null}
        </View>
        <View style={[styles.optInPill, item.leaderboardOptIn ? styles.optInPillActive : styles.optInPillMuted]}>
          <Text style={styles.optInText}>{item.leaderboardOptIn ? "Opted in" : "Opted out"}</Text>
        </View>
      </View>
      <View style={styles.giftRow}>
        <View style={styles.flexText}>
          <Text style={styles.userThemeText} numberOfLines={1}>
            Active theme: {themeNameById(item.activeTheme)}
          </Text>
          <Text style={styles.mutedSmall}>
            {item.xpBalance} coins - {unlockedThemeCount}/{themeShopItems.length} themes unlocked
          </Text>
        </View>
        <View style={styles.giftActions}>
          <Button mode="outlined" compact icon="email-outline" onPress={() => onEmail(item)}>
            Email
          </Button>
          <Button mode="outlined" compact icon="cash-multiple" onPress={() => onGiftCoins(item)}>
            Gift coins
          </Button>
          <Button mode="outlined" compact icon="gift-outline" onPress={() => onGiftTheme(item)}>
            Gift theme
          </Button>
        </View>
      </View>
      <View style={styles.userStats}>
        <Text style={styles.userStat}>Level {item.level}</Text>
        <Text style={styles.userStat}>{titleLabelById(item.activeTitle)}</Text>
        <Text style={styles.userStat}>{item.totalXp} XP</Text>
        <Text style={styles.userStat}>{item.xpBalance} coins</Text>
        <Text style={styles.userStat}>{item.sessionCount} sessions</Text>
        <Text style={styles.userStat}>{item.subjectCount} subjects</Text>
        <Text style={styles.userStat}>{item.feedbackCount} feedback</Text>
        <Text style={styles.userStat}>{item.chatMessageCount} chats</Text>
      </View>
    </View>
  );
}

function MetricTile({
  label,
  value,
  detail,
  icon
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  return (
    <View style={styles.metricTile}>
      <View style={styles.metricIcon}>
        <MaterialCommunityIcons name={icon} color={palette.primary} size={18} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.mutedSmall}>{detail}</Text>
    </View>
  );
}

function AnalyticsPanel({
  analytics,
  loading,
  onRefresh
}: {
  analytics: AdminUsageAnalytics | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const maxHourlyEvents = Math.max(1, ...(analytics?.hourly.map((item) => item.eventCount) ?? [0]));
  const maxScreenEvents = Math.max(1, ...(analytics?.screens.map((item) => item.eventCount) ?? [0]));

  if (loading && !analytics) {
    return <SkeletonStack />;
  }

  if (!analytics) {
    return (
      <AppCard style={styles.listCard}>
        <EmptyState title="No analytics yet" body="Usage data will appear after students open the updated app." />
        <Button mode="contained" icon="refresh" loading={loading} disabled={loading} onPress={onRefresh}>
          Refresh
        </Button>
      </AppCard>
    );
  }

  return (
    <>
      <AppCard style={styles.listCard}>
        <View style={styles.feedbackHeader}>
          <View style={styles.flexText}>
            <Text style={styles.cardTitle}>Usage analytics</Text>
            <Text style={styles.muted}>Last updated {formatRelativeTime(analytics.generatedAt)}</Text>
          </View>
          <Button mode="outlined" compact icon="refresh" loading={loading} disabled={loading} onPress={onRefresh}>
            Refresh
          </Button>
        </View>
        <View style={styles.metricGrid}>
          <MetricTile label="Active now" value={analytics.totals.activeNow} detail="Last 10 min" icon="account-clock-outline" />
          <MetricTile label="Active today" value={analytics.totals.activeToday} detail="Last 24h" icon="account-group-outline" />
          <MetricTile label="Active week" value={analytics.totals.active7Days} detail="Last 7 days" icon="calendar-weekend-outline" />
          <MetricTile label="Visits today" value={analytics.totals.trackedEvents24h} detail="Tab views" icon="gesture-tap" />
        </View>
        <View style={styles.metricGrid}>
          <MetricTile label="Study minutes" value={analytics.totals.studyMinutes7d} detail="Last 7 days" icon="timer-outline" />
          <MetricTile label="Chat posts" value={analytics.totals.chatMessages7d} detail="Last 7 days" icon="chat-outline" />
          <MetricTile label="Feedback" value={analytics.totals.feedback7d} detail="Last 7 days" icon="inbox-arrow-down-outline" />
        </View>
      </AppCard>

      <AppCard style={styles.listCard}>
        <View style={styles.feedbackHeader}>
          <Text style={styles.cardTitle}>Times people use it</Text>
          <Text style={styles.muted}>Last 24h</Text>
        </View>
        <View style={styles.list}>
          {analytics.hourly.map((hour) => (
            <View key={hour.hourStart} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{formatHour(hour.hourStart)}</Text>
              <View style={styles.hourTrack}>
                <View style={[styles.hourFill, { width: `${Math.max(3, (hour.eventCount / maxHourlyEvents) * 100)}%` }]} />
              </View>
              <Text style={styles.hourCount}>
                {hour.eventCount} / {hour.uniqueUsers}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.mutedSmall}>Each row shows tab visits / unique students for that hour.</Text>
      </AppCard>

      <AppCard style={styles.listCard}>
        <View style={styles.feedbackHeader}>
          <Text style={styles.cardTitle}>Most used areas</Text>
          <Text style={styles.muted}>Last 7 days</Text>
        </View>
        <View style={styles.list}>
          {analytics.screens.map((screen) => (
            <View key={screen.screen} style={styles.screenUsageRow}>
              <View style={styles.flexText}>
                <Text style={styles.userName}>{screen.label}</Text>
                <Text style={styles.mutedSmall}>Last used {formatRelativeTime(screen.lastSeenAt)}</Text>
                <View style={styles.screenBarTrack}>
                  <View style={[styles.screenBarFill, { width: `${Math.max(3, (screen.eventCount / maxScreenEvents) * 100)}%` }]} />
                </View>
              </View>
              <Text style={styles.leaderboardXp}>
                {screen.eventCount} / {screen.uniqueUsers}
              </Text>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.listCard}>
        <View style={styles.feedbackHeader}>
          <Text style={styles.cardTitle}>Student activity</Text>
          <Text style={styles.muted}>{analytics.users.length} students</Text>
        </View>
        {analytics.users.length ? (
          <View style={styles.list}>
            {analytics.users.map((user) => (
              <View key={user.userId} style={styles.userItem}>
                <View style={styles.userTop}>
                  <View style={styles.flexText}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.displayName}
                    </Text>
                    <Text style={styles.userEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                    {user.schoolName ? (
                      <Text style={styles.mutedSmall} numberOfLines={1}>
                        School: {user.schoolName}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.mutedSmall}>{formatRelativeTime(user.lastSeenAt)}</Text>
                </View>
                <Text style={styles.userThemeText}>
                  Last seen in {usageScreenLabel(user.lastScreen)} - {user.events24h} visits today
                </Text>
                <View style={styles.userStats}>
                  <Text style={styles.userStat}>{user.events7d} visits</Text>
                  <Text style={styles.userStat}>{user.studyMinutes7d} study min</Text>
                  <Text style={styles.userStat}>{user.chatMessages7d} chats</Text>
                  <Text style={styles.userStat}>{user.feedback7d} feedback</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No students yet" body="Registered student activity will appear here." />
        )}
      </AppCard>

      <AppCard style={styles.listCard}>
        <View style={styles.feedbackHeader}>
          <Text style={styles.cardTitle}>Recent tab visits</Text>
          <Text style={styles.muted}>{analytics.recent.length} latest</Text>
        </View>
        {analytics.recent.length ? (
          <View style={styles.list}>
            {analytics.recent.map((event) => (
              <View key={event.id} style={styles.recentEventRow}>
                <View style={styles.flexText}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {event.displayName}
                  </Text>
                  <Text style={styles.mutedSmall} numberOfLines={1}>
                    {event.schoolName ? `${event.email} - ${event.schoolName}` : event.email}
                  </Text>
                </View>
                <Text style={styles.recentScreen}>{event.label}</Text>
                <Text style={styles.mutedSmall}>{formatTime(event.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No tracked visits yet" body="This starts filling as students move through the updated app." />
        )}
      </AppCard>
    </>
  );
}

export default function CommunityScreen() {
  useTrackScreen("community");
  const { subjects, gamification, leaderboard, fetchAll, setLeaderboardPreference } = useAppStore();
  const [mode, setMode] = useState<Mode>("squads");
  const [boardScope, setBoardScope] = useState<BoardScope>("week");
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [landingContacts, setLandingContacts] = useState<PublicContactSubmission[]>([]);
  const [communityReports, setCommunityReports] = useState<CommunityReportSummary[]>([]);
  const [mutedUsers, setMutedUsers] = useState<CommunityMutedUserSummary[]>([]);
  const [chat, setChat] = useState<CommunityChatMessage[]>([]);
  const [squads, setSquads] = useState<CommunitySquad[]>([]);
  const [liveRooms, setLiveRooms] = useState<CommunityLiveRoom[]>([]);
  const [questionWall, setQuestionWall] = useState<CommunityQuestionWallItem[]>([]);
  const [mission, setMission] = useState<CommunityMission | null>(null);
  const [boards, setBoards] = useState<CommunityBoards | null>(null);
  const [chessTournament, setChessTournament] = useState<CommunityChessTournament | null>(null);
  const [roomChat, setRoomChat] = useState<Record<string, CommunityChatMessage[]>>({});
  const [joinedRoomIds, setJoinedRoomIds] = useState<string[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [users, setUsers] = useState<CommunityUserSummary[]>([]);
  const [analytics, setAnalytics] = useState<AdminUsageAnalytics | null>(null);
  const [allowance, setAllowance] = useState<ChatAllowance | null>(null);
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [updatingContactId, setUpdatingContactId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [questionSubject, setQuestionSubject] = useState("");
  const [questionType, setQuestionType] = useState<(typeof QUESTION_TYPES)[number]>("Concept help");
  const [questionMessage, setQuestionMessage] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [activeLiveRoomId, setActiveLiveRoomId] = useState<string | null>(null);
  const [liveRoomStartedAt, setLiveRoomStartedAt] = useState<number | null>(null);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  const [roomIntroOpen, setRoomIntroOpen] = useState(false);
  const [communityGuideHidden, setCommunityGuideHidden] = useState(true);
  const [leaderboardSaving, setLeaderboardSaving] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [resendingLeaderboardInvite, setResendingLeaderboardInvite] = useState(false);
  const [giftUser, setGiftUser] = useState<CommunityUserSummary | null>(null);
  const [giftThemeId, setGiftThemeId] = useState("cherry_blossom");
  const [coinGiftUser, setCoinGiftUser] = useState<CommunityUserSummary | null>(null);
  const [coinGiftAmount, setCoinGiftAmount] = useState("120");
  const [coinGiftMessage, setCoinGiftMessage] = useState("");
  const [gifting, setGifting] = useState(false);
  const [adminEmailOpen, setAdminEmailOpen] = useState(false);
  const [adminEmailTarget, setAdminEmailTarget] = useState<CommunityUserSummary | null>(null);
  const [adminEmailAudience, setAdminEmailAudience] = useState<AdminEmailAudience>("opted_in");
  const [adminEmailSubject, setAdminEmailSubject] = useState("");
  const [adminEmailMessage, setAdminEmailMessage] = useState("");
  const [adminEmailTemplateId, setAdminEmailTemplateId] = useState<AdminEmailTemplateId>("service_update");
  const [adminEmailSending, setAdminEmailSending] = useState(false);

  const loadCommunity = useCallback(async () => {
    setError(null);
    try {
      const data = await studyApi.community();
      setFeedback(data.feedback);
      setLandingContacts(data.landingContacts ?? []);
      setCommunityReports(data.reports ?? []);
      setMutedUsers(data.mutedUsers ?? []);
      setChat(data.chat);
      setUsers(data.users ?? []);
      setAllowance(data.allowance);
      setPulse(data.pulse ?? null);
      setIsAdmin(Boolean(data.isAdmin));
      setSquads(data.squads ?? []);
      setLiveRooms(data.liveRooms ?? []);
      setQuestionWall(data.questionWall ?? []);
      setMission(data.mission ?? null);
      setBoards(data.boards ?? null);
      setChessTournament(data.chessTournament ?? null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setError(null);
    try {
      const data = await studyApi.usageAnalytics();
      setAnalytics(data.analytics);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const subjectRooms = useMemo(() => roomsFromSubjects(subjects), [subjects]);
  const joinedRooms = useMemo(
    () => subjectRooms.filter((room) => joinedRoomIds.includes(room.id)),
    [joinedRoomIds, subjectRooms]
  );
  const availableRooms = useMemo(
    () => subjectRooms.filter((room) => !joinedRoomIds.includes(room.id)),
    [joinedRoomIds, subjectRooms]
  );
  const selectedRoom = joinedRooms.find((room) => room.id === selectedRoomId) ?? joinedRooms[0] ?? null;
  const selectedRoomMessages = selectedRoom ? roomChat[selectedRoom.id] ?? [] : [];
  const unansweredQuestionCount = useMemo(
    () => questionWall.filter((item) => item.answerCount === 0).length,
    [questionWall]
  );
  const helpedQuestionCount = useMemo(
    () => questionWall.filter((item) => item.answeredByViewer).length,
    [questionWall]
  );
  const savedQuestionWallItems = useMemo(
    () => questionWall.filter((item) => item.savedByViewer),
    [questionWall]
  );
  const questionSubjects = useMemo(() => {
    const subjectNames = Array.from(new Set(subjects.map((subject) => subject.subjectName))).sort((a, b) => a.localeCompare(b));
    return ["General", ...subjectNames];
  }, [subjects]);
  const selectedRoomPrompts = useMemo(() => {
    if (!selectedRoom) return genericRoomPrompts;
    const normalised = selectedRoom.subjectName.toLowerCase();
    const key = normalised.includes("software")
      ? "software"
      : normalised.includes("business")
        ? "business"
        : normalised.includes("english")
          ? "english"
          : normalised.includes("math")
            ? "maths"
            : "";
    return [...(key ? subjectStarterPrompts[key] ?? [] : []), ...genericRoomPrompts].slice(0, 8);
  }, [selectedRoom]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(JOINED_SUBJECT_ROOMS_KEY)
      .then((value) => {
        if (!active || !value) return;
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          setJoinedRoomIds(parsed.filter((item): item is string => typeof item === "string"));
        }
      })
      .catch(() => undefined);

    AsyncStorage.getItem(SUBJECT_ROOM_INTRO_KEY)
      .then((value) => {
        if (active && !value) setRoomIntroOpen(true);
      })
      .catch(() => undefined);

    AsyncStorage.getItem(COMMUNITY_GUIDE_KEY)
      .then((value) => {
        if (active) setCommunityGuideHidden(Boolean(value));
      })
      .catch(() => {
        if (active) setCommunityGuideHidden(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!joinedRooms.length) {
      setSelectedRoomId(null);
      return;
    }
    if (!selectedRoomId || !joinedRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(joinedRooms[0].id);
    }
  }, [joinedRooms, selectedRoomId]);

  const persistJoinedRooms = async (roomIds: string[]) => {
    setJoinedRoomIds(roomIds);
    await AsyncStorage.setItem(JOINED_SUBJECT_ROOMS_KEY, JSON.stringify(roomIds));
  };

  const loadSubjectRoom = useCallback(async (roomId: string) => {
    setRoomLoading(true);
    setError(null);
    try {
      const data = await studyApi.subjectRoomChat(roomId);
      setRoomChat((current) => ({ ...current, [roomId]: data.chat }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load subject room");
    } finally {
      setRoomLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "rooms" || !selectedRoom) return;
    loadSubjectRoom(selectedRoom.id);
  }, [loadSubjectRoom, mode, selectedRoom]);

  useEffect(() => {
    if (!activeLiveRoomId || !liveRoomStartedAt) {
      setLiveElapsedSeconds(0);
      return;
    }

    const tick = () => setLiveElapsedSeconds(Math.max(0, Math.floor((Date.now() - liveRoomStartedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeLiveRoomId, liveRoomStartedAt]);

  useEffect(() => {
    if (!activeLiveRoomId) return;

    let active = true;
    const heartbeat = async () => {
      try {
        const data = await studyApi.liveRoomHeartbeat(activeLiveRoomId);
        if (active) setLiveRooms(data.liveRooms);
      } catch {
        // Live presence is intentionally best-effort.
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 45_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeLiveRoomId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCommunity();
      fetchAll();
      if (mode === "analytics") {
        loadAnalytics();
      }
    }, [fetchAll, loadAnalytics, loadCommunity, mode])
  );

  const allowanceLabel = useMemo(() => {
    if (!allowance) return "Loading chat messages";
    if (allowance.unlimitedRoomChat) return "Unlimited chat today";
    return `${allowance.remainingMinutes}/${allowance.totalMinutes} chat messages left`;
  }, [allowance]);

  const sendFeedback = async () => {
    if (!feedbackMessage.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.sendFeedback({ category, message: feedbackMessage.trim() });
      setFeedback((current) => [data.feedback, ...current]);
      setFeedbackMessage("");
      setNotice("Sent. It is in the admin feedback inbox.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send feedback");
    } finally {
      setSending(false);
    }
  };

  const updateContactStatus = async (id: string, adminStatus: PublicContactSubmission["adminStatus"]) => {
    setUpdatingContactId(id);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.updateContactSubmissionStatus(id, adminStatus);
      setLandingContacts((current) => current.map((item) => (item.id === id ? data.submission : item)));
      setNotice(`Landing inquiry marked ${contactStatusCopy[adminStatus].toLowerCase()}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update landing inquiry");
    } finally {
      setUpdatingContactId(null);
    }
  };

  const updateReportStatus = async (id: string, status: CommunityReportSummary["status"]) => {
    setUpdatingReportId(id);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.updateCommunityReportStatus(id, status);
      setCommunityReports((current) => current.map((item) => (item.id === id ? data.report : item)));
      setNotice(`Report marked ${status}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update report");
    } finally {
      setUpdatingReportId(null);
    }
  };

  const deleteReportedMessage = async (item: CommunityReportSummary) => {
    if (!item.messageId) return;
    setUpdatingReportId(item.id);
    setError(null);
    setNotice(null);
    try {
      await studyApi.deleteCommunityChat(item.messageId);
      await studyApi.updateCommunityReportStatus(item.id, "resolved");
      await loadCommunity();
      setNotice("Content deleted and report resolved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete reported content");
    } finally {
      setUpdatingReportId(null);
    }
  };

  const deleteChatMessage = async (id: string) => {
    setDeletingChatId(id);
    setError(null);
    setNotice(null);
    try {
      await studyApi.deleteCommunityChat(id);
      setChat((current) => current.filter((item) => item.id !== id));
      setRoomChat((current) =>
        Object.fromEntries(Object.entries(current).map(([roomId, messages]) => [roomId, messages.filter((item) => item.id !== id)]))
      );
      setNotice("Chat message deleted.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete chat message");
    } finally {
      setDeletingChatId(null);
    }
  };

  const sendChat = async () => {
    if (!chatMessage.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.sendCommunityChat({ message: chatMessage.trim() });
      setChat((current) => [...current, data.chatMessage].slice(-80));
      setAllowance(data.allowance);
      setChatMessage("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send chat message");
    } finally {
      setSending(false);
    }
  };

  const joinRoom = async (room: CommunitySubjectRoom) => {
    const nextRoomIds = Array.from(new Set([...joinedRoomIds, room.id]));
    await persistJoinedRooms(nextRoomIds);
    setSelectedRoomId(room.id);
    await loadSubjectRoom(room.id);
  };

  const leaveRoom = async (roomId: string) => {
    const nextRoomIds = joinedRoomIds.filter((id) => id !== roomId);
    await persistJoinedRooms(nextRoomIds);
    setRoomChat((current) => {
      const next = { ...current };
      delete next[roomId];
      return next;
    });
    if (selectedRoomId === roomId) {
      setSelectedRoomId(nextRoomIds[0] ?? null);
    }
  };

  const sendRoomChat = async () => {
    if (!selectedRoom || !roomMessage.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.sendSubjectRoomChat(selectedRoom.id, { message: roomMessage.trim() });
      setRoomChat((current) => ({
        ...current,
        [selectedRoom.id]: [...(current[selectedRoom.id] ?? []), data.chatMessage].slice(-80)
      }));
      setAllowance(data.allowance);
      setRoomMessage("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send room message");
    } finally {
      setSending(false);
    }
  };

  const joinLiveRoom = async (room: CommunityLiveRoom) => {
    setActiveLiveRoomId(room.id);
    setLiveRoomStartedAt(Date.now());
    setNotice(`Joined ${room.title}. Stay in the room while you study.`);
    setError(null);
    try {
      const data = await studyApi.liveRoomHeartbeat(room.id);
      setLiveRooms(data.liveRooms);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not join live room");
    }
  };

  const leaveLiveRoom = () => {
    setActiveLiveRoomId(null);
    setLiveRoomStartedAt(null);
    setLiveElapsedSeconds(0);
    setNotice("Left the live study room.");
  };

  const dismissCommunityGuide = async () => {
    setCommunityGuideHidden(true);
    await AsyncStorage.setItem(COMMUNITY_GUIDE_KEY, "seen");
  };

  const runMissionAction = (action: CommunityMission["items"][number]["action"]) => {
    if (action === "study") {
      router.push({ pathname: "/(tabs)/study", params: { mode: "timer", targetMinutes: "45" } });
      return;
    }
    if (action === "notes") {
      router.push({ pathname: "/(tabs)/study", params: { mode: "notes" } });
      return;
    }
    if (action === "practice") {
      router.push("/(tabs)/questions");
      return;
    }
    setMode("questions");
  };

  const startSquadSprint = (squad: CommunitySquad) => {
    const subject = subjects.find((item) => item.subjectName.toLowerCase().includes(squad.shortName.toLowerCase().split(" ")[0]));
    router.push({
      pathname: "/(tabs)/study",
      params: {
        mode: "timer",
        targetMinutes: "25",
        ...(subject ? { subjectId: subject.id } : {})
      }
    });
  };

  const askSquad = (squad: CommunitySquad) => {
    setQuestionSubject(squad.shortName);
    setQuestionType("Concept help");
    setMode("questions");
  };

  const viewSquadRoom = (squad: CommunitySquad) => {
    const room = liveRooms.find((item) => item.squadId === squad.id);
    setMode("rooms");
    if (room) {
      void joinLiveRoom(room);
    }
  };

  const applyRoomPrompt = (prompt: string) => {
    setRoomMessage((current) => (current.trim() ? `${current.trim()}\n${prompt}` : prompt));
  };

  const reportCommunityItem = async (
    contentType: "chat" | "room-chat" | "question" | "answer",
    contentId: string,
    reason: string,
    messageId?: string | null,
    reportedUserId?: string | null
  ) => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await studyApi.reportCommunityItem({
        contentType,
        contentId,
        reason: reason.slice(0, 600),
        messageId,
        reportedUserId
      });
      setNotice("Reported. Admin can review it from the community inbox.");
      if (isAdmin) {
        await loadCommunity();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not report that item");
    } finally {
      setSending(false);
    }
  };

  const muteCommunityUser = async (item: CommunityChatMessage) => {
    if (item.isCurrentUser) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await studyApi.muteCommunityUser(item.userId);
      setMutedUsers((current) => [
        {
          mutedUserId: item.userId,
          displayName: item.user.displayName,
          email: "",
          createdAt: new Date().toISOString()
        },
        ...current.filter((user) => user.mutedUserId !== item.userId)
      ]);
      setChat((current) => current.filter((message) => message.userId !== item.userId));
      setRoomChat((current) =>
        Object.fromEntries(Object.entries(current).map(([roomId, messages]) => [roomId, messages.filter((message) => message.userId !== item.userId)]))
      );
      setNotice(`${item.user.displayName} is muted for you.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not mute that student");
    } finally {
      setSending(false);
    }
  };

  const unmuteCommunityUser = async (mutedUserId: string) => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await studyApi.unmuteCommunityUser(mutedUserId);
      setMutedUsers((current) => current.filter((user) => user.mutedUserId !== mutedUserId));
      await loadCommunity();
      setNotice("Student unmuted.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not unmute that student");
    } finally {
      setSending(false);
    }
  };

  const replyToChat = (item: CommunityChatMessage) => {
    const reply = `@${item.user.displayName} `;
    if (item.subjectRoomId) {
      setRoomMessage((current) => (current.trim() ? `${current.trim()}\n${reply}` : reply));
    } else {
      setChatMessage((current) => (current.trim() ? `${current.trim()}\n${reply}` : reply));
    }
  };

  const reactToChat = () => {
    setNotice("Reaction noted. Q&A helpful votes are tracked on the Board.");
  };

  const saveQuestionWallItem = async (item: CommunityQuestionWallItem) => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = item.savedByViewer
        ? await studyApi.unsaveQuestionWallQuestion(item.id)
        : await studyApi.saveQuestionWallQuestion(item.id);
      setQuestionWall(data.questionWall);
      setNotice(item.savedByViewer ? "Question removed from saved." : "Question saved. It will stay marked for you.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update saved question");
    } finally {
      setSending(false);
    }
  };

  const markAnswerHelpful = async (_item: CommunityQuestionWallItem, answerId: string) => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.helpfulQuestionWallAnswer(answerId);
      setQuestionWall(data.questionWall);
      setNotice("Helpful vote updated. Good answers now count on the Board.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not mark that answer helpful");
    } finally {
      setSending(false);
    }
  };

  const sendQuestion = async () => {
    if (!questionMessage.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.sendQuestionWallQuestion({
        subjectName: questionSubject.trim() || null,
        questionType,
        message: questionMessage.trim()
      });
      setQuestionWall(data.questionWall);
      setQuestionMessage("");
      setQuestionSubject("");
      setQuestionType("Concept help");
      setNotice("Posted anonymously to the question wall.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not post question");
    } finally {
      setSending(false);
    }
  };

  const sendQuestionAnswer = async (item: CommunityQuestionWallItem) => {
    const draft = answerDrafts[item.id]?.trim();
    if (!draft) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.sendQuestionWallAnswer(item.id, { message: draft });
      setQuestionWall(data.questionWall);
      setAllowance(data.allowance);
      setAnswerDrafts((current) => ({ ...current, [item.id]: "" }));
      setNotice("Answer posted. You earned XP and bonus chat energy.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not answer that question");
    } finally {
      setSending(false);
    }
  };

  const joinChessArena = async () => {
    if (chessTournament?.joined) {
      if (chessTournament.signupOpen !== false) {
        setError("You are signed up. Pairings lock Tuesday 8pm, then your match board opens here.");
        return;
      }
      const match = currentChessMatch;
      if (!match?.matchCode) {
        setError(chessTournament.statusCopy ?? "There is no playable knockout match right now.");
        return;
      }
      router.push({ pathname: "/chess-match", params: { code: match.matchCode } });
      return;
    }
    if (chessTournament && chessTournament.signupOpen === false) {
      setError(chessTournament.statusCopy ?? "Chess tournament signups are closed for this week.");
      return;
    }
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.joinChessTournament();
      setChessTournament(data.chessTournament);
      setNotice("You are signed up. Pairings and match codes will stay on the Rooms tab.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not join the chess arena");
    } finally {
      setSending(false);
    }
  };

  const openChessMatch = (matchCode?: string | null) => {
    if (chessTournament?.signupOpen !== false) {
      setError("Pairings lock Tuesday 8pm, then match boards open.");
      return;
    }
    if (!matchCode) {
      setError("This round does not have a match code yet.");
      return;
    }
    router.push({ pathname: "/chess-match", params: { code: matchCode } });
  };

  const dismissRoomIntro = async () => {
    setRoomIntroOpen(false);
    await AsyncStorage.setItem(SUBJECT_ROOM_INTRO_KEY, "seen");
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

  const resendLeaderboardInvite = async () => {
    setResendingLeaderboardInvite(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.resendLeaderboardInvite();
      setNotice(
        data.resentCount
          ? `Leaderboard invite resent to ${data.resentCount} opted-out student${data.resentCount === 1 ? "" : "s"}.`
          : "Everyone is already opted in."
      );
      await loadCommunity();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not resend leaderboard invite");
    } finally {
      setResendingLeaderboardInvite(false);
    }
  };

  const openGiftTheme = (user: CommunityUserSummary) => {
    setError(null);
    setNotice(null);
    setGiftUser(user);
    setGiftThemeId(firstGiftThemeFor(user));
  };

  const openGiftCoins = (user: CommunityUserSummary) => {
    setError(null);
    setNotice(null);
    setCoinGiftUser(user);
    setCoinGiftAmount("120");
    setCoinGiftMessage(`A little boost from Sasen. Spend these coins on something that makes study feel sharper.`);
  };

  const openAdminEmail = (user?: CommunityUserSummary) => {
    setError(null);
    setNotice(null);
    const defaultTemplate = adminEmailTemplates.find((item) => item.id === "service_update") ?? adminEmailTemplates[0];
    setAdminEmailTarget(user ?? null);
    setAdminEmailAudience(user ? "single" : "opted_in");
    setAdminEmailTemplateId(defaultTemplate.id);
    setAdminEmailSubject((current) => current || defaultTemplate.subject);
    setAdminEmailMessage((current) => current || defaultTemplate.message);
    setAdminEmailOpen(true);
  };

  const applyAdminEmailTemplate = (templateId: AdminEmailTemplateId) => {
    const template = adminEmailTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setAdminEmailTemplateId(templateId);
    setAdminEmailSubject(template.subject);
    setAdminEmailMessage(template.message);
  };

  const sendThemeGift = async () => {
    if (!giftUser) return;
    setGifting(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.giftTheme(giftUser.id, { themeId: giftThemeId, equip: true });
      setUsers((current) => current.map((user) => (user.id === data.user.id ? data.user : user)));
      setGiftUser(data.user);
      setNotice(`Gifted ${themeNameById(giftThemeId)} to ${data.user.displayName}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not gift theme");
    } finally {
      setGifting(false);
    }
  };

  const sendCoinGift = async () => {
    if (!coinGiftUser) return;
    const amount = Number(coinGiftAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a whole coin amount.");
      return;
    }

    setGifting(true);
    setError(null);
    setNotice(null);
    try {
      const data = await studyApi.giftCoins(coinGiftUser.id, {
        amount,
        message: coinGiftMessage.trim() || null
      });
      setUsers((current) => current.map((user) => (user.id === data.user.id ? data.user : user)));
      setCoinGiftUser(data.user);
      setNotice(`Gifted ${amount} coins to ${data.user.displayName}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not gift coins");
    } finally {
      setGifting(false);
    }
  };

  const sendAdminEmail = async () => {
    const subject = adminEmailSubject.trim();
    const message = adminEmailMessage.trim();
    if (subject.length < 4) {
      setError("Add a clear email subject.");
      return;
    }
    if (message.length < 10) {
      setError("Write a real message before sending.");
      return;
    }
    if (adminEmailAudience === "single" && !adminEmailTarget) {
      setError("Choose a user before sending a direct email.");
      return;
    }

    setAdminEmailSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await studyApi.sendAdminEmail({
        audience: adminEmailAudience,
        userId: adminEmailAudience === "single" ? adminEmailTarget?.id : null,
        subject,
        message
      });
      setAdminEmailOpen(false);
      setAdminEmailSubject("");
      setAdminEmailMessage("");
      setNotice(
        result.failed
          ? `Email sent to ${result.sent}/${result.attempted} users. ${result.failed} failed.`
          : `Email sent to ${result.sent} user${result.sent === 1 ? "" : "s"}.`
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send admin email");
    } finally {
      setAdminEmailSending(false);
    }
  };

  const boardEntries = boards?.[boardScope] ?? [];
  const boardCopy: Record<BoardScope, { title: string; empty: string }> = {
    week: { title: "This week", empty: "No weekly study yet." },
    today: { title: "Today", empty: "No one has logged study today yet." },
    improved: { title: "Most improved", empty: "Improvement appears once students beat last week." },
    streaks: { title: "Longest active streaks", empty: "No active streaks yet." },
    helpful: { title: "Most helpful", empty: "Helpful answers appear once students support Q&A." },
    challenge: { title: "Challenge leaders", empty: "Mission points appear as students complete weekly actions." }
  };
  const selectedBoardCopy = boardCopy[boardScope];
  const spotlightEntries = boardEntries.slice(0, 3);
  const viewerBoardEntry = boardEntries.find((entry) => entry.isCurrentUser);
  const viewerBoardRank = viewerBoardEntry?.rank;
  const nextBoardEntry = viewerBoardEntry ? boardEntries.find((entry) => entry.rank === viewerBoardEntry.rank - 1) : null;
  const nextBoardGap =
    viewerBoardEntry && nextBoardEntry ? Math.max(1, nextBoardEntry.score - viewerBoardEntry.score + 1) : null;
  const nextBoardMove =
    viewerBoardEntry && viewerBoardEntry.rank === 1
      ? "You are holding #1 on this board."
      : nextBoardGap
        ? `${boardGapLabel(boardScope, nextBoardGap)} to climb one spot.`
        : null;
  const chessRounds = chessTournament?.rounds ?? [];
  const chessMatches = chessTournament?.viewerMatches ?? [];
  const chessTournamentMatches = chessTournament?.tournamentMatches ?? [];
  const chessStandings = chessTournament?.standings ?? [];
  const currentChessMatch = chessTournamentMatches.find(
    (item) => item.canOpen && item.matchCode && (item.status === "scheduled" || item.status === "active")
  );
  const primaryChessMatch =
    chessMatches.find((match) => match.status === "paired") ??
    chessMatches.find((match) => match.status === "waiting" || match.status === "bye") ??
    null;
  const chessSignupOpen = chessTournament?.signupOpen !== false;
  const chessPairingCount = chessTournament?.pairingCount ?? Math.floor((chessTournament?.joinedCount ?? 0) / 2);
  const chessSignupStatus = chessSignupOpen
    ? `Open until ${formatHour(chessTournament?.signupClosesAt)}`
    : "Closed this week";
  const chessButtonLabel = chessTournament?.joined
    ? chessSignupOpen
      ? "Pairings lock Tuesday"
      : currentChessMatch
        ? "Open your match"
        : "Bracket visible"
    : chessSignupOpen
      ? "Sign up this week"
      : "Signups closed";
  const formatChessPoints = (points: number) => (Number.isInteger(points) ? `${points}` : points.toFixed(1));
  const chooseMode = (value: string) => {
    const nextMode = value as Mode;
    setMode(nextMode);
    if (nextMode === "analytics") {
      loadAnalytics();
    }
  };

  if (loading) {
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
          <Text style={styles.eyebrow}>Community</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Community
          </Text>
          <Text style={styles.muted}>Squads, rooms, questions and recognition without derailing study.</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="message-text-outline" color={palette.primary} size={22} />
        </View>
      </View>

      <SegmentedButtons
        value={mode}
        onValueChange={chooseMode}
        buttons={[
          { value: "squads", label: "Squads", icon: "account-group-outline" },
          { value: "rooms", label: "Rooms", icon: "timer-outline" },
          { value: "questions", label: "Q&A", icon: "comment-question-outline" },
          { value: "chat", label: "Chat", icon: "chat-outline" },
          { value: "leaderboard", label: "Board", icon: "trophy-outline" },
          { value: "feedback", label: isAdmin ? "Inbox" : "Feedback", icon: "inbox-arrow-up" },
          ...(isAdmin ? [{ value: "users", label: "Users", icon: "account-group-outline" }] : []),
          ...(isAdmin ? [{ value: "analytics", label: "Analytics", icon: "chart-line" }] : [])
        ]}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {isAdmin ? (
        <AppCard style={styles.adminCommandCard}>
          <View style={styles.privacyHeader}>
            <View style={styles.adminCommandIcon}>
              <MaterialCommunityIcons name="shield-account-outline" color={palette.info} size={20} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.cardTitle}>Admin command</Text>
              <Text style={styles.muted}>Email users, check reports and keep the community clean without leaving the app.</Text>
            </View>
          </View>
          <View style={styles.adminCommandActions}>
            <Button mode="contained-tonal" compact icon="email-send-outline" onPress={() => openAdminEmail()}>
              Email users
            </Button>
            <Button mode="outlined" compact icon="inbox-arrow-up" onPress={() => chooseMode("feedback")}>
              Inbox
            </Button>
            <Button mode="outlined" compact icon="account-group-outline" onPress={() => chooseMode("users")}>
              Users
            </Button>
            <Button mode="outlined" compact icon="chart-line" onPress={() => chooseMode("analytics")}>
              Analytics
            </Button>
          </View>
        </AppCard>
      ) : null}

      {mode === "squads" ? (
        <>
          <CommunityGuideCard hidden={communityGuideHidden} onDismiss={dismissCommunityGuide} />
          <CommunitySnapshotCard pulse={pulse} />
          <MissionCard mission={mission} onAction={runMissionAction} />
          <CommunityLoopCard />

          <AppCard style={styles.leaderboardStatusCard}>
            <View style={styles.allowanceTop}>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Community is on by default</Text>
                <Text style={styles.muted}>
                  Your display name, weekly study minutes and squad stats can appear in Community. Opt out anytime.
                </Text>
              </View>
              <Button
                mode={gamification?.leaderboardOptIn ? "outlined" : "contained"}
                disabled={leaderboardSaving}
                loading={leaderboardSaving}
                onPress={() => chooseLeaderboard(!gamification?.leaderboardOptIn)}
              >
                {gamification?.leaderboardOptIn ? "Opt out" : "Join"}
              </Button>
            </View>
            <CommunityPulseStrip pulse={pulse} />
          </AppCard>

          <ActivityFeedCard pulse={pulse} />

          <AppCard style={styles.listCard}>
            <View style={styles.feedbackHeader}>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Weekly subject squads</Text>
                <Text style={styles.muted}>Mini teams for each subject. Minutes matter, but helping and improvement count too.</Text>
              </View>
              <Text style={styles.muted}>{formatWeekRange(boards?.weekStart ?? leaderboard?.weekStart, boards?.weekEnd ?? leaderboard?.weekEnd)}</Text>
            </View>
            <View style={styles.squadGrid}>
              {squads.length ? (
                squads.map((squad) => (
                  <SquadCard key={squad.id} squad={squad} onStart={startSquadSprint} onAsk={askSquad} onRoom={viewSquadRoom} />
                ))
              ) : (
                <EmptyState title="No matching squads" body="Add one of the supported VCE subjects, then its squad will appear here." />
              )}
            </View>
          </AppCard>
        </>
      ) : mode === "rooms" ? (
        <>
          <AppCard style={styles.listCard}>
            <View style={styles.feedbackHeader}>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Live study rooms</Text>
                <Text style={styles.muted}>Join a room, keep your timer running, and let others see someone is working.</Text>
              </View>
              {!activeLiveRoomId ? (
                <Button mode="contained" compact icon="door-open" onPress={() => liveRooms[0] && joinLiveRoom(liveRooms[0])}>
                  Start public session
                </Button>
              ) : null}
              {activeLiveRoomId ? (
                <Button mode="outlined" compact icon="exit-to-app" onPress={leaveLiveRoom}>
                  Leave
                </Button>
              ) : null}
            </View>
            <View style={styles.list}>
              {liveRooms.map((room) => (
                <LiveRoomCard
                  key={room.id}
                  room={room}
                  active={room.id === activeLiveRoomId}
                  elapsedSeconds={room.id === activeLiveRoomId ? liveElapsedSeconds : 0}
                  onJoin={joinLiveRoom}
                  onLeave={leaveLiveRoom}
                />
              ))}
            </View>
          </AppCard>

          <AppCard style={styles.chessArenaCard}>
            <View style={styles.roomHubHeader}>
              <View style={styles.chessIcon}>
                <MaterialCommunityIcons name="chess-knight" color={palette.warning} size={22} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Chess knockout bracket</Text>
                <Text style={styles.muted}>
                  Winners advance. Losers are knocked out. New rounds appear after the previous winners are decided.
                </Text>
              </View>
              <View style={styles.chessPillRow}>
                <View style={styles.minutePill}>
                  <Text style={styles.minuteText}>{chessTournament?.joinedCount ?? 0} signed</Text>
                </View>
                <View style={styles.minutePill}>
                  <Text style={styles.minuteText}>{chessPairingCount} paired</Text>
                </View>
              </View>
            </View>
            <Text style={styles.muted}>
              {chessTournament?.statusCopy ??
                "Sign up before Tuesday night. Rounds run Wednesday and Sunday at 7:30pm."}
            </Text>
            <View style={styles.chessFactGrid}>
              <View style={styles.chessFactTile}>
                <Text style={styles.mutedSmall}>Signups</Text>
                <Text style={styles.userThemeText}>{chessSignupStatus}</Text>
              </View>
              <View style={styles.chessFactTile}>
                <Text style={styles.mutedSmall}>Pairings</Text>
                <Text style={styles.userThemeText}>{chessPairingCount} match{chessPairingCount === 1 ? "" : "es"}</Text>
              </View>
              <View style={styles.chessFactTile}>
                <Text style={styles.mutedSmall}>Results</Text>
                <Text style={styles.userThemeText}>Winners advance</Text>
              </View>
            </View>
            <View style={styles.chessRoundGrid}>
              {chessRounds.map((round) => (
                <View key={round.id} style={styles.chessRoundTile}>
                  <Text style={styles.userThemeText}>{round.label}</Text>
                  <Text style={styles.mutedSmall}>
                    {formatHour(round.startsAt)} - {round.status}
                  </Text>
                </View>
              ))}
            </View>
            {chessTournament?.joined ? (
              <View style={styles.chessMatchGrid}>
                {chessMatches.map((match) => (
                  <View key={match.id} style={styles.chessMatchTile}>
                    <Text style={styles.userThemeText}>{match.label}</Text>
                    <Text style={styles.metricValueSmall}>
                      {match.status === "paired"
                        ? `vs ${match.opponent?.displayName ?? "opponent"}`
                        : match.status === "bye"
                          ? "Bye round"
                          : match.status === "champion"
                            ? "Champion"
                            : match.status === "eliminated"
                              ? "Knocked out"
                              : "Waiting for winner"}
                    </Text>
                    <Text style={styles.mutedSmall}>
                      {formatHour(match.startsAt)}
                      {match.color !== "either" ? ` - you play ${match.color}` : ""}
                      {match.matchCode ? ` - ${match.matchCode}` : ""}
                    </Text>
                    {match.status === "paired" && match.matchCode ? (
                      <Button
                        mode="contained-tonal"
                        compact
                        icon="chess-board"
                        disabled={chessSignupOpen}
                        onPress={() => openChessMatch(match.matchCode)}
                      >
                        Play match
                      </Button>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : primaryChessMatch ? null : (
              <Text style={styles.mutedSmall}>
                No minute gate. The only rule is signing up before matchups are set.
              </Text>
            )}
            {chessStandings.length ? (
              <View style={styles.chessTournamentSection}>
                <Text style={styles.userThemeText}>Tournament standings</Text>
                <View style={styles.chessStandingList}>
                  {chessStandings.map((standing, index) => (
                    <View key={`standing-${standing.displayName}-${index}`} style={[styles.chessStandingRow, standing.isCurrentUser && styles.chessStandingRowActive]}>
                      <Text style={styles.chessStandingRank}>#{index + 1}</Text>
                      <View style={styles.flexText}>
                        <Text style={styles.userThemeText} numberOfLines={1}>
                          {standing.displayName}
                        </Text>
                        <Text style={styles.mutedSmall}>
                          {standing.status} - {standing.wins}W {standing.draws}D {standing.losses}L - {standing.matchesRemaining} to play
                        </Text>
                      </View>
                      <Text style={styles.metricValueSmall}>{formatChessPoints(standing.points)} win pts</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {chessTournamentMatches.length ? (
              <View style={styles.chessTournamentSection}>
                <Text style={styles.userThemeText}>Match board</Text>
                <View style={styles.chessMatchGrid}>
                  {chessTournamentMatches.map((match) => (
                    <View key={`board-${match.id}`} style={styles.chessMatchTile}>
                      <Text style={styles.userThemeText}>{match.label}</Text>
                      <Text style={styles.metricValueSmall} numberOfLines={1}>
                        {match.status === "waiting"
                          ? "Waiting for winners"
                          : match.status === "bye"
                            ? `${match.white?.displayName ?? "Player"} advances`
                            : `${match.white?.displayName ?? "TBD"} vs ${match.black?.displayName ?? "TBD"}`}
                      </Text>
                      <Text style={styles.mutedSmall}>
                        {formatHour(match.startsAt)} - {match.resultCopy}
                        {match.matchCode ? ` - ${match.matchCode}` : ""}
                      </Text>
                      {match.canOpen ? (
                        <Button mode="outlined" compact icon="chess-board" onPress={() => openChessMatch(match.matchCode)}>
                          Open
                        </Button>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <Button
              mode="outlined"
              compact
              icon="chess-king"
              loading={sending}
              disabled={!chessTournament?.joined && !chessSignupOpen}
              onPress={joinChessArena}
            >
              {chessButtonLabel}
            </Button>
          </AppCard>

          <AppCard style={styles.roomHubCard}>
            <View style={styles.roomHubHeader}>
              <View style={styles.roomHubIcon}>
                <MaterialCommunityIcons name="book-open-page-variant-outline" color={palette.info} size={22} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Subject chat rooms</Text>
                <Text style={styles.muted}>Quieter rooms for the subjects you actually take.</Text>
              </View>
            </View>

            {joinedRooms.length ? (
              <View style={styles.roomTabs}>
                {joinedRooms.map((room) => {
                  const selected = selectedRoom?.id === room.id;
                  return (
                    <Pressable
                      key={room.id}
                      style={[styles.roomTab, selected && styles.roomTabActive, { borderColor: selected ? room.color : palette.border }]}
                      onPress={() => setSelectedRoomId(room.id)}
                    >
                      <View style={[styles.roomDot, { backgroundColor: room.color }]} />
                      <Text style={styles.roomTabText} numberOfLines={1}>
                        {room.subjectName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {availableRooms.length ? (
              <View style={styles.availableRooms}>
                <Text style={styles.roomSectionLabel}>Available to join</Text>
                {availableRooms.map((room) => (
                  <View key={room.id} style={styles.availableRoomRow}>
                    <View style={[styles.roomDot, { backgroundColor: room.color }]} />
                    <View style={styles.flexText}>
                      <Text style={styles.availableRoomName}>{room.subjectName}</Text>
                      <Text style={styles.mutedSmall}>{room.unit}</Text>
                    </View>
                    <Button mode="outlined" compact icon="plus" onPress={() => joinRoom(room)}>
                      Join
                    </Button>
                  </View>
                ))}
              </View>
            ) : null}

            {!subjectRooms.length ? (
              <EmptyState title="No subjects yet" body="Add subjects from Profile, then their rooms will appear here." />
            ) : !joinedRooms.length ? (
              <EmptyState title="No joined rooms" body="Join a subject room above when you want a quieter space for that class." />
            ) : null}
          </AppCard>

          {selectedRoom ? (
            <>
              <AppCard style={styles.roomStatusCard}>
                <View style={styles.roomHeader}>
                  <View style={[styles.roomIcon, { backgroundColor: `${selectedRoom.color}22` }]}>
                    <MaterialCommunityIcons name="book-open-outline" color={selectedRoom.color} size={22} />
                  </View>
                  <View style={styles.flexText}>
                    <Text style={styles.cardTitle}>{selectedRoom.subjectName}</Text>
                    <Text style={styles.muted}>{selectedRoom.unit} room</Text>
                  </View>
                  <Button mode="outlined" compact icon="exit-to-app" onPress={() => leaveRoom(selectedRoom.id)}>
                    Leave
                  </Button>
                </View>
              </AppCard>

              <AppCard style={styles.chatCard}>
                {roomLoading ? (
                  <Text style={styles.muted}>Loading room messages...</Text>
                ) : selectedRoomMessages.length ? (
                  <View style={styles.chatList}>
                    {selectedRoomMessages.map((item) => (
                      <ChatBubble
                        key={item.id}
                        item={item}
                        canDelete={isAdmin || item.isCurrentUser}
                        deleting={deletingChatId === item.id}
                        onDelete={deleteChatMessage}
                        onReply={replyToChat}
                        onReact={reactToChat}
                        onReport={(message) => reportCommunityItem("room-chat", message.id, message.message, message.id, message.userId)}
                        onMute={muteCommunityUser}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyState title="Room is quiet" body="Pick a starter prompt or drop the question you wish someone asked first." />
                )}
              </AppCard>

              <AppCard style={styles.formCard}>
                <View style={styles.promptGrid}>
                  {selectedRoomPrompts.map((prompt) => (
                    <Pressable key={prompt} style={styles.promptChip} onPress={() => applyRoomPrompt(prompt)}>
                      <Text style={styles.promptChipText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  mode="outlined"
                  label={`${selectedRoom.subjectName} room message`}
                  value={roomMessage}
                  onChangeText={setRoomMessage}
                  multiline
                  numberOfLines={3}
                  maxLength={280}
                  style={styles.input}
                />
                <Button
                  mode="contained"
                  icon="send"
                  disabled={!roomMessage.trim() || sending || !allowance?.remainingMinutes}
                  loading={sending}
                  onPress={sendRoomChat}
                >
                  Send to room
                </Button>
              </AppCard>
            </>
          ) : null}
        </>
      ) : mode === "questions" ? (
        <>
          <AppCard style={styles.formCard}>
            <View style={styles.roomHubHeader}>
              <View style={styles.questionIcon}>
                <MaterialCommunityIcons name="comment-question-outline" color={palette.info} size={22} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Anonymous question wall</Text>
                <Text style={styles.muted}>Ask the thing you are stuck on without putting your name on the question. Anonymous still has rules and moderation.</Text>
              </View>
            </View>
            <View style={styles.choiceBlock}>
              <Text style={styles.roomSectionLabel}>Subject</Text>
              <View style={styles.promptGrid}>
                {questionSubjects.map((subjectName) => {
                  const selected = (questionSubject || "General") === subjectName;
                  return (
                    <Pressable
                      key={subjectName}
                      style={[styles.promptChip, selected && styles.promptChipActive]}
                      onPress={() => setQuestionSubject(subjectName === "General" ? "" : subjectName)}
                    >
                      <Text style={[styles.promptChipText, selected && styles.promptChipTextActive]}>{subjectName}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.choiceBlock}>
              <Text style={styles.roomSectionLabel}>Question type</Text>
              <View style={styles.promptGrid}>
                {QUESTION_TYPES.map((type) => {
                  const selected = questionType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.promptChip, selected && styles.promptChipActive]}
                      onPress={() => setQuestionType(type)}
                    >
                      <Text style={[styles.promptChipText, selected && styles.promptChipTextActive]}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <TextInput
              mode="outlined"
              label="What are you stuck on?"
              value={questionMessage}
              onChangeText={setQuestionMessage}
              multiline
              numberOfLines={3}
              maxLength={360}
              style={styles.input}
            />
            <Button mode="contained" icon="send" disabled={!questionMessage.trim() || sending} loading={sending} onPress={sendQuestion}>
              Post anonymously
            </Button>
          </AppCard>

          {savedQuestionWallItems.length ? (
            <AppCard style={styles.listCard}>
              <View style={styles.feedbackHeader}>
                <View style={styles.flexText}>
                  <Text style={styles.cardTitle}>Saved questions</Text>
                  <Text style={styles.muted}>Quick return points for useful explanations.</Text>
                </View>
                <Text style={styles.muted}>{savedQuestionWallItems.length} saved</Text>
              </View>
              <View style={styles.list}>
                {savedQuestionWallItems.slice(0, 4).map((item) => (
                  <View key={`saved-${item.id}`} style={styles.savedQuestionRow}>
                    <View style={styles.flexText}>
                      <Text style={styles.feedbackCategory}>{item.subjectName ?? "General"}</Text>
                      <Text style={styles.userThemeText} numberOfLines={2}>
                        {item.message}
                      </Text>
                      <Text style={styles.mutedSmall}>
                        {item.answerCount} answer{item.answerCount === 1 ? "" : "s"} - {item.helpfulScore} helpful score
                      </Text>
                    </View>
                    <Button mode="outlined" compact icon="bookmark-off-outline" disabled={sending} onPress={() => saveQuestionWallItem(item)}>
                      Unsave
                    </Button>
                  </View>
                ))}
              </View>
            </AppCard>
          ) : null}

          <AppCard style={styles.listCard}>
            <View style={styles.feedbackHeader}>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Questions waiting for help</Text>
                <Text style={styles.muted}>Helpful answers give XP, bonus messages and Board recognition.</Text>
              </View>
              <Text style={styles.muted}>
                {unansweredQuestionCount} need help - {helpedQuestionCount} helped by you
              </Text>
            </View>
            {questionWall.length ? (
              <View style={styles.list}>
                {questionWall.map((item) => (
                  <QuestionWallItem
                    key={item.id}
                    item={item}
                    answerDraft={answerDrafts[item.id] ?? ""}
                    onAnswerDraft={(value) => setAnswerDrafts((current) => ({ ...current, [item.id]: value }))}
                    onAnswer={sendQuestionAnswer}
                    onReport={(question) => reportCommunityItem("question", question.id, question.message)}
                    onReportAnswer={(question, answerId, message) => reportCommunityItem("answer", answerId, message, answerId)}
                    onSave={saveQuestionWallItem}
                    onHelpfulAnswer={markAnswerHelpful}
                    sending={sending}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.exampleQuestionBox}>
                <EmptyState title="No questions yet" body="Be the first to ask a clean stuck point." />
                {["Can someone explain depreciation?", "What command term means evaluate?", "How do I structure Criterion 2?"].map((example) => (
                  <Pressable key={example} style={styles.exampleQuestion} onPress={() => setQuestionMessage(example)}>
                    <MaterialCommunityIcons name="comment-question-outline" color={palette.info} size={16} />
                    <Text style={styles.userThemeText}>{example}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </AppCard>
        </>
      ) : mode === "users" && isAdmin ? (
        <>
          <AppCard style={styles.leaderboardPrivacyCard}>
            <View style={styles.privacyHeader}>
              <View style={styles.privacyIcon}>
                <MaterialCommunityIcons name="email-fast-outline" color={palette.info} size={20} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Admin email</Text>
                <Text style={styles.muted}>Send a short VCE Forge update through the backend SMTP account.</Text>
              </View>
              <Button mode="contained" compact icon="email-send-outline" onPress={() => openAdminEmail()}>
                Compose
              </Button>
            </View>
          </AppCard>

          <AppCard style={styles.listCard}>
            <View style={styles.feedbackHeader}>
              <Text style={styles.cardTitle}>Users</Text>
              <Text style={styles.muted}>{users.length} total</Text>
            </View>
            {users.length ? (
              <View style={styles.list}>
                {users.map((item) => (
                  <UserRow
                    key={item.id}
                    item={item}
                    onGiftTheme={openGiftTheme}
                    onGiftCoins={openGiftCoins}
                    onEmail={openAdminEmail}
                  />
                ))}
              </View>
            ) : (
              <EmptyState title="No users yet" body="Registered students will appear here." />
            )}
          </AppCard>
        </>
      ) : mode === "analytics" && isAdmin ? (
        <AnalyticsPanel analytics={analytics} loading={analyticsLoading} onRefresh={loadAnalytics} />
      ) : mode === "leaderboard" ? (
        <>
          {leaderboardError ? <Text style={styles.error}>{leaderboardError}</Text> : null}
          <AppCard style={styles.leaderboardStatusCard}>
            <View style={styles.allowanceTop}>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>{gamification?.leaderboardOptIn ? "You are competing" : "You are opted out"}</Text>
                <Text style={styles.muted}>
                  {gamification?.leaderboardOptIn
                    ? viewerBoardRank
                      ? `Your current ${selectedBoardCopy.title.toLowerCase()} rank is #${viewerBoardRank}.`
                      : "Log a study session to land on the board."
                    : "Stay private, or join when you want your weekly XP to count against other opted-in students."}
                </Text>
              </View>
              <View style={styles.leaderboardActions}>
                <Button
                  mode={gamification?.leaderboardOptIn ? "outlined" : "contained"}
                  disabled={leaderboardSaving}
                  loading={leaderboardSaving}
                  onPress={() => chooseLeaderboard(!gamification?.leaderboardOptIn)}
                >
                  {gamification?.leaderboardOptIn ? "Opt out" : "Join"}
                </Button>
                {isAdmin ? (
                  <Button
                    mode="outlined"
                    icon="send"
                    compact
                    disabled={resendingLeaderboardInvite}
                    loading={resendingLeaderboardInvite}
                    onPress={resendLeaderboardInvite}
                  >
                    Resend invite
                  </Button>
                ) : null}
              </View>
            </View>
            <Text style={styles.muted}>
              {formatWeekRange(leaderboard?.weekStart, leaderboard?.weekEnd)} - the board only includes students who
              choose Join.
            </Text>
            {nextBoardMove ? <Text style={styles.userThemeText}>{nextBoardMove}</Text> : null}
          </AppCard>

          <AppCard style={styles.leaderboardPrivacyCard}>
            <View style={styles.privacyHeader}>
              <View style={styles.privacyIcon}>
                <MaterialCommunityIcons name="shield-check-outline" color={palette.info} size={20} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Leaderboard privacy</Text>
                <Text style={styles.muted}>Joining makes your display name visible on the weekly public board.</Text>
              </View>
            </View>
            <View style={styles.privacyList}>
              <Text style={styles.privacyBullet}>Visible when joined: display name, title, weekly XP, minutes and sessions.</Text>
              <Text style={styles.privacyBullet}>Private mode: stay opted out and your name will not appear in rankings.</Text>
              <Text style={styles.privacyBullet}>You can opt out again from this screen at any time.</Text>
            </View>
          </AppCard>

          <AppCard style={styles.chatSwitchCard}>
            <SegmentedButtons
              value={boardScope}
              onValueChange={(value) => setBoardScope(value as BoardScope)}
              buttons={[
                { value: "week", label: "Week", icon: "calendar-week" },
                { value: "today", label: "Today", icon: "clock-outline" },
                { value: "improved", label: "Improved", icon: "trending-up" },
                { value: "streaks", label: "Streaks", icon: "fire" },
                { value: "helpful", label: "Helpful", icon: "hand-heart-outline" },
                { value: "challenge", label: "Missions", icon: "flag-checkered" }
              ]}
            />
            <Text style={styles.muted}>
              Everyone starts fresh each week. Consistency counts. Helping others counts too.
            </Text>
          </AppCard>

          <AppCard style={styles.listCard}>
            <View style={styles.feedbackHeader}>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Squad leaders</Text>
                <Text style={styles.muted}>Subject squads recognise minutes, helpers and improvement separately.</Text>
              </View>
            </View>
            <View style={styles.squadLeaderGrid}>
              {squads.map((squad) => (
                <View key={`leader-${squad.id}`} style={styles.squadLeaderTile}>
                  <View style={[styles.roomDot, { backgroundColor: squad.color }]} />
                  <View style={styles.flexText}>
                    <Text style={styles.leaderboardName}>{squad.shortName}</Text>
                    <Text style={styles.mutedSmall} numberOfLines={1}>
                      Minutes: {squad.topContributor ? `${squad.topContributor.displayName} ${squad.topContributor.minutes}m` : "open"}
                    </Text>
                    <Text style={styles.mutedSmall} numberOfLines={1}>
                      Helper: {squad.topHelper ? `${squad.topHelper.displayName} ${squad.topHelper.answers}` : "open"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </AppCard>

          {spotlightEntries.length ? (
            <View style={styles.podium}>
              {spotlightEntries.map((entry) => (
                <View key={entry.userId} style={[styles.podiumCard, entry.isCurrentUser && styles.leaderboardRowActive]}>
                  <Text style={styles.podiumRank}>#{entry.rank}</Text>
                  <Text style={styles.leaderboardName} numberOfLines={1}>
                    {entry.displayName}
                  </Text>
                  <Text style={styles.podiumXp}>{boardMetricLabel(entry, boardScope)}</Text>
                  <Text style={styles.muted}>{titleLabelById(entry.activeTitle)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <AppCard style={styles.listCard}>
            <View style={styles.feedbackHeader}>
              <Text style={styles.cardTitle}>{selectedBoardCopy.title}</Text>
              <Text style={styles.muted}>{boardEntries.length} competing</Text>
            </View>
            {boardEntries.length ? (
              <View style={styles.list}>
                {boardEntries.map((entry) => (
                  <CommunityBoardRow key={`${boardScope}-${entry.userId}`} entry={entry} scope={boardScope} />
                ))}
              </View>
            ) : (
              <EmptyState title="No competitors yet" body={selectedBoardCopy.empty} />
            )}
          </AppCard>
        </>
      ) : mode === "feedback" ? (
        isAdmin ? (
          <>
            <AppCard style={styles.listCard}>
              <View style={styles.feedbackHeader}>
                <Text style={styles.cardTitle}>Landing inquiries</Text>
                <Text style={styles.muted}>
                  {landingContacts.filter((item) => item.adminStatus === "new").length} new / {landingContacts.length} total
                </Text>
              </View>
              {landingContacts.length ? (
                <View style={styles.list}>
                  {landingContacts.map((item) => (
                    <LandingContactItem
                      key={item.id}
                      item={item}
                      updating={updatingContactId === item.id}
                      onStatus={updateContactStatus}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState title="No landing inquiries" body="Pre-account contact messages from the landing page will appear here." />
              )}
            </AppCard>

            <AppCard style={styles.listCard}>
              <View style={styles.feedbackHeader}>
                <Text style={styles.cardTitle}>Community reports</Text>
                <Text style={styles.muted}>{communityReports.length} open signals</Text>
              </View>
              {communityReports.length ? (
                <View style={styles.list}>
                  {communityReports.map((item) => (
                    <CommunityReportItem
                      key={item.id}
                      item={item}
                      updating={updatingReportId === item.id}
                      onStatus={updateReportStatus}
                      onDeleteMessage={deleteReportedMessage}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState title="No reports" body="Student reports from chat, rooms and Q&A will appear here." />
              )}
            </AppCard>

            <AppCard style={styles.listCard}>
              <View style={styles.feedbackHeader}>
                <Text style={styles.cardTitle}>Feedback inbox</Text>
                <Text style={styles.muted}>{feedback.length} received</Text>
              </View>
              {feedback.length ? (
                <View style={styles.list}>
                  {feedback.map((item) => (
                    <FeedbackItem key={item.id} item={item} showSender />
                  ))}
                </View>
              ) : (
                <EmptyState title="Inbox empty" body="When students send feedback, it will land here with their name and email." />
              )}
            </AppCard>
          </>
        ) : (
          <>
            <AppCard style={styles.formCard}>
              <Text style={styles.cardTitle}>Send feedback to admin</Text>
              <SegmentedButtons
                value={category}
                onValueChange={(value) => setCategory(value as FeedbackCategory)}
                buttons={[
                  { value: "feature", label: "Feature" },
                  { value: "bug", label: "Bug" },
                  { value: "content", label: "Content" },
                  { value: "other", label: "Other" }
                ]}
              />
              <TextInput
                mode="outlined"
                label="Message"
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
                multiline
                numberOfLines={5}
                maxLength={1200}
                style={styles.input}
              />
              <Button mode="contained" icon="send" disabled={!feedbackMessage.trim() || sending} loading={sending} onPress={sendFeedback}>
                Send feedback
              </Button>
            </AppCard>

            <AppCard style={styles.listCard}>
              <Text style={styles.cardTitle}>Your sent feedback</Text>
              {feedback.length ? (
                <View style={styles.list}>
                  {feedback.map((item) => (
                    <FeedbackItem key={item.id} item={item} />
                  ))}
                </View>
              ) : (
                <EmptyState title="No feedback yet" body="Feature requests, bugs, content issues, confusing bits, all of it can go here." />
              )}
            </AppCard>
          </>
        )
      ) : (
        <>
          <AppCard style={styles.allowanceCard}>
            <View style={styles.allowanceTop}>
              <View>
                <Text style={styles.cardTitle}>Chat unlocks</Text>
                <Text style={styles.muted}>{allowanceLabel}</Text>
              </View>
              <View style={styles.minutePill}>
                <MaterialCommunityIcons name={allowance?.unlimitedRoomChat ? "infinity" : "message-text-outline"} color={palette.warning} size={16} />
                <Text style={styles.minuteText}>{allowance?.remainingMinutes ?? 0}</Text>
              </View>
            </View>
            <Text style={styles.muted}>
              Study {allowance?.unlockStudyMinutes ?? 10} minutes to unlock {allowance?.unlockedMessages ?? 5} messages.
              Study {allowance?.roomUnlimitedStudyMinutes ?? 30} minutes for unlimited chat today. Helpful Q&A answers add bonus messages.
            </Text>
            {!allowance?.remainingMinutes ? (
              <Button mode="outlined" compact icon="timer-outline" onPress={() => router.push({ pathname: "/(tabs)/study", params: { mode: "timer", targetMinutes: "10" } })}>
                Study to unlock more messages
              </Button>
            ) : null}
          </AppCard>

          <AppCard style={styles.rulesCard}>
            <View style={styles.roomHubHeader}>
              <View style={styles.privacyIcon}>
                <MaterialCommunityIcons name="shield-check-outline" color={palette.info} size={20} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Community rules</Text>
                <Text style={styles.muted}>No personal info, no piling on, keep help specific, report anything off.</Text>
              </View>
            </View>
          </AppCard>

          {mutedUsers.length ? (
            <AppCard style={styles.listCard}>
              <View style={styles.feedbackHeader}>
                <View style={styles.flexText}>
                  <Text style={styles.cardTitle}>Muted students</Text>
                  <Text style={styles.muted}>Their chat, room and Q&A activity is hidden for you.</Text>
                </View>
                <Text style={styles.muted}>{mutedUsers.length} muted</Text>
              </View>
              <View style={styles.list}>
                {mutedUsers.map((user) => (
                  <View key={user.mutedUserId} style={styles.savedQuestionRow}>
                    <View style={styles.flexText}>
                      <Text style={styles.userThemeText} numberOfLines={1}>
                        {user.displayName}
                      </Text>
                      <Text style={styles.mutedSmall} numberOfLines={1}>
                        {user.schoolName || user.email || `Muted ${formatTime(user.createdAt)}`}
                      </Text>
                    </View>
                    <Button mode="outlined" compact icon="volume-high" disabled={sending} onPress={() => unmuteCommunityUser(user.mutedUserId)}>
                      Unmute
                    </Button>
                  </View>
                ))}
              </View>
            </AppCard>
          ) : null}

          <AppCard style={styles.chatCard}>
            {chat.length ? (
              <View style={styles.chatList}>
                {chat.map((item) => (
                  <ChatBubble
                    key={item.id}
                    item={item}
                    canDelete={isAdmin || item.isCurrentUser}
                    deleting={deletingChatId === item.id}
                    onDelete={deleteChatMessage}
                    onReply={replyToChat}
                    onReact={reactToChat}
                    onReport={(message) => reportCommunityItem("chat", message.id, message.message, message.id, message.userId)}
                    onMute={muteCommunityUser}
                  />
                ))}
              </View>
            ) : (
              <EmptyState title="No chat yet" body="Main chat stays calm. Try a subject room if you want a smaller conversation." />
            )}
          </AppCard>

          <AppCard style={styles.formCard}>
            <TextInput
              mode="outlined"
              label="Chat message"
              value={chatMessage}
              onChangeText={setChatMessage}
              multiline
              numberOfLines={3}
              maxLength={280}
              style={styles.input}
            />
            <Button
              mode="contained"
              icon="send"
              disabled={!chatMessage.trim() || sending || !allowance?.remainingMinutes}
              loading={sending}
              onPress={sendChat}
            >
              Send chat
            </Button>
          </AppCard>

          <AppCard style={styles.leaderboardPrivacyCard}>
            <View style={styles.privacyHeader}>
              <View style={styles.privacyIcon}>
                <MaterialCommunityIcons name="door-open" color={palette.info} size={20} />
              </View>
              <View style={styles.flexText}>
                <Text style={styles.cardTitle}>Need subject chat?</Text>
                <Text style={styles.muted}>Subject rooms and live timers live under Rooms so this chat stays clean.</Text>
              </View>
              <Button mode="outlined" compact icon="timer-outline" onPress={() => setMode("rooms")}>
                Rooms
              </Button>
            </View>
          </AppCard>
        </>
      )}
      <Portal>
        <Dialog visible={roomIntroOpen} onDismiss={dismissRoomIntro} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Subject rooms are here</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.muted}>
              The main Community chat is still there. You can now optionally join rooms for your subjects inside
              Community Chat, and those room messages stay separate from the all-school chat.
            </Text>
            <Text style={styles.muted}>Your daily chat unlocks apply across both main chat and subject rooms.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="contained" onPress={dismissRoomIntro}>
              Got it
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(giftUser)} onDismiss={() => setGiftUser(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Gift theme</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.muted}>
              {giftUser ? `Grant and equip a free theme for ${giftUser.displayName}. No coins will be deducted.` : ""}
            </Text>
            <ScrollView style={styles.themePicker} contentContainerStyle={styles.themePickerContent}>
              {themeShopItems.map((theme) => {
                const selected = giftThemeId === theme.id;
                const unlocked = Boolean(giftUser?.unlockedCosmetics.includes(theme.id));
                const active = giftUser?.activeTheme === theme.id;
                return (
                  <Pressable
                    key={theme.id}
                    onPress={() => setGiftThemeId(theme.id)}
                    style={[styles.themeOption, selected && styles.themeOptionSelected]}
                  >
                    <View style={[styles.themeSwatch, { backgroundColor: theme.colors.background }]}>
                      <View style={[styles.themeSwatchLine, { backgroundColor: theme.colors.primary }]} />
                      <View style={[styles.themeSwatchLineShort, { backgroundColor: theme.colors.secondary }]} />
                    </View>
                    <View style={styles.flexText}>
                      <Text style={styles.themeOptionName} numberOfLines={1}>
                        {theme.name}
                      </Text>
                      <Text style={styles.themeOptionMeta} numberOfLines={1}>
                        {active ? "Active now" : unlocked ? "Already unlocked" : `${theme.price} coins in shop`}
                      </Text>
                    </View>
                    {selected ? <MaterialCommunityIcons name="check-circle" color={palette.primary} size={20} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={gifting} onPress={() => setGiftUser(null)}>
              Close
            </Button>
            <Button mode="contained" icon="gift-outline" loading={gifting} disabled={gifting || !giftUser} onPress={sendThemeGift}>
              Gift + equip
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(coinGiftUser)} onDismiss={() => setCoinGiftUser(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Gift coins</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.muted}>
              {coinGiftUser ? `Send shop coins to ${coinGiftUser.displayName}. They will also receive the message below on Home.` : ""}
            </Text>
            <TextInput
              mode="outlined"
              label="Coins"
              value={coinGiftAmount}
              keyboardType="number-pad"
              onChangeText={setCoinGiftAmount}
            />
            <TextInput
              mode="outlined"
              label="Short message"
              value={coinGiftMessage}
              multiline
              maxLength={180}
              onChangeText={setCoinGiftMessage}
            />
            <Text style={styles.mutedSmall}>{coinGiftMessage.length}/180 characters</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={gifting} onPress={() => setCoinGiftUser(null)}>
              Close
            </Button>
            <Button mode="contained" icon="cash-multiple" loading={gifting} disabled={gifting || !coinGiftUser} onPress={sendCoinGift}>
              Gift coins
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={adminEmailOpen} onDismiss={() => !adminEmailSending && setAdminEmailOpen(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Send admin email</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.muted}>
              {adminEmailTarget
                ? `Target selected: ${adminEmailTarget.displayName} (${adminEmailTarget.email})`
                : "Send an announcement without leaving the app. Opt-in is the safest default."}
            </Text>
            <SegmentedButtons
              value={adminEmailAudience}
              onValueChange={(value) => setAdminEmailAudience(value as AdminEmailAudience)}
              buttons={[
                { value: "opted_in", label: "Opt-in" },
                { value: "all", label: "All" },
                ...(adminEmailTarget ? [{ value: "single", label: "User" }] : [])
              ]}
            />
            <View style={styles.adminTemplateGrid}>
              {adminEmailTemplates.map((template) => {
                const active = adminEmailTemplateId === template.id;
                return (
                  <Pressable
                    key={template.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.adminTemplateChip, active && styles.adminTemplateChipActive]}
                    onPress={() => applyAdminEmailTemplate(template.id)}
                  >
                    <MaterialCommunityIcons
                      name={template.icon as IconName}
                      color={active ? palette.text : palette.info}
                      size={16}
                    />
                    <Text style={[styles.adminTemplateText, active && styles.adminTemplateTextActive]} numberOfLines={1}>
                      {template.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              mode="outlined"
              label="Subject"
              value={adminEmailSubject}
              maxLength={120}
              onChangeText={setAdminEmailSubject}
            />
            <TextInput
              mode="outlined"
              label="Message"
              value={adminEmailMessage}
              multiline
              numberOfLines={6}
              maxLength={5000}
              onChangeText={setAdminEmailMessage}
            />
            <Text style={styles.mutedSmall}>
              {adminEmailMessage.length}/5000 characters. Opt-in reaches students who have not turned weekly emails off.
              All emails include an Open VCE Forge button and unsubscribe link.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={adminEmailSending} onPress={() => setAdminEmailOpen(false)}>
              Close
            </Button>
            <Button
              mode="contained"
              icon="email-send-outline"
              loading={adminEmailSending}
              disabled={adminEmailSending || adminEmailSubject.trim().length < 4 || adminEmailMessage.trim().length < 10}
              onPress={sendAdminEmail}
            >
              Send
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  eyebrow: {
    color: palette.muted,
    marginBottom: 4
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,110,255,0.14)"
  },
  error: {
    color: palette.secondary
  },
  notice: {
    color: palette.success
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
  adminCommandCard: {
    gap: 12,
    borderColor: "rgba(56,189,248,0.26)",
    backgroundColor: "rgba(56,189,248,0.07)"
  },
  adminCommandIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,189,248,0.14)"
  },
  adminCommandActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  adminTemplateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  adminTemplateChip: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  adminTemplateChipActive: {
    borderColor: "rgba(56,189,248,0.55)",
    backgroundColor: "rgba(56,189,248,0.14)"
  },
  adminTemplateText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  adminTemplateTextActive: {
    color: palette.text
  },
  formCard: {
    gap: 12
  },
  leaderboardStatusCard: {
    gap: 12
  },
  leaderboardActions: {
    alignItems: "flex-end",
    gap: 8
  },
  leaderboardPrivacyCard: {
    gap: 12,
    borderColor: "rgba(96,165,250,0.24)",
    backgroundColor: "rgba(96,165,250,0.08)"
  },
  guideCard: {
    gap: 12,
    borderColor: "rgba(124,110,255,0.28)",
    backgroundColor: "rgba(124,110,255,0.08)"
  },
  guideGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  guideStep: {
    flexGrow: 1,
    flexBasis: 190,
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  guideIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  guideTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  snapshotCard: {
    gap: 12,
    borderColor: "rgba(56,189,248,0.24)",
    backgroundColor: "rgba(56,189,248,0.07)"
  },
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  snapshotTile: {
    flexGrow: 1,
    flexBasis: 126,
    minHeight: 88,
    gap: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,0.12)"
  },
  privacyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,165,250,0.14)"
  },
  privacyList: {
    gap: 8
  },
  privacyBullet: {
    color: palette.text,
    lineHeight: 20
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricTile: {
    flexGrow: 1,
    flexBasis: 160,
    minHeight: 108,
    gap: 5,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.primary}18`
  },
  metricValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 24
  },
  metricValueSmall: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  metricLabel: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  podium: {
    flexDirection: "row",
    gap: 10
  },
  podiumCard: {
    flex: 1,
    minHeight: 124,
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 8,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border
  },
  podiumRank: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 20
  },
  podiumXp: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  leaderboardRowActive: {
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.5)",
    backgroundColor: "rgba(124,110,255,0.1)"
  },
  leaderboardRank: {
    width: 40,
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  leaderboardNameBlock: {
    flex: 1,
    minWidth: 0
  },
  leaderboardName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  leaderboardXp: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  hourRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  hourLabel: {
    width: 76,
    color: palette.muted,
    fontSize: 12
  },
  hourTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  hourFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary
  },
  hourCount: {
    width: 58,
    textAlign: "right",
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  screenUsageRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  screenBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  screenBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.info
  },
  userItem: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  userTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  userName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  userEmail: {
    color: palette.info,
    lineHeight: 20
  },
  userPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  planBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: `${palette.primary}18`,
    overflow: "hidden"
  },
  planBadgeText: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 11
  },
  userStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  contactMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  contactActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  giftRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 8
  },
  giftActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  userThemeText: {
    color: palette.text,
    lineHeight: 20
  },
  userStat: {
    color: palette.text,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden"
  },
  optInPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden"
  },
  optInPillActive: {
    backgroundColor: "rgba(74,222,128,0.14)"
  },
  optInPillMuted: {
    backgroundColor: "rgba(136,136,170,0.14)"
  },
  optInText: {
    color: palette.text,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  listCard: {
    gap: 12
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  input: {
    backgroundColor: "transparent"
  },
  list: {
    gap: 10
  },
  activityList: {
    gap: 8
  },
  activityRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  activityTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  loopCard: {
    gap: 12,
    borderColor: "rgba(74,222,128,0.2)",
    backgroundColor: "rgba(74,222,128,0.06)"
  },
  loopIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,222,128,0.12)"
  },
  loopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  loopStep: {
    flexGrow: 1,
    flexBasis: 135,
    minHeight: 58,
    gap: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.14)"
  },
  loopNumber: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  loopText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  squadLeaderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  squadLeaderTile: {
    flexGrow: 1,
    flexBasis: 210,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  squadGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  squadCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 260,
    maxWidth: 390,
    minHeight: 196,
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  squadTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12
  },
  pulsePill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: "hidden"
  },
  pulseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pulseTile: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  pulseIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  pulseValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  pulseText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11
  },
  squadMark: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  squadGoalBlock: {
    gap: 6
  },
  squadGoalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  squadProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  squadProgressFill: {
    height: "100%",
    borderRadius: 999
  },
  squadNudge: {
    color: palette.text,
    lineHeight: 19
  },
  squadStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  squadStat: {
    flex: 1,
    minWidth: 86,
    gap: 2,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.14)"
  },
  squadRecognitionGrid: {
    gap: 4,
    paddingTop: 2
  },
  cardActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  missionCard: {
    gap: 14,
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  missionIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.14)"
  },
  missionList: {
    gap: 10
  },
  missionRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  missionLabel: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  missionTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  missionFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.warning
  },
  liveRoomCard: {
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  liveRoomFooter: {
    gap: 4,
    paddingLeft: 56
  },
  roomInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  roomInfoTile: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 3,
    padding: 9,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.14)"
  },
  roomPrompt: {
    color: palette.text,
    lineHeight: 20
  },
  questionIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,165,250,0.14)"
  },
  questionItem: {
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  questionType: {
    color: palette.info,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.12)",
    overflow: "hidden"
  },
  questionMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  answerList: {
    gap: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(96,165,250,0.28)"
  },
  answerItem: {
    gap: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(96,165,250,0.08)"
  },
  savedQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  feedbackItem: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  feedbackMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: 8
  },
  feedbackCategory: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  feedbackStatus: {
    color: palette.success,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(74,222,128,0.12)",
    overflow: "hidden",
    textTransform: "uppercase"
  },
  feedbackStatusCalm: {
    color: palette.success,
    backgroundColor: "rgba(74,222,128,0.12)"
  },
  feedbackStatusHot: {
    color: palette.secondary,
    backgroundColor: "rgba(255,107,107,0.12)"
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(96,165,250,0.1)"
  },
  feedbackSender: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  feedbackMessage: {
    color: palette.text,
    lineHeight: 20
  },
  recentEventRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  recentScreen: {
    minWidth: 86,
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  allowanceCard: {
    gap: 10
  },
  allowanceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center"
  },
  minutePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.14)"
  },
  minuteText: {
    color: palette.warning,
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
  chatSwitchCard: {
    gap: 12
  },
  chessArenaCard: {
    gap: 12,
    borderColor: "rgba(245,158,11,0.24)",
    backgroundColor: "rgba(245,158,11,0.07)"
  },
  chessIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.14)"
  },
  chessPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
  },
  chessFactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chessFactTile: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)"
  },
  chessTournamentSection: {
    gap: 8
  },
  chessStandingList: {
    gap: 6
  },
  chessStandingRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.16)",
    backgroundColor: "rgba(0,0,0,0.12)"
  },
  chessStandingRowActive: {
    borderColor: "rgba(245,158,11,0.42)",
    backgroundColor: "rgba(245,158,11,0.1)"
  },
  chessStandingRank: {
    minWidth: 34,
    color: palette.warning,
    fontFamily: "Outfit_700Bold"
  },
  chessRoundGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chessRoundTile: {
    flexGrow: 1,
    flexBasis: 170,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.18)",
    backgroundColor: "rgba(0,0,0,0.14)"
  },
  chessMatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chessMatchTile: {
    flexGrow: 1,
    flexBasis: 220,
    gap: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.26)",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  rulesCard: {
    gap: 10,
    borderColor: "rgba(96,165,250,0.2)",
    backgroundColor: "rgba(96,165,250,0.06)"
  },
  roomHubCard: {
    gap: 14
  },
  roomHubHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  roomHubIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96,165,250,0.14)"
  },
  roomTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  roomTab: {
    minHeight: 40,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  roomTabActive: {
    backgroundColor: "rgba(124,110,255,0.12)"
  },
  roomDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  roomTabText: {
    maxWidth: 220,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  availableRooms: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  roomSectionLabel: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  availableRoomRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 10
  },
  availableRoomName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  promptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  promptChip: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  promptChipActive: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}18`
  },
  promptChipText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  promptChipTextActive: {
    color: palette.text
  },
  choiceBlock: {
    gap: 8
  },
  exampleQuestionBox: {
    gap: 8
  },
  exampleQuestion: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "rgba(96,165,250,0.08)",
    padding: 10
  },
  roomStatusCard: {
    gap: 12,
    borderColor: "rgba(96,165,250,0.22)",
    backgroundColor: "rgba(96,165,250,0.08)"
  },
  roomHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  roomIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  chatCard: {
    gap: 12
  },
  chatList: {
    gap: 10
  },
  chatBubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    minWidth: 180,
    gap: 6,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.045)"
  },
  chatBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(124,110,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.36)"
  },
  chatMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  chatMetaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  chatName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    flex: 1,
    minWidth: 0
  },
  deleteIconButton: {
    width: 28,
    height: 28,
    margin: 0
  },
  chatText: {
    color: palette.text,
    lineHeight: 20
  },
  chatControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 4
  },
  themePicker: {
    maxHeight: 380
  },
  themePickerContent: {
    gap: 8,
    paddingRight: 4
  },
  themeOption: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 10
  },
  themeOptionSelected: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}16`
  },
  themeSwatch: {
    width: 44,
    height: 38,
    borderRadius: 8,
    justifyContent: "flex-end",
    gap: 4,
    padding: 7
  },
  themeSwatchLine: {
    width: "78%",
    height: 4,
    borderRadius: 4
  },
  themeSwatchLineShort: {
    width: "48%",
    height: 4,
    borderRadius: 4
  },
  themeOptionName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  themeOptionMeta: {
    color: palette.muted,
    fontSize: 12
  }
});
