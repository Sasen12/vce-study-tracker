import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, IconButton, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { palette } from "@/constants/theme";
import { studyApi } from "@/services/studyApi";
import { useAppStore } from "@/store/appStore";
import type { ChatAllowance, CommunityChatMessage, CommunityUserSummary, LeaderboardEntry, UserFeedback } from "@/types";

type Mode = "chat" | "leaderboard" | "feedback" | "users";
type FeedbackCategory = UserFeedback["category"];

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

const formatWeekRange = (start?: string, end?: string) => {
  if (!start || !end) return "This week";
  const formatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1);
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
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
          {entry.weekMinutes} min - {entry.sessionCount} sessions - level {entry.level}
        </Text>
      </View>
      <Text style={styles.leaderboardXp}>{entry.weekXp} XP</Text>
    </View>
  );
}

function UserRow({ item }: { item: CommunityUserSummary }) {
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
      <Text style={styles.mutedSmall}>Joined {formatTime(item.createdAt)}</Text>
      <View style={styles.userStats}>
        <Text style={styles.userStat}>Level {item.level}</Text>
        <Text style={styles.userStat}>{item.totalXp} XP</Text>
        <Text style={styles.userStat}>{item.sessionCount} sessions</Text>
        <Text style={styles.userStat}>{item.subjectCount} subjects</Text>
        <Text style={styles.userStat}>{item.feedbackCount} feedback</Text>
        <Text style={styles.userStat}>{item.chatMessageCount} chats</Text>
      </View>
    </View>
  );
}

export default function CommunityScreen() {
  const { gamification, leaderboard, fetchAll, setLeaderboardPreference } = useAppStore();
  const [mode, setMode] = useState<Mode>("chat");
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [chat, setChat] = useState<CommunityChatMessage[]>([]);
  const [users, setUsers] = useState<CommunityUserSummary[]>([]);
  const [allowance, setAllowance] = useState<ChatAllowance | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [leaderboardSaving, setLeaderboardSaving] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCommunity();
      fetchAll();
    }, [fetchAll, loadCommunity])
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

  const leaderboardEntries = leaderboard?.entries ?? [];
  const topThree = leaderboardEntries.slice(0, 3);
  const viewerRank = leaderboard?.viewer?.rank;

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
        onValueChange={(value) => setMode(value as Mode)}
        buttons={[
          { value: "chat", label: "Student chat", icon: "chat-outline" },
          { value: "leaderboard", label: "Leaderboard", icon: "trophy-outline" },
          { value: "feedback", label: isAdmin ? "Feedback inbox" : "Direct feedback", icon: "inbox-arrow-up" },
          ...(isAdmin ? [{ value: "users", label: "Users", icon: "account-group-outline" }] : [])
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
                <UserRow key={item.id} item={item} />
              ))}
            </View>
          ) : (
            <EmptyState title="No users yet" body="Registered students will appear here." />
          )}
        </AppCard>
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
                    : "Join when you want your weekly XP to count against other opted-in students."}
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
            <Text style={styles.muted}>
              {formatWeekRange(leaderboard?.weekStart, leaderboard?.weekEnd)} - shows display name, weekly XP, weekly
              minutes and session count.
            </Text>
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
                  <Text style={styles.muted}>{entry.weekMinutes} min</Text>
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
      )}
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
  formCard: {
    gap: 12
  },
  leaderboardStatusCard: {
    gap: 12
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
  userStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
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
  }
});
