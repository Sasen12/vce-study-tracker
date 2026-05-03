import { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SubjectSelector } from "@/components/ui/SubjectSelector";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import type { AnswerFeedback, GeneratedAnswerOption, GeneratedQuestion, SavedQuestion } from "@/types";

const width = Dimensions.get("window").width;

const TOPICS: Record<string, string[]> = {
  English: ["Argument analysis", "Text response", "Comparative writing"],
  "Mathematical Methods": ["Calculus", "Probability", "Functions and graphs"],
  "Software Development": ["Data design", "Algorithms", "Testing and evaluation"],
  Psychology: ["Research methods", "Learning", "Mental wellbeing"],
  Chemistry: ["Equilibrium", "Organic chemistry", "Reaction pathways"],
  Physics: ["Fields", "Motion", "Electricity"]
};

const VERDICT_COPY: Record<AnswerFeedback["verdict"], string> = {
  needs_work: "Needs work",
  close: "Close",
  strong: "Strong",
  excellent: "Excellent"
};

const fallbackGameOptions = (question: GeneratedQuestion): GeneratedAnswerOption[] => [
  { text: question.model_answer, correct: true },
  { text: "Define the key term only, without applying it to the exact scenario.", correct: false },
  { text: "Write a conclusion with no supporting evidence or subject terminology.", correct: false },
  { text: "List related facts without linking them back to the command word.", correct: false }
];

const gameOptionsFor = (question: GeneratedQuestion): GeneratedAnswerOption[] => {
  const supplied = question.answer_options?.filter((option) => option.text.trim()) ?? [];
  const hasCorrect = supplied.some((option) => option.correct);
  const options = supplied.length >= 2 && hasCorrect ? supplied : fallbackGameOptions(question);
  const trimmed = options.slice(0, 4);
  return trimmed.some((option) => option.correct) ? trimmed : fallbackGameOptions(question);
};

type FeedbackState = {
  feedback: AnswerFeedback;
  xpEarned: number;
};

function QuestionCard({
  item,
  index,
  revealed,
  onReveal,
  answer,
  onAnswerChange,
  feedback,
  onCheck,
  checking,
  onSave,
  saving
}: {
  item: GeneratedQuestion;
  index: number;
  revealed: boolean;
  onReveal: () => void;
  answer: string;
  onAnswerChange: (text: string) => void;
  feedback?: FeedbackState;
  onCheck: () => void;
  checking: boolean;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <AppCard style={styles.questionCard}>
      <View style={styles.questionHeader}>
        <Text style={styles.badge}>{item.marks} marks</Text>
        <Text style={styles.muted}>Question {index + 1}</Text>
      </View>
      <Text style={styles.questionText}>{item.question}</Text>
      <TextInput
        mode="outlined"
        label="Your answer"
        value={answer}
        onChangeText={onAnswerChange}
        multiline
        numberOfLines={4}
        style={styles.answerInput}
      />
      <Button mode="contained-tonal" icon="check-decagram" disabled={!answer.trim() || checking} onPress={onCheck}>
        {checking ? "Checking..." : "Check answer"}
      </Button>
      {feedback ? (
        <View style={styles.feedbackBox}>
          <View style={styles.feedbackHeader}>
            <Text style={styles.feedbackTitle}>{VERDICT_COPY[feedback.feedback.verdict]}</Text>
            <Text style={styles.feedbackScore}>
              {feedback.feedback.awarded_marks}/{feedback.feedback.max_marks} marks - {feedback.feedback.score}% - +
              {feedback.xpEarned} XP
            </Text>
          </View>
          {feedback.feedback.strengths.map((point) => (
            <Text key={point} style={styles.feedbackPoint}>
              + {point}
            </Text>
          ))}
          {feedback.feedback.improvements.map((point) => (
            <Text key={point} style={styles.feedbackPoint}>
              - {point}
            </Text>
          ))}
          <Text style={styles.nextStep}>{feedback.feedback.next_step}</Text>
        </View>
      ) : null}
      {revealed ? (
        <View style={styles.answerBox}>
          <Text style={styles.answerTitle}>Model answer</Text>
          <Text style={styles.answer}>{item.model_answer}</Text>
          {item.marking_criteria.map((criterion) => (
            <Text key={criterion} style={styles.criterion}>
              - {criterion}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.cardActions}>
        <Button mode="outlined" icon={revealed ? "eye-off" : "eye"} onPress={onReveal}>
          {revealed ? "Hide" : "Reveal"}
        </Button>
        <Button mode="contained" icon="content-save" disabled={saving} onPress={onSave}>
          {saving ? "Saving" : "Save"}
        </Button>
      </View>
    </AppCard>
  );
}

function SavedQuestionCard({ item }: { item: SavedQuestion }) {
  return (
    <AppCard style={styles.savedCard}>
      <View style={styles.questionHeader}>
        <Text style={styles.badge}>{item.difficulty ?? "saved"}</Text>
        <Text style={styles.muted}>{item.subject?.subjectName ?? "Subject removed"}</Text>
      </View>
      <Text style={styles.questionText}>{item.question}</Text>
      <Text style={styles.answer}>{item.modelAnswer}</Text>
    </AppCard>
  );
}

export default function QuestionsScreen() {
  useTrackScreen("questions");
  const { subjects, generatedQuestions, savedQuestions, loading, fetchAll, generateQuestions, saveQuestion, checkAnswer } =
    useAppStore();
  const [mode, setMode] = useState("generate");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState<1 | 3 | 5>(3);
  const [sourceMode, setSourceMode] = useState<"balanced" | "exam_bank">("balanced");
  const [generating, setGenerating] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({});
  const [answerFeedback, setAnswerFeedback] = useState<Record<number, FeedbackState>>({});
  const [cooldownActive, setCooldownActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSubjectId, setFilterSubjectId] = useState<string | null>(null);
  const [savedSearch, setSavedSearch] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameIndex, setGameIndex] = useState(0);
  const [gameScore, setGameScore] = useState(0);
  const [gameStreak, setGameStreak] = useState(0);
  const [gameLives, setGameLives] = useState(3);
  const [gameCoins, setGameCoins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(18);
  const [shieldActive, setShieldActive] = useState(false);
  const [doubleActive, setDoubleActive] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | "shield" | "timeout" | null>(null);
  const [gameOver, setGameOver] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const selectedSubject = subjects.find((subject) => subject.id === subjectId) ?? subjects[0];
  const presetTopics = TOPICS[selectedSubject?.subjectName ?? ""] ?? ["Key knowledge", "Exam revision", "Common mistakes"];
  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setTimeout(() => setCooldownActive(false), 2500);
    return () => clearTimeout(timer);
  }, [cooldownActive]);

  const filteredSaved = useMemo(
    () => {
      const query = savedSearch.trim().toLowerCase();
      return savedQuestions.filter((question) => {
        const matchesSubject = !filterSubjectId || question.subjectId === filterSubjectId;
        const matchesQuery =
          !query ||
          question.question.toLowerCase().includes(query) ||
          question.modelAnswer.toLowerCase().includes(query) ||
          (question.topic ?? "").toLowerCase().includes(query) ||
          (question.subject?.subjectName ?? "").toLowerCase().includes(query);
        return matchesSubject && matchesQuery;
      });
    },
    [filterSubjectId, savedQuestions, savedSearch]
  );
  const oldestSaved = useMemo(
    () => [...filteredSaved].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 3),
    [filteredSaved]
  );

  const currentGameQuestion = generatedQuestions[gameIndex];
  const currentGameOptions = useMemo(
    () => (currentGameQuestion ? gameOptionsFor(currentGameQuestion) : []),
    [currentGameQuestion]
  );
  const visibleGameOptions = useMemo(
    () => currentGameOptions.filter((option) => !hiddenOptions.includes(option.text)),
    [currentGameOptions, hiddenOptions]
  );
  const gameRoundCount = generatedQuestions.length;
  const gameRank =
    gameScore >= Math.max(1, gameRoundCount) * 140
      ? "Mastery run"
      : gameScore >= Math.max(1, gameRoundCount) * 90
        ? "Clean win"
        : "Warm-up run";

  const endGameRound = useCallback(
    (correct: boolean, optionText: string, timedOut = false, remainingTime = 0) => {
      const nextStreak = correct ? gameStreak + 1 : 0;
      const shieldSaved = !correct && shieldActive;
      const nextLives = correct || shieldSaved ? gameLives : Math.max(0, gameLives - 1);
      const basePoints = 100 + Math.max(0, remainingTime) * 5 + gameStreak * 25;
      const points = correct ? basePoints * (doubleActive ? 2 : 1) : 0;
      const coins = correct ? 35 + Math.max(0, remainingTime) + gameStreak * 5 : 8;

      setSelectedOption(optionText);
      setLastResult(correct ? "correct" : shieldSaved ? "shield" : timedOut ? "timeout" : "wrong");
      setGameStreak(nextStreak);
      setGameLives(nextLives);
      setShieldActive(shieldSaved ? false : shieldActive);
      setDoubleActive(false);
      setGameCoins((current) => current + coins);
      if (points) setGameScore((current) => current + points);
      if (nextLives === 0) setGameOver(true);
    },
    [doubleActive, gameLives, gameStreak, shieldActive]
  );

  useEffect(() => {
    if (!gameStarted || gameOver || selectedOption || !currentGameQuestion) return undefined;
    setTimeLeft(18);
    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          endGameRound(false, "__timeout__", true, 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentGameQuestion, endGameRound, gameIndex, gameOver, gameStarted, selectedOption]);

  const resetPracticeState = () => {
    setRevealed({});
    setStudentAnswers({});
    setAnswerFeedback({});
    setCheckingIndex(null);
  };

  const requestQuestions = async () => {
    if (!selectedSubject || !topic.trim()) return false;
    setGenerating(true);
    setError(null);
    try {
      await generateQuestions({
        subjectId: selectedSubject.id,
        topic: topic.trim(),
        difficulty,
        count,
        sourceMode
      });
      resetPracticeState();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate questions");
      return false;
    } finally {
      setGenerating(false);
    }
  };

  const submitGenerate = async () => {
    if (cooldownActive) return;
    const ok = await requestQuestions();
    if (ok) {
      setCooldownActive(true);
      setGameStarted(false);
      setGameOver(false);
    }
  };

  const submitAnswer = async (item: GeneratedQuestion, index: number) => {
    if (!selectedSubject || !studentAnswers[index]?.trim()) return;
    setCheckingIndex(index);
    try {
      const result = await checkAnswer({
        subjectId: selectedSubject.id,
        question: item.question,
        studentAnswer: studentAnswers[index].trim(),
        modelAnswer: item.model_answer,
        topic: item.topic,
        marks: item.marks,
        markingCriteria: item.marking_criteria
      });
      setAnswerFeedback((current) => ({ ...current, [index]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check your answer");
    } finally {
      setCheckingIndex(null);
    }
  };

  const startGame = async () => {
    if (!selectedSubject || !topic.trim()) return;
    const ok = await requestQuestions();
    if (!ok) return;
    setCooldownActive(true);
    setGameStarted(true);
    setGameOver(false);
    setGameIndex(0);
    setGameScore(0);
    setGameStreak(0);
    setGameLives(3);
    setGameCoins(0);
    setTimeLeft(18);
    setShieldActive(false);
    setDoubleActive(false);
    setHiddenOptions([]);
    setSelectedOption(null);
    setLastResult(null);
  };

  const chooseGameOption = (option: GeneratedAnswerOption) => {
    if (selectedOption || gameOver) return;
    endGameRound(option.correct, option.text, false, timeLeft);
  };

  const buyFiftyFifty = () => {
    if (gameCoins < 45 || selectedOption || hiddenOptions.length || currentGameOptions.length < 4) return;
    const wrongOptions = currentGameOptions.filter((option) => !option.correct).slice(0, 2);
    setGameCoins((current) => current - 45);
    setHiddenOptions(wrongOptions.map((option) => option.text));
  };

  const buyShield = () => {
    if (gameCoins < 60 || shieldActive) return;
    setGameCoins((current) => current - 60);
    setShieldActive(true);
  };

  const buyDouble = () => {
    if (gameCoins < 75 || doubleActive || selectedOption) return;
    setGameCoins((current) => current - 75);
    setDoubleActive(true);
  };

  const advanceGame = () => {
    if (gameIndex >= generatedQuestions.length - 1) {
      setGameOver(true);
      return;
    }
    setGameIndex((current) => current + 1);
    setTimeLeft(18);
    setHiddenOptions([]);
    setSelectedOption(null);
    setLastResult(null);
  };

  const persistQuestion = async (item: GeneratedQuestion, index: number) => {
    if (!selectedSubject) return;
    setSavingIndex(index);
    await saveQuestion({
      subjectId: selectedSubject.id,
      question: item.question,
      modelAnswer: item.model_answer,
      topic: item.topic,
      difficulty,
      marks: item.marks,
      markingCriteria: item.marking_criteria
    });
    setSavingIndex(null);
  };

  return (
    <Screen>
      <View>
        <Text style={styles.eyebrow}>AI practice</Text>
        <Text variant="headlineLarge" style={styles.title}>
          Question forge
        </Text>
      </View>

      <SegmentedButtons
        value={mode}
        onValueChange={setMode}
        buttons={[
          { value: "generate", label: "Forge" },
          { value: "game", label: "Battle" },
          { value: "saved", label: "Saved" }
        ]}
      />

      {mode === "generate" ? (
        <>
          {subjects.length ? (
            <SubjectSelector subjects={subjects} selectedId={selectedSubject?.id} onSelect={(subject) => setSubjectId(subject.id)} />
          ) : (
            <EmptyState title="No subjects found" body="Add subjects before generating questions." />
          )}

          <AppCard style={styles.form}>
            <TextInput mode="outlined" label="Topic" value={topic} onChangeText={setTopic} />
            <View style={styles.topicRow}>
              {presetTopics.map((item) => (
                <Pressable key={item} style={styles.topicChip} onPress={() => setTopic(item)}>
                  <Text style={styles.topicText}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <SegmentedButtons
              value={difficulty}
              onValueChange={(value) => setDifficulty(value as "easy" | "medium" | "hard")}
              buttons={[
                { value: "easy", label: "Easy" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" }
              ]}
            />
            <SegmentedButtons
              value={String(count)}
              onValueChange={(value) => setCount(Number(value) as 1 | 3 | 5)}
              buttons={[
                { value: "1", label: "1" },
                { value: "3", label: "3" },
                { value: "5", label: "5" }
              ]}
            />
            <SegmentedButtons
              value={sourceMode}
              onValueChange={(value) => setSourceMode(value as "balanced" | "exam_bank")}
              buttons={[
                { value: "balanced", label: "Balanced" },
                { value: "exam_bank", label: "Exam bank" }
              ]}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              mode="contained"
              icon="auto-fix"
              disabled={!topic.trim() || !selectedSubject || generating || cooldownActive}
              onPress={submitGenerate}
            >
              {generating ? "Generating..." : "Generate questions"}
            </Button>
          </AppCard>

          {generating ? (
            <AppCard style={styles.loadingCard}>
              <Skeleton style={styles.skeletonTitle} />
              <Skeleton style={styles.skeletonBody} />
              <Skeleton style={styles.skeletonBody} />
            </AppCard>
          ) : generatedQuestions.length ? (
            <>
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={generatedQuestions}
                keyExtractor={(item, index) => `${item.question}-${index}`}
                renderItem={({ item, index }) => (
                  <QuestionCard
                    item={item}
                    index={index}
                    revealed={Boolean(revealed[index])}
                    onReveal={() => setRevealed((current) => ({ ...current, [index]: !current[index] }))}
                    answer={studentAnswers[index] ?? ""}
                    onAnswerChange={(text) => setStudentAnswers((current) => ({ ...current, [index]: text }))}
                    feedback={answerFeedback[index]}
                    onCheck={() => submitAnswer(item, index)}
                    checking={checkingIndex === index}
                    onSave={() => persistQuestion(item, index)}
                    saving={savingIndex === index}
                  />
                )}
              />
              <Button mode="outlined" icon="refresh" disabled={generating || cooldownActive} onPress={submitGenerate}>
                Try again
              </Button>
              <Button mode="contained-tonal" icon="sword-cross" disabled={generating} onPress={startGame}>
                Play battle deck
              </Button>
            </>
          ) : (
            <EmptyState title="Ready for a drill" body="Choose a subject and topic to generate VCE-style practice." />
          )}
        </>
      ) : mode === "game" ? (
        <>
          {subjects.length ? (
            <SubjectSelector subjects={subjects} selectedId={selectedSubject?.id} onSelect={(subject) => setSubjectId(subject.id)} />
          ) : (
            <EmptyState title="No subjects found" body="Add subjects before starting a battle." />
          )}

          <AppCard style={styles.form}>
            <View style={styles.battleHeader}>
              <View>
                <Text style={styles.battleKicker}>Study battle</Text>
                <Text style={styles.battleTitle}>{selectedSubject?.subjectName ?? "Pick a subject"}</Text>
              </View>
              <Text style={styles.battleBadge}>{gameStarted ? `${gameLives} lives` : `${count} rounds`}</Text>
            </View>
            <TextInput mode="outlined" label="Topic" value={topic} onChangeText={setTopic} />
            <View style={styles.topicRow}>
              {presetTopics.map((item) => (
                <Pressable key={item} style={styles.topicChip} onPress={() => setTopic(item)}>
                  <Text style={styles.topicText}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <SegmentedButtons
              value={difficulty}
              onValueChange={(value) => setDifficulty(value as "easy" | "medium" | "hard")}
              buttons={[
                { value: "easy", label: "Easy" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" }
              ]}
            />
            <SegmentedButtons
              value={String(count)}
              onValueChange={(value) => setCount(Number(value) as 1 | 3 | 5)}
              buttons={[
                { value: "1", label: "1" },
                { value: "3", label: "3" },
                { value: "5", label: "5" }
              ]}
            />
            <SegmentedButtons
              value={sourceMode}
              onValueChange={(value) => setSourceMode(value as "balanced" | "exam_bank")}
              buttons={[
                { value: "balanced", label: "Balanced" },
                { value: "exam_bank", label: "Exam bank" }
              ]}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button mode="contained" icon="play" disabled={!topic.trim() || !selectedSubject || generating} onPress={startGame}>
              {generating ? "Building deck..." : "Start battle"}
            </Button>
          </AppCard>

          {generating ? (
            <AppCard style={styles.loadingCard}>
              <Skeleton style={styles.skeletonTitle} />
              <Skeleton style={styles.skeletonBody} />
            </AppCard>
          ) : gameStarted && gameOver ? (
            <AppCard style={styles.gameCard}>
              <Text style={styles.gameOverTitle}>{gameRank}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statNumber}>{gameScore}</Text>
                  <Text style={styles.statLabel}>score</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statNumber}>{gameCoins}</Text>
                  <Text style={styles.statLabel}>coins</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statNumber}>{gameStreak}</Text>
                  <Text style={styles.statLabel}>combo</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statNumber}>{gameLives}</Text>
                  <Text style={styles.statLabel}>lives</Text>
                </View>
              </View>
              <Text style={styles.answer}>Every round is built from your selected subject, topic and difficulty.</Text>
              <Button mode="contained" icon="refresh" onPress={startGame}>
                New battle
              </Button>
            </AppCard>
          ) : gameStarted && currentGameQuestion ? (
            <AppCard style={styles.gameCard}>
              <View style={styles.statsRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statNumber}>{gameScore}</Text>
                  <Text style={styles.statLabel}>score</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statNumber}>{gameCoins}</Text>
                  <Text style={styles.statLabel}>coins</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statNumber}>{gameStreak}</Text>
                  <Text style={styles.statLabel}>combo</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statNumber}>{gameLives}</Text>
                  <Text style={styles.statLabel}>lives</Text>
                </View>
              </View>
              <View style={styles.timerTrack}>
                <View style={[styles.timerFill, { width: `${Math.max(0, Math.min(18, timeLeft)) / 18 * 100}%` }]} />
              </View>
              <View style={styles.powerShop}>
                <Pressable
                  style={[styles.powerButton, (gameCoins < 45 || Boolean(selectedOption) || Boolean(hiddenOptions.length)) && styles.powerDisabled]}
                  onPress={buyFiftyFifty}
                >
                  <Text style={styles.powerTitle}>50/50</Text>
                  <Text style={styles.powerCost}>45 coins</Text>
                </Pressable>
                <Pressable
                  style={[styles.powerButton, (gameCoins < 60 || shieldActive) && styles.powerDisabled, shieldActive && styles.powerActive]}
                  onPress={buyShield}
                >
                  <Text style={styles.powerTitle}>Shield</Text>
                  <Text style={styles.powerCost}>{shieldActive ? "active" : "60 coins"}</Text>
                </Pressable>
                <Pressable
                  style={[styles.powerButton, (gameCoins < 75 || doubleActive || Boolean(selectedOption)) && styles.powerDisabled, doubleActive && styles.powerActive]}
                  onPress={buyDouble}
                >
                  <Text style={styles.powerTitle}>2x</Text>
                  <Text style={styles.powerCost}>{doubleActive ? "armed" : "75 coins"}</Text>
                </Pressable>
              </View>
              <Text style={styles.muted}>
                Round {gameIndex + 1} of {gameRoundCount} - {timeLeft}s
              </Text>
              <Text style={styles.questionText}>{currentGameQuestion.question}</Text>
              <View style={styles.optionGrid}>
                {visibleGameOptions.map((option) => {
                  const selected = selectedOption === option.text;
                  const showCorrect = Boolean(selectedOption) && option.correct;
                  const showWrong = selected && !option.correct;
                  return (
                    <Pressable
                      key={option.text}
                      style={[
                        styles.gameOption,
                        showCorrect ? styles.gameOptionCorrect : null,
                        showWrong ? styles.gameOptionWrong : null
                      ]}
                      disabled={Boolean(selectedOption)}
                      onPress={() => chooseGameOption(option)}
                    >
                      <Text style={styles.gameOptionText}>{option.text}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {lastResult ? (
                <View style={styles.feedbackBox}>
                  <Text style={lastResult === "correct" || lastResult === "shield" ? styles.answerTitle : styles.error}>
                    {lastResult === "correct"
                      ? doubleActive
                        ? "Correct"
                        : "Correct combo"
                      : lastResult === "shield"
                        ? "Shield saved the round"
                        : lastResult === "timeout"
                          ? "Time ran out"
                          : "Not quite"}
                  </Text>
                  <Text style={styles.answer}>{currentGameQuestion.model_answer}</Text>
                </View>
              ) : null}
              {selectedOption ? (
                <Button mode="contained" icon={gameIndex >= generatedQuestions.length - 1 ? "flag-checkered" : "arrow-right"} onPress={advanceGame}>
                  {gameIndex >= generatedQuestions.length - 1 ? "Finish" : "Next round"}
                </Button>
              ) : null}
            </AppCard>
          ) : (
            <EmptyState title="Ready for battle" body="Choose a subject and topic to build a quick multiple-choice deck." />
          )}
        </>
      ) : (
        <>
          {subjects.length ? (
            <SubjectSelector
              subjects={subjects}
              selectedId={filterSubjectId}
              onSelect={(subject) => setFilterSubjectId(filterSubjectId === subject.id ? null : subject.id)}
            />
          ) : null}
          <AppCard style={styles.savedTools}>
            <TextInput
              mode="outlined"
              label="Search saved questions"
              value={savedSearch}
              onChangeText={setSavedSearch}
              left={<TextInput.Icon icon="magnify" />}
              style={styles.answerInput}
            />
            <View style={styles.reviewQueue}>
              <View>
                <Text style={styles.answerTitle}>Review queue</Text>
                <Text style={styles.muted}>{filteredSaved.length} matching saved questions</Text>
              </View>
              {oldestSaved.length ? (
                <Text style={styles.reviewHint} numberOfLines={2}>
                  Start with: {oldestSaved.map((item) => item.topic || item.subject?.subjectName || "saved question").join(", ")}
                </Text>
              ) : null}
            </View>
          </AppCard>
          {loading && !savedQuestions.length ? (
            <AppCard style={styles.loadingCard}>
              <Skeleton style={styles.skeletonTitle} />
              <Skeleton style={styles.skeletonBody} />
            </AppCard>
          ) : filteredSaved.length ? (
            filteredSaved.map((item) => <SavedQuestionCard key={item.id} item={item} />)
          ) : (
            <EmptyState title="No saved questions" body="Save generated questions here for future revision." />
          )}
        </>
      )}
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
  form: {
    gap: 12
  },
  topicRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  topicChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  topicText: {
    color: palette.text,
    fontSize: 12
  },
  error: {
    color: palette.secondary
  },
  questionCard: {
    width: width - 40,
    minHeight: 370,
    marginRight: 14,
    gap: 14
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  badge: {
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: palette.text,
    backgroundColor: `${palette.primary}44`,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted
  },
  questionText: {
    color: palette.text,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Outfit_700Bold"
  },
  answerInput: {
    backgroundColor: palette.surface
  },
  answerBox: {
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 8
  },
  answerTitle: {
    color: palette.success,
    fontFamily: "Outfit_700Bold"
  },
  answer: {
    color: palette.text,
    lineHeight: 21
  },
  criterion: {
    color: palette.muted,
    lineHeight: 19
  },
  feedbackBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.28)",
    backgroundColor: "rgba(124,110,255,0.08)",
    padding: 12,
    gap: 8
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  feedbackTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  feedbackScore: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    textAlign: "right",
    flexShrink: 1
  },
  feedbackPoint: {
    color: palette.text,
    lineHeight: 20
  },
  nextStep: {
    color: palette.info,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: "auto"
  },
  battleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  battleKicker: {
    color: palette.warning,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  battleTitle: {
    color: palette.text,
    fontSize: 22,
    fontFamily: "Outfit_700Bold"
  },
  battleBadge: {
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: palette.text,
    backgroundColor: `${palette.warning}33`,
    fontFamily: "Outfit_700Bold"
  },
  gameCard: {
    gap: 14
  },
  gameOverTitle: {
    color: palette.text,
    fontSize: 28,
    fontFamily: "Outfit_700Bold"
  },
  statsRow: {
    flexDirection: "row",
    gap: 8
  },
  statPill: {
    flex: 1,
    minHeight: 68,
    borderRadius: 8,
    backgroundColor: palette.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    padding: 8
  },
  statNumber: {
    color: palette.text,
    fontSize: 22,
    fontFamily: "Outfit_700Bold"
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12
  },
  timerTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  timerFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: palette.warning
  },
  powerShop: {
    flexDirection: "row",
    gap: 8
  },
  powerButton: {
    flex: 1,
    minHeight: 58,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}66`,
    backgroundColor: "rgba(124,110,255,0.14)",
    padding: 8
  },
  powerDisabled: {
    opacity: 0.5
  },
  powerActive: {
    borderColor: palette.success,
    backgroundColor: "rgba(74,222,128,0.16)"
  },
  powerTitle: {
    color: palette.text,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  },
  powerCost: {
    color: palette.muted,
    textAlign: "center",
    fontSize: 11
  },
  optionGrid: {
    gap: 10
  },
  gameOption: {
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    justifyContent: "center",
    padding: 12
  },
  gameOptionCorrect: {
    borderColor: palette.success,
    backgroundColor: "rgba(74,222,128,0.14)"
  },
  gameOptionWrong: {
    borderColor: palette.secondary,
    backgroundColor: "rgba(255,107,107,0.14)"
  },
  gameOptionText: {
    color: palette.text,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  savedCard: {
    gap: 12
  },
  savedTools: {
    gap: 12
  },
  reviewQueue: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center"
  },
  reviewHint: {
    flex: 1,
    color: palette.info,
    textAlign: "right",
    lineHeight: 18,
    fontFamily: "Outfit_700Bold"
  },
  loadingCard: {
    gap: 12
  },
  skeletonTitle: {
    width: "45%"
  },
  skeletonBody: {
    height: 70
  }
});
