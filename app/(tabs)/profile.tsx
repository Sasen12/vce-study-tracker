import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Dialog, IconButton, Portal, Text, TextInput } from "react-native-paper";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { XPBar } from "@/components/gamification/XPBar";
import { BadgeGrid } from "@/components/gamification/BadgeGrid";
import { subjectColors, palette, themeShopItems } from "@/constants/theme";
import { VCE_SUBJECTS, VCE_SUBJECT_CATEGORIES } from "@/constants/vceSubjects";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import type { Gamification, Goal, SavedQuestion, StudyNote, StudyReflection, StudySession, UserSubject } from "@/types";

const scaleAdjustments: Record<string, number> = {
  "Specialist Mathematics": 10,
  "Mathematical Methods": 5,
  Chemistry: 4,
  Physics: 3,
  "English Language": 2,
  Literature: 1,
  English: 0,
  Psychology: -1,
  "Business Management": -2,
  "Health and Human Development": -3,
  "Physical Education": -3
};

const clampScore = (score: number) => Math.max(0, Math.min(55, score));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

const estimateAtarFromScaledScores = (scores: { subjectName: string; scaled: number }[]) => {
  const ranked = [...scores].sort((a, b) => b.scaled - a.scaled);
  const english = ranked
    .filter((score) => score.subjectName.includes("English") || score.subjectName === "Literature")
    .sort((a, b) => b.scaled - a.scaled)[0];
  const others = ranked.filter((score) => score !== english);
  const aggregate =
    (english?.scaled ?? 0) +
    others.slice(0, 3).reduce((sum, score) => sum + score.scaled, 0) +
    others.slice(3, 5).reduce((sum, score) => sum + score.scaled * 0.1, 0);
  return Math.min(99.95, Math.max(30, 30 + (aggregate / 210) * 69.95));
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
  const adjustedTarget = clampScore(rawTarget + adjustment);
  const status = targetRatio >= 1.15 ? "surging" : targetRatio >= 0.85 ? "on_track" : targetRatio >= 0.45 ? "soft_dip" : "needs_nudge";

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
    scaled: clampScore(adjustedTarget + (scaleAdjustments[subject.subjectName] ?? 0)),
    baselineScaled: clampScore(rawTarget + (scaleAdjustments[subject.subjectName] ?? 0)),
    status
  };
};

function GoalCard({
  subject,
  goal,
  weekSeconds,
  onSave
}: {
  subject: UserSubject;
  goal?: Goal;
  weekSeconds: number;
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
          <Text variant="titleMedium" style={styles.cardTitle} numberOfLines={1}>
            {subject.subjectName}
          </Text>
        </View>
        <ProgressRing
          size={82}
          stroke={8}
          color={subject.color}
          progress={weeklyHours ? studiedHours / weeklyHours : 0}
          label={`${Math.round(studiedHours * 10) / 10}h`}
          sublabel={`${weeklyHours}h`}
        />
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
      <Button mode="contained" icon="content-save" disabled={saving} onPress={save}>
        {saving ? "Saving" : "Save goal"}
      </Button>
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
  const availableSubjects = useMemo(
    () =>
      VCE_SUBJECTS.filter(
        (subject) =>
          subject.units.includes("3/4") &&
          !existingSubjects.some((existing) => existing.subjectName === subject.name)
      ),
    [existingSubjects]
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
      unit: "3/4",
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

function ThemeShop({
  gamification,
  onUnlock,
  onApply
}: {
  gamification: Gamification | null;
  onUnlock: (themeId: string) => Promise<void>;
  onApply: (themeId: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const xpBalance = gamification?.xpBalance ?? 0;
  const activeTheme = gamification?.activeTheme ?? "midnight";
  const unlocked = useMemo(
    () => new Set(["midnight", ...(gamification?.unlockedCosmetics ?? [])]),
    [gamification?.unlockedCosmetics]
  );

  const chooseTheme = async (themeId: string, isUnlocked: boolean) => {
    setBusyId(themeId);
    setShopError(null);
    try {
      if (isUnlocked) {
        await onApply(themeId);
      } else {
        await onUnlock(themeId);
      }
    } catch (error) {
      setShopError(error instanceof Error ? error.message : "Could not update theme");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppCard style={styles.shopCard}>
      <View style={styles.shopHeader}>
        <View>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Style shop
          </Text>
          <Text style={styles.muted}>Theme unlocks</Text>
        </View>
        <View style={styles.coinPill}>
          <Text style={styles.coinValue}>{xpBalance}</Text>
          <Text style={styles.coinLabel}>coins</Text>
        </View>
      </View>
      <View style={styles.themeGrid}>
        {themeShopItems.map((theme) => {
          const isUnlocked = unlocked.has(theme.id);
          const isActive = activeTheme === theme.id;
          const canAfford = xpBalance >= theme.price;
          const loadingTheme = busyId === theme.id;
          const actionLabel = isActive
            ? "Equipped"
            : isUnlocked
              ? "Use"
              : canAfford
                ? "Unlock"
                : `${theme.price - xpBalance} more`;

          return (
            <View
              key={theme.id}
              style={[
                styles.themeItem,
                {
                  borderColor: isActive ? theme.colors.primary : palette.border,
                  backgroundColor: theme.colors.surface
                }
              ]}
            >
              <View style={[styles.themePreview, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.themePreviewCard, { backgroundColor: theme.colors.surfaceRaised }]}>
                  <View style={[styles.themePreviewLine, { backgroundColor: theme.colors.primary }]} />
                  <View style={[styles.themePreviewLineShort, { backgroundColor: theme.colors.secondary }]} />
                </View>
              </View>
              <View style={styles.themeTextRow}>
                <Text style={[styles.themeName, { color: theme.colors.text }]}>{theme.name}</Text>
                <Text style={[styles.themePrice, { color: theme.colors.muted }]}>
                  {theme.price ? `${theme.price} coins` : "Starter"}
                </Text>
              </View>
              <Button
                mode={isActive ? "outlined" : "contained"}
                compact
                loading={loadingTheme}
                disabled={loadingTheme || isActive || (!isUnlocked && !canAfford)}
                buttonColor={isActive ? undefined : theme.colors.primary}
                textColor={isActive ? theme.colors.primary : theme.colors.background}
                icon={isUnlocked ? "palette-outline" : "lock-open-outline"}
                onPress={() => chooseTheme(theme.id, isUnlocked)}
              >
                {actionLabel}
              </Button>
            </View>
          );
        })}
      </View>
      {shopError ? <Text style={styles.errorText}>{shopError}</Text> : null}
    </AppCard>
  );
}

export default function ProfileScreen() {
  const {
    subjects,
    sessions,
    goals,
    savedQuestions,
    reflections,
    notes,
    gamification,
    loading,
    fetchAll,
    saveGoal,
    createSubject,
    unlockTheme,
    applyTheme
  } = useAppStore();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

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
    const delta = adaptive - baseline;
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

  const signOut = async () => {
    await logout();
    router.replace("/(auth)/login");
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
        </View>
        <Button mode="outlined" icon="logout" onPress={signOut}>
          Log out
        </Button>
      </View>

      <AppCard>
        <XPBar gamification={gamification} />
      </AppCard>

      <ThemeShop gamification={gamification} onUnlock={unlockTheme} onApply={applyTheme} />

      <AppCard style={styles.atarCard}>
        <View>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Adaptive ATAR projection
          </Text>
          <Text style={styles.muted}>Target scores plus this week's study momentum, consistency and learning evidence.</Text>
        </View>
        <View style={styles.atarRow}>
          <Text style={styles.atar}>{atarProjection.adaptive.toFixed(2)}</Text>
          <View style={[styles.deltaPill, atarProjection.delta >= 0 ? styles.deltaPositive : styles.deltaSoft]}>
            <Text style={styles.deltaText}>
              {atarProjection.delta >= 0 ? "+" : ""}
              {atarProjection.delta.toFixed(2)}
            </Text>
          </View>
        </View>
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
                      {subject.studyDays === 1 ? "" : "s"}
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
        <Text style={styles.baselineText}>Target-only baseline: {atarProjection.baseline.toFixed(2)}</Text>
        <Text style={styles.disclaimer}>Estimate only. Official scaling and ATAR conversion changes each year.</Text>
      </AppCard>

      <View>
        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Subjects and goals
          </Text>
          <Button mode="outlined" icon="plus" onPress={() => setAddSubjectOpen(true)}>
            Add
          </Button>
        </View>
      </View>
      {subjects.length ? (
        subjects.map((subject) => (
          <GoalCard
            key={subject.id}
            subject={subject}
            goal={goals.find((goal) => goal.subjectId === subject.id)}
            weekSeconds={weeklySecondsBySubject[subject.id] ?? 0}
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
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  shopCard: {
    gap: 14
  },
  shopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  coinPill: {
    minWidth: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}18`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center"
  },
  coinValue: {
    color: palette.text,
    fontSize: 22,
    lineHeight: 26,
    fontFamily: "Outfit_700Bold"
  },
  coinLabel: {
    color: palette.muted,
    fontSize: 11
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  themeItem: {
    width: "48%",
    minWidth: 148,
    flexGrow: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 10
  },
  themePreview: {
    height: 82,
    borderRadius: 8,
    padding: 10,
    justifyContent: "flex-end"
  },
  themePreviewCard: {
    borderRadius: 6,
    padding: 8,
    gap: 6
  },
  themePreviewLine: {
    width: "72%",
    height: 8,
    borderRadius: 8
  },
  themePreviewLineShort: {
    width: "46%",
    height: 8,
    borderRadius: 8
  },
  themeTextRow: {
    gap: 2
  },
  themeName: {
    fontFamily: "Outfit_700Bold"
  },
  themePrice: {
    fontSize: 12
  },
  errorText: {
    color: palette.secondary,
    lineHeight: 18
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
