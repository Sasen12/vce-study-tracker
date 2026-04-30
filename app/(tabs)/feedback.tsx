import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { palette } from "@/constants/theme";
import { studyApi } from "@/services/studyApi";
import type { ChatAllowance, CommunityChatMessage, UserFeedback } from "@/types";

type Mode = "feedback" | "chat";
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

function ChatBubble({ item }: { item: CommunityChatMessage }) {
  return (
    <View style={[styles.chatBubble, item.isCurrentUser && styles.chatBubbleMine]}>
      <View style={styles.chatMeta}>
        <Text style={styles.chatName}>{item.user.displayName}</Text>
        <Text style={styles.mutedSmall}>{formatTime(item.createdAt)}</Text>
      </View>
      <Text style={styles.chatText}>{item.message}</Text>
    </View>
  );
}

function FeedbackItem({ item }: { item: UserFeedback }) {
  return (
    <View style={styles.feedbackItem}>
      <View style={styles.feedbackHeader}>
        <Text style={styles.feedbackCategory}>{categoryCopy[item.category]}</Text>
        <Text style={styles.mutedSmall}>{formatTime(item.createdAt)}</Text>
      </View>
      <Text style={styles.feedbackMessage}>{item.message}</Text>
    </View>
  );
}

export default function FeedbackScreen() {
  const [mode, setMode] = useState<Mode>("feedback");
  const [feedback, setFeedback] = useState<UserFeedback[]>([]);
  const [chat, setChat] = useState<CommunityChatMessage[]>([]);
  const [allowance, setAllowance] = useState<ChatAllowance | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [chatMessage, setChatMessage] = useState("");

  const loadCommunity = useCallback(async () => {
    setError(null);
    try {
      const data = await studyApi.community();
      setFeedback(data.feedback);
      setChat(data.chat);
      setAllowance(data.allowance);
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
    }, [loadCommunity])
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
      setNotice("Sent. I will see this in the database.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send feedback");
    } finally {
      setSending(false);
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
            Feedback
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
          { value: "feedback", label: "Direct feedback", icon: "inbox-arrow-up" },
          { value: "chat", label: "Student chat", icon: "chat-outline" }
        ]}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {mode === "feedback" ? (
        <>
          <AppCard style={styles.formCard}>
            <Text style={styles.cardTitle}>Send something in</Text>
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
                  <ChatBubble key={item.id} item={item} />
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
    gap: 12
  },
  feedbackCategory: {
    color: palette.primary,
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
    gap: 10
  },
  chatName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  chatText: {
    color: palette.text,
    lineHeight: 20
  }
});
