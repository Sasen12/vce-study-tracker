import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
import { ScientificCalculator } from "@/components/tools/ScientificCalculator";
import { STUDY_SESSION_PRESETS, type StudySessionPreset } from "@/constants/studySessionPresets";
import { palette } from "@/constants/theme";
import { MOTIVATION_MESSAGES, hasUnlockedPerk } from "@/constants/gamification";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import type { GeneratedAnswerOption, GeneratedQuestion } from "@/types";
import { loadStudyPreferences } from "@/utils/studyPreferences";
import { subjectToolProfile } from "@/utils/subjectTools";

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${secs}`;
};

const formatStudyDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const calculateXp = (seconds: number) => Math.floor(seconds / 600) * 10 + (seconds > 3600 ? 25 : 0);
const defaultCheckpointIntervalSeconds = 10 * 60;
const checkpointBonusXp = 8;

const confidenceButtons = ["1", "2", "3", "4", "5"].map((value) => ({ value, label: value }));

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
  const userId = useAuthStore((state) => state.user?.id);
  const params = useLocalSearchParams<{
    subjectId?: string;
    mode?: string;
    targetMinutes?: string;
    rescueTopic?: string;
    rescue?: string;
    tutorTopic?: string;
    tutorGoal?: string;
    tutorEventId?: string;
    tutorEventTitle?: string;
    ritualTitle?: string;
    ritualReason?: string;
    ritualSteps?: string;
  }>();
  const { subjects, sessions, stats, gamification, loading, fetchAll, saveSession, timerCheckQuestion, createNote } = useAppStore();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [studyTopic, setStudyTopic] = useState("");
  const [sessionGoal, setSessionGoal] = useState("");
  const [checkInsEnabled, setCheckInsEnabled] = useState(true);
  const [checkInIntervalMinutes, setCheckInIntervalMinutes] = useState("10");
  const [elapsed, setElapsed] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState("25");
  const [running, setRunning] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [confidenceBefore, setConfidenceBefore] = useState("3");
  const [confidenceAfter, setConfidenceAfter] = useState("3");
  const [nextAction, setNextAction] = useState("");
  const [timerBonusXp, setTimerBonusXp] = useState(0);
  const [nextCheckpointAt, setNextCheckpointAt] = useState(defaultCheckpointIntervalSeconds);
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
  const preferencesAppliedRef = useRef(false);
  const appliedRitualRef = useRef<string | null>(null);

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
    preferencesAppliedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (params.mode === "coach" || params.mode === "timer") {
      setMode(params.mode);
    }
  }, [params.mode]);

  useEffect(() => {
    if (!params.targetMinutes || running) return;
    const parsed = Number(params.targetMinutes);
    if (!Number.isFinite(parsed)) return;
    const minutes = Math.min(90, Math.max(10, Math.round(parsed)));
    setTargetMinutes(String(minutes));
  }, [params.targetMinutes, running]);

  useEffect(() => {
    if (!params.rescueTopic || running) return;
    setStudyTopic(params.rescueTopic);
    if (params.rescue === "1") {
      setMessage("Rescue mode loaded: 12 minutes, one topic, no setup spiral.");
    }
  }, [params.rescue, params.rescueTopic, running]);

  const ritualTitle = params.ritualTitle?.trim() ?? "";
  const ritualReason = params.ritualReason?.trim() ?? "";
  const ritualSteps = useMemo(() => {
    if (!params.ritualSteps) return [];
    try {
      const parsed = JSON.parse(params.ritualSteps);
      if (Array.isArray(parsed)) {
        return parsed.filter((step): step is string => typeof step === "string" && Boolean(step.trim())).map((step) => step.trim());
      }
    } catch {
      return params.ritualSteps
        .split("|")
        .map((step) => step.trim())
        .filter(Boolean);
    }
    return [];
  }, [params.ritualSteps]);

  useEffect(() => {
    if (!ritualTitle || running || appliedRitualRef.current === ritualTitle) return;
    appliedRitualRef.current = ritualTitle;
    setSessionGoal(ritualTitle);
    setCheckInsEnabled(true);
    setMessage(`${ritualTitle} loaded.`);
  }, [ritualTitle, running]);

  useEffect(() => {
    let active = true;
    const hasRouteSession = Boolean(params.targetMinutes || params.rescueTopic || params.tutorTopic || ritualTitle);
    if (preferencesAppliedRef.current || running || elapsed > 0 || hasRouteSession) return undefined;

    loadStudyPreferences(userId).then((preferences) => {
      if (!active || preferencesAppliedRef.current || running || elapsed > 0) return;
      const preset = STUDY_SESSION_PRESETS.find((item) => item.id === preferences.defaultPresetId) ?? STUDY_SESSION_PRESETS[1];
      preferencesAppliedRef.current = true;
      setTargetMinutes(String(preset.minutes));
      setCheckInsEnabled(preferences.checkInsEnabled);
      setCheckInIntervalMinutes(preferences.checkInIntervalMinutes);
      setNextCheckpointAt(Number(preferences.checkInIntervalMinutes) * 60);
      setFocusMode(preferences.focusFilterByDefault);
      setSessionGoal(preferences.defaultAim.trim() || preset.goal);
      setStudyTopic((current) => current.trim() || preset.topicHint);
    });

    return () => {
      active = false;
    };
  }, [elapsed, params.rescueTopic, params.targetMinutes, params.tutorTopic, ritualTitle, running, userId]);

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
  const checkpointIntervalSeconds = Number(checkInIntervalMinutes) * 60;
  const focusAuraUnlocked = hasUnlockedPerk(gamification?.unlockedCosmetics, "focus_aura");
  const selectedSubjectTools = useMemo(() => subjectToolProfile(selectedSubject?.subjectName), [selectedSubject?.subjectName]);
  const calculatorSubjects = useMemo(
    () => subjects.filter((subject) => subjectToolProfile(subject.subjectName).calculator),
    [subjects]
  );
  const calculatorSubject =
    selectedSubject && selectedSubjectTools.calculator ? selectedSubject : calculatorSubjects[0] ?? null;
  const studyModeButtons = useMemo(
    () => [
      { value: "timer", label: "Timer" },
      { value: "coach", label: "Coach" },
      { value: "notes", label: "Notes" },
      { value: "resources", label: "Files" },
      ...(calculatorSubjects.length ? [{ value: "calculator", label: "Calc" }] : []),
      { value: "chess", label: "Chess" }
    ],
    [calculatorSubjects.length]
  );
  useEffect(() => {
    if (mode === "calculator" && !calculatorSubjects.length) {
      setMode("timer");
    }
  }, [calculatorSubjects.length, mode]);
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
  const targetLengthButtons = useMemo(() => {
    const base = [
      { value: "25", label: "25m" },
      { value: "50", label: "50m" },
      { value: "75", label: "75m" }
    ];
    if (base.some((button) => button.value === targetMinutes)) return base;
    return [{ value: targetMinutes, label: `${targetMinutes}m` }, ...base].sort((a, b) => Number(a.value) - Number(b.value));
  }, [targetMinutes]);
  const checkInRhythmButtons = useMemo(
    () =>
      [
        { value: "8", label: "8m" },
        { value: "10", label: "10m" },
        { value: "15", label: "15m" }
      ].map((button) => ({ ...button, disabled: running })),
    [running]
  );
  const selectedSubjectContext = useMemo(() => {
    if (!selectedSubject) return null;
    const weekStart = new Date();
    const dayOffset = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - dayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const subjectSessions = sessions.filter((session) => session.subjectId === selectedSubject.id);
    const weekSeconds = subjectSessions
      .filter((session) => new Date(session.createdAt) >= weekStart)
      .reduce((sum, session) => sum + session.durationSeconds, 0);
    const bestSeconds = subjectSessions.reduce((best, session) => Math.max(best, session.durationSeconds), 0);
    const lastSession = [...subjectSessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

    return {
      weekSeconds,
      bestSeconds,
      lastSession
    };
  }, [selectedSubject, sessions]);

  useEffect(() => {
    if (!running) setNextCheckpointAt(checkpointIntervalSeconds);
  }, [checkpointIntervalSeconds, running]);

  const applySessionPreset = (preset: StudySessionPreset) => {
    if (running) return;
    const presetCheckInMinutes = preset.minutes <= 12 ? "8" : preset.minutes >= 50 ? "15" : "10";
    setTargetMinutes(String(preset.minutes));
    setCheckInsEnabled(preset.checkIns);
    setCheckInIntervalMinutes(presetCheckInMinutes);
    setNextCheckpointAt(Number(presetCheckInMinutes) * 60);
    setFocusMode(preset.focus);
    setSessionGoal(preset.goal);
    setStudyTopic((current) => current.trim() || preset.topicHint);
    setMessage(`${preset.label} loaded.`);
  };

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
  }, [
    checkInsActive,
    checkpointGenerating,
    checkpointIntervalSeconds,
    checkpointOpen,
    elapsed,
    selectedSubject,
    timerCheckQuestion,
    trimmedStudyTopic
  ]);

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
    const goal = sessionGoal.trim();
    const typedNotes = notes.trim();
    const nextStep = nextAction.trim();
    const sessionNotes = [
      topic ? `Topic: ${topic}` : "",
      goal ? `Aim: ${goal}` : "",
      typedNotes,
      `Confidence: ${confidenceBefore}/5 -> ${confidenceAfter}/5`,
      nextStep ? `Next action: ${nextStep}` : "",
      checkInsActive ? `Check-in rhythm: every ${checkInIntervalMinutes} minutes` : "Check-ins: off",
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
      if (typedNotes || goal || nextStep) {
        try {
          await createNote({
            subjectId: selectedSubject.id,
            title: `Session notes: ${topic || selectedSubject.subjectName}`.slice(0, 140),
            noteType: "general",
            tags: ["session-summary"],
            body: [
              `${formatElapsed(elapsed)} focused on ${selectedSubject.subjectName}.`,
              topic ? `Topic: ${topic}` : "",
              goal ? `Aim: ${goal}` : "",
              typedNotes || "No extra notes written.",
              nextStep ? `Next action: ${nextStep}` : "",
              `Confidence: ${confidenceBefore}/5 -> ${confidenceAfter}/5`
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
      setSessionGoal("");
      setNotes("");
      setConfidenceBefore("3");
      setConfidenceAfter("3");
      setNextAction("");
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
          buttons={studyModeButtons}
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

      {mode === "calculator" ? (
        <>
          {subjects.length ? (
            <SubjectSelector
              subjects={subjects}
              selectedId={calculatorSubject?.id ?? selectedSubjectId}
              onSelect={(subject) => setSelectedSubjectId(subject.id)}
            />
          ) : null}
          {calculatorSubject ? (
            <ScientificCalculator subjectName={calculatorSubject.subjectName} />
          ) : (
            <EmptyState title="No calculator subject selected" body="Add General Mathematics or another calculator subject from Profile." />
          )}
        </>
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

          {ritualTitle ? (
            <AppCard style={styles.ritualCard}>
              <View style={styles.ritualHeader}>
                <View style={styles.ritualMark}>
                  <MaterialCommunityIcons name="auto-fix" color={palette.primary} size={22} />
                </View>
                <View style={styles.ritualText}>
                  <Text style={styles.ritualLabel}>Forge ritual</Text>
                  <Text style={styles.ritualTitle}>{ritualTitle}</Text>
                  {ritualReason ? <Text style={styles.ritualReason}>{ritualReason}</Text> : null}
                </View>
                <Text style={styles.ritualMinutes}>{targetMinutes}m</Text>
              </View>
              {ritualSteps.length ? (
                <View style={styles.ritualSteps}>
                  {ritualSteps.map((step, index) => (
                    <View key={`${step}-${index}`} style={styles.ritualStep}>
                      <Text style={styles.ritualStepIndex}>{index + 1}</Text>
                      <Text style={styles.ritualStepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </AppCard>
          ) : null}

          <AppCard style={[styles.timerCard, focusAuraUnlocked && styles.timerCardAura]}>
            <Text style={styles.status}>{statusLabel}</Text>
            <View style={styles.presetBlock}>
              <View style={styles.presetHeader}>
                <Text style={styles.targetLabel}>Quick start</Text>
                <Text style={styles.presetHint}>Sprint, repair, drill, deep work, restart.</Text>
              </View>
              <View style={styles.presetGrid}>
                {STUDY_SESSION_PRESETS.map((preset) => {
                  const activePreset = targetMinutes === String(preset.minutes) && sessionGoal === preset.goal;
                  return (
                    <Pressable
                      key={preset.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activePreset, disabled: running }}
                      disabled={running}
                      onPress={() => applySessionPreset(preset)}
                      style={[
                        styles.presetChip,
                        { borderColor: `${preset.accent}55`, backgroundColor: `${preset.accent}10` },
                        activePreset && { borderColor: preset.accent }
                      ]}
                    >
                      <MaterialCommunityIcons name={preset.icon} color={preset.accent} size={18} />
                      <View style={styles.presetTextWrap}>
                        <Text style={styles.presetTitle} numberOfLines={1}>
                          {preset.label}
                        </Text>
                        <Text style={styles.presetMeta} numberOfLines={1}>
                          {preset.minutes}m {preset.focus ? "- focus" : "- flexible"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <TextInput
              mode="outlined"
              label="Topic for this session (optional)"
              value={studyTopic}
              onChangeText={setStudyTopic}
              disabled={running}
              style={styles.topicInput}
              textColor={palette.text}
            />
            <TextInput
              mode="outlined"
              label="Aim for this block"
              value={sessionGoal}
              onChangeText={setSessionGoal}
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
            {checkInsEnabled ? (
              <View style={styles.targetBlock}>
                <Text style={styles.targetLabel}>Check-in rhythm</Text>
                <SegmentedButtons
                  value={checkInIntervalMinutes}
                  onValueChange={setCheckInIntervalMinutes}
                  buttons={checkInRhythmButtons}
                />
              </View>
            ) : null}
            <View style={styles.targetBlock}>
              <Text style={styles.targetLabel}>Target length</Text>
              <SegmentedButtons
                value={targetMinutes}
                onValueChange={setTargetMinutes}
                buttons={targetLengthButtons}
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
              {focusAuraUnlocked ? <Text style={styles.auraPill}>Aura active</Text> : null}
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

          {selectedSubjectContext ? (
            <AppCard style={styles.contextCard}>
              <View style={styles.contextHeader}>
                <View>
                  <Text style={styles.cardTitle}>Session context</Text>
                  <Text style={styles.muted}>For {selectedSubject?.subjectName ?? "this subject"}</Text>
                </View>
                <Text style={styles.contextBadge}>{formatStudyDuration(stats?.todaySeconds ?? 0)} today</Text>
              </View>
              <View style={styles.contextGrid}>
                <View style={styles.contextTile}>
                  <Text style={styles.contextValue}>{formatStudyDuration(selectedSubjectContext.weekSeconds)}</Text>
                  <Text style={styles.contextLabel}>this subject this week</Text>
                </View>
                <View style={styles.contextTile}>
                  <Text style={styles.contextValue}>{formatStudyDuration(selectedSubjectContext.bestSeconds)}</Text>
                  <Text style={styles.contextLabel}>personal best</Text>
                </View>
                <View style={styles.contextTile}>
                  <Text style={styles.contextValue}>
                    {selectedSubjectContext.lastSession ? formatStudyDuration(selectedSubjectContext.lastSession.durationSeconds) : "0m"}
                  </Text>
                  <Text style={styles.contextLabel}>last saved block</Text>
                </View>
              </View>
            </AppCard>
          ) : null}

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
            <View style={styles.confidenceGrid}>
              <View style={styles.confidenceBlock}>
                <Text style={styles.confidenceLabel}>Before</Text>
                <SegmentedButtons
                  value={confidenceBefore}
                  onValueChange={setConfidenceBefore}
                  buttons={confidenceButtons}
                />
              </View>
              <View style={styles.confidenceBlock}>
                <Text style={styles.confidenceLabel}>After</Text>
                <SegmentedButtons
                  value={confidenceAfter}
                  onValueChange={setConfidenceAfter}
                  buttons={confidenceButtons}
                />
              </View>
            </View>
            <TextInput
              mode="outlined"
              label="Notes"
              value={notes}
              multiline
              numberOfLines={3}
              onChangeText={setNotes}
            />
            <TextInput
              mode="outlined"
              label="Next action"
              value={nextAction}
              onChangeText={setNextAction}
              placeholder="Redo one question, make a summary, ask coach..."
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
  ritualCard: {
    gap: 12,
    borderColor: "rgba(168,85,247,0.34)",
    backgroundColor: "rgba(168,85,247,0.09)"
  },
  ritualHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  ritualMark: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,85,247,0.16)"
  },
  ritualText: {
    flex: 1,
    minWidth: 0
  },
  ritualLabel: {
    color: palette.primary,
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  ritualTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 24
  },
  ritualReason: {
    color: palette.muted,
    lineHeight: 20
  },
  ritualMinutes: {
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.36)",
    backgroundColor: "rgba(168,85,247,0.14)",
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  ritualSteps: {
    gap: 8
  },
  ritualStep: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  ritualStepIndex: {
    overflow: "hidden",
    width: 22,
    borderRadius: 8,
    backgroundColor: "rgba(168,85,247,0.16)",
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
    paddingVertical: 3
  },
  ritualStepText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    lineHeight: 20
  },
  timerCard: {
    alignItems: "center",
    gap: 18,
    paddingVertical: 32
  },
  timerCardAura: {
    borderColor: "rgba(56,189,248,0.34)",
    backgroundColor: "rgba(56,189,248,0.08)"
  },
  presetBlock: {
    width: "100%",
    maxWidth: 720,
    gap: 10
  },
  presetHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  presetHint: {
    color: palette.muted,
    fontSize: 12,
    flexShrink: 1
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8
  },
  presetChip: {
    width: 132,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  presetTextWrap: {
    flex: 1,
    minWidth: 0
  },
  presetTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  presetMeta: {
    color: palette.muted,
    fontSize: 11
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
  auraPill: {
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.34)",
    backgroundColor: "rgba(56,189,248,0.12)",
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
  contextCard: {
    gap: 12,
    borderColor: `${palette.primary}33`,
    backgroundColor: `${palette.primary}08`
  },
  contextHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  contextBadge: {
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.success}44`,
    backgroundColor: `${palette.success}12`,
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  contextGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  contextTile: {
    minWidth: 126,
    flex: 1,
    minHeight: 66,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 10
  },
  contextValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  contextLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16
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
  confidenceGrid: {
    gap: 10
  },
  confidenceBlock: {
    gap: 6
  },
  confidenceLabel: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
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
