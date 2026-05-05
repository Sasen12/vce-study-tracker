import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Button, Text, TextInput } from "react-native-paper";
import { AppCard } from "@/components/ui/AppCard";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import type { StudyAnswer, UserSubject } from "@/types";

type StudyAskCardProps = {
  selectedSubject: UserSubject | null;
};

type ScreenshotAsset = {
  uri: string;
  name: string;
  mimeType?: string;
  file?: Blob;
};

const coachAnswerTag = "coach-answer";

const coachNoteTitle = (question: string) => `Coach: ${question.replace(/\s+/g, " ").trim()}`.slice(0, 140);

const coachNoteBody = (question: string, answer: StudyAnswer, screenshotCount: number) =>
  [
    "Question",
    question,
    screenshotCount ? `Screenshots attached: ${screenshotCount}` : null,
    "Answer",
    answer.answer,
    answer.key_points.length ? `Key points\n${answer.key_points.map((point) => `- ${point}`).join("\n")}` : null,
    answer.sources_used.length
      ? `Sources\n${answer.sources_used
          .map((source) => `- ${source.title}${source.detail || source.source_type ? ` (${source.detail || source.source_type})` : ""}`)
          .join("\n")}`
      : null,
    answer.follow_up_questions.length
      ? `Follow-up questions\n${answer.follow_up_questions.map((followUp) => `- ${followUp}`).join("\n")}`
      : null
  ]
    .filter(Boolean)
    .join("\n\n");

const formatSavedDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const appendScreenshot = (formData: FormData, asset: ScreenshotAsset) => {
  const webFile = Platform.OS === "web" ? asset.file : null;
  if (webFile) {
    formData.append("screenshots", webFile, asset.name);
    return;
  }

  formData.append("screenshots", {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType ?? "image/png"
  } as unknown as Blob);
};

const SourceRow = ({ title, detail }: { title: string; detail?: string }) => (
  <View style={styles.sourceRow}>
    <View style={styles.sourceDot} />
    <View style={styles.sourceText}>
      <Text style={styles.sourceTitle}>{title}</Text>
      {detail ? <Text style={styles.muted}>{detail}</Text> : null}
    </View>
  </View>
);

export function StudyAskCard({ selectedSubject }: StudyAskCardProps) {
  const askStudyQuestion = useAppStore((state) => state.askStudyQuestion);
  const createNote = useAppStore((state) => state.createNote);
  const notes = useAppStore((state) => state.notes);
  const [question, setQuestion] = useState("");
  const [screenshots, setScreenshots] = useState<ScreenshotAsset[]>([]);
  const [answer, setAnswer] = useState<StudyAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const selectedSubjectId = selectedSubject?.id ?? null;

  const coachHistory = useMemo(
    () =>
      notes.filter(
        (note) => note.tags.includes(coachAnswerTag) && (!selectedSubjectId || note.subjectId === selectedSubjectId)
      ),
    [notes, selectedSubjectId]
  );

  const addScreenshotAssets = useCallback((assets: ScreenshotAsset[]) => {
    if (!assets.length) return;
    setScreenshots((current) => {
      const next = [...current, ...assets].slice(0, 4);
      setMessage(current.length + assets.length > 4 ? "Up to 4 screenshots can be attached." : `${assets.length} screenshot${assets.length === 1 ? "" : "s"} attached.`);
      return next;
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return undefined;

    const handlePaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const files = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (!files.length) return;
      event.preventDefault();
      addScreenshotAssets(
        files.map((file, index) => ({
          uri: URL.createObjectURL(file),
          name: file.name || `pasted-screenshot-${Date.now()}-${index + 1}.png`,
          mimeType: file.type || "image/png",
          file
        }))
      );
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addScreenshotAssets]);

  const addScreenshots = async () => {
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/*"],
      multiple: true,
      copyToCacheDirectory: true
    });

    if (result.canceled) return;

    addScreenshotAssets(result.assets as ScreenshotAsset[]);
  };

  const removeScreenshot = (index: number) => {
    setScreenshots((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const ask = async () => {
    const askedQuestion = question.trim();
    if (!selectedSubject || !askedQuestion) {
      setMessage("Choose a subject and add a question.");
      return;
    }

    setAsking(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("subjectId", selectedSubject.id);
      formData.append("question", askedQuestion);
      screenshots.forEach((asset) => appendScreenshot(formData, asset));

      const nextAnswer = await askStudyQuestion(formData);
      setAnswer(nextAnswer);
      try {
        await createNote({
          subjectId: selectedSubject.id,
          title: coachNoteTitle(askedQuestion),
          body: coachNoteBody(askedQuestion, nextAnswer, screenshots.length),
          noteType: "general",
          tags: [coachAnswerTag]
        });
        setMessage("Coach answer saved.");
      } catch {
        setMessage("Answer shown, but it could not be saved.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not answer that yet.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="titleLarge" style={styles.title}>
            Ask coach
          </Text>
          <Text style={styles.muted}>{selectedSubject?.subjectName ?? "Choose a subject"}</Text>
          <Text style={styles.pasteHint}>Upload images or paste screenshots with Ctrl+V</Text>
        </View>
        <View style={[styles.confidence, answer?.confidence === "high" && styles.confidenceHigh]}>
          <Text style={styles.confidenceText}>{answer?.confidence ?? "ready"}</Text>
        </View>
      </View>

      <TextInput
        mode="outlined"
        label="Question"
        value={question}
        multiline
        numberOfLines={5}
        onChangeText={setQuestion}
      />

      {screenshots.length ? (
        <View style={styles.screenshotList}>
          {screenshots.map((asset, index) => (
            <Pressable key={`${asset.uri}-${index}`} onPress={() => removeScreenshot(index)} style={styles.screenshotPill}>
              <Text numberOfLines={1} style={styles.screenshotText}>
                {asset.name}
              </Text>
              <Text style={styles.removeText}>x</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button mode="outlined" icon="image-plus" disabled={asking || screenshots.length >= 4} onPress={addScreenshots}>
          Image
        </Button>
        <Button mode="contained" icon="send" loading={asking} disabled={asking || !selectedSubject || !question.trim()} onPress={ask}>
          Ask
        </Button>
      </View>

      {answer ? (
        <View style={styles.answerStack}>
          <Text style={styles.answer}>{answer.answer}</Text>

          {answer.key_points.length ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Key points</Text>
              {answer.key_points.map((point, index) => (
                <Text key={`${point}-${index}`} style={styles.listText}>
                  - {point}
                </Text>
              ))}
            </View>
          ) : null}

          {answer.sources_used.length ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Sources</Text>
              {answer.sources_used.slice(0, 5).map((source, index) => (
                <SourceRow key={`${source.title}-${index}`} title={source.title} detail={source.detail || source.source_type} />
              ))}
            </View>
          ) : null}

          {answer.follow_up_questions.length ? (
            <View style={styles.followUps}>
              {answer.follow_up_questions.slice(0, 3).map((followUp) => (
                <Button key={followUp} mode="text" compact onPress={() => setQuestion(followUp)}>
                  {followUp}
                </Button>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {coachHistory.length ? (
        <View style={styles.historyStack}>
          <View style={styles.historyHeader}>
            <Text style={styles.blockTitle}>Saved coach answers</Text>
            <Text style={styles.muted}>
              {coachHistory.length} saved{selectedSubject ? "" : " total"}
            </Text>
          </View>
          {coachHistory.map((note) => {
            const expanded = expandedHistoryId === note.id;
            return (
              <View key={note.id} style={styles.historyItem}>
                <View style={styles.historyRow}>
                  <View style={styles.historyText}>
                    <Text style={styles.historyTitle}>{note.title.replace(/^Coach:\s*/, "")}</Text>
                    <Text style={styles.muted}>
                      {note.subject?.subjectName ?? "General"} - {formatSavedDate(note.createdAt)}
                    </Text>
                  </View>
                  <Button
                    mode="text"
                    compact
                    icon={expanded ? "chevron-up" : "eye-outline"}
                    onPress={() => setExpandedHistoryId(expanded ? null : note.id)}
                  >
                    {expanded ? "Hide" : "View"}
                  </Button>
                </View>
                {expanded ? <Text style={styles.historyBody}>{note.body}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  headerText: {
    flex: 1
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted,
    lineHeight: 19
  },
  pasteHint: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18
  },
  confidence: {
    minWidth: 68,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.info}55`,
    backgroundColor: `${palette.info}18`,
    paddingHorizontal: 8
  },
  confidenceHigh: {
    borderColor: `${palette.success}55`,
    backgroundColor: `${palette.success}18`
  },
  confidenceText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10
  },
  screenshotList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  screenshotPill: {
    maxWidth: 210,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: 10
  },
  screenshotText: {
    flex: 1,
    color: palette.text,
    fontSize: 12
  },
  removeText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold"
  },
  answerStack: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  answer: {
    color: palette.text,
    lineHeight: 21
  },
  block: {
    gap: 8
  },
  blockTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  listText: {
    color: palette.muted,
    lineHeight: 20
  },
  sourceRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
    marginTop: 6
  },
  sourceText: {
    flex: 1
  },
  sourceTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  followUps: {
    alignItems: "flex-start",
    gap: 2
  },
  historyStack: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap"
  },
  historyItem: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  historyText: {
    flex: 1,
    minWidth: 0
  },
  historyTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  historyBody: {
    color: palette.text,
    lineHeight: 21,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    padding: 10
  },
  message: {
    color: palette.warning,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  }
});
