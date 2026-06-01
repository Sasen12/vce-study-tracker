import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Dialog, IconButton, Portal, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { XPBar } from "@/components/gamification/XPBar";
import { BadgeGrid } from "@/components/gamification/BadgeGrid";
import { titleLabelById } from "@/constants/gamification";
import { STUDY_SESSION_PRESETS } from "@/constants/studySessionPresets";
import { subjectColors, palette } from "@/constants/theme";
import { VCE_SUBJECTS, VCE_SUBJECT_CATEGORIES } from "@/constants/vceSubjects";
import { estimateAtarFromScaledScores, scaleStudyScoreForAtar } from "@/constants/atarEstimate";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import {
  DEFAULT_TAB_OPTIONS,
  defaultTabLabelFor,
  loadDefaultTab,
  saveDefaultTab,
  type DefaultTabId
} from "@/utils/defaultTab";
import { buildPersonalRituals, buildUserStudySignature, type PersonalRitual } from "@/utils/personalization";
import {
  DEFAULT_STUDY_PREFERENCES,
  loadStudyPreferences,
  saveStudyPreferences,
  type CheckInRhythmMinutes,
  type CoachTone,
  type HomeDensity,
  type StudyPreferences
} from "@/utils/studyPreferences";
import type { Goal, SavedQuestion, StudyNote, StudyReflection, StudySession, UserSubject } from "@/types";

const clampStudyScore = (score: number) => Math.max(0, Math.min(50, score));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const maxSubjects = 8;

type SubjectTransitionRow = {
  subject: UserSubject;
  evidenceCount: number;
  futureDeadlineCount: number;
  weekMinutes: number;
  recommendedAction: "rollover" | "protect" | "archive" | "steady";
  actionCopy: string;
};

const startOfWeek = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isBetween = (value: string | Date, start: Date, end: Date) => {
  const date = new Date(value);
  return date >= start && date < end;
};

const studyDaysForSubject = (sessions: StudySession[], subjectId: string, start: Date, end: Date) =>
  new Set(
    sessions
      .filter((session) => session.subjectId === subjectId && isBetween(session.createdAt, start, end))
      .map((session) => session.createdAt.slice(0, 10))
  ).size;

const learningEvidenceCount = ({
  subjectId,
  weekStart,
  weekEnd,
  sessions,
  notes,
  reflections,
  savedQuestions
}: {
  subjectId: string;
  weekStart: Date;
  weekEnd: Date;
  sessions: StudySession[];
  notes: StudyNote[];
  reflections: StudyReflection[];
  savedQuestions: SavedQuestion[];
}) => {
  const sessionNotes = sessions.filter(
    (session) =>
      session.subjectId === subjectId &&
      isBetween(session.createdAt, weekStart, weekEnd) &&
      Boolean(session.notes?.trim()) &&
      (session.notes?.trim().length ?? 0) > 18
  ).length;
  const noteCount = notes.filter((note) => note.subjectId === subjectId && isBetween(note.updatedAt, weekStart, weekEnd)).length;
  const reflectionCount = reflections.filter(
    (reflection) => reflection.subjectId === subjectId && isBetween(reflection.classDate, weekStart, weekEnd)
  ).length;
  const savedCount = savedQuestions.filter(
    (question) => question.subjectId === subjectId && isBetween(question.createdAt, weekStart, weekEnd)
  ).length;
  return sessionNotes + noteCount + reflectionCount + savedCount;
};

const subjectMomentum = ({
  subject,
  goal,
  weekSeconds,
  previousWeekSeconds,
  studyDays,
  evidenceCount
}: {
  subject: UserSubject;
  goal?: Goal;
  weekSeconds: number;
  previousWeekSeconds: number;
  studyDays: number;
  evidenceCount: number;
}) => {
  const targetHours = Number(goal?.weeklyHoursTarget ?? 5);
  const weekHours = weekSeconds / 3600;
  const previousHours = previousWeekSeconds / 3600;
  const targetRatio = targetHours > 0 ? weekHours / targetHours : 1;
  const paceAdjustment =
    targetHours <= 0 ? 0 : targetRatio >= 1.15 ? 1.15 : targetRatio >= 0.85 ? 0.55 : targetRatio >= 0.55 ? -0.35 : -0.9;
  const trendAdjustment = targetHours > 0 ? clamp((weekHours - previousHours) / Math.max(targetHours, 1), -1, 1) * 0.65 : 0;
  const consistencyAdjustment = studyDays >= 4 ? 0.45 : studyDays >= 2 ? 0.2 : weekHours > 0 ? 0 : -0.35;
  const evidenceAdjustment = clamp(evidenceCount * 0.12, 0, 0.7);
  const adjustment = clamp(paceAdjustment + trendAdjustment + consistencyAdjustment + evidenceAdjustment, -1.8, 2.4);
  const rawTarget = Number(goal?.targetStudyScore ?? subject.targetScore ?? 30);
  const adjustedTarget = clampStudyScore(rawTarget + adjustment);
  const status = targetRatio >= 1.15 ? "surging" : targetRatio >= 0.85 ? "on_track" : targetRatio >= 0.45 ? "soft_dip" : "needs_nudge";
  const scaled = scaleStudyScoreForAtar(subject.subjectName, adjustedTarget);
  const baselineScaled = scaleStudyScoreForAtar(subject.subjectName, clampStudyScore(rawTarget));

  return {
    subjectId: subject.id,
    subjectName: subject.subjectName,
    color: subject.color,
    targetHours,
    weekHours,
    previousHours,
    studyDays,
    evidenceCount,
    adjustment,
    rawTarget,
    adjustedTarget,
    scaled,
    baselineScaled,
    status
  };
};

function GoalCard({
  subject,
  goal,
  weekSeconds,
  rolling,
  onDelete,
  onRollover,
  onSave
}: {
  subject: UserSubject;
  goal?: Goal;
  weekSeconds: number;
  rolling?: boolean;
  onDelete: (subject: UserSubject) => void;
  onRollover: (subject: UserSubject) => void;
  onSave: (input: { subjectId: string; targetStudyScore?: number | null; weeklyHoursTarget?: number | null }) => Promise<void>;
}) {
  const [targetScore, setTargetScore] = useState(String(goal?.targetStudyScore ?? subject.targetScore ?? ""));
  const [weeklyHours, setWeeklyHours] = useState(Number(goal?.weeklyHoursTarget ?? 5));
  const [saving, setSaving] = useState(false);
  const studiedHours = weekSeconds / 3600;

  const save = async () => {
    setSaving(true);
    await onSave({
      subjectId: subject.id,
      targetStudyScore: targetScore ? Number(targetScore) : null,
      weeklyHoursTarget: weeklyHours
    });
    setSaving(false);
  };

  return (
    <AppCard style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={styles.subjectTitleRow}>
          <View style={[styles.dot, { backgroundColor: subject.color }]} />
          <View style={styles.subjectTitleText}>
            <Text variant="titleMedium" style={styles.cardTitle} numberOfLines={1}>
              {subject.subjectName}
            </Text>
            <Text style={styles.unitLabel}>Unit {subject.unit}</Text>
          </View>
        </View>
        <View style={styles.goalHeaderRight}>
          <ProgressRing
            size={82}
            stroke={8}
            color={subject.color}
            progress={weeklyHours ? studiedHours / weeklyHours : 0}
            label={`${Math.round(studiedHours * 10) / 10}h`}
            sublabel={`${weeklyHours}h`}
          />
          <IconButton
            icon="archive-outline"
            mode="outlined"
            size={18}
            iconColor={palette.secondary}
            accessibilityLabel={`Archive ${subject.subjectName}`}
            onPress={() => onDelete(subject)}
          />
        </View>
      </View>

      <View style={styles.goalInputs}>
        <TextInput
          mode="outlined"
          dense
          label="Target score"
          keyboardType="number-pad"
          value={targetScore}
          onChangeText={setTargetScore}
          style={styles.scoreInput}
        />
        <View style={styles.stepper}>
          <IconButton
            icon="minus"
            mode="outlined"
            size={18}
            onPress={() => setWeeklyHours((value) => Math.max(0, value - 0.5))}
          />
          <Text style={styles.stepperText}>{weeklyHours}h</Text>
          <IconButton
            icon="plus"
            mode="outlined"
            size={18}
            onPress={() => setWeeklyHours((value) => Math.min(20, value + 0.5))}
          />
        </View>
      </View>
      <View style={styles.goalActions}>
        <Button mode="contained" icon="content-save" disabled={saving} onPress={save} style={styles.goalActionButton}>
          {saving ? "Saving" : "Save goal"}
        </Button>
        {subject.unit === "1/2" ? (
          <Button
            mode="outlined"
            icon="arrow-up-bold-box-outline"
            loading={rolling}
            disabled={rolling}
            onPress={() => onRollover(subject)}
            style={styles.goalActionButton}
          >
            Move to 3/4
          </Button>
        ) : null}
      </View>
    </AppCard>
  );
}

function AddSubjectDialog({
  visible,
  existingSubjects,
  onDismiss,
  onCreate
}: {
  visible: boolean;
  existingSubjects: UserSubject[];
  onDismiss: () => void;
  onCreate: (input: { subjectName: string; unit: string; targetScore?: number | null; color: string }) => Promise<void>;
}) {
  const [subjectSearch, setSubjectSearch] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<"1/2" | "3/4">("3/4");
  const availableSubjects = useMemo(
    () =>
      VCE_SUBJECTS.filter(
        (subject) =>
          subject.units.includes(selectedUnit) &&
          !existingSubjects.some((existing) => existing.subjectName === subject.name)
      ),
    [existingSubjects, selectedUnit]
  );
  const visibleSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    return availableSubjects.filter(
      (subject) => !query || subject.name.toLowerCase().includes(query) || subject.category.toLowerCase().includes(query)
    );
  }, [availableSubjects, subjectSearch]);
  const groupedSubjects = useMemo(
    () =>
      VCE_SUBJECT_CATEGORIES.map((category) => ({
        category,
        subjects: visibleSubjects.filter((subject) => subject.category === category)
      })).filter((group) => group.subjects.length),
    [visibleSubjects]
  );
  const [subjectName, setSubjectName] = useState(availableSubjects[0]?.name ?? "");
  const [targetScore, setTargetScore] = useState("");
  const [color, setColor] = useState(subjectColors[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && availableSubjects.length && !availableSubjects.some((subject) => subject.name === subjectName)) {
      setSubjectName(availableSubjects[0].name);
    }
  }, [availableSubjects, subjectName, visible]);

  const save = async () => {
    const selectedName = availableSubjects.some((subject) => subject.name === subjectName)
      ? subjectName
      : availableSubjects[0]?.name;
    if (!selectedName) return;
    setSaving(true);
    await onCreate({
      subjectName: selectedName,
      unit: selectedUnit,
      targetScore: targetScore ? Number(targetScore) : null,
      color
    });
    setSaving(false);
    setTargetScore("");
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>Add subject</Dialog.Title>
        <Dialog.Content style={styles.dialogContent}>
          <Text style={styles.muted}>
            {existingSubjects.length}/{maxSubjects} active subjects. Archive dropped subjects to make room without losing history.
          </Text>
          <SegmentedButtons
            value={selectedUnit}
            onValueChange={(value) => setSelectedUnit(value as "1/2" | "3/4")}
            buttons={[
              { value: "1/2", label: "Unit 1/2" },
              { value: "3/4", label: "Unit 3/4" }
            ]}
          />
          {availableSubjects.length ? (
            <>
              <TextInput
                mode="outlined"
                dense
                label="Search subjects"
                value={subjectSearch}
                onChangeText={setSubjectSearch}
                left={<TextInput.Icon icon="magnify" />}
              />
              <ScrollView style={styles.subjectPicker} contentContainerStyle={styles.subjectPickerContent}>
                {groupedSubjects.map((group) => (
                  <View key={group.category} style={styles.subjectGroup}>
                    <Text style={styles.subjectCategory}>{group.category}</Text>
                    <View style={styles.subjectOptionGrid}>
                      {group.subjects.map((subject) => {
                        const selected = subject.name === subjectName;
                        return (
                          <Pressable
                            key={subject.name}
                            onPress={() => setSubjectName(subject.name)}
                            style={[styles.subjectOption, selected && styles.subjectOptionSelected]}
                          >
                            <Text style={[styles.subjectOptionText, selected && styles.subjectOptionTextSelected]} numberOfLines={2}>
                              {subject.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TextInput
                mode="outlined"
                label="Target score"
                keyboardType="number-pad"
                value={targetScore}
                onChangeText={setTargetScore}
              />
              <View style={styles.colorRow}>
                {subjectColors.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setColor(item)}
                    style={[styles.colorChoice, { backgroundColor: item }, color === item && styles.colorChoiceSelected]}
                  />
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.muted}>Every preset subject is already in your profile.</Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" loading={saving} disabled={saving || !availableSubjects.length} onPress={save}>
            Add
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

export default function ProfileScreen() {
  useTrackScreen("profile");
  const {
    subjects,
    sessions,
    events,
    goals,
    savedQuestions,
    reflections,
    notes,
    resources,
    gamification,
    loading,
    fetchAll,
    saveGoal,
    createSubject,
    archiveSubject,
    rolloverSubject
  } = useAppStore();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setWeeklyDigestPreference = useAuthStore((state) => state.setWeeklyDigestPreference);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [archivingSubject, setArchivingSubject] = useState<UserSubject | null>(null);
  const [archivingSubjectSaving, setArchivingSubjectSaving] = useState(false);
  const [rollingSubjectId, setRollingSubjectId] = useState<string | null>(null);
  const [defaultTab, setDefaultTab] = useState<DefaultTabId>("home");
  const [defaultTabMessage, setDefaultTabMessage] = useState<string | null>(null);
  const [studyPreferences, setStudyPreferences] = useState<StudyPreferences>(DEFAULT_STUDY_PREFERENCES);
  const [studyPreferenceMessage, setStudyPreferenceMessage] = useState<string | null>(null);
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestMessage, setDigestMessage] = useState<string | null>(null);
  const [defaultAimDraft, setDefaultAimDraft] = useState("");
  const [ritualsExpanded, setRitualsExpanded] = useState(false);
  const subjectLimit = maxSubjects;

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  useEffect(() => {
    let active = true;
    loadDefaultTab(user?.id).then((tab) => {
      if (active) setDefaultTab(tab);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    loadStudyPreferences(user?.id).then((preferences) => {
      if (!active) return;
      setStudyPreferences(preferences);
      setDefaultAimDraft(preferences.defaultAim);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const chooseDefaultTab = async (nextTab: DefaultTabId) => {
    setDefaultTab(nextTab);
    setDefaultTabMessage(null);
    try {
      await saveDefaultTab(user?.id, nextTab);
      setDefaultTabMessage(`${defaultTabLabelFor(nextTab)} will open first after login.`);
    } catch {
      setDefaultTabMessage("Could not save that start tab. Try again.");
    }
  };

  const updateStudyPreferences = async (patch: Partial<StudyPreferences>, message?: string) => {
    const nextPreferences = { ...studyPreferences, ...patch };
    setStudyPreferences(nextPreferences);
    setStudyPreferenceMessage(null);
    try {
      const saved = await saveStudyPreferences(user?.id, nextPreferences);
      setStudyPreferences(saved);
      setDefaultAimDraft(saved.defaultAim);
      setStudyPreferenceMessage(message ?? "Study defaults saved.");
    } catch {
      setStudyPreferenceMessage("Could not save study defaults. Try again.");
    }
  };

  const saveDefaultAim = () => {
    void updateStudyPreferences({ defaultAim: defaultAimDraft.trim() }, "Default aim saved.");
  };

  const updateWeeklyDigest = async (optIn: boolean) => {
    setDigestSaving(true);
    setDigestMessage(null);
    try {
      await setWeeklyDigestPreference(optIn);
      setDigestMessage(optIn ? "Weekly brief enabled." : "Weekly brief turned off.");
    } catch {
      setDigestMessage("Could not update weekly emails. Try again.");
    } finally {
      setDigestSaving(false);
    }
  };

  const weekStart = useMemo(startOfWeek, []);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const previousWeekStart = useMemo(() => addDays(weekStart, -7), [weekStart]);
  const weeklySecondsBySubject = useMemo(() => {
    return sessions.reduce<Record<string, number>>((acc, session: StudySession) => {
      if (!session.subjectId || !isBetween(session.createdAt, weekStart, weekEnd)) return acc;
      acc[session.subjectId] = (acc[session.subjectId] ?? 0) + session.durationSeconds;
      return acc;
    }, {});
  }, [sessions, weekEnd, weekStart]);

  const previousWeeklySecondsBySubject = useMemo(() => {
    return sessions.reduce<Record<string, number>>((acc, session: StudySession) => {
      if (!session.subjectId || !isBetween(session.createdAt, previousWeekStart, weekStart)) return acc;
      acc[session.subjectId] = (acc[session.subjectId] ?? 0) + session.durationSeconds;
      return acc;
    }, {});
  }, [previousWeekStart, sessions, weekStart]);

  const adaptiveSubjects = useMemo(
    () =>
      subjects.map((subject) =>
        subjectMomentum({
          subject,
          goal: goals.find((item) => item.subjectId === subject.id),
          weekSeconds: weeklySecondsBySubject[subject.id] ?? 0,
          previousWeekSeconds: previousWeeklySecondsBySubject[subject.id] ?? 0,
          studyDays: studyDaysForSubject(sessions, subject.id, weekStart, weekEnd),
          evidenceCount: learningEvidenceCount({
            subjectId: subject.id,
            weekStart,
            weekEnd,
            sessions,
            notes,
            reflections,
            savedQuestions
          })
        })
      ),
    [goals, notes, previousWeeklySecondsBySubject, reflections, savedQuestions, sessions, subjects, weekEnd, weekStart, weeklySecondsBySubject]
  );

  const atarProjection = useMemo(() => {
    const baseline = estimateAtarFromScaledScores(
      adaptiveSubjects.map((subject) => ({ subjectName: subject.subjectName, scaled: subject.baselineScaled }))
    );
    const adaptive = estimateAtarFromScaledScores(
      adaptiveSubjects.map((subject) => ({ subjectName: subject.subjectName, scaled: subject.scaled }))
    );
    const totalTargetHours = adaptiveSubjects.reduce((sum, subject) => sum + subject.targetHours, 0);
    const totalWeekHours = adaptiveSubjects.reduce((sum, subject) => sum + subject.weekHours, 0);
    const totalPreviousHours = adaptiveSubjects.reduce((sum, subject) => sum + subject.previousHours, 0);
    const studyDays = new Set(
      sessions
        .filter((session) => isBetween(session.createdAt, weekStart, weekEnd))
        .map((session) => session.createdAt.slice(0, 10))
    ).size;
    const evidence = adaptiveSubjects.reduce((sum, subject) => sum + subject.evidenceCount, 0);
    const ratio = totalTargetHours > 0 ? totalWeekHours / totalTargetHours : 1;
    const delta = adaptive.atar - baseline.atar;
    const strongest = [...adaptiveSubjects].sort((a, b) => b.adjustment - a.adjustment)[0];
    const softest = [...adaptiveSubjects].sort((a, b) => a.adjustment - b.adjustment)[0];
    const message =
      ratio >= 1.05
        ? `Strong week. The projection is giving credit for ${Math.round(totalWeekHours * 10) / 10}h of work and ${evidence} learning signal${evidence === 1 ? "" : "s"}.`
        : ratio >= 0.75
          ? `You are close to pace. A couple of focused blocks would keep the projection steady.`
          : totalWeekHours > 0
            ? `Softer week, not a disaster. Pick one small block for ${softest?.subjectName ?? "your weakest subject"} and rebuild momentum gently.`
            : `No logged study yet this week. Start with one 25-minute block so the projection has fresh evidence.`;

    return {
      baseline,
      adaptive,
      delta,
      totalTargetHours,
      totalWeekHours,
      totalPreviousHours,
      studyDays,
      evidence,
      ratio,
      strongest,
      softest,
      message
    };
  }, [adaptiveSubjects, sessions, weekEnd, weekStart]);

  const studySignature = useMemo(
    () => buildUserStudySignature({ subjects, sessions, events, goals, notes, savedQuestions, resources }),
    [events, goals, notes, resources, savedQuestions, sessions, subjects]
  );
  const personalRituals = useMemo(
    () => buildPersonalRituals({ subjects, sessions, events, goals, notes, savedQuestions, resources }),
    [events, goals, notes, resources, savedQuestions, sessions, subjects]
  );
  const visibleRituals = ritualsExpanded ? personalRituals : personalRituals.slice(0, 1);
  const subjectTransitionRows = useMemo<SubjectTransitionRow[]>(
    () =>
      subjects.map((subject) => {
        const evidenceCount =
          sessions.filter((session) => session.subjectId === subject.id).length +
          notes.filter((note) => note.subjectId === subject.id).length +
          savedQuestions.filter((question) => question.subjectId === subject.id).length +
          resources.filter((resource) => resource.subjectId === subject.id).length;
        const futureDeadlineCount = events.filter((event) => event.subjectId === subject.id && !event.completed).length;
        const weekMinutes = Math.round((weeklySecondsBySubject[subject.id] ?? 0) / 60);
        const recommendedAction =
          subject.unit === "1/2"
            ? "rollover"
            : futureDeadlineCount > 0
              ? "protect"
              : evidenceCount === 0 && subjects.length >= 5
                ? "archive"
                : "steady";
        const actionCopy =
          recommendedAction === "rollover"
            ? "Ready for Unit 3/4 if this subject continues."
            : recommendedAction === "protect"
              ? `${futureDeadlineCount} active deadline${futureDeadlineCount === 1 ? "" : "s"} still attached.`
              : recommendedAction === "archive"
                ? "No evidence yet. Safe candidate if this was a trial subject."
                : "Keep active. History is being preserved.";

        return { subject, evidenceCount, futureDeadlineCount, weekMinutes, recommendedAction, actionCopy };
      }),
    [events, notes, resources, savedQuestions, sessions, subjects, weeklySecondsBySubject]
  );
  const transitionStats = useMemo(() => {
    const unit12Count = subjectTransitionRows.filter((row) => row.subject.unit === "1/2").length;
    const totalEvidence = subjectTransitionRows.reduce((sum, row) => sum + row.evidenceCount, 0);
    const protectedDeadlines = subjectTransitionRows.reduce((sum, row) => sum + row.futureDeadlineCount, 0);
    const rolloverReady = subjectTransitionRows.filter((row) => row.recommendedAction === "rollover").length;
    return { unit12Count, totalEvidence, protectedDeadlines, rolloverReady };
  }, [subjectTransitionRows]);

  const openRitual = (ritual: PersonalRitual) => {
    router.push({
      pathname: "/(tabs)/study",
      params: {
        mode: "timer",
        targetMinutes: String(clamp(ritual.minutes, 10, 90)),
        ritualTitle: ritual.title,
        ritualReason: ritual.reason,
        ritualSteps: JSON.stringify(ritual.steps),
        ...(ritual.priority >= 90 ? { ritualFocus: "1" } : {}),
        ...(ritual.subjectId ? { subjectId: ritual.subjectId } : {}),
        ...(ritual.topic ? { rescueTopic: ritual.topic } : {})
      }
    });
  };

  const openRitualDrill = (ritual: PersonalRitual) => {
    if (!ritual.subjectId) return;
    router.push({
      pathname: "/(tabs)/questions",
      params: {
        mode: "generate",
        subjectId: ritual.subjectId,
        topic: ritual.topic ?? ritual.title,
        difficulty: ritual.priority >= 90 ? "hard" : "medium",
        count: "3"
      }
    });
  };

  const signOut = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const confirmArchiveSubject = async () => {
    if (!archivingSubject) return;
    setArchivingSubjectSaving(true);
    try {
      await archiveSubject(archivingSubject.id, "dropped_or_changed");
      setArchivingSubject(null);
    } finally {
      setArchivingSubjectSaving(false);
    }
  };

  const moveSubjectToUnit34 = async (subject: UserSubject) => {
    setRollingSubjectId(subject.id);
    try {
      await rolloverSubject(subject.id);
    } finally {
      setRollingSubjectId(null);
    }
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
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Profile</Text>
          <Text variant="headlineLarge" style={styles.title}>
            {user?.displayName ?? "Student"}
          </Text>
          <Text style={styles.activeTitle}>{titleLabelById(gamification?.activeTitle)}</Text>
        </View>
        <Button mode="outlined" icon="logout" onPress={signOut}>
          Log out
        </Button>
      </View>

      <AppCard>
        <XPBar gamification={gamification} />
      </AppCard>

      <AppCard style={styles.preferenceCard}>
        <View>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Start tab
          </Text>
          <Text style={styles.muted}>Choose what opens first after login.</Text>
        </View>
        <View style={styles.defaultTabGrid}>
          {DEFAULT_TAB_OPTIONS.map((option) => {
            const active = option.id === defaultTab;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => chooseDefaultTab(option.id)}
                style={[styles.defaultTabOption, active && styles.defaultTabOptionActive]}
              >
                <MaterialCommunityIcons
                  name={option.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  color={active ? palette.primary : palette.muted}
                  size={20}
                />
                <View style={styles.defaultTabTextWrap}>
                  <Text style={[styles.defaultTabTitle, active && styles.defaultTabTitleActive]} numberOfLines={1}>
                    {option.label}
                  </Text>
                  <Text style={styles.defaultTabDescription} numberOfLines={1}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {defaultTabMessage ? <Text style={styles.preferenceMessage}>{defaultTabMessage}</Text> : null}
      </AppCard>

      <AppCard style={styles.preferenceCard}>
        <View style={styles.preferenceSetting}>
          <View style={styles.preferenceSettingText}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Weekly email brief
            </Text>
            <Text style={styles.defaultTabDescription}>Sunday recap with study time, weak spots, XP and upcoming SAC pressure.</Text>
          </View>
          <Switch
            value={user?.weeklyDigestOptIn ?? true}
            disabled={digestSaving}
            onValueChange={(value) => void updateWeeklyDigest(value)}
            color={palette.primary}
          />
        </View>
        {digestMessage ? <Text style={styles.preferenceMessage}>{digestMessage}</Text> : null}
      </AppCard>

      <AppCard style={styles.preferenceCard}>
        <View>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Study defaults
          </Text>
          <Text style={styles.muted}>Pre-load timer sessions with your preferred setup.</Text>
        </View>
        <View style={styles.defaultTabGrid}>
          {STUDY_SESSION_PRESETS.map((preset) => {
            const active = preset.id === studyPreferences.defaultPresetId;
            return (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() =>
                  updateStudyPreferences(
                    { defaultPresetId: preset.id },
                    `${preset.label} will load first in Study.`
                  )
                }
                style={[styles.defaultTabOption, active && styles.defaultTabOptionActive]}
              >
                <MaterialCommunityIcons name={preset.icon} color={active ? preset.accent : palette.muted} size={20} />
                <View style={styles.defaultTabTextWrap}>
                  <Text style={[styles.defaultTabTitle, active && styles.defaultTabTitleActive]} numberOfLines={1}>
                    {preset.label}
                  </Text>
                  <Text style={styles.defaultTabDescription} numberOfLines={1}>
                    {preset.minutes}m {preset.focus ? "- focus" : "- flexible"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.preferenceSettingsGrid}>
          <View style={styles.preferenceSetting}>
            <View style={styles.preferenceSettingText}>
              <Text style={styles.preferenceSettingTitle}>Check-ins</Text>
              <Text style={styles.defaultTabDescription}>Start sessions with timer questions on.</Text>
            </View>
            <Switch
              value={studyPreferences.checkInsEnabled}
              onValueChange={(value) => void updateStudyPreferences({ checkInsEnabled: value })}
              color={palette.primary}
            />
          </View>
          <View style={styles.preferenceSetting}>
            <View style={styles.preferenceSettingText}>
              <Text style={styles.preferenceSettingTitle}>Focus filter</Text>
              <Text style={styles.defaultTabDescription}>Open Study with distraction controls ready.</Text>
            </View>
            <Switch
              value={studyPreferences.focusFilterByDefault}
              onValueChange={(value) => void updateStudyPreferences({ focusFilterByDefault: value })}
              color={palette.primary}
            />
          </View>
          <View style={styles.preferenceSetting}>
            <View style={styles.preferenceSettingText}>
              <Text style={styles.preferenceSettingTitle}>Exam Week</Text>
              <Text style={styles.defaultTabDescription}>Keep Home stripped down under pressure.</Text>
            </View>
            <Switch
              value={studyPreferences.examWeekMode}
              onValueChange={(value) =>
                void updateStudyPreferences({ examWeekMode: value }, value ? "Exam Week mode on." : "Exam Week mode off.")
              }
              color={palette.primary}
            />
          </View>
          <View style={styles.preferenceSetting}>
            <View style={styles.preferenceSettingText}>
              <Text style={styles.preferenceSettingTitle}>Study bird</Text>
              <Text style={styles.defaultTabDescription}>Show the animated bird and quick-ask menu.</Text>
            </View>
            <Switch
              value={studyPreferences.mascotEnabled}
              onValueChange={(value) =>
                void updateStudyPreferences(
                  { mascotEnabled: value },
                  value ? "Study bird enabled." : "Study bird hidden."
                )
              }
              color={palette.primary}
            />
          </View>
        </View>
        <View style={styles.preferenceInputBlock}>
          <Text style={styles.preferenceLabel}>Home layout</Text>
          <SegmentedButtons
            value={studyPreferences.homeDensity}
            onValueChange={(value) =>
              void updateStudyPreferences(
                { homeDensity: value as HomeDensity },
                value === "focus" ? "Focus Home saved." : "Full Home saved."
              )
            }
            buttons={[
              { value: "focus", label: "Focus" },
              { value: "full", label: "Full" }
            ]}
          />
        </View>
        <View style={styles.preferenceInputBlock}>
          <Text style={styles.preferenceLabel}>Forge tone</Text>
          <SegmentedButtons
            value={studyPreferences.coachTone}
            onValueChange={(value) =>
              void updateStudyPreferences({ coachTone: value as CoachTone }, `${value[0].toUpperCase()}${value.slice(1)} tone saved.`)
            }
            buttons={[
              { value: "calm", label: "Calm" },
              { value: "sharp", label: "Sharp" },
              { value: "brutal", label: "Brutal" }
            ]}
          />
        </View>
        <View style={styles.preferenceInputBlock}>
          <Text style={styles.preferenceLabel}>Check-in rhythm</Text>
          <SegmentedButtons
            value={studyPreferences.checkInIntervalMinutes}
            onValueChange={(value) =>
              void updateStudyPreferences({ checkInIntervalMinutes: value as CheckInRhythmMinutes }, `${value} minute check-ins saved.`)
            }
            buttons={[
              { value: "8", label: "8m" },
              { value: "10", label: "10m" },
              { value: "15", label: "15m" }
            ]}
          />
        </View>
        <View style={styles.preferenceInputBlock}>
          <TextInput
            mode="outlined"
            label="Default aim"
            value={defaultAimDraft}
            onChangeText={setDefaultAimDraft}
            placeholder="Fix one weak area, build evidence, finish corrections..."
          />
          <Button mode="outlined" icon="content-save-outline" onPress={saveDefaultAim}>
            Save aim
          </Button>
        </View>
        {studyPreferenceMessage ? <Text style={styles.preferenceMessage}>{studyPreferenceMessage}</Text> : null}
      </AppCard>

      <AppCard style={styles.signatureCard}>
        <View style={styles.signatureTop}>
          <View style={styles.signatureMark}>
            <MaterialCommunityIcons name="fingerprint" color={palette.info} size={24} />
          </View>
          <View style={styles.flexText}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Study DNA
            </Text>
            <Text style={styles.signatureName}>{studySignature.profileName}</Text>
            <Text style={styles.muted}>{studySignature.depthLabel} - {studySignature.depth}% mapped</Text>
          </View>
        </View>
        <View style={styles.signatureTraitGrid}>
          {studySignature.traits.map((trait) => (
            <View key={trait.label} style={styles.signatureTrait}>
              <MaterialCommunityIcons name={trait.icon} color={trait.accent} size={19} />
              <View style={styles.defaultTabTextWrap}>
                <Text style={styles.signatureTraitLabel}>{trait.label}</Text>
                <Text style={styles.signatureTraitValue} numberOfLines={1}>
                  {trait.value}
                </Text>
                <Text style={styles.defaultTabDescription} numberOfLines={2}>
                  {trait.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.signatureNextMove}>
          <View style={[styles.signatureMoveIcon, { backgroundColor: `${studySignature.nextMove.accent}18` }]}>
            <MaterialCommunityIcons name={studySignature.nextMove.icon} color={studySignature.nextMove.accent} size={20} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.signatureTraitLabel}>Personal next move</Text>
            <Text style={styles.signatureTraitValue} numberOfLines={1}>
              {studySignature.nextMove.title}
            </Text>
            <Text style={styles.defaultTabDescription} numberOfLines={2}>
              {studySignature.nextMove.body}
            </Text>
          </View>
          <Text style={styles.signatureMinutes}>{studySignature.nextMove.minutes}m</Text>
        </View>
      </AppCard>

      <AppCard style={styles.ritualsCard}>
        <View style={styles.ritualsHeader}>
          <View style={[styles.signatureTop, styles.ritualsHeaderText]}>
            <View style={styles.ritualMark}>
              <MaterialCommunityIcons name="auto-fix" color={palette.primary} size={24} />
            </View>
            <View style={styles.flexText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Forge Rituals
              </Text>
              <Text style={styles.muted}>Protocols that change as your deadlines, notes and weak areas change.</Text>
            </View>
          </View>
          <Button
            compact
            mode="text"
            icon={ritualsExpanded ? "chevron-up" : "chevron-down"}
            onPress={() => setRitualsExpanded((value) => !value)}
          >
            {ritualsExpanded ? "Less" : "All"}
          </Button>
        </View>
        <View style={styles.ritualGrid}>
          {visibleRituals.map((ritual) => (
            <View key={ritual.id} style={styles.ritualItem}>
              <View style={styles.ritualItemTop}>
                <View style={[styles.ritualIcon, { backgroundColor: `${ritual.accent}18` }]}>
                  <MaterialCommunityIcons name={ritual.icon} color={ritual.accent} size={20} />
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.ritualItemTitle} numberOfLines={1}>
                    {ritual.title}
                  </Text>
                  <Text style={styles.defaultTabDescription} numberOfLines={2}>
                    {ritual.reason}
                  </Text>
                </View>
                <Text style={styles.ritualMinutePill}>{ritual.minutes}m</Text>
              </View>
              <View style={styles.ritualStepList}>
                {ritual.steps.map((step, index) => (
                  <View key={`${ritual.id}-${step}`} style={styles.ritualStepRow}>
                    <Text style={styles.ritualStepNumber}>{index + 1}</Text>
                    <Text style={styles.ritualStepCopy} numberOfLines={2}>
                      {step}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.ritualActions}>
                <Button compact mode="contained-tonal" icon="timer-play-outline" onPress={() => openRitual(ritual)}>
                  Start
                </Button>
                <Button compact mode="outlined" icon="cards-outline" disabled={!ritual.subjectId} onPress={() => openRitualDrill(ritual)}>
                  Drill
                </Button>
              </View>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.atarCard}>
        <View>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Adaptive ATAR projection
          </Text>
          <Text style={styles.muted}>Raw target study scores are scaled with 2025 VTAC data, then converted from aggregate to ATAR.</Text>
        </View>
        <View style={styles.atarRow}>
          <Text style={styles.atar}>{atarProjection.adaptive.atar.toFixed(2)}</Text>
          <View style={[styles.deltaPill, atarProjection.delta >= 0 ? styles.deltaPositive : styles.deltaSoft]}>
            <Text style={styles.deltaText}>
              {atarProjection.delta >= 0 ? "+" : ""}
              {atarProjection.delta.toFixed(2)}
            </Text>
          </View>
        </View>
        <Text style={styles.aggregateText}>Estimated aggregate: {atarProjection.adaptive.aggregate.toFixed(2)}</Text>
        {!atarProjection.adaptive.englishIncluded ? (
          <Text style={styles.englishWarning}>Add an English study for an ATAR-eligible estimate.</Text>
        ) : null}
        <Text style={styles.momentumMessage}>{atarProjection.message}</Text>
        <View style={styles.momentumGrid}>
          <View style={styles.momentumTile}>
            <Text style={styles.momentumValue}>{Math.round(atarProjection.totalWeekHours * 10) / 10}h</Text>
            <Text style={styles.momentumLabel}>this week</Text>
          </View>
          <View style={styles.momentumTile}>
            <Text style={styles.momentumValue}>{Math.round(atarProjection.totalTargetHours * 10) / 10}h</Text>
            <Text style={styles.momentumLabel}>weekly target</Text>
          </View>
          <View style={styles.momentumTile}>
            <Text style={styles.momentumValue}>{atarProjection.studyDays}</Text>
            <Text style={styles.momentumLabel}>study days</Text>
          </View>
          <View style={styles.momentumTile}>
            <Text style={styles.momentumValue}>{atarProjection.evidence}</Text>
            <Text style={styles.momentumLabel}>learning signals</Text>
          </View>
        </View>
        {adaptiveSubjects.length ? (
          <View style={styles.subjectMomentumList}>
            {[...adaptiveSubjects]
              .sort((a, b) => b.adjustment - a.adjustment)
              .slice(0, 5)
              .map((subject) => (
                <View key={subject.subjectId} style={styles.subjectMomentumRow}>
                  <View style={[styles.dot, { backgroundColor: subject.color }]} />
                  <View style={styles.subjectMomentumText}>
                    <Text style={styles.subjectMomentumName} numberOfLines={1}>
                      {subject.subjectName}
                    </Text>
                    <Text style={styles.momentumLabel}>
                      {Math.round(subject.weekHours * 10) / 10}/{subject.targetHours}h, {subject.studyDays} day
                      {subject.studyDays === 1 ? "" : "s"} - scaled {subject.scaled.toFixed(1)}
                    </Text>
                  </View>
                  <Text style={[styles.subjectDelta, subject.adjustment >= 0 ? styles.subjectDeltaUp : styles.subjectDeltaDown]}>
                    {subject.adjustment >= 0 ? "+" : ""}
                    {subject.adjustment.toFixed(1)}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}
        <Text style={styles.baselineText}>Target-only baseline: {atarProjection.baseline.atar.toFixed(2)}</Text>
        <Text style={styles.disclaimer}>
          Estimate only. Uses 2025 VTAC rounded scaling and aggregate thresholds; official results vary by year and exact VTAC
          calculations use more precision.
        </Text>
      </AppCard>

      <AppCard style={styles.transitionCard}>
        <View style={styles.transitionHeader}>
          <View style={styles.transitionIcon}>
            <MaterialCommunityIcons name="swap-horizontal-bold" color={palette.warning} size={23} />
          </View>
          <View style={styles.flexText}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Subject transition
            </Text>
            <Text style={styles.muted}>
              Use this when Unit 1 moves to Unit 2, Year 11 turns into Year 12, or a subject gets dropped.
            </Text>
          </View>
          <Button compact mode="contained-tonal" icon="plus" disabled={subjects.length >= subjectLimit} onPress={() => setAddSubjectOpen(true)}>
            Add replacement
          </Button>
        </View>
        <View style={styles.transitionStatGrid}>
          <View style={styles.transitionStat}>
            <Text style={styles.transitionStatValue}>{transitionStats.rolloverReady}</Text>
            <Text style={styles.transitionStatLabel}>ready to roll</Text>
          </View>
          <View style={styles.transitionStat}>
            <Text style={styles.transitionStatValue}>{transitionStats.protectedDeadlines}</Text>
            <Text style={styles.transitionStatLabel}>live dates</Text>
          </View>
          <View style={styles.transitionStat}>
            <Text style={styles.transitionStatValue}>{transitionStats.totalEvidence}</Text>
            <Text style={styles.transitionStatLabel}>history items</Text>
          </View>
          <View style={styles.transitionStat}>
            <Text style={styles.transitionStatValue}>{transitionStats.unit12Count}</Text>
            <Text style={styles.transitionStatLabel}>Unit 1/2</Text>
          </View>
        </View>
        {subjectTransitionRows.length ? (
          <View style={styles.transitionList}>
            {subjectTransitionRows.map((row) => (
              <View key={row.subject.id} style={styles.transitionRow}>
                <View style={[styles.transitionSubjectDot, { backgroundColor: row.subject.color }]} />
                <View style={styles.transitionRowText}>
                  <View style={styles.transitionTitleLine}>
                    <Text style={styles.transitionSubjectName} numberOfLines={1}>
                      {row.subject.subjectName}
                    </Text>
                    <Text style={styles.transitionUnit}>Unit {row.subject.unit}</Text>
                  </View>
                  <Text style={styles.defaultTabDescription} numberOfLines={2}>
                    {row.actionCopy} {row.weekMinutes ? `${row.weekMinutes}m studied this week.` : "No minutes this week."}
                  </Text>
                </View>
                <View style={styles.transitionRowActions}>
                  {row.subject.unit === "1/2" ? (
                    <Button
                      compact
                      mode="contained-tonal"
                      icon="arrow-up-bold-box-outline"
                      loading={rollingSubjectId === row.subject.id}
                      disabled={rollingSubjectId === row.subject.id}
                      onPress={() => moveSubjectToUnit34(row.subject)}
                    >
                      3/4
                    </Button>
                  ) : null}
                  <Button compact mode="outlined" icon="archive-outline" onPress={() => setArchivingSubject(row.subject)}>
                    Archive
                  </Button>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>Add your current subjects first. Transition planning appears once subjects exist.</Text>
        )}
        <Text style={styles.transitionNote}>
          Archiving removes a subject from active study but keeps its sessions, notes, saved questions, resources and memory attached.
        </Text>
      </AppCard>

      <View>
        <View style={styles.sectionHeader}>
          <View style={styles.flexText}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Subjects and goals ({subjects.length}/{subjectLimit})
            </Text>
            <Text style={styles.subjectLifecycleNote}>
              Archive dropped subjects or move Unit 1/2 into Unit 3/4. Notes, sessions and questions stay attached to the old record.
            </Text>
          </View>
          <Button
            mode="outlined"
            icon="plus"
            disabled={subjects.length >= subjectLimit}
            onPress={() => setAddSubjectOpen(true)}
          >
            Add
          </Button>
        </View>
        {subjects.length >= subjectLimit ? (
          <Text style={styles.subjectLimitText}>You are at your {subjectLimit}-subject limit. Archive a dropped subject to add another.</Text>
        ) : null}
      </View>
      {subjects.length ? (
        subjects.map((subject) => (
          <GoalCard
            key={subject.id}
            subject={subject}
            goal={goals.find((goal) => goal.subjectId === subject.id)}
            weekSeconds={weeklySecondsBySubject[subject.id] ?? 0}
            rolling={rollingSubjectId === subject.id}
            onDelete={setArchivingSubject}
            onRollover={moveSubjectToUnit34}
            onSave={saveGoal}
          />
        ))
      ) : (
        <EmptyState title="No subjects yet" body="Your goals will appear once subjects are added." />
      )}

      <AppCard style={styles.badgesCard}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          Badges
        </Text>
        <BadgeGrid unlocked={gamification?.badges ?? []} />
      </AppCard>

      <AddSubjectDialog
        visible={addSubjectOpen}
        existingSubjects={subjects}
        onDismiss={() => setAddSubjectOpen(false)}
        onCreate={createSubject}
      />
      <Portal>
        <Dialog visible={Boolean(archivingSubject)} onDismiss={() => setArchivingSubject(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Archive subject</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.muted}>
              Archive {archivingSubject?.subjectName}? It disappears from active study, but past sessions, notes, questions and results
              stay attached to this subject record.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setArchivingSubject(null)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={palette.secondary}
              loading={archivingSubjectSaving}
              disabled={archivingSubjectSaving}
              onPress={confirmArchiveSubject}
            >
              Archive
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
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    marginBottom: 4
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  activeTitle: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    marginTop: 4
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  flexText: {
    flex: 1,
    minWidth: 0
  },
  preferenceCard: {
    gap: 14
  },
  defaultTabGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  defaultTabOption: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 128,
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  defaultTabOptionActive: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}18`
  },
  defaultTabTextWrap: {
    flex: 1,
    minWidth: 0
  },
  defaultTabTitle: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold"
  },
  defaultTabTitleActive: {
    color: palette.text
  },
  defaultTabDescription: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16
  },
  preferenceMessage: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  preferenceSettingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  preferenceSetting: {
    flex: 1,
    minWidth: 210,
    minHeight: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  preferenceSettingText: {
    flex: 1,
    minWidth: 0
  },
  preferenceSettingTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  preferenceInputBlock: {
    gap: 8
  },
  preferenceLabel: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  signatureCard: {
    gap: 14,
    borderColor: "rgba(56,189,248,0.24)",
    backgroundColor: "rgba(56,189,248,0.07)"
  },
  signatureTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  signatureMark: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,189,248,0.14)"
  },
  signatureName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  signatureTraitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  signatureTrait: {
    flex: 1,
    minWidth: 180,
    minHeight: 98,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9
  },
  signatureTraitLabel: {
    color: palette.muted,
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  signatureTraitValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  signatureNextMove: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  signatureMoveIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  signatureMinutes: {
    minWidth: 42,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    textAlign: "right"
  },
  ritualsCard: {
    gap: 14,
    borderColor: "rgba(168,85,247,0.28)",
    backgroundColor: "rgba(168,85,247,0.07)"
  },
  ritualsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  ritualsHeaderText: {
    flex: 1,
    minWidth: 0
  },
  ritualMark: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,85,247,0.14)"
  },
  ritualGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  ritualItem: {
    flex: 1,
    minWidth: 250,
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12
  },
  ritualItemTop: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  ritualIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  ritualItemTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  ritualMinutePill: {
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.34)",
    backgroundColor: "rgba(168,85,247,0.14)",
    color: palette.text,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  ritualStepList: {
    gap: 7
  },
  ritualStepRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  ritualStepNumber: {
    overflow: "hidden",
    width: 21,
    borderRadius: 8,
    backgroundColor: "rgba(168,85,247,0.16)",
    color: palette.primary,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textAlign: "center",
    paddingVertical: 3
  },
  ritualStepCopy: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    lineHeight: 18
  },
  ritualActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  atarCard: {
    gap: 10
  },
  atarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  },
  atar: {
    color: palette.text,
    fontSize: 48,
    lineHeight: 56,
    fontFamily: "Outfit_700Bold"
  },
  deltaPill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  deltaPositive: {
    borderColor: `${palette.success}66`,
    backgroundColor: `${palette.success}18`
  },
  deltaSoft: {
    borderColor: `${palette.warning}66`,
    backgroundColor: `${palette.warning}18`
  },
  deltaText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  momentumMessage: {
    color: palette.text,
    lineHeight: 20
  },
  aggregateText: {
    color: palette.info,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  englishWarning: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  momentumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  momentumTile: {
    minWidth: 112,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 10
  },
  momentumValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  momentumLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16
  },
  subjectMomentumList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10
  },
  subjectMomentumRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  subjectMomentumText: {
    flex: 1
  },
  subjectMomentumName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  subjectDelta: {
    width: 46,
    textAlign: "right",
    fontFamily: "Outfit_700Bold"
  },
  subjectDeltaUp: {
    color: palette.success
  },
  subjectDeltaDown: {
    color: palette.warning
  },
  baselineText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18
  },
  disclaimer: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18
  },
  transitionCard: {
    gap: 13,
    borderColor: "rgba(245,158,11,0.26)",
    backgroundColor: "rgba(245,158,11,0.07)"
  },
  transitionHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12
  },
  transitionIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.15)"
  },
  transitionStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  transitionStat: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.18)",
    backgroundColor: "rgba(0,0,0,0.13)",
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  transitionStatValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 20
  },
  transitionStatLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16
  },
  transitionList: {
    gap: 8
  },
  transitionRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  transitionSubjectDot: {
    width: 11,
    height: 42,
    borderRadius: 999
  },
  transitionRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  transitionTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  transitionSubjectName: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  transitionUnit: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(245,158,11,0.15)",
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  transitionRowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 7
  },
  transitionNote: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    lineHeight: 17
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  subjectLimitText: {
    color: palette.warning,
    marginTop: 8,
    lineHeight: 20
  },
  subjectLifecycleNote: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  goalCard: {
    gap: 14
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  subjectTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  subjectTitleText: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  unitLabel: {
    color: palette.muted,
    fontSize: 12
  },
  goalHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  goalInputs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  scoreInput: {
    flex: 1
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  stepperText: {
    width: 42,
    textAlign: "center",
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  goalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  goalActionButton: {
    flexGrow: 1
  },
  badgesCard: {
    gap: 14
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
  subjectPicker: {
    maxHeight: 300
  },
  subjectPickerContent: {
    gap: 12,
    paddingRight: 6
  },
  subjectGroup: {
    gap: 8
  },
  subjectCategory: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  subjectOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  subjectOption: {
    width: 142,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  subjectOptionSelected: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}22`
  },
  subjectOptionText: {
    color: palette.muted,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  subjectOptionTextSelected: {
    color: palette.text
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  colorChoice: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent"
  },
  colorChoiceSelected: {
    borderColor: palette.text
  }
});
