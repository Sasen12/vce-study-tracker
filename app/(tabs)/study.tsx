import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Button, Dialog, Portal, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { SubjectSelector } from "@/components/ui/SubjectSelector";
import { ChessBreak } from "@/components/session/ChessBreak";
import { StudyCoachPanel } from "@/components/session/StudyCoachPanel";
import { StudyMusicPanel } from "@/components/session/StudyMusicPanel";
import { StudyNotesPanel } from "@/components/session/StudyNotesPanel";
import { StudyResourcesPanel } from "@/components/session/StudyResourcesPanel";
import { palette } from "@/constants/theme";
import { MOTIVATION_MESSAGES } from "@/constants/gamification";
import { useAppStore } from "@/store/appStore";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import type { GeneratedAnswerOption, GeneratedQuestion } from "@/types";

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${secs}`;
};

const calculateXp = (seconds: number) => Math.floor(seconds / 600) * 10 + (seconds > 3600 ? 25 : 0);
const checkpointIntervalSeconds = 10 * 60;
const checkpointBonusXp = 8;

const breakPlanFor = (elapsedSeconds: number, targetSeconds: number) => {
  const plannedMinutes = Math.max(Math.round(Math.max(elapsedSeconds, targetSeconds) / 60), 1);

  if (plannedMinutes >= 70) {
    return {
      duration: "15-25 min",
      title: "Long reset",
      action: "Walk outside, eat something real, then come back for one light review.",
      tone: "Your brain has done enough heavy lifting for now."
    };
  }

  if (plannedMinutes >= 50) {
    return {
      duration: "10-15 min",
      title: "Full reset",
      action: "Stand up, refill water, stretch hips and shoulders, then do three slow breaths.",
      tone: "Protect the next block by actually stepping away."
    };
  }

  if (plannedMinutes >= 25) {
    return {
      duration: "5-10 min",
      title: "Purposeful break",
      action: "Move away from the screen, stretch wrists and neck, then review the next tiny task.",
      tone: "A clean pause beats drifting into half-work."
    };
  }

  return {
    duration: "3-5 min",
    title: "Micro reset",
    action: "Stand, breathe slowly, look away from the screen, and return to one clear question.",
    tone: "Short blocks still deserve a real reset."
  };
};

const fallbackOptions = (question: GeneratedQuestion): GeneratedAnswerOption[] => [
  { text: question.model_answer, correct: true },
  { text: "Define the key term only, without applying it to the exact scenario.", correct: false },
  { text: "Write a conclusion with no supporting evidence or subject terminology.", correct: false },
  { text: "List related facts without linking them back to the command word.", correct: false }
];

const optionsFor = (question: GeneratedQuestion): GeneratedAnswerOption[] => {
  const supplied = question.answer_options?.filter((option) => option.text.trim()) ?? [];
  const hasCorrect = supplied.some((option) => option.correct);
  const options = supplied.length >= 2 && hasCorrect ? supplied : fallbackOptions(question);
  return options.slice(0, 4);
};

const browserFullscreenSupported = () =>
  Platform.OS === "web" &&
  typeof document !== "undefined" &&
  typeof document.documentElement.requestFullscreen === "function";

const enterBrowserFullscreen = async () => {
  if (Platform.OS !== "web" || typeof document === "undefined") return "unsupported";
  if (document.fullscreenElement) return "active";
  if (!browserFullscreenSupported()) return "unsupported";

  try {
    await document.documentElement.requestFullscreen();
    return "active";
  } catch {
    return "blocked";
  }
};

const exitBrowserFullscreen = async () => {
  if (Platform.OS !== "web" || typeof document === "undefined" || !document.fullscreenElement) return;
  await document.exitFullscreen().catch(() => undefined);
};

export default function StudyScreen() {
  useTrackScreen("study");
  const params = useLocalSearchParams<{
    subjectId?: string;
    mode?: string;
    tutorTopic?: string;
    tutorGoal?: string;
    tutorEventId?: string;
    tutorEventTitle?: string;
  }>();
  const { subjects, gamification, loading, fetchAll, saveSession, timerCheckQuestion, createNote } = useAppStore();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [studyTopic, setStudyTopic] = useState("");
  const [checkInsEnabled, setCheckInsEnabled] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState("25");
  const [running, setRunning] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [timerBonusXp, setTimerBonusXp] = useState(0);
  const [nextCheckpointAt, setNextCheckpointAt] = useState(checkpointIntervalSeconds);
  const [checkpointQuestion, setCheckpointQuestion] = useState<GeneratedQuestion | null>(null);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [checkpointGenerating, setCheckpointGenerating] = useState(false);
  const [selectedCheckpointOption, setSelectedCheckpointOption] = useState<string | null>(null);
  const [checkpointResult, setCheckpointResult] = useState<"correct" | "wrong" | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [mode, setMode] = useState("coach");
  const [focusMode, setFocusMode] = useState(false);
  const scale = useSharedValue(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalFullscreenExitRef = useRef(false);
  const fullscreenLockActiveRef = useRef(false);

  const releaseFocusLock = useCallback(() => {
    fullscreenLockActiveRef.current = false;
    intentionalFullscreenExitRef.current = true;
    void exitBrowserFullscreen().finally(() => {
      intentionalFullscreenExitRef.current = false;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  useEffect(() => {
    if (params.subjectId) {
      setSelectedSubjectId(params.subjectId);
    } else if (!selectedSubjectId && subjects[0]) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [params.subjectId, selectedSubjectId, subjects]);

  useEffect(() => {
    if (params.mode === "coach") {
      setMode("coach");
    }
  }, [params.mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((value) => {
          const next = value + 1;
          if (next % 60 === 0) {
            scale.value = withSequence(withTiming(1.035, { duration: 120 }), withTiming(1, { duration: 180 }));
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      cancelAnimation(scale);
    };
  }, [running, scale]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return undefined;

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return;
      if (intentionalFullscreenExitRef.current) {
        intentionalFullscreenExitRef.current = false;
        return;
      }
      if (!fullscreenLockActiveRef.current) return;
      fullscreenLockActiveRef.current = false;
      if (running) {
        setRunning(false);
        setMessage("Focus lock paused because fullscreen was exited. Press Start to lock back in.");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden" || !running || !fullscreenLockActiveRef.current) return;
      setRunning(false);
      setMessage("Focus lock paused because the tab lost focus. Press Start to lock back in.");
      releaseFocusLock();
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!running) return;
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [releaseFocusLock, running]);

  useEffect(() => {
    return () => {
      releaseFocusLock();
    };
  }, [releaseFocusLock]);

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const trimmedStudyTopic = studyTopic.trim();
  const checkInsActive = checkInsEnabled && Boolean(trimmedStudyTopic);
  const timerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const xp = calculateXp(elapsed) + timerBonusXp;
  const targetSeconds = Number(targetMinutes) * 60;
  const targetProgress = targetSeconds ? Math.min(100, Math.round((elapsed / targetSeconds) * 100)) : 0;
  const remainingSeconds = Math.max(0, targetSeconds - elapsed);
  const overtimeSeconds = Math.max(0, elapsed - targetSeconds);
  const countdownLabel =
    elapsed >= targetSeconds && elapsed > 0 ? `+${formatElapsed(overtimeSeconds)} over target` : formatElapsed(remainingSeconds);
  const breakPlan = useMemo(() => breakPlanFor(elapsed, targetSeconds), [elapsed, targetSeconds]);
  const breakReady = elapsed >= targetSeconds && elapsed > 0;

  const statusLabel = useMemo(() => {
    if (!selectedSubject) return "Choose a subject";
    if (running) return `Focusing on ${selectedSubject.subjectName}${trimmedStudyTopic ? ` - ${trimmedStudyTopic}` : ""}`;
    if (elapsed > 0) return "Paused";
    return "Ready when you are";
  }, [elapsed, running, selectedSubject, trimmedStudyTopic]);

  const checkpointOptions = useMemo(
    () => (checkpointQuestion ? optionsFor(checkpointQuestion) : []),
    [checkpointQuestion]
  );
  const minutesUntilCheckpoint = Math.max(0, Math.ceil((nextCheckpointAt - elapsed) / 60));

  const askCheckpoint = useCallback(async () => {
    if (!selectedSubject || !checkInsActive || checkpointGenerating || checkpointOpen) return;
    setCheckpointGenerating(true);
    try {
      const question = await timerCheckQuestion({
        subjectId: selectedSubject.id,
        topic: trimmedStudyTopic,
        difficulty: elapsed >= 30 * 60 ? "hard" : elapsed >= 15 * 60 ? "medium" : "easy"
      });
      setCheckpointQuestion(question);
      setSelectedCheckpointOption(null);
      setCheckpointResult(null);
      setCheckpointOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate a timer check-in.");
      setNextCheckpointAt((value) => value + checkpointIntervalSeconds);
    } finally {
      setCheckpointGenerating(false);
    }
  }, [checkInsActive, checkpointGenerating, checkpointOpen, elapsed, selectedSubject, timerCheckQuestion, trimmedStudyTopic]);

  useEffect(() => {
    if (!running || !checkInsActive || checkpointOpen || checkpointGenerating || elapsed < nextCheckpointAt) return;
    askCheckpoint();
  }, [askCheckpoint, checkInsActive, checkpointGenerating, checkpointOpen, elapsed, nextCheckpointAt, running]);

  const changeMode = (value: string) => {
    setMode(value);
  };

  const applyFocusLock = useCallback(async () => {
    const fullscreenResult = await enterBrowserFullscreen();
    fullscreenLockActiveRef.current = fullscreenResult === "active";
    if (fullscreenResult === "blocked") {
      return "Focus lock was blocked, but the timer is still running.";
    }
    if (fullscreenResult === "unsupported") {
      return "This browser cannot use fullscreen focus lock, but the timer is still running.";
    }
    return null;
  }, []);

  const toggleFocusMode = async () => {
    const nextFocusMode = !focusMode;
    setFocusMode(nextFocusMode);
    if (!nextFocusMode) {
      releaseFocusLock();
      setMessage(running ? "Focus lock off. Timer keeps running while you move around the app." : null);
      return;
    }
    if (running) {
      const focusLockMessage = await applyFocusLock();
      setMessage(focusLockMessage ?? "Focus lock on. Use Show tools when you need Coach or other study tools.");
    }
  };

  const start = async () => {
    if (!selectedSubject) return;
    setStarting(true);
    if (elapsed === 0) {
      setTimerBonusXp(0);
      setNextCheckpointAt(checkpointIntervalSeconds);
      setCheckpointQuestion(null);
      setCheckpointOpen(false);
      setSelectedCheckpointOption(null);
      setCheckpointResult(null);
    }
    setMode("timer");
    setRunning(true);
    try {
      const focusLockMessage = focusMode ? await applyFocusLock() : null;
      if (!focusMode) {
        fullscreenLockActiveRef.current = false;
      }
      const movementMessage = focusMode ? null : "Timer is running in the background. You can switch to Coach, Notes or Files.";
      const checkInMessage = checkInsActive ? null : "Check-ins are off for this session.";
      setMessage([focusLockMessage, movementMessage, checkInMessage].filter(Boolean).join(" ") || null);
    } finally {
      setStarting(false);
    }
  };

  const pause = () => {
    setRunning(false);
    releaseFocusLock();
  };

  const stop = () => {
    setRunning(false);
    releaseFocusLock();
    if (elapsed >= 60) {
      setSummaryError(null);
      setSummaryOpen(true);
    } else {
      setElapsed(0);
      setMessage("Log at least one minute to keep the streak alive.");
    }
  };

  const confirmSave = async () => {
    if (!selectedSubject) return;
    setSaving(true);
    setSummaryError(null);
    const previousLevel = gamification?.level ?? 1;
    const topic = studyTopic.trim();
    const typedNotes = notes.trim();
    const sessionNotes = [
      topic ? `Topic: ${topic}` : "",
      typedNotes,
      timerBonusXp ? `Timer check bonus: ${timerBonusXp} XP` : ""
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await saveSession({
        subjectId: selectedSubject.id,
        durationSeconds: elapsed,
        notes: sessionNotes || null,
        bonusXp: timerBonusXp
      });

      let noteMirrorError: string | null = null;
      if (typedNotes) {
        try {
          await createNote({
            subjectId: selectedSubject.id,
            title: `Session notes: ${topic || selectedSubject.subjectName}`.slice(0, 140),
            noteType: "general",
            tags: ["session-summary"],
            body: [
              `${formatElapsed(elapsed)} focused on ${selectedSubject.subjectName}.`,
              topic ? `Topic: ${topic}` : "",
              typedNotes
            ]
              .filter(Boolean)
              .join("\n\n")
          });
        } catch (error) {
          noteMirrorError = error instanceof Error ? error.message : "Could not copy notes into Saved notes.";
        }
      }

      const nextLevel = useAppStore.getState().gamification?.level ?? previousLevel;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (nextLevel > previousLevel) setConfettiKey((key) => key + 1);
      setMessage(noteMirrorError ?? MOTIVATION_MESSAGES[Math.floor(Math.random() * MOTIVATION_MESSAGES.length)]);
      setSummaryOpen(false);
      setElapsed(0);
      setStudyTopic("");
      setNotes("");
      setTimerBonusXp(0);
      setNextCheckpointAt(checkpointIntervalSeconds);
      setCheckpointQuestion(null);
      setCheckpointOpen(false);
      setSelectedCheckpointOption(null);
      setCheckpointResult(null);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Could not save this study session.");
    } finally {
      setSaving(false);
    }
  };

  const answerCheckpoint = async (option: GeneratedAnswerOption) => {
    if (!checkpointQuestion || selectedCheckpointOption) return;
    setSelectedCheckpointOption(option.text);
    setCheckpointResult(option.correct ? "correct" : "wrong");
    setNextCheckpointAt((value) => value + checkpointIntervalSeconds);

    if (option.correct) {
      setTimerBonusXp((value) => value + checkpointBonusXp);
      setMessage(`Nice. +${checkpointBonusXp} bonus XP for the timer check-in.`);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (selectedSubject) {
      try {
        await createNote({
          subjectId: selectedSubject.id,
          title: `Timer gap: ${studyTopic.trim() || checkpointQuestion.topic}`,
          noteType: "mistake_log",
          tags: ["timer-check", "roadmap"],
          body: `Question:\n${checkpointQuestion.question}\n\nYour selected answer:\n${option.text}\n\nModel answer:\n${checkpointQuestion.model_answer}\n\nFix for the roadmap:\nReview ${studyTopic.trim() || checkpointQuestion.topic}, make one clean note, then do two similar questions.`
        });
        setMessage("Missed check-in saved as a mistake-log note for the roadmap.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Missed check-in, but the note could not be saved.");
      }
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const closeCheckpoint = () => {
    setCheckpointOpen(false);
    setCheckpointQuestion(null);
    setSelectedCheckpointOption(null);
    setCheckpointResult(null);
  };

  if (loading && !subjects.length) {
    return (
      <Screen>
        <SkeletonStack />
      </Screen>
    );
  }

  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>Study timer</Text>
        <Text variant="headlineLarge" style={styles.title}>
          Deep work mode
        </Text>
      </View>

      {running && focusMode ? (
        <AppCard style={styles.focusBanner}>
          <View style={styles.focusBannerText}>
            <Text style={styles.cardTitle}>Focus filter is on</Text>
            <Text style={styles.muted}>Chat, shop-style distractions and extra study tools are hidden until you pause or switch it off.</Text>
          </View>
          <Button mode="outlined" icon="eye-outline" onPress={() => void toggleFocusMode()}>
            Show tools
          </Button>
        </AppCard>
      ) : (
        <SegmentedButtons
          value={mode}
          onValueChange={changeMode}
          buttons={[
            { value: "timer", label: "Timer" },
            { value: "coach", label: "Coach" },
            { value: "notes", label: "Notes" },
            { value: "resources", label: "Files" },
            { value: "chess", label: "Chess" }
          ]}
        />
      )}

      {running && mode !== "timer" ? (
        <AppCard style={styles.runningTimerBanner}>
          <View style={styles.runningTimerText}>
            <Text style={styles.cardTitle}>Timer running</Text>
            <Text style={styles.muted}>
              {formatElapsed(elapsed)} on {selectedSubject?.subjectName ?? "study"}
              {trimmedStudyTopic ? ` - ${trimmedStudyTopic}` : ""}
            </Text>
          </View>
          <View style={styles.runningTimerActions}>
            <Button mode="contained-tonal" compact icon="timer-outline" onPress={() => setMode("timer")}>
              Timer
            </Button>
            <Button mode="outlined" compact icon="pause" onPress={pause}>
              Pause
            </Button>
          </View>
        </AppCard>
      ) : null}

      {mode === "coach" ? (
        <StudyCoachPanel
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={(subject) => setSelectedSubjectId(subject.id)}
          initialTutorTopic={params.tutorTopic}
          initialTutorGoal={params.tutorGoal}
          initialTutorEventId={params.tutorEventId}
          initialTutorEventTitle={params.tutorEventTitle}
        />
      ) : null}

      {mode === "notes" ? (
        <StudyNotesPanel
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={(subject) => setSelectedSubjectId(subject.id)}
        />
      ) : null}

      {mode === "resources" ? (
        <StudyResourcesPanel
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={(subject) => setSelectedSubjectId(subject.id)}
        />
      ) : null}

      {mode === "chess" ? <ChessBreak /> : null}

      {mode === "timer" ? (
        <>
          {subjects.length ? (
            <SubjectSelector
              subjects={subjects}
              selectedId={selectedSubjectId}
              onSelect={(subject) => setSelectedSubjectId(subject.id)}
            />
          ) : (
            <EmptyState title="No subjects found" body="Add a subject from Profile, then your sessions can earn XP." />
          )}

          <AppCard style={styles.timerCard}>
            <Text style={styles.status}>{statusLabel}</Text>
            <TextInput
              mode="outlined"
              label="Topic for this session (optional)"
              value={studyTopic}
              onChangeText={setStudyTopic}
              disabled={running}
              style={styles.topicInput}
              textColor={palette.text}
            />
            <View style={styles.checkInRow}>
              <View style={styles.checkInText}>
                <Text style={styles.checkInTitle}>Check-in questions</Text>
                <Text style={styles.checkInStatus}>
                  {checkInsActive ? `On - ${trimmedStudyTopic}` : checkInsEnabled ? "Waiting for a topic" : "Off for this session"}
                </Text>
              </View>
              <Switch
                value={checkInsEnabled}
                disabled={running}
                onValueChange={setCheckInsEnabled}
                color={palette.primary}
              />
            </View>
            <View style={styles.targetBlock}>
              <Text style={styles.targetLabel}>Target length</Text>
              <SegmentedButtons
                value={targetMinutes}
                onValueChange={setTargetMinutes}
                buttons={[
                  { value: "25", label: "25m" },
                  { value: "50", label: "50m" },
                  { value: "75", label: "75m" }
                ]}
              />
            </View>
            <Animated.View style={timerStyle}>
              <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
            </Animated.View>
            <View style={styles.targetTrack}>
              <View style={[styles.targetFill, { width: `${targetProgress}%` }]} />
            </View>
            <View style={styles.countdownRow}>
              <Text style={styles.countdownLabel}>{elapsed >= targetSeconds && elapsed > 0 ? "Over target" : "Time remaining"}</Text>
              <Text style={styles.countdownValue}>{countdownLabel}</Text>
            </View>
            <View style={styles.timerMetaRow}>
              <Text style={styles.xp}>{xp} XP estimated</Text>
              <Text style={styles.progressPill}>{targetProgress}% target</Text>
              {timerBonusXp ? <Text style={styles.bonusPill}>+{timerBonusXp} check-in XP</Text> : null}
            </View>
            <Button
              mode={focusMode ? "contained-tonal" : "outlined"}
              compact
              icon={focusMode ? "eye-off-outline" : "eye-outline"}
              onPress={() => void toggleFocusMode()}
            >
              {focusMode ? "Focus filter on" : "Focus filter"}
            </Button>
            {elapsed >= targetSeconds && elapsed > 0 ? <Text style={styles.targetReached}>Target reached. Save now or keep going.</Text> : null}
            {running ? (
              <Text style={styles.checkInMeta}>
                {checkInsActive
                  ? checkpointGenerating
                    ? "Building check-in..."
                    : `Next check-in in ${minutesUntilCheckpoint} min`
                  : "Check-ins off for this session"}
              </Text>
            ) : null}

            <View style={styles.controls}>
              {!running ? (
                <Button mode="contained" icon="play" loading={starting} disabled={!selectedSubject || starting} onPress={start}>
                  Start
                </Button>
              ) : (
                <Button mode="contained-tonal" icon="pause" onPress={pause}>
                  Pause
                </Button>
              )}
              <Button
                mode="outlined"
                icon="help-circle"
                loading={checkpointGenerating}
                disabled={!selectedSubject || !checkInsActive || checkpointGenerating || checkpointOpen}
                onPress={askCheckpoint}
              >
                Ask now
              </Button>
              <Button mode="outlined" icon="stop" disabled={elapsed === 0} onPress={stop}>
                Stop
              </Button>
            </View>
          </AppCard>

          <StudyMusicPanel />

          <AppCard style={[styles.breakCard, breakReady && styles.breakCardReady]}>
            <View style={styles.breakHeader}>
              <View style={styles.breakHeaderText}>
                <Text style={styles.breakTitle}>{breakReady ? breakPlan.title : "Planned reset"}</Text>
                <Text style={styles.muted}>{breakPlan.tone}</Text>
              </View>
              <Text style={styles.breakDuration}>{breakPlan.duration}</Text>
            </View>
            <Text style={styles.breakAction}>{breakPlan.action}</Text>
            <Button
              mode={breakReady ? "contained" : "outlined"}
              compact
              icon="meditation"
              onPress={() => setMessage(`Reset done: ${breakPlan.action}`)}
            >
              Mark reset
            </Button>
          </AppCard>

          {message ? (
            <AppCard style={styles.messageCard}>
              <Text style={styles.message}>{message}</Text>
            </AppCard>
          ) : null}

          <AppCard>
            <Text variant="titleMedium" style={styles.cardTitle}>
              XP rules
            </Text>
            <Text style={styles.muted}>10 XP per 10 minutes, plus 25 XP for sessions over an hour.</Text>
          </AppCard>
        </>
      ) : null}

      {confettiKey > 0 ? <ConfettiCannon key={confettiKey} count={90} origin={{ x: 200, y: 0 }} fadeOut /> : null}

      <Portal>
        <Dialog visible={summaryOpen} onDismiss={() => setSummaryOpen(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Session summary</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.summaryLine}>{formatElapsed(elapsed)} focused</Text>
            <Text style={styles.summaryLine}>{xp} XP earned</Text>
            {timerBonusXp ? <Text style={styles.summaryBonus}>Includes {timerBonusXp} XP from timer check-ins</Text> : null}
            <TextInput
              mode="outlined"
              label="Notes"
              value={notes}
              multiline
              numberOfLines={3}
              onChangeText={setNotes}
            />
            {summaryError ? <Text style={styles.summaryError}>{summaryError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSummaryOpen(false)}>Cancel</Button>
            <Button mode="contained" loading={saving} disabled={saving || !selectedSubject} onPress={confirmSave}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={checkpointOpen && Boolean(checkpointQuestion)}
          onDismiss={() => {
            if (selectedCheckpointOption) closeCheckpoint();
          }}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Timer check-in</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {checkpointQuestion ? (
              <>
                <Text style={styles.checkpointTopic}>{checkpointQuestion.topic}</Text>
                <Text style={styles.checkpointQuestion}>{checkpointQuestion.question}</Text>
                <View style={styles.checkpointOptions}>
                  {checkpointOptions.map((option) => {
                    const wasSelected = selectedCheckpointOption === option.text;
                    const showResult = Boolean(selectedCheckpointOption);
                    return (
                      <Pressable
                        key={option.text}
                        disabled={showResult}
                        onPress={() => answerCheckpoint(option)}
                        style={[
                          styles.checkpointOption,
                          showResult && option.correct ? styles.checkpointOptionCorrect : null,
                          wasSelected && !option.correct ? styles.checkpointOptionWrong : null
                        ]}
                      >
                        <Text style={styles.checkpointOptionText}>{option.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {checkpointResult ? (
                  <View style={styles.checkpointResult}>
                    <Text style={checkpointResult === "correct" ? styles.resultCorrect : styles.resultWrong}>
                      {checkpointResult === "correct" ? `Correct. +${checkpointBonusXp} XP` : "Saved to Saved notes."}
                    </Text>
                    <Text style={styles.modelAnswer}>{checkpointQuestion.model_answer}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={!selectedCheckpointOption} onPress={closeCheckpoint}>
              Continue
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    marginBottom: 4
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  focusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderColor: `${palette.success}44`,
    backgroundColor: `${palette.success}10`
  },
  focusBannerText: {
    flex: 1,
    minWidth: 0
  },
  runningTimerBanner: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderColor: `${palette.primary}44`,
    backgroundColor: `${palette.primary}10`
  },
  runningTimerText: {
    flex: 1,
    minWidth: 0
  },
  runningTimerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
  },
  timerCard: {
    alignItems: "center",
    gap: 18,
    paddingVertical: 32
  },
  topicInput: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: palette.surface
  },
  checkInRow: {
    width: "100%",
    maxWidth: 520,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  checkInText: {
    flex: 1,
    minWidth: 0
  },
  checkInTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  checkInStatus: {
    color: palette.muted,
    fontSize: 12
  },
  targetBlock: {
    width: "100%",
    maxWidth: 520,
    gap: 8
  },
  targetLabel: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  status: {
    color: palette.muted
  },
  timer: {
    color: palette.text,
    fontSize: 72,
    lineHeight: 82,
    fontFamily: "Outfit_700Bold"
  },
  targetTrack: {
    width: "100%",
    maxWidth: 520,
    height: 10,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  targetFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: palette.primary
  },
  countdownRow: {
    width: "100%",
    maxWidth: 520,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  countdownLabel: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  countdownValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  xp: {
    color: palette.success,
    fontFamily: "Outfit_700Bold"
  },
  timerMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  bonusPill: {
    color: palette.text,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.success}55`,
    backgroundColor: `${palette.success}18`,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  progressPill: {
    color: palette.text,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  targetReached: {
    color: palette.success,
    fontFamily: "Outfit_700Bold"
  },
  checkInMeta: {
    color: palette.muted,
    fontSize: 12
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12
  },
  breakCard: {
    gap: 12,
    borderColor: `${palette.info}44`,
    backgroundColor: `${palette.info}10`
  },
  breakCardReady: {
    borderColor: `${palette.success}55`,
    backgroundColor: `${palette.success}12`
  },
  breakHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  breakHeaderText: {
    flex: 1,
    minWidth: 0
  },
  breakTitle: {
    color: palette.text,
    fontSize: 18,
    fontFamily: "Outfit_700Bold"
  },
  breakDuration: {
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.info}55`,
    backgroundColor: `${palette.info}16`,
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  breakAction: {
    color: palette.text,
    lineHeight: 20
  },
  messageCard: {
    borderColor: `${palette.success}55`,
    backgroundColor: `${palette.success}12`
  },
  message: {
    color: palette.text,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    marginBottom: 6
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  dialog: {
    backgroundColor: palette.surface
  },
  dialogTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  dialogContent: {
    gap: 12
  },
  summaryLine: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  summaryBonus: {
    color: palette.success,
    fontFamily: "Outfit_700Bold"
  },
  summaryError: {
    color: palette.warning,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  },
  checkpointTopic: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  checkpointQuestion: {
    color: palette.text,
    lineHeight: 21
  },
  checkpointOptions: {
    gap: 10
  },
  checkpointOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    padding: 12
  },
  checkpointOptionCorrect: {
    borderColor: `${palette.success}AA`,
    backgroundColor: `${palette.success}18`
  },
  checkpointOptionWrong: {
    borderColor: `${palette.secondary}AA`,
    backgroundColor: `${palette.secondary}18`
  },
  checkpointOptionText: {
    color: palette.text,
    lineHeight: 20
  },
  checkpointResult: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  resultCorrect: {
    color: palette.success,
    fontFamily: "Outfit_700Bold"
  },
  resultWrong: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold"
  },
  modelAnswer: {
    color: palette.muted,
    lineHeight: 20
  }
});
