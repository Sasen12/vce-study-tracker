import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { palette } from "@/constants/theme";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import {
  DEFAULT_STUDY_PREFERENCES,
  loadStudyPreferences,
  subscribeStudyPreferences,
  type StudyPreferences
} from "@/utils/studyPreferences";
import type { StudyAnswer } from "@/types";

type PixelCell = [number, number, string];

const dark = "#06101E";
const blue = "#2563EB";
const lightBlue = "#60A5FA";
const orange = "#F59E0B";
const gold = "#FBBF24";
const cream = "#FFF7E6";

const birdCells = (wingUp: boolean): PixelCell[] => [
  [2, 0, dark],
  [3, 0, dark],
  [4, 0, dark],
  [1, 1, dark],
  [2, 1, blue],
  [3, 1, lightBlue],
  [4, 1, blue],
  [5, 1, dark],
  [0, 2, dark],
  [1, 2, blue],
  [2, 2, blue],
  [3, 2, dark],
  [4, 2, blue],
  [5, 2, blue],
  [6, 2, dark],
  [7, 2, dark],
  [8, 2, dark],
  [0, 3, dark],
  [1, 3, blue],
  [2, 3, blue],
  [3, 3, blue],
  [4, 3, blue],
  [5, 3, blue],
  [6, 3, blue],
  [7, 3, blue],
  [8, 3, blue],
  [9, 3, dark],
  [1, 4, dark],
  [2, 4, orange],
  [3, 4, orange],
  [4, 4, blue],
  [5, 4, blue],
  [6, 4, blue],
  [7, 4, dark],
  [2, 5, dark],
  [3, 5, orange],
  [4, 5, gold],
  [5, 5, dark],
  [6, 5, dark],
  [3, 6, dark],
  [4, 6, dark],
  [3, 7, dark],
  [5, 7, dark],
  ...(wingUp
    ? [
        [4, 0, lightBlue],
        [5, 0, dark],
        [6, 0, dark],
        [5, 1, blue]
      ]
    : [
        [5, 5, blue],
        [6, 5, blue],
        [7, 5, dark]
      ]),
  [3, 2, cream]
];

function PixelBird({ wingUp }: { wingUp: boolean }) {
  const size = 5;
  return (
    <View style={[styles.pixelBird, { width: 11 * size, height: 8 * size }]}>
      {birdCells(wingUp).map(([x, y, color], index) => (
        <View
          key={`${x}-${y}-${color}-${index}`}
          style={[
            styles.pixel,
            {
              left: x * size,
              top: y * size,
              width: size,
              height: size,
              backgroundColor: color
            }
          ]}
        />
      ))}
    </View>
  );
}

const compactAnswer = (answer: StudyAnswer) =>
  [
    answer.answer,
    answer.key_points.length ? `Key points:\n${answer.key_points.map((point) => `- ${point}`).join("\n")}` : null,
    answer.follow_up_questions.length
      ? `Follow-up:\n${answer.follow_up_questions.map((question) => `- ${question}`).join("\n")}`
      : null
  ]
    .filter(Boolean)
    .join("\n\n");

export function ForgeMascot() {
  const activePalette = useActivePalette();
  const userId = useAuthStore((state) => state.user?.id);
  const subjects = useAppStore((state) => state.subjects);
  const askStudyQuestion = useAppStore((state) => state.askStudyQuestion);
  const createNote = useAppStore((state) => state.createNote);
  const { width } = useWindowDimensions();
  const flyX = useSharedValue(0);
  const [preferences, setPreferences] = useState<StudyPreferences>(DEFAULT_STUDY_PREFERENCES);
  const [open, setOpen] = useState(false);
  const [flying, setFlying] = useState(false);
  const [wingUp, setWingUp] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<StudyAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadStudyPreferences(userId).then((loaded) => {
      if (active) setPreferences(loaded);
    });
    const unsubscribe = subscribeStudyPreferences((nextPreferences) => setPreferences(nextPreferences));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedSubjectId && subjects[0]) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    if (!preferences.mascotEnabled) return;
    const interval = setInterval(() => setWingUp((value) => !value), 360);
    return () => clearInterval(interval);
  }, [preferences.mascotEnabled]);

  useEffect(() => {
    if (!preferences.mascotEnabled || open || width < 720) return;

    const fly = () => {
      if (open) return;
      setFlying(true);
      flyX.value = width + 120;
      flyX.value = withTiming(-width - 140, { duration: 5200, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) {
          flyX.value = 0;
          runOnJS(setFlying)(false);
        }
      });
    };

    const firstFlight = setTimeout(fly, 24_000);
    const interval = setInterval(fly, 68_000);
    return () => {
      clearTimeout(firstFlight);
      clearInterval(interval);
    };
  }, [flyX, open, preferences.mascotEnabled, width]);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: flyX.value }, { translateY: flying ? -26 : 0 }]
  }));

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0] ?? null,
    [selectedSubjectId, subjects]
  );

  const ask = async () => {
    const prompt = question.trim();
    if (!prompt) {
      setMessage("Ask one clear question first.");
      return;
    }

    setAsking(true);
    setMessage(null);
    setAnswer(null);
    try {
      const formData = new FormData();
      if (selectedSubject?.id) formData.append("subjectId", selectedSubject.id);
      formData.append("question", prompt);
      formData.append("responseMode", "direct");
      const nextAnswer = await askStudyQuestion(formData);
      setAnswer(nextAnswer);
      setMessage("Answered. Saved as a quick coach note.");
      try {
        await createNote({
          subjectId: selectedSubject?.id ?? null,
          title: `Quick ask: ${prompt}`.slice(0, 140),
          body: compactAnswer(nextAnswer),
          noteType: "general",
          tags: ["coach-answer", "quick-ask"]
        });
      } catch {
        setMessage("Answered, but the note could not be saved.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not answer that yet.");
    } finally {
      setAsking(false);
    }
  };

  if (!preferences.mascotEnabled) return null;

  return (
    <>
      <Animated.View
        pointerEvents={flying ? "none" : "auto"}
        style={[styles.mascotWrap, flying && styles.mascotFlying, mascotStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open quick ask"
          disabled={flying}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.mascotButton, pressed && styles.mascotButtonPressed]}
        >
          <PixelBird wingUp={wingUp || flying} />
        </Pressable>
      </Animated.View>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: activePalette.surface, borderColor: activePalette.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalBird}>
                  <PixelBird wingUp={wingUp} />
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.eyebrow}>Quick ask</Text>
                  <Text style={styles.modalTitle}>Ask from anywhere</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" color={palette.muted} size={22} />
              </Pressable>
            </View>

            {subjects.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
                {subjects.map((subject) => {
                  const active = subject.id === selectedSubject?.id;
                  return (
                    <Pressable
                      key={subject.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelectedSubjectId(subject.id)}
                      style={[
                        styles.subjectChip,
                        { borderColor: active ? subject.color : activePalette.border },
                        active && { backgroundColor: `${subject.color}18` }
                      ]}
                    >
                      <Text style={[styles.subjectChipText, active && { color: subject.color }]} numberOfLines={1}>
                        {subject.subjectName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <TextInput
              mode="outlined"
              label="What are you stuck on?"
              value={question}
              multiline
              numberOfLines={3}
              onChangeText={setQuestion}
            />

            {message ? <Text style={styles.message}>{message}</Text> : null}

            {answer ? (
              <ScrollView style={styles.answerBox} contentContainerStyle={styles.answerContent}>
                <Text style={styles.answerText}>{answer.answer}</Text>
                {answer.key_points.length ? (
                  <View style={styles.points}>
                    {answer.key_points.slice(0, 4).map((point) => (
                      <View key={point} style={styles.pointRow}>
                        <View style={styles.pointDot} />
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>
            ) : null}

            <View style={styles.modalActions}>
              <Button mode="text" onPress={() => setOpen(false)}>
                Close
              </Button>
              <Button mode="contained" icon="send" loading={asking} disabled={asking} onPress={ask}>
                Ask
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  mascotWrap: {
    position: "absolute",
    right: 18,
    bottom: 92,
    zIndex: 12
  },
  mascotFlying: {
    bottom: 170
  },
  mascotButton: {
    width: 66,
    height: 58,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.38)"
  },
  mascotButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }]
  },
  pixelBird: {
    position: "relative"
  },
  pixel: {
    position: "absolute"
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(2, 6, 23, 0.62)"
  },
  modalCard: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "86%",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    gap: 14
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  modalTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  modalBird: {
    width: 58,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(96, 165, 250, 0.12)"
  },
  flexText: {
    flex: 1
  },
  eyebrow: {
    color: palette.info,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    textTransform: "uppercase"
  },
  modalTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 21,
    lineHeight: 26
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.08)"
  },
  subjectRow: {
    gap: 8,
    paddingRight: 6
  },
  subjectChip: {
    minHeight: 38,
    maxWidth: 190,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  subjectChipText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold"
  },
  message: {
    color: palette.muted,
    fontSize: 14
  },
  answerBox: {
    maxHeight: 260,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    backgroundColor: "rgba(2, 6, 23, 0.22)"
  },
  answerContent: {
    padding: 12,
    gap: 12
  },
  answerText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22
  },
  points: {
    gap: 8
  },
  pointRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start"
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: palette.info
  },
  pointText: {
    flex: 1,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8
  }
});
