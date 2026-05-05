import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
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
  AdminUsageAnalytics,
  ChatAllowance,
  CommunityChatMessage,
  CommunitySubjectRoom,
  CommunityUserSummary,
  LeaderboardEntry,
  UsageScreen,
  UserSubject,
  UserFeedback
} from "@/types";

type Mode = "chat" | "leaderboard" | "feedback" | "users" | "analytics";
type ChatScope = "school" | "subject";
type FeedbackCategory = UserFeedback["category"];

const SUBJECT_ROOM_INTRO_KEY = "vce_subject_rooms_intro_seen_v1";
const JOINED_SUBJECT_ROOMS_KEY = "vce_joined_subject_rooms_v1";

const categoryCopy: Record<FeedbackCategory, string> = {
  bug: "Bug",
  feature: "Feature",
  content: "Content",
  other: "Other"
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

const formatHour = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

const formatRelativeTime = (value?: string | null) => {
  if (!value) return "No visits yet";
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
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
  study: "Study",
  calendar: "Calendar",
  questions: "Questions",
  community: "Community",
  shop: "Shop",
  profile: "Profile"
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
  onDelete
}: {
  item: CommunityChatMessage;
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: (id: string) => void;
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

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={[styles.leaderboardRow, entry.isCurrentUser && styles.leaderboardRowActive]}>
      <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
      <View style={styles.leaderboardNameBlock}>
        <Text style={styles.leaderboardName} numberOfLines={1}>
          {entry.displayName}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {titleLabelById(entry.activeTitle)} - {entry.weekMinutes} min - {entry.sessionCount} sessions
        </Text>
      </View>
      <Text style={styles.leaderboardXp}>{entry.weekXp} XP</Text>
    </View>
  );
}

function UserRow({
  item,
  onGiftTheme
}: {
  item: CommunityUserSummary;
  onGiftTheme: (user: CommunityUserSummary) => void;
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
            {unlockedThemeCount}/{themeShopItems.length} themes unlocked
          </Text>
        </View>
        <Button mode="outlined" compact icon="gift-outline" onPress={() => onGiftTheme(item)}>
          Gift theme
        </Button>
      </View>
      <View style={styles.userStats}>
        <Text style={styles.userStat}>Level {item.level}</Text>
        <Text style={styles.userStat}>{titleLabelById(item.activeTitle)}</Text>
        <Text style={styles.userStat}>{item.totalXp} XP</Text>
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
                    {event.email}
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
  const [mode, setMode] = useState<Mode>("chat");
  const [chatScope, setChatScope] = useState<ChatScope>("school");
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [chat, setChat] = useState<CommunityChatMessage[]>([]);
  const [roomChat, setRoomChat] = useState<Record<string, CommunityChatMessage[]>>({});
  const [joinedRoomIds, setJoinedRoomIds] = useState<string[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [users, setUsers] = useState<CommunityUserSummary[]>([]);
  const [analytics, setAnalytics] = useState<AdminUsageAnalytics | null>(null);
  const [allowance, setAllowance] = useState<ChatAllowance | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [roomIntroOpen, setRoomIntroOpen] = useState(false);
  const [leaderboardSaving, setLeaderboardSaving] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [resendingLeaderboardInvite, setResendingLeaderboardInvite] = useState(false);
  const [giftUser, setGiftUser] = useState<CommunityUserSummary | null>(null);
  const [giftThemeId, setGiftThemeId] = useState("cherry_blossom");
  const [gifting, setGifting] = useState(false);

  const loadCommunity = useCallback(async () => {
    setError(null);
    try {
      const data = await studyApi.community();
      setFeedback(data.feedback);
      setChat(data.chat);
      setUsers(data.users ?? []);
      setAllowance(data.allowance);
      setIsAdmin(Boolean(data.isAdmin));
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
    if (chatScope !== "subject" || !selectedRoom) return;
    loadSubjectRoom(selectedRoom.id);
  }, [chatScope, loadSubjectRoom, selectedRoom]);

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
    if (!allowance) return "Loading chat minutes";
    return `${allowance.remainingMinutes}/${allowance.totalMinutes} chat minutes left`;
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
    setChatScope("subject");
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

  const leaderboardEntries = leaderboard?.entries ?? [];
  const topThree = leaderboardEntries.slice(0, 3);
  const viewerRank = leaderboard?.viewer?.rank;
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
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="message-text-outline" color={palette.primary} size={22} />
        </View>
      </View>

      <SegmentedButtons
        value={mode}
        onValueChange={chooseMode}
        buttons={[
          { value: "chat", label: "Chat", icon: "chat-outline" },
          { value: "leaderboard", label: "Board", icon: "trophy-outline" },
          { value: "feedback", label: isAdmin ? "Inbox" : "Feedback", icon: "inbox-arrow-up" },
          ...(isAdmin ? [{ value: "users", label: "Users", icon: "account-group-outline" }] : []),
          ...(isAdmin ? [{ value: "analytics", label: "Analytics", icon: "chart-line" }] : [])
        ]}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {mode === "users" && isAdmin ? (
        <AppCard style={styles.listCard}>
          <View style={styles.feedbackHeader}>
            <Text style={styles.cardTitle}>Users</Text>
            <Text style={styles.muted}>{users.length} total</Text>
          </View>
          {users.length ? (
            <View style={styles.list}>
              {users.map((item) => (
                <UserRow key={item.id} item={item} onGiftTheme={openGiftTheme} />
              ))}
            </View>
          ) : (
            <EmptyState title="No users yet" body="Registered students will appear here." />
          )}
        </AppCard>
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
                    ? viewerRank
                      ? `Your current weekly rank is #${viewerRank}.`
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

          {topThree.length ? (
            <View style={styles.podium}>
              {topThree.map((entry) => (
                <View key={entry.userId} style={[styles.podiumCard, entry.isCurrentUser && styles.leaderboardRowActive]}>
                  <Text style={styles.podiumRank}>#{entry.rank}</Text>
                  <Text style={styles.leaderboardName} numberOfLines={1}>
                    {entry.displayName}
                  </Text>
                  <Text style={styles.podiumXp}>{entry.weekXp} XP</Text>
                  <Text style={styles.muted}>{titleLabelById(entry.activeTitle)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <AppCard style={styles.listCard}>
            <View style={styles.feedbackHeader}>
              <Text style={styles.cardTitle}>Weekly rankings</Text>
              <Text style={styles.muted}>{leaderboardEntries.length} competing</Text>
            </View>
            {leaderboardEntries.length ? (
              <View style={styles.list}>
                {leaderboardEntries.map((entry) => (
                  <LeaderboardRow key={entry.userId} entry={entry} />
                ))}
              </View>
            ) : (
              <EmptyState title="No competitors yet" body="Once students opt in and log study sessions, the rankings appear here." />
            )}
          </AppCard>
        </>
      ) : mode === "feedback" ? (
        isAdmin ? (
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
                <Text style={styles.cardTitle}>Student chat</Text>
                <Text style={styles.muted}>{allowanceLabel}</Text>
              </View>
              <View style={styles.minutePill}>
                <MaterialCommunityIcons name="timer-sand" color={palette.warning} size={16} />
                <Text style={styles.minuteText}>{allowance?.remainingMinutes ?? 0}</Text>
              </View>
            </View>
            <Text style={styles.muted}>
              Base {allowance?.baseMinutes ?? 3} per day. Every {allowance?.studyMinutesPerChatMinute ?? 5} study minutes earns 1 more.
            </Text>
          </AppCard>

          <AppCard style={styles.chatSwitchCard}>
            <SegmentedButtons
              value={chatScope}
              onValueChange={(value) => setChatScope(value as ChatScope)}
              buttons={[
                { value: "school", label: "All school", icon: "account-group-outline" },
                { value: "subject", label: "Subject rooms", icon: "book-open-variant" }
              ]}
            />
            <Text style={styles.muted}>
              {chatScope === "school"
                ? "The main chat is shared by everyone."
                : "Join only the subject rooms you want. Room messages stay out of the main chat."}
            </Text>
          </AppCard>

          {chatScope === "school" ? (
            <>
              <AppCard style={styles.chatCard}>
                {chat.length ? (
                  <View style={styles.chatList}>
                    {chat.map((item) => (
                      <ChatBubble
                        key={item.id}
                        item={item}
                        canDelete={isAdmin}
                        deleting={deletingChatId === item.id}
                        onDelete={deleteChatMessage}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyState title="No chat yet" body="The public chat will appear here once someone sends the first message." />
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
            </>
          ) : (
            <>
              <AppCard style={styles.roomHubCard}>
                <View style={styles.roomHubHeader}>
                  <View style={styles.roomHubIcon}>
                    <MaterialCommunityIcons name="book-open-page-variant-outline" color={palette.info} size={22} />
                  </View>
                  <View style={styles.flexText}>
                    <Text style={styles.cardTitle}>Subject rooms</Text>
                    <Text style={styles.muted}>Optional spaces for classmates studying the same subject.</Text>
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
                            canDelete={isAdmin}
                            deleting={deletingChatId === item.id}
                            onDelete={deleteChatMessage}
                          />
                        ))}
                      </View>
                    ) : (
                      <EmptyState title="Room is quiet" body="Start with a question, a resource, or a quick study win." />
                    )}
                  </AppCard>

                  <AppCard style={styles.formCard}>
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
          )}
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
            <Text style={styles.muted}>Your daily chat minutes apply across both main chat and subject rooms.</Text>
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
  giftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 8
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
