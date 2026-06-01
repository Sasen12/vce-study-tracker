import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, Text, TextInput } from "react-native-paper";
import Animated from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { Screen } from "@/components/ui/Screen";
import { motion } from "@/constants/motion";
import { palette } from "@/constants/theme";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useTrackScreen } from "@/hooks/useTrackScreen";

const moreItems = [
  {
    title: "Insights",
    detail: "Weak spots",
    icon: "map-search-outline",
    accent: palette.primary,
    route: "/(tabs)/insights"
  },
  {
    title: "Shop",
    detail: "Themes and badges",
    icon: "shopping-outline",
    accent: palette.success,
    route: "/(tabs)/shop"
  },
  {
    title: "Profile",
    detail: "Subjects and defaults",
    icon: "account-circle-outline",
    accent: "#60A5FA",
    route: "/(tabs)/profile"
  },
  {
    title: "Guide",
    detail: "Guided start",
    icon: "compass-outline",
    accent: palette.warning,
    route: "/(tabs)/onboarding"
  },
  {
    title: "Chess break",
    detail: "Reset tool",
    icon: "chess-knight",
    accent: palette.info,
    route: "/(tabs)/study"
  }
] as const;

const studyDiceMissions = [
  {
    label: "10 minute repair",
    title: "Fix one mistake properly.",
    detail: "Pick a recent mistake, rewrite the rule, then do one similar question.",
    icon: "wrench-outline",
    accent: palette.secondary
  },
  {
    label: "Command term snap",
    title: "Write one answer with a verb.",
    detail: "Choose analyse, evaluate or explain. Write the answer, then underline the evidence.",
    icon: "lightning-bolt-outline",
    accent: palette.warning
  },
  {
    label: "SAC pressure check",
    title: "Find the next date that can hurt you.",
    detail: "Open Calendar, pick the closest SAC, and plan one block backwards from it.",
    icon: "calendar-alert",
    accent: palette.info
  },
  {
    label: "Low energy mode",
    title: "Make one clean note.",
    detail: "Turn one messy page into five bullet points. No perfection, just usable evidence.",
    icon: "note-edit-outline",
    accent: palette.success
  },
  {
    label: "Question forge",
    title: "Make the topic answer back.",
    detail: "Generate or save three questions from the topic you keep avoiding.",
    icon: "cards-outline",
    accent: palette.primary
  }
] as const;

const commandTerms = [
  {
    term: "Explain",
    move: "Give the reason, then link it to the result.",
    frame: "Because -> this means -> therefore",
    accent: palette.info
  },
  {
    term: "Analyse",
    move: "Break the idea into parts and show how they connect.",
    frame: "Cause -> effect -> consequence",
    accent: palette.primary
  },
  {
    term: "Evaluate",
    move: "Make a judgement after weighing strength and limitation.",
    frame: "Benefit -> limit -> final judgement",
    accent: palette.warning
  },
  {
    term: "Discuss",
    move: "Show both sides before landing on a clear position.",
    frame: "For -> against -> depends on",
    accent: palette.success
  }
] as const;

const sacChecklist = [
  "SAC date checked",
  "One weak topic picked",
  "One timed question done",
  "Teacher feedback reviewed",
  "Formula/quote/criteria ready"
] as const;

const markTargets = [2, 4, 6, 10, 15] as const;

const answerFrames = [
  {
    label: "4 mark",
    title: "Tight paragraph",
    steps: ["Define the key idea", "Apply to the case", "Explain the effect", "Link to the question"],
    accent: palette.info
  },
  {
    label: "10 mark",
    title: "Balanced response",
    steps: ["Set the argument", "Use two clear points", "Bring evidence in", "Judge, don't waffle"],
    accent: palette.warning
  },
  {
    label: "Essay",
    title: "Controlled essay",
    steps: ["Contention first", "Topic sentence", "Evidence and analysis", "Mini judgement"],
    accent: palette.primary
  }
] as const;

const folioChecklist = [
  "Task requirements understood",
  "Evidence screenshot saved",
  "Decision justified",
  "Feedback acted on",
  "Reflection written"
] as const;

const confidenceMoves = [
  "Open notes and rebuild one clean example.",
  "Do one easy question without help.",
  "Do one medium question and mark it.",
  "Push a timed hard question.",
  "Teach the idea in five lines."
] as const;

const memoryPrompts = [
  "Cover the notes. Write everything you remember in 90 seconds.",
  "Make one fake SAC question from this topic.",
  "Write the common mistake before writing the correct answer.",
  "Explain the topic to a tired Year 10 student.",
  "Turn one paragraph into three trigger words."
] as const;

const deadlinePlans = [
  {
    label: "Tomorrow",
    title: "Damage control",
    move: "Do one timed question, mark it, then write the rule you keep missing.",
    accent: palette.secondary
  },
  {
    label: "3 days",
    title: "Triage week",
    move: "Pick two weak topics, do one drill for each, then save the correction.",
    accent: palette.warning
  },
  {
    label: "7 days",
    title: "Build pressure slowly",
    move: "Alternate notes, timed practice, and correction so memory survives.",
    accent: palette.info
  },
  {
    label: "14 days",
    title: "Calm runway",
    move: "Map the study design, choose weak areas, and schedule three proof sessions.",
    accent: palette.success
  }
] as const;

const mistakeAutopsy = [
  "What did the question actually ask?",
  "Where did marks leak?",
  "What rule fixes it?",
  "What similar question proves it?"
] as const;

const teacherQuestionPrompts = [
  {
    label: "Marks",
    prompt: "Could you show me where this answer loses marks and what one sentence would fix it?",
    accent: palette.info
  },
  {
    label: "Criteria",
    prompt: "Which criterion is weakest here, and what evidence would make it stronger?",
    accent: palette.primary
  },
  {
    label: "SAC prep",
    prompt: "What topic should I prioritise tonight if I only have 30 minutes before the SAC?",
    accent: palette.warning
  },
  {
    label: "Folio",
    prompt: "Is this enough evidence for my decision, or do I need another screenshot/explanation?",
    accent: "#60A5FA"
  }
] as const;

const resourceModes = [
  {
    label: "Messy notes",
    action: "Rewrite one page into five bullet points and one test question.",
    accent: palette.primary
  },
  {
    label: "Screenshot",
    action: "Name what it proves, then attach one sentence explaining why it matters.",
    accent: "#60A5FA"
  },
  {
    label: "Video",
    action: "Pause after one example. Solve one question before watching more.",
    accent: palette.secondary
  },
  {
    label: "Feedback",
    action: "Turn the comment into a rule, then redo the smallest failed part.",
    accent: palette.warning
  }
] as const;

const contractOptions = [12, 25, 45] as const;

const toolCategories = [
  { id: "all", label: "All" },
  { id: "sac", label: "SAC" },
  { id: "exam", label: "Exam" },
  { id: "folio", label: "Folio" },
  { id: "memory", label: "Memory" },
  { id: "reset", label: "Reset" },
  { id: "routes", label: "App" }
] as const;

type ToolCategory = (typeof toolCategories)[number]["id"];

const toolFinderItems: {
  title: string;
  detail: string;
  category: Exclude<ToolCategory, "all">;
  keywords: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  accent: string;
  route?: "/(tabs)/study" | "/(tabs)/questions" | "/(tabs)/calendar" | "/(tabs)/insights" | "/(tabs)/shop" | "/(tabs)/profile";
}[] = [
  {
    title: "Study dice",
    detail: "Pick a tiny mission when you feel stuck.",
    category: "reset",
    keywords: "random mission stuck low energy",
    icon: "dice-d20-outline",
    accent: palette.secondary,
    route: "/(tabs)/study"
  },
  {
    title: "Command decoder",
    detail: "Explain, analyse, evaluate and discuss frames.",
    category: "exam",
    keywords: "command terms answer frame evaluate analyse explain discuss",
    icon: "text-box-check-outline",
    accent: palette.info
  },
  {
    title: "Pre-SAC check",
    detail: "A fast checklist before assessment pressure hits.",
    category: "sac",
    keywords: "sac checklist assessment teacher feedback",
    icon: "clipboard-check-outline",
    accent: palette.warning
  },
  {
    title: "Answer skeleton",
    detail: "Structure 4 mark, 10 mark and essay responses.",
    category: "exam",
    keywords: "marks essay paragraph structure",
    icon: "format-list-numbered",
    accent: palette.primary
  },
  {
    title: "Folio checkpoint",
    detail: "Evidence, screenshots, decisions and reflections.",
    category: "folio",
    keywords: "folio sat software art systems evidence screenshot",
    icon: "folder-check-outline",
    accent: "#60A5FA"
  },
  {
    title: "Memory spark",
    detail: "Recall prompts for quick active memory.",
    category: "memory",
    keywords: "recall flashcards memory prompt",
    icon: "brain",
    accent: palette.primary,
    route: "/(tabs)/questions"
  },
  {
    title: "Deadline backplan",
    detail: "Turn SAC dates into tonight's move.",
    category: "sac",
    keywords: "deadline calendar backplan panic",
    icon: "calendar-range",
    accent: palette.info,
    route: "/(tabs)/calendar"
  },
  {
    title: "Mistake autopsy",
    detail: "Work out exactly where marks leaked.",
    category: "exam",
    keywords: "mistake log repair marks feedback",
    icon: "clipboard-search-outline",
    accent: palette.secondary,
    route: "/(tabs)/study"
  },
  {
    title: "Resource triage",
    detail: "Make notes, videos and feedback usable.",
    category: "folio",
    keywords: "files notes upload resource feedback",
    icon: "file-tree-outline",
    accent: palette.primary,
    route: "/(tabs)/study"
  },
  {
    title: "Insights",
    detail: "Weak spots and evidence patterns.",
    category: "routes",
    keywords: "student map weaknesses insights",
    icon: "map-search-outline",
    accent: palette.primary,
    route: "/(tabs)/insights"
  },
  {
    title: "Shop",
    detail: "Themes, titles, badges and unlocks.",
    category: "routes",
    keywords: "coins themes badges title",
    icon: "shopping-outline",
    accent: palette.success,
    route: "/(tabs)/shop"
  },
  {
    title: "Profile",
    detail: "Subjects, defaults and account settings.",
    category: "routes",
    keywords: "subjects default tab preferences",
    icon: "account-circle-outline",
    accent: "#60A5FA",
    route: "/(tabs)/profile"
  }
];

export default function MoreScreen() {
  const activePalette = useActivePalette();
  const [toolQuery, setToolQuery] = useState("");
  const [activeToolCategory, setActiveToolCategory] = useState<ToolCategory>("all");
  const [missionIndex, setMissionIndex] = useState(0);
  const [commandIndex, setCommandIndex] = useState(0);
  const [resetSeconds, setResetSeconds] = useState(60);
  const [resetRunning, setResetRunning] = useState(false);
  const [checkedSacItems, setCheckedSacItems] = useState<string[]>([]);
  const [markTarget, setMarkTarget] = useState<(typeof markTargets)[number]>(4);
  const [answerFrameIndex, setAnswerFrameIndex] = useState(0);
  const [checkedFolioItems, setCheckedFolioItems] = useState<string[]>([]);
  const [confidenceLevel, setConfidenceLevel] = useState(2);
  const [memoryPromptIndex, setMemoryPromptIndex] = useState(0);
  const [deadlinePlanIndex, setDeadlinePlanIndex] = useState(1);
  const [checkedAutopsyItems, setCheckedAutopsyItems] = useState<string[]>([]);
  const [teacherQuestionIndex, setTeacherQuestionIndex] = useState(0);
  const [resourceModeIndex, setResourceModeIndex] = useState(0);
  const [contractMinutes, setContractMinutes] = useState<(typeof contractOptions)[number]>(25);
  const [contractLocked, setContractLocked] = useState(false);
  const activeMission = studyDiceMissions[missionIndex] ?? studyDiceMissions[0];
  const activeCommand = commandTerms[commandIndex] ?? commandTerms[0];
  const activeAnswerFrame = answerFrames[answerFrameIndex] ?? answerFrames[0];
  const activeDeadlinePlan = deadlinePlans[deadlinePlanIndex] ?? deadlinePlans[0];
  const activeTeacherQuestion = teacherQuestionPrompts[teacherQuestionIndex] ?? teacherQuestionPrompts[0];
  const activeResourceMode = resourceModes[resourceModeIndex] ?? resourceModes[0];
  const checklistProgress = checkedSacItems.length;
  const folioProgress = checkedFolioItems.length;
  const autopsyProgress = checkedAutopsyItems.length;
  const toolboxCount = 14;
  const checkedToolItems = checklistProgress + folioProgress + autopsyProgress;
  const suggestedMinutes = Math.max(3, Math.round(markTarget * 1.5));
  const activeMemoryPrompt = memoryPrompts[memoryPromptIndex] ?? memoryPrompts[0];
  const normalisedToolQuery = toolQuery.trim().toLowerCase();
  const matchingTools = useMemo(
    () =>
      toolFinderItems
        .filter((item) => {
          const categoryMatch = activeToolCategory === "all" || item.category === activeToolCategory;
          if (!categoryMatch) return false;
          if (!normalisedToolQuery) return true;
          const searchable = `${item.title} ${item.detail} ${item.category} ${item.keywords}`.toLowerCase();
          return searchable.includes(normalisedToolQuery);
        })
        .slice(0, 8),
    [activeToolCategory, normalisedToolQuery]
  );
  const finderActive = activeToolCategory !== "all" || Boolean(normalisedToolQuery);
  useTrackScreen("more");

  useEffect(() => {
    if (!resetRunning) return undefined;
    if (resetSeconds <= 0) {
      setResetRunning(false);
      return undefined;
    }
    const interval = setInterval(() => {
      setResetSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetRunning, resetSeconds]);

  const rollStudyDice = () => {
    setMissionIndex((current) => {
      if (studyDiceMissions.length <= 1) return current;
      const offset = 1 + Math.floor(Math.random() * (studyDiceMissions.length - 1));
      return (current + offset) % studyDiceMissions.length;
    });
  };

  const toggleSacItem = (item: string) => {
    setCheckedSacItems((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  const toggleFolioItem = (item: string) => {
    setCheckedFolioItems((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  const toggleAutopsyItem = (item: string) => {
    setCheckedAutopsyItems((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  const resetBreather = () => {
    setResetRunning(false);
    setResetSeconds(60);
  };

  const rollMemoryPrompt = () => {
    setMemoryPromptIndex((current) => {
      if (memoryPrompts.length <= 1) return current;
      const offset = 1 + Math.floor(Math.random() * (memoryPrompts.length - 1));
      return (current + offset) % memoryPrompts.length;
    });
  };

  return (
    <Screen>
      <Animated.View entering={motion.card(0)}>
        <AppCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.toolCopy}>
              <Text style={styles.eyebrow}>More</Text>
              <Text variant="headlineLarge" style={styles.title}>
                Study toolbox
              </Text>
              <Text style={[styles.heroBody, { color: activePalette.muted }]}>
                Small, sharp utilities for pressure moments. Use one, then get back to the main study flow.
              </Text>
            </View>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="tools" color={palette.primary} size={26} />
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{toolboxCount}</Text>
              <Text style={styles.heroStatLabel}>tools</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{checkedToolItems}</Text>
              <Text style={styles.heroStatLabel}>checks</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{contractLocked ? "on" : "ready"}</Text>
              <Text style={styles.heroStatLabel}>contract</Text>
            </View>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(20)}>
        <AppCard style={styles.finderCard}>
          <View style={styles.finderHeader}>
            <View style={styles.toolCopy}>
              <Text style={styles.sectionTitle}>Find the right tool</Text>
              <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>
                Search by pressure, subject type, or the problem you are trying to solve.
              </Text>
            </View>
            {finderActive ? (
              <Button
                compact
                mode="outlined"
                icon="close"
                onPress={() => {
                  setToolQuery("");
                  setActiveToolCategory("all");
                }}
              >
                Clear
              </Button>
            ) : null}
          </View>
          <TextInput
            mode="outlined"
            value={toolQuery}
            onChangeText={setToolQuery}
            placeholder="Try SAC, folio, memory, command terms..."
            left={<TextInput.Icon icon="magnify" />}
            style={styles.finderInput}
            textColor={palette.text}
          />
          <View style={styles.categoryRail}>
            {toolCategories.map((category) => {
              const active = activeToolCategory === category.id;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setActiveToolCategory(category.id)}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{category.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {matchingTools.length ? (
            <View style={styles.finderResults}>
              {matchingTools.map((item) => (
                <Pressable
                  key={`${item.title}-${item.category}`}
                  accessibilityRole={item.route ? "button" : "text"}
                  disabled={!item.route}
                  onPress={() => {
                    if (item.route) router.push(item.route);
                  }}
                  style={({ pressed }) => [
                    styles.finderResult,
                    { borderColor: `${item.accent}28` },
                    pressed && item.route ? styles.pressed : null
                  ]}
                >
                  <View style={[styles.resultIcon, { backgroundColor: `${item.accent}18` }]}>
                    <MaterialCommunityIcons name={item.icon} color={item.accent} size={19} />
                  </View>
                  <View style={styles.toolCopy}>
                    <Text style={styles.resultTitle}>{item.title}</Text>
                    <Text style={[styles.resultDetail, { color: activePalette.muted }]}>{item.detail}</Text>
                  </View>
                  <Text style={[styles.resultCategory, { color: item.accent }]}>{item.category}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.finderEmpty}>
              <MaterialCommunityIcons name="magnify-close" color={activePalette.muted} size={20} />
              <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>No match yet. Try “SAC”, “folio”, “memory” or “exam”.</Text>
            </View>
          )}
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(45)}>
        <AppCard style={[styles.studyDiceCard, { borderColor: `${activeMission.accent}35` }]}>
          <View style={styles.studyDiceTop}>
            <View style={[styles.diceIconBox, { backgroundColor: `${activeMission.accent}18` }]}>
              <MaterialCommunityIcons name="dice-d20-outline" color={activeMission.accent} size={24} />
            </View>
            <View style={styles.toolCopy}>
              <Text style={[styles.diceLabel, { color: activeMission.accent }]}>{activeMission.label}</Text>
              <Text style={styles.diceTitle}>{activeMission.title}</Text>
              <Text style={[styles.toolDetail, { color: activePalette.muted }]}>{activeMission.detail}</Text>
            </View>
          </View>
          <View style={styles.diceActions}>
            <Button compact mode="contained-tonal" icon="dice-5-outline" onPress={rollStudyDice}>
              Roll
            </Button>
            <Button compact mode="outlined" icon={activeMission.icon} onPress={() => router.push("/(tabs)/study")}>
              Start
            </Button>
          </View>
        </AppCard>
      </Animated.View>

      <Animated.View entering={motion.card(70)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pocket tools</Text>
        <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>Small helpers for weird study moments.</Text>
      </Animated.View>

      <View style={styles.featureGrid}>
        <Animated.View entering={motion.card(95)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: `${activeCommand.accent}35` }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: `${activeCommand.accent}18` }]}>
                <MaterialCommunityIcons name="text-box-check-outline" color={activeCommand.accent} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: activeCommand.accent }]}>Command decoder</Text>
                <Text style={styles.featureTitle}>{activeCommand.term}</Text>
              </View>
            </View>
            <Text style={[styles.toolDetail, { color: activePalette.muted }]}>{activeCommand.move}</Text>
            <Text style={styles.commandFrame}>{activeCommand.frame}</Text>
            <View style={styles.termRail}>
              {commandTerms.map((item, index) => (
                <Pressable
                  key={item.term}
                  accessibilityRole="button"
                  style={[styles.termChip, commandIndex === index && { borderColor: item.accent, backgroundColor: `${item.accent}16` }]}
                  onPress={() => setCommandIndex(index)}
                >
                  <Text style={[styles.termChipText, commandIndex === index && { color: item.accent }]}>{item.term}</Text>
                </Pressable>
              ))}
            </View>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(120)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(74,222,128,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(74,222,128,0.16)" }]}>
                <MaterialCommunityIcons name="timer-sand" color={palette.success} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.success }]}>60-second reset</Text>
                <Text style={styles.featureTitle}>{resetSeconds}s</Text>
              </View>
            </View>
            <Text style={[styles.toolDetail, { color: activePalette.muted }]}>
              Breathe, unclench, then pick one tiny next move.
            </Text>
            <View style={styles.resetBarTrack}>
              <View style={[styles.resetBarFill, { width: `${((60 - resetSeconds) / 60) * 100}%` }]} />
            </View>
            <View style={styles.diceActions}>
              <Button
                compact
                mode="contained-tonal"
                icon={resetRunning ? "pause" : "play"}
                onPress={() => {
                  if (resetSeconds === 0) {
                    setResetSeconds(60);
                    setResetRunning(true);
                    return;
                  }
                  setResetRunning((value) => !value);
                }}
              >
                {resetRunning ? "Pause" : resetSeconds === 0 ? "Again" : "Start"}
              </Button>
              <Button compact mode="outlined" icon="restart" onPress={resetBreather}>
                Reset
              </Button>
            </View>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(145)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(245,158,11,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(245,158,11,0.16)" }]}>
                <MaterialCommunityIcons name="clipboard-check-outline" color={palette.warning} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.warning }]}>Pre-SAC check</Text>
                <Text style={styles.featureTitle}>{checklistProgress}/{sacChecklist.length} ready</Text>
              </View>
            </View>
            <View style={styles.checkList}>
              {sacChecklist.map((item) => {
                const checked = checkedSacItems.includes(item);
                return (
                  <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.checkRow} onPress={() => toggleSacItem(item)}>
                    <MaterialCommunityIcons
                      name={checked ? "check-circle" : "checkbox-blank-circle-outline"}
                      color={checked ? palette.success : activePalette.muted}
                      size={18}
                    />
                    <Text style={[styles.checkText, checked && styles.checkTextDone]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </AppCard>
        </Animated.View>
      </View>

      <Animated.View entering={motion.card(145)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Exam moves</Text>
        <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>Quick structure when the brain goes blank.</Text>
      </Animated.View>

      <View style={styles.featureGrid}>
        <Animated.View entering={motion.card(170)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(56,189,248,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(56,189,248,0.16)" }]}>
                <MaterialCommunityIcons name="counter" color={palette.info} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.info }]}>Mark timer</Text>
                <Text style={styles.featureTitle}>{markTarget} marks = {suggestedMinutes}m</Text>
              </View>
            </View>
            <Text style={[styles.toolDetail, { color: activePalette.muted }]}>
              Budget time before you start so one answer does not eat the SAC.
            </Text>
            <View style={styles.termRail}>
              {markTargets.map((target) => (
                <Pressable
                  key={target}
                  accessibilityRole="button"
                  style={[styles.termChip, markTarget === target && { borderColor: palette.info, backgroundColor: `${palette.info}16` }]}
                  onPress={() => setMarkTarget(target)}
                >
                  <Text style={[styles.termChipText, markTarget === target && { color: palette.info }]}>{target}mks</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.miniPlan}>
              <Text style={styles.miniPlanText}>Plan: 20% think, 70% write, 10% fix the link.</Text>
            </View>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(195)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: `${activeAnswerFrame.accent}35` }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: `${activeAnswerFrame.accent}18` }]}>
                <MaterialCommunityIcons name="format-list-numbered" color={activeAnswerFrame.accent} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: activeAnswerFrame.accent }]}>Answer skeleton</Text>
                <Text style={styles.featureTitle}>{activeAnswerFrame.title}</Text>
              </View>
            </View>
            <View style={styles.termRail}>
              {answerFrames.map((frame, index) => (
                <Pressable
                  key={frame.label}
                  accessibilityRole="button"
                  style={[styles.termChip, answerFrameIndex === index && { borderColor: frame.accent, backgroundColor: `${frame.accent}16` }]}
                  onPress={() => setAnswerFrameIndex(index)}
                >
                  <Text style={[styles.termChipText, answerFrameIndex === index && { color: frame.accent }]}>{frame.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.numberedList}>
              {activeAnswerFrame.steps.map((step, index) => (
                <View key={step} style={styles.numberedRow}>
                  <Text style={[styles.numberBadge, { borderColor: `${activeAnswerFrame.accent}55`, color: activeAnswerFrame.accent }]}>
                    {index + 1}
                  </Text>
                  <Text style={styles.numberedText}>{step}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        </Animated.View>
      </View>

      <Animated.View entering={motion.card(220)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Personal rescue</Text>
        <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>For folios, memory, and shaky confidence.</Text>
      </Animated.View>

      <View style={styles.featureGrid}>
        <Animated.View entering={motion.card(245)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(96,165,250,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(96,165,250,0.16)" }]}>
                <MaterialCommunityIcons name="folder-check-outline" color="#60A5FA" size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: "#60A5FA" }]}>Folio checkpoint</Text>
                <Text style={styles.featureTitle}>{folioProgress}/{folioChecklist.length} evidence</Text>
              </View>
            </View>
            <View style={styles.checkList}>
              {folioChecklist.map((item) => {
                const checked = checkedFolioItems.includes(item);
                return (
                  <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.checkRow} onPress={() => toggleFolioItem(item)}>
                    <MaterialCommunityIcons
                      name={checked ? "check-circle" : "checkbox-blank-circle-outline"}
                      color={checked ? palette.success : activePalette.muted}
                      size={18}
                    />
                    <Text style={[styles.checkText, checked && styles.checkTextDone]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(270)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(255,107,107,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(255,107,107,0.16)" }]}>
                <MaterialCommunityIcons name="signal-cellular-outline" color={palette.secondary} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.secondary }]}>Confidence ladder</Text>
                <Text style={styles.featureTitle}>{confidenceLevel}/5</Text>
              </View>
            </View>
            <Text style={[styles.toolDetail, { color: activePalette.muted }]}>{confidenceMoves[confidenceLevel - 1]}</Text>
            <View style={styles.confidenceRail}>
              {[1, 2, 3, 4, 5].map((level) => (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  style={[styles.confidenceDot, confidenceLevel >= level && styles.confidenceDotActive]}
                  onPress={() => setConfidenceLevel(level)}
                >
                  <Text style={styles.confidenceText}>{level}</Text>
                </Pressable>
              ))}
            </View>
            <Button compact mode="outlined" icon="timer-outline" onPress={() => router.push("/(tabs)/study")}>
              Turn into session
            </Button>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(295)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(124,110,255,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(124,110,255,0.18)" }]}>
                <MaterialCommunityIcons name="brain" color={palette.primary} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.primary }]}>Memory spark</Text>
                <Text style={styles.featureTitle}>Recall prompt</Text>
              </View>
            </View>
            <Text style={styles.memoryPrompt}>{activeMemoryPrompt}</Text>
            <View style={styles.diceActions}>
              <Button compact mode="contained-tonal" icon="shuffle-variant" onPress={rollMemoryPrompt}>
                New prompt
              </Button>
              <Button compact mode="outlined" icon="cards-outline" onPress={() => router.push("/(tabs)/questions")}>
                Drill it
              </Button>
            </View>
          </AppCard>
        </Animated.View>
      </View>

      <Animated.View entering={motion.card(320)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pressure tools</Text>
        <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>When the deadline starts looking back at you.</Text>
      </Animated.View>

      <View style={styles.featureGrid}>
        <Animated.View entering={motion.card(345)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: `${activeDeadlinePlan.accent}35` }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: `${activeDeadlinePlan.accent}18` }]}>
                <MaterialCommunityIcons name="calendar-range" color={activeDeadlinePlan.accent} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: activeDeadlinePlan.accent }]}>Deadline backplan</Text>
                <Text style={styles.featureTitle}>{activeDeadlinePlan.title}</Text>
              </View>
            </View>
            <View style={styles.termRail}>
              {deadlinePlans.map((plan, index) => (
                <Pressable
                  key={plan.label}
                  accessibilityRole="button"
                  style={[styles.termChip, deadlinePlanIndex === index && { borderColor: plan.accent, backgroundColor: `${plan.accent}16` }]}
                  onPress={() => setDeadlinePlanIndex(index)}
                >
                  <Text style={[styles.termChipText, deadlinePlanIndex === index && { color: plan.accent }]}>{plan.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.memoryPrompt}>{activeDeadlinePlan.move}</Text>
            <Button compact mode="outlined" icon="calendar-month" onPress={() => router.push("/(tabs)/calendar")}>
              Open calendar
            </Button>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(370)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(255,107,107,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(255,107,107,0.16)" }]}>
                <MaterialCommunityIcons name="clipboard-search-outline" color={palette.secondary} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.secondary }]}>Mistake autopsy</Text>
                <Text style={styles.featureTitle}>{autopsyProgress}/{mistakeAutopsy.length} checked</Text>
              </View>
            </View>
            <View style={styles.checkList}>
              {mistakeAutopsy.map((item) => {
                const checked = checkedAutopsyItems.includes(item);
                return (
                  <Pressable key={item} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.checkRow} onPress={() => toggleAutopsyItem(item)}>
                    <MaterialCommunityIcons
                      name={checked ? "check-circle" : "checkbox-blank-circle-outline"}
                      color={checked ? palette.success : activePalette.muted}
                      size={18}
                    />
                    <Text style={[styles.checkText, checked && styles.checkTextDone]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Button compact mode="outlined" icon="note-edit-outline" onPress={() => router.push("/(tabs)/study")}>
              Repair it
            </Button>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(395)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: `${activeTeacherQuestion.accent}35` }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: `${activeTeacherQuestion.accent}18` }]}>
                <MaterialCommunityIcons name="account-question-outline" color={activeTeacherQuestion.accent} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: activeTeacherQuestion.accent }]}>Teacher question</Text>
                <Text style={styles.featureTitle}>{activeTeacherQuestion.label}</Text>
              </View>
            </View>
            <View style={styles.termRail}>
              {teacherQuestionPrompts.map((prompt, index) => (
                <Pressable
                  key={prompt.label}
                  accessibilityRole="button"
                  style={[styles.termChip, teacherQuestionIndex === index && { borderColor: prompt.accent, backgroundColor: `${prompt.accent}16` }]}
                  onPress={() => setTeacherQuestionIndex(index)}
                >
                  <Text style={[styles.termChipText, teacherQuestionIndex === index && { color: prompt.accent }]}>{prompt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.memoryPrompt}>{activeTeacherQuestion.prompt}</Text>
          </AppCard>
        </Animated.View>
      </View>

      <Animated.View entering={motion.card(420)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Routine builders</Text>
        <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>Turn loose materials into proof of study.</Text>
      </Animated.View>

      <View style={styles.featureGrid}>
        <Animated.View entering={motion.card(445)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: `${activeResourceMode.accent}35` }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: `${activeResourceMode.accent}18` }]}>
                <MaterialCommunityIcons name="file-tree-outline" color={activeResourceMode.accent} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: activeResourceMode.accent }]}>Resource triage</Text>
                <Text style={styles.featureTitle}>{activeResourceMode.label}</Text>
              </View>
            </View>
            <View style={styles.termRail}>
              {resourceModes.map((mode, index) => (
                <Pressable
                  key={mode.label}
                  accessibilityRole="button"
                  style={[styles.termChip, resourceModeIndex === index && { borderColor: mode.accent, backgroundColor: `${mode.accent}16` }]}
                  onPress={() => setResourceModeIndex(index)}
                >
                  <Text style={[styles.termChipText, resourceModeIndex === index && { color: mode.accent }]}>{mode.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.memoryPrompt}>{activeResourceMode.action}</Text>
            <Button compact mode="outlined" icon="folder-upload-outline" onPress={() => router.push("/(tabs)/study")}>
              Use it
            </Button>
          </AppCard>
        </Animated.View>

        <Animated.View entering={motion.card(470)} style={styles.featureItem}>
          <AppCard style={[styles.featureCard, { borderColor: "rgba(74,222,128,0.28)" }]}>
            <View style={styles.featureTop}>
              <View style={[styles.smallIconBox, { backgroundColor: "rgba(74,222,128,0.16)" }]}>
                <MaterialCommunityIcons name="handshake-outline" color={palette.success} size={20} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.diceLabel, { color: palette.success }]}>Study contract</Text>
                <Text style={styles.featureTitle}>{contractMinutes} minute promise</Text>
              </View>
            </View>
            <View style={styles.termRail}>
              {contractOptions.map((minutes) => (
                <Pressable
                  key={minutes}
                  accessibilityRole="button"
                  style={[styles.termChip, contractMinutes === minutes && { borderColor: palette.success, backgroundColor: `${palette.success}16` }]}
                  onPress={() => {
                    setContractMinutes(minutes);
                    setContractLocked(false);
                  }}
                >
                  <Text style={[styles.termChipText, contractMinutes === minutes && { color: palette.success }]}>{minutes}m</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.contractBox, contractLocked && styles.contractBoxLocked]}>
              <MaterialCommunityIcons name={contractLocked ? "lock-check-outline" : "lock-open-outline"} color={contractLocked ? palette.success : activePalette.muted} size={18} />
              <Text style={styles.contractText}>
                I will do {contractMinutes} minutes, avoid tab-hopping, and leave one piece of evidence.
              </Text>
            </View>
            <View style={styles.diceActions}>
              <Button compact mode="contained-tonal" icon="lock-check-outline" onPress={() => setContractLocked((value) => !value)}>
                {contractLocked ? "Locked" : "Lock in"}
              </Button>
              <Button compact mode="outlined" icon="timer-outline" onPress={() => router.push("/(tabs)/study")}>
                Start
              </Button>
            </View>
          </AppCard>
        </Animated.View>
      </View>

      <Animated.View entering={motion.card(495)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Core app links</Text>
        <Text style={[styles.sectionMeta, { color: activePalette.muted }]}>The bigger rooms, kept here so the main nav stays calm.</Text>
      </Animated.View>

      <View style={styles.grid}>
        {moreItems.map((item, index) => (
          <Animated.View key={item.title} entering={motion.card(520 + index * 25)} style={styles.gridItem}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                item.title === "Guide"
                  ? router.push({ pathname: "/(tabs)", params: { guide: "1" } })
                  : item.title === "Chess break"
                    ? router.push({ pathname: "/(tabs)/study", params: { mode: "chess" } })
                  : router.push(item.route)
              }
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <AppCard style={styles.toolCard}>
                <View style={[styles.iconBox, { backgroundColor: `${item.accent}18` }]}>
                  <MaterialCommunityIcons name={item.icon} color={item.accent} size={24} />
                </View>
                <View style={styles.toolCopy}>
                  <Text style={styles.toolTitle}>{item.title}</Text>
                  <Text style={[styles.toolDetail, { color: activePalette.muted }]}>{item.detail}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" color={activePalette.muted} size={22} />
              </AppCard>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4
  },
  heroCard: {
    gap: 14,
    borderColor: "rgba(124,110,255,0.32)",
    backgroundColor: "rgba(124,110,255,0.1)"
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14
  },
  heroBody: {
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 20
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,110,255,0.18)"
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  heroStat: {
    minWidth: 96,
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.14)",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  heroStatValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 22
  },
  heroStatLabel: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 11
  },
  finderCard: {
    gap: 12,
    borderColor: "rgba(56,189,248,0.26)",
    backgroundColor: "rgba(56,189,248,0.07)"
  },
  finderHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  finderInput: {
    backgroundColor: palette.surface
  },
  categoryRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  categoryChip: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 11
  },
  categoryChipActive: {
    borderColor: "rgba(56,189,248,0.55)",
    backgroundColor: "rgba(56,189,248,0.14)"
  },
  categoryChipText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  categoryChipTextActive: {
    color: palette.info
  },
  finderResults: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9
  },
  finderResult: {
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.034)",
    padding: 10
  },
  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  resultTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    lineHeight: 18
  },
  resultDetail: {
    fontSize: 12,
    lineHeight: 16
  },
  resultCategory: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.045)",
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  finderEmpty: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 0
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  studyDiceCard: {
    gap: 12,
    borderWidth: 1,
    backgroundColor: "rgba(8,20,38,0.48)"
  },
  studyDiceTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  diceIconBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  diceLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    textTransform: "uppercase"
  },
  diceTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 23
  },
  diceActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sectionHeader: {
    gap: 3,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 14,
    marginTop: 2
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  sectionMeta: {
    fontSize: 13,
    lineHeight: 18
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  featureItem: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 260,
    maxWidth: 430
  },
  featureCard: {
    minHeight: 214,
    height: "100%",
    gap: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.032)"
  },
  featureTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  smallIconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  featureTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 17,
    lineHeight: 22
  },
  commandFrame: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.045)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  termRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  termChip: {
    minHeight: 32,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 9
  },
  termChipText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  resetBarTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  resetBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.success
  },
  checkList: {
    gap: 6
  },
  checkRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  checkText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 17
  },
  checkTextDone: {
    color: palette.success,
    textDecorationLine: "line-through"
  },
  miniPlan: {
    borderRadius: 8,
    backgroundColor: "rgba(56,189,248,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  miniPlanText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 18
  },
  numberedList: {
    gap: 7
  },
  numberedRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: "center",
    textAlignVertical: "center",
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    lineHeight: 22
  },
  numberedText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 18
  },
  confidenceRail: {
    flexDirection: "row",
    gap: 8
  },
  confidenceDot: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center"
  },
  confidenceDotActive: {
    borderColor: "rgba(255,107,107,0.5)",
    backgroundColor: "rgba(255,107,107,0.18)"
  },
  confidenceText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  memoryPrompt: {
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: "rgba(124,110,255,0.1)",
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  contractBox: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  contractBoxLocked: {
    borderColor: "rgba(74,222,128,0.36)",
    backgroundColor: "rgba(74,222,128,0.08)"
  },
  contractText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 18
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 240,
    maxWidth: 420
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }]
  },
  toolCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.034)"
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  toolCopy: {
    flex: 1,
    gap: 2
  },
  toolTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    lineHeight: 20
  },
  toolDetail: {
    fontSize: 14,
    lineHeight: 19
  }
});
