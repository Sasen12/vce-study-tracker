import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Text } from "react-native-paper";
import Animated from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { WeeklyChart } from "@/components/charts/WeeklyChart";
import { LEVELS, titleLabelById } from "@/constants/gamification";
import { motion } from "@/constants/motion";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import { buildWeeklyReport, isFlashcardNote, isMistakeNote, isSacPanicNote } from "@/utils/vceCoach";
import { getActiveStreak } from "@/utils/streaks";
import type { StudentSubjectMemory } from "@/types";

type MemoryTopic = {
  topic?: string | null;
  title?: string | null;
  detail?: string | null;
  evidence?: string | null;
  confidence?: string | null;
  count?: number;
  weight?: number;
  lastSeenAt?: string | null;
  sourceTypes?: string[];
};

type MemoryAssessment = {
  id?: string;
  title?: string;
  eventType?: string;
  eventDate?: string;
  daysUntil?: number;
  topic?: string;
  subject?: string;
};

type EvidenceItem = {
  at?: string;
  type?: string;
  topic?: string | null;
  title?: string;
  evidence?: string;
  sourceType?: string;
};

type StudyMethod = {
  method?: string;
  reason?: string;
  topic?: string | null;
  evidence?: string;
  confidence?: string;
};

const startOfWeek = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value.filter(Boolean) as T[]) : []);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const riskRank = (risk: string) => (risk === "high" ? 3 : risk === "medium" ? 2 : 1);
const riskColor = (risk: string) => {
  if (risk === "high") return palette.secondary;
  if (risk === "medium") return palette.warning;
  return palette.success;
};
const riskLabel = (risk: string) => `${risk.slice(0, 1).toUpperCase()}${risk.slice(1)} risk`;
const compactDate = (value?: string | null) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(value));
};
const topicTitle = (item: MemoryTopic) => item.topic || item.title || "General";
const topicDetail = (item: MemoryTopic) => item.detail || item.evidence || "Recent signal";
const subjectKey = (memory: StudentSubjectMemory) => memory.subjectKey || memory.subjectId || memory.subjectName;
const subjectColorFor = (memory: StudentSubjectMemory, index: number) =>
  memory.subject?.color ?? paletteByIndex[index % paletteByIndex.length];
const paletteByIndex = [palette.primary, palette.info, palette.success, palette.warning, palette.secondary, "#22D3EE", "#F472B6"];

const masteryFor = (memory: StudentSubjectMemory) => {
  const strengths = asArray<MemoryTopic>(memory.strengths);
  const weakAreas = asArray<MemoryTopic>(memory.weakAreas);
  const mistakes = asArray<MemoryTopic>(memory.commonMistakes);
  const recentTopics = asArray<MemoryTopic>(memory.recentTopics);
  const riskPenalty = memory.riskLevel === "high" ? 18 : memory.riskLevel === "medium" ? 10 : 3;
  return clamp(58 + strengths.length * 8 + recentTopics.length * 2 - weakAreas.length * 7 - mistakes.length * 4 - riskPenalty, 14, 96);
};

const listKey = (item: MemoryTopic | EvidenceItem | StudyMethod | MemoryAssessment, fallback: string) =>
  [("topic" in item && item.topic) || ("title" in item && item.title) || ("method" in item && item.method), fallback].filter(Boolean).join("-");

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.miniTrack}>
      <View style={[styles.miniFill, { width: `${clamp(value, 0, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function SignalList({
  items,
  emptyTitle,
  emptyBody,
  accent
}: {
  items: MemoryTopic[];
  emptyTitle: string;
  emptyBody: string;
  accent: string;
}) {
  if (!items.length) return <EmptyState title={emptyTitle} body={emptyBody} />;

  return (
    <View style={styles.signalStack}>
      {items.slice(0, 5).map((item, index) => (
        <View key={listKey(item, String(index))} style={styles.signalRow}>
          <View style={[styles.signalIndex, { borderColor: `${accent}66`, backgroundColor: `${accent}16` }]}>
            <Text style={[styles.signalIndexText, { color: accent }]}>{index + 1}</Text>
          </View>
          <View style={styles.flexText}>
            <Text style={styles.signalTitle}>{topicTitle(item)}</Text>
            <Text style={styles.signalDetail}>{topicDetail(item)}</Text>
            {item.evidence ? <Text style={styles.evidenceText}>Evidence: {item.evidence}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function StudentMapScreen() {
  useTrackScreen("insights");
  const {
    subjects,
    sessions,
    events,
    stats,
    goals,
    savedQuestions,
    notes,
    subjectMemories,
    gamification,
    loading,
    fetchAll,
    refreshStudentMemoryMap
  } = useAppStore();
  const [selectedMemoryKey, setSelectedMemoryKey] = useState<string | null>(null);
  const [refreshingMap, setRefreshingMap] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const xp = gamification?.totalXp ?? 0;
  const level = LEVELS.find((item) => item.level === (gamification?.level ?? 1)) ?? LEVELS[0];
  const nextLevel = LEVELS.find((item) => item.xp > xp) ?? LEVELS[LEVELS.length - 1];
  const previousLevel = LEVELS.filter((item) => item.xp <= xp).at(-1) ?? LEVELS[0];
  const xpProgress = nextLevel.xp === previousLevel.xp ? 1 : (xp - previousLevel.xp) / (nextLevel.xp - previousLevel.xp);
  const todayMinutes = Math.round((stats?.todaySeconds ?? 0) / 60);
  const weekMinutes = Math.round((stats?.weekSeconds ?? 0) / 60);
  const monthMinutes = Math.round((stats?.monthSeconds ?? 0) / 60);
  const activeStreak = getActiveStreak(gamification);
  const dailyTargetMinutes = useMemo(() => {
    const weeklyHours = goals.reduce((sum, goal) => sum + Number(goal.weeklyHoursTarget ?? 0), 0);
    return weeklyHours ? Math.round((weeklyHours * 60) / 7) : 120;
  }, [goals]);
  const weekStart = useMemo(startOfWeek, []);
  const weeklyReport = useMemo(
    () => buildWeeklyReport({ subjects, sessions, goals, notes, savedQuestions, gamification }),
    [gamification, goals, notes, savedQuestions, sessions, subjects]
  );
  const chartData = useMemo(
    () =>
      Object.values(stats?.perSubject ?? {}).map((item) => ({
        label: item.subjectName,
        value: item.seconds / 3600,
        color: item.color
      })),
    [stats?.perSubject]
  );
  const weeklySecondsBySubject = useMemo(
    () =>
      sessions.reduce<Record<string, number>>((acc, session) => {
        if (!session.subjectId || new Date(session.createdAt) < weekStart) return acc;
        acc[session.subjectId] = (acc[session.subjectId] ?? 0) + session.durationSeconds;
        return acc;
      }, {}),
    [sessions, weekStart]
  );
  const subjectPace = useMemo(
    () =>
      subjects
        .map((subject) => {
          const goal = goals.find((item) => item.subjectId === subject.id);
          const targetHours = Number(goal?.weeklyHoursTarget ?? 5);
          const weekHours = (weeklySecondsBySubject[subject.id] ?? 0) / 3600;
          const progress = targetHours ? weekHours / targetHours : 0;
          return { subject, targetHours, weekHours, progress };
        })
        .sort((a, b) => a.progress - b.progress || a.subject.subjectName.localeCompare(b.subject.subjectName)),
    [goals, subjects, weeklySecondsBySubject]
  );
  const sortedMemories = useMemo(
    () =>
      [...subjectMemories].sort(
        (a, b) =>
          riskRank(b.riskLevel) - riskRank(a.riskLevel) ||
          masteryFor(a) - masteryFor(b) ||
          a.subjectName.localeCompare(b.subjectName)
      ),
    [subjectMemories]
  );
  const selectedMemory = useMemo(
    () => sortedMemories.find((memory) => subjectKey(memory) === selectedMemoryKey) ?? sortedMemories[0] ?? null,
    [selectedMemoryKey, sortedMemories]
  );
  const selectedIndex = selectedMemory ? sortedMemories.findIndex((memory) => subjectKey(memory) === subjectKey(selectedMemory)) : 0;
  const selectedColor = selectedMemory ? subjectColorFor(selectedMemory, selectedIndex) : palette.primary;
  const selectedMastery = selectedMemory ? masteryFor(selectedMemory) : 0;
  const selectedWeakAreas = asArray<MemoryTopic>(selectedMemory?.weakAreas);
  const selectedMistakes = asArray<MemoryTopic>(selectedMemory?.commonMistakes);
  const selectedStrengths = asArray<MemoryTopic>(selectedMemory?.strengths);
  const selectedTopics = asArray<MemoryTopic>(selectedMemory?.recentTopics);
  const selectedAssessments = asArray<MemoryAssessment>(selectedMemory?.upcomingAssessments);
  const selectedMethods = asArray<StudyMethod>(selectedMemory?.bestStudyMethods);
  const selectedEvidence = asArray<EvidenceItem>(selectedMemory?.evidenceTrail);
  const memoryStats = useMemo(
    () => ({
      subjects: sortedMemories.length,
      highRisk: sortedMemories.filter((memory) => memory.riskLevel === "high").length,
      weakAreas: sortedMemories.reduce((sum, memory) => sum + asArray<MemoryTopic>(memory.weakAreas).length, 0),
      evidence: sortedMemories.reduce((sum, memory) => sum + asArray<EvidenceItem>(memory.evidenceTrail).length, 0)
    }),
    [sortedMemories]
  );
  const continueItems = useMemo(() => {
    const latestPanicPlan = notes.filter(isSacPanicNote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const latestMistake = notes.filter(isMistakeNote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const latestFlashcard = notes.filter(isFlashcardNote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

    return [
      latestPanicPlan
        ? {
            icon: "calendar-alert" as const,
            title: "Resume SAC plan",
            body: latestPanicPlan.title.replace(/^SAC Panic:\s*/, ""),
            route: "/(tabs)/study" as const
          }
        : null,
      latestMistake
        ? {
            icon: "alert-circle-check-outline" as const,
            title: "Review latest mistake",
            body: latestMistake.title.replace(/^Mistake:\s*/, ""),
            route: { pathname: "/(tabs)/questions" as const, params: { mode: "tools", toolMode: "mistakes" } }
          }
        : null,
      latestFlashcard
        ? {
            icon: "cards-outline" as const,
            title: "Flip flashcards",
            body: latestFlashcard.title.replace(/^Flashcard:\s*/, ""),
            route: { pathname: "/(tabs)/questions" as const, params: { mode: "tools", toolMode: "flashcards" } }
          }
        : null
    ].filter(Boolean) as {
      icon: keyof typeof MaterialCommunityIcons.glyphMap;
      title: string;
      body: string;
      route: string | { pathname: string; params: Record<string, string> };
    }[];
  }, [notes]);

  const rebuildMap = async () => {
    setRefreshingMap(true);
    setMapMessage(null);
    try {
      await refreshStudentMemoryMap();
      setMapMessage("Student Map refreshed.");
    } catch (error) {
      setMapMessage(error instanceof Error ? error.message : "Could not refresh Student Map.");
    } finally {
      setRefreshingMap(false);
    }
  };

  if (loading && !stats && !subjectMemories.length) {
    return (
      <Screen>
        <SkeletonStack />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Student Map</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Learning profile
          </Text>
        </View>
        <Button mode="outlined" icon="home-outline" onPress={() => router.push("/(tabs)")}>
          Home
        </Button>
      </View>

      {mapMessage ? <Text style={styles.mapMessage}>{mapMessage}</Text> : null}

      <Animated.View entering={motion.card(16)}>
        <AppCard style={styles.mapHero}>
          {selectedMemory ? (
            <>
              <ProgressRing
                size={112}
                stroke={9}
                progress={selectedMastery / 100}
                label={`${selectedMastery}%`}
                sublabel="mastery"
                color={selectedColor}
              />
              <View style={styles.heroText}>
                <View style={styles.heroTopRow}>
                  <View style={styles.flexText}>
                    <Text style={styles.heroSubject}>{selectedMemory.subjectName}</Text>
                    <Text style={styles.muted}>{titleLabelById(gamification?.activeTitle)}</Text>
                  </View>
                  <View style={[styles.riskPill, { borderColor: `${riskColor(selectedMemory.riskLevel)}66`, backgroundColor: `${riskColor(selectedMemory.riskLevel)}16` }]}>
                    <MaterialCommunityIcons name="radar" color={riskColor(selectedMemory.riskLevel)} size={15} />
                    <Text style={[styles.riskPillText, { color: riskColor(selectedMemory.riskLevel) }]}>
                      {riskLabel(selectedMemory.riskLevel)}
                    </Text>
                  </View>
                </View>
                <View style={styles.nextMoveBox}>
                  <Text style={styles.nextMoveLabel}>Next move</Text>
                  <Text style={styles.nextMoveText}>{selectedMemory.predictedNextTask ?? "Complete one checked practice answer."}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyMapWrap}>
              <EmptyState title="Student Map is empty" body="Ask Coach, check answers, save mistakes, upload resources, or rebuild from existing signals." />
              <Button mode="contained" icon="map-sync-outline" loading={refreshingMap} disabled={refreshingMap} onPress={rebuildMap}>
                Rebuild map
              </Button>
            </View>
          )}
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(30)}>
        <AppCard style={styles.metricCard}>
          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{memoryStats.subjects}</Text>
              <Text style={styles.metricLabel}>mapped subjects</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{memoryStats.highRisk}</Text>
              <Text style={styles.metricLabel}>high risk</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{memoryStats.weakAreas}</Text>
              <Text style={styles.metricLabel}>weak areas</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{memoryStats.evidence}</Text>
              <Text style={styles.metricLabel}>evidence points</Text>
            </View>
          </View>
          <Button mode="outlined" icon="map-sync-outline" loading={refreshingMap} disabled={refreshingMap} onPress={rebuildMap}>
            Refresh Student Map
          </Button>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(44)}>
        <AppCard style={styles.section}>
          <View style={styles.rowBetween}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Subject mastery map
            </Text>
            <Text style={styles.muted}>{sortedMemories.length || subjects.length} subjects</Text>
          </View>
          {sortedMemories.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectMapRow}>
              {sortedMemories.map((memory, index) => {
                const active = selectedMemory && subjectKey(memory) === subjectKey(selectedMemory);
                const color = subjectColorFor(memory, index);
                const mastery = masteryFor(memory);
                return (
                  <Pressable
                    key={subjectKey(memory)}
                    style={[styles.subjectMapTile, active && { borderColor: `${color}88`, backgroundColor: `${color}12` }]}
                    onPress={() => setSelectedMemoryKey(subjectKey(memory))}
                  >
                    <View style={styles.subjectMapTop}>
                      <View style={[styles.subjectDot, { backgroundColor: color }]} />
                      <Text style={[styles.subjectRisk, { color: riskColor(memory.riskLevel) }]}>{memory.riskLevel}</Text>
                    </View>
                    <Text style={styles.subjectMapName} numberOfLines={2}>
                      {memory.subjectName}
                    </Text>
                    <MiniBar value={mastery} color={color} />
                    <Text style={styles.subjectMapValue}>{mastery}% mastery</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <EmptyState title="No mapped subjects yet" body="The map fills in after saved coach turns, checked answers, mistakes, resources and study sessions." />
          )}
        </AppCard>
      </Animated.View>

      {selectedMemory ? (
        <>
          <Animated.View entering={motion.card(58)}>
            <AppCard style={styles.section}>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Weak area tracker
                </Text>
                {selectedWeakAreas.length > 0 && selectedMemory?.subjectId ? (
                  <Button
                    mode="contained-tonal"
                    compact
                    icon="target"
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/questions",
                        params: {
                          mode: "generate",
                          subjectId: selectedMemory.subjectId!,
                          topic: selectedWeakAreas[0].topic ?? selectedWeakAreas[0].title ?? "",
                          difficulty: "hard"
                        }
                      })
                    }
                  >
                    Drill
                  </Button>
                ) : null}
              </View>
              <SignalList
                items={selectedWeakAreas}
                emptyTitle="No weak areas mapped"
                emptyBody="Checked answers and saved mistakes will calibrate this."
                accent={palette.secondary}
              />
            </AppCard>
          </Animated.View>

          <Animated.View entering={motion.card(72)}>
            <AppCard style={styles.section}>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Common mistakes
                </Text>
                {selectedMistakes.length > 0 ? (
                  <Button
                    mode="outlined"
                    compact
                    icon="alert-circle-check-outline"
                    onPress={() => router.push({ pathname: "/(tabs)/questions", params: { mode: "tools", toolMode: "mistakes" } })}
                  >
                    Review
                  </Button>
                ) : null}
              </View>
              <SignalList
                items={selectedMistakes}
                emptyTitle="No repeat mistakes yet"
                emptyBody="Mistake logs and marked answers will appear here."
                accent={palette.warning}
              />
            </AppCard>
          </Animated.View>

          <Animated.View entering={motion.card(86)}>
            <AppCard style={styles.section}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Strengths
              </Text>
              <SignalList
                items={selectedStrengths}
                emptyTitle="No strengths confirmed"
                emptyBody="Strong checked answers will add proof here."
                accent={palette.success}
              />
            </AppCard>
          </Animated.View>

          <Animated.View entering={motion.card(100)}>
            <AppCard style={styles.section}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Risk links
              </Text>
              {selectedAssessments.length ? (
                selectedAssessments.slice(0, 5).map((assessment, index) => (
                  <View key={assessment.id ?? `${assessment.title}-${index}`} style={styles.assessmentRow}>
                    <View style={[styles.assessmentBadge, { borderColor: `${riskColor(selectedMemory.riskLevel)}55` }]}>
                      <Text style={[styles.assessmentDays, { color: riskColor(selectedMemory.riskLevel) }]}>
                        {assessment.daysUntil ?? 0}d
                      </Text>
                    </View>
                    <View style={styles.flexText}>
                      <Text style={styles.signalTitle}>{assessment.title ?? "Assessment"}</Text>
                      <Text style={styles.signalDetail}>
                        {assessment.eventType ?? "TASK"} - {compactDate(assessment.eventDate)}
                      </Text>
                      {assessment.topic ? <Text style={styles.evidenceText}>{assessment.topic}</Text> : null}
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState title="No upcoming risk link" body="Calendar SACs and exams will connect here." />
              )}
            </AppCard>
          </Animated.View>

          <Animated.View entering={motion.card(114)}>
            <AppCard style={styles.section}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                What the app has learned
              </Text>
              <View style={styles.learnedGrid}>
                <View style={styles.learnedColumn}>
                  <Text style={styles.learnedLabel}>Recent topics</Text>
                  {selectedTopics.slice(0, 5).map((item, index) => (
                    <Text key={listKey(item, String(index))} style={styles.learnedItem}>
                      - {topicTitle(item)}
                    </Text>
                  ))}
                  {!selectedTopics.length ? <Text style={styles.muted}>No topic pattern yet.</Text> : null}
                </View>
                <View style={styles.learnedColumn}>
                  <Text style={styles.learnedLabel}>Best study methods</Text>
                  {selectedMethods.slice(0, 4).map((item, index) => (
                    <Text key={listKey(item, String(index))} style={styles.learnedItem}>
                      - {item.method ?? item.reason ?? "Checked practice"}
                    </Text>
                  ))}
                  {!selectedMethods.length ? <Text style={styles.muted}>No method pattern yet.</Text> : null}
                </View>
              </View>
            </AppCard>
          </Animated.View>

          <Animated.View entering={motion.card(128)}>
            <AppCard style={styles.section}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Evidence trail
              </Text>
              {selectedEvidence.length ? (
                selectedEvidence.slice(0, 8).map((item, index) => (
                  <View key={`${item.at}-${index}`} style={styles.evidenceRow}>
                    <MaterialCommunityIcons name="source-branch" color={selectedColor} size={18} />
                    <View style={styles.flexText}>
                      <Text style={styles.signalTitle}>
                        {item.title ?? item.topic ?? item.type ?? "Signal"} {item.at ? `- ${compactDate(item.at)}` : ""}
                      </Text>
                      <Text style={styles.signalDetail}>{item.evidence ?? "Saved app activity"}</Text>
                      <Text style={styles.evidenceText}>{item.sourceType ?? item.type ?? "memory event"}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <EmptyState title="No evidence trail yet" body="Every new coach turn, mistake and checked answer adds proof." />
              )}
            </AppCard>
          </Animated.View>
        </>
      ) : null}

      <Animated.View entering={motion.card(142)}>
        <AppCard style={styles.levelCard}>
          <ProgressRing
            size={96}
            stroke={8}
            progress={xpProgress}
            label={`Lvl ${gamification?.level ?? 1}`}
            sublabel={`${gamification?.xpBalance ?? 0} coins`}
            color={palette.warning}
          />
          <View style={styles.levelText}>
            <Text style={styles.levelTitle}>{level.title}</Text>
            <Text style={styles.muted}>{titleLabelById(gamification?.activeTitle)}</Text>
            <View style={styles.xpStats}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{xp}</Text>
                <Text style={styles.statLabel}>total XP</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{activeStreak}</Text>
                <Text style={styles.statLabel}>day streak</Text>
              </View>
            </View>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(156)}>
        <AppCard style={styles.reportCard}>
          <View style={styles.rowBetween}>
            <View style={styles.flexText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Weekly study report
              </Text>
              <Text style={styles.muted}>Study time, mistakes and review pressure.</Text>
            </View>
            <View style={styles.reportBadge}>
              <Text style={styles.reportBadgeValue}>{weeklyReport.totalMinutes}</Text>
              <Text style={styles.reportBadgeLabel}>min</Text>
            </View>
          </View>
          {weeklyReport.lines.map((line) => (
            <Text key={line} style={styles.reportLine}>
              - {line}
            </Text>
          ))}
          <Text style={styles.nextActionText}>{weeklyReport.nextMove}</Text>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(170)}>
        <AppCard style={styles.metricCard}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Study pulse
          </Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{todayMinutes}</Text>
              <Text style={styles.metricLabel}>today min</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{weekMinutes}</Text>
              <Text style={styles.metricLabel}>week min</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{monthMinutes}</Text>
              <Text style={styles.metricLabel}>month min</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{notes.length + savedQuestions.length}</Text>
              <Text style={styles.metricLabel}>learning items</Text>
            </View>
          </View>
          <View style={styles.todayTargetRow}>
            <ProgressRing
              size={80}
              stroke={8}
              progress={todayMinutes / dailyTargetMinutes}
              label={`${Math.min(100, Math.round((todayMinutes / dailyTargetMinutes) * 100))}%`}
              sublabel="today"
              color={palette.success}
            />
            <View style={styles.flexText}>
              <Text style={styles.targetTitle}>Daily target</Text>
              <Text style={styles.muted}>
                {todayMinutes}/{dailyTargetMinutes} minutes logged. Upcoming assessments tracked: {events.filter((event) => !event.completed).length}.
              </Text>
            </View>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(184)}>
        <AppCard style={styles.chartCard}>
          <View style={styles.rowBetween}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Subject mix
            </Text>
            <Text style={styles.muted}>{Math.round((stats?.weekSeconds ?? 0) / 3600)}h this week</Text>
          </View>
          <WeeklyChart data={chartData} />
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(198)}>
        <AppCard style={styles.section}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Weekly pace
          </Text>
          {subjectPace.length ? (
            subjectPace.map((item) => {
              const pct = Math.min(item.progress, 1);
              const color = item.progress >= 1 ? palette.success : item.progress >= 0.5 ? item.subject.color : palette.secondary;
              return (
                <View key={item.subject.id} style={styles.paceRow}>
                  <View style={[styles.subjectDot, { backgroundColor: item.subject.color }]} />
                  <View style={styles.paceText}>
                    <View style={styles.paceTitleRow}>
                      <Text style={styles.paceTitle} numberOfLines={1}>
                        {item.subject.subjectName}
                      </Text>
                      <Text style={[styles.paceValue, item.progress >= 1 ? styles.paceDone : styles.paceBehind]}>
                        {Math.round(item.weekHours * 10) / 10}/{item.targetHours || 0}h
                      </Text>
                    </View>
                    <View style={styles.paceBarTrack}>
                      <View style={[styles.paceBarFill, { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <EmptyState title="No subject goals yet" body="Add subjects and weekly targets from Profile." />
          )}
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(212)}>
        <AppCard style={styles.section}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Continue
          </Text>
          {continueItems.length ? (
            continueItems.map((item) => (
              <Pressable key={item.title} style={styles.continueRow} onPress={() => router.push(item.route)}>
                <View style={styles.continueIcon}>
                  <MaterialCommunityIcons name={item.icon} color={palette.info} size={18} />
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.paceTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {item.body}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyState title="Nothing paused" body="SAC plans, mistakes and flashcards will appear here after you use them." />
          )}
        </AppCard>
      </Animated.View>
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
  headerText: {
    flex: 1,
    minWidth: 0
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
  flexText: {
    flex: 1,
    minWidth: 0
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  mapMessage: {
    color: palette.success,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  },
  mapHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderColor: "rgba(96,165,250,0.26)",
    backgroundColor: "rgba(96,165,250,0.08)"
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 10
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap"
  },
  heroSubject: {
    color: palette.text,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Outfit_700Bold"
  },
  riskPill: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  riskPillText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  nextMoveBox: {
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12
  },
  nextMoveLabel: {
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  nextMoveText: {
    color: palette.text,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  emptyMapWrap: {
    flex: 1,
    gap: 12
  },
  metricCard: {
    gap: 14
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metricTile: {
    minWidth: 126,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12
  },
  metricValue: {
    color: palette.text,
    fontSize: 22,
    fontFamily: "Outfit_700Bold"
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18
  },
  section: {
    gap: 12
  },
  subjectMapRow: {
    gap: 10,
    paddingVertical: 2
  },
  subjectMapTile: {
    width: 164,
    minHeight: 126,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12,
    gap: 9
  },
  subjectMapTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  subjectDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  subjectRisk: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  subjectMapName: {
    minHeight: 38,
    color: palette.text,
    lineHeight: 19,
    fontFamily: "Outfit_700Bold"
  },
  miniTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  miniFill: {
    height: "100%",
    borderRadius: 8
  },
  subjectMapValue: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  signalStack: {
    gap: 12
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  signalIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  signalIndexText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  signalTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  signalDetail: {
    color: palette.text,
    lineHeight: 20
  },
  evidenceText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17
  },
  assessmentRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  assessmentBadge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  assessmentDays: {
    fontFamily: "Outfit_700Bold"
  },
  learnedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  learnedColumn: {
    flex: 1,
    minWidth: 240,
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12
  },
  learnedLabel: {
    color: palette.info,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    textTransform: "uppercase"
  },
  learnedItem: {
    color: palette.text,
    lineHeight: 19
  },
  evidenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  levelCard: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    borderColor: "rgba(245,158,11,0.24)",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  levelText: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  levelTitle: {
    color: palette.text,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Outfit_700Bold"
  },
  xpStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statTile: {
    minWidth: 104,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10
  },
  statValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12
  },
  reportCard: {
    gap: 10,
    borderColor: "rgba(74,222,128,0.22)",
    backgroundColor: "rgba(74,222,128,0.07)"
  },
  reportBadge: {
    minWidth: 78,
    minHeight: 58,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.success}18`,
    borderWidth: 1,
    borderColor: `${palette.success}55`,
    paddingHorizontal: 10
  },
  reportBadgeValue: {
    color: palette.text,
    fontSize: 20,
    fontFamily: "Outfit_700Bold"
  },
  reportBadgeLabel: {
    color: palette.success,
    fontSize: 11,
    fontFamily: "Outfit_700Bold"
  },
  reportLine: {
    color: palette.text,
    lineHeight: 20
  },
  nextActionText: {
    color: palette.info,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  todayTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  targetTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    marginBottom: 2
  },
  chartCard: {
    gap: 8
  },
  paceRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  paceText: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  paceTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  paceBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  paceBarFill: {
    height: 6,
    borderRadius: 3
  },
  paceTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    flex: 1,
    minWidth: 0
  },
  paceValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  paceDone: {
    color: palette.success
  },
  paceBehind: {
    color: palette.warning
  },
  continueRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  continueIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.info}18`
  }
});
