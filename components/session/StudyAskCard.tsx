import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { FormattedStudyText } from "@/components/session/FormattedStudyText";
import { AppCard } from "@/components/ui/AppCard";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import type { StudyAnswer, StudyNote, UserSubject } from "@/types";

type StudyAskCardProps = {
  selectedSubject: UserSubject | null;
  onRouteSubject?: (subject: UserSubject) => void;
  initialTutorTopic?: string;
  initialTutorGoal?: string;
  initialTutorEventId?: string;
  initialTutorEventTitle?: string;
};

type TutorAttachment = {
  uri: string;
  name: string;
  mimeType?: string;
  file?: Blob;
};

type SubjectDomain = {
  id: string;
  subjectTerms: string[];
  questionSignals: { pattern: RegExp; weight: number }[];
};

type CoachMode = "coach" | "tutor";

const coachAnswerTag = "coach-answer";
const coachChatTag = "coach-chat";
const tutorSessionTag = "tutor-session";
const tutorTurnTag = "tutor-turn";
const maxTutorAttachments = 6;

type TutorTurn = {
  question: string;
  answer: StudyAnswer;
  createdAt: string;
  attachmentNames: string[];
};

type CoachChatTurn = {
  question: string;
  answer: StudyAnswer;
  createdAt: string;
  attachmentNames: string[];
  turnNumber: number;
};

const subjectDomains: SubjectDomain[] = [
  {
    id: "maths",
    subjectTerms: ["mathematics", "maths", "math", "methods", "specialist", "further"],
    questionSignals: [
      { pattern: /\\frac|\\boxed|\\\(|\\\[|\^|[a-z]\s*=/i, weight: 4 },
      { pattern: /\bannuit(?:y|ies)|recursion|compound interest|interest rate|monthly payment|depreciation\b/i, weight: 5 },
      { pattern: /\bsolve|calculate|equation|formula|function|gradient|derivative|integral|probability|matrix|matrices|cas\b/i, weight: 3 },
      { pattern: /\bsine|cosine|tangent|trigonometry|quadratic|linear|standard deviation|mean|median\b/i, weight: 3 }
    ]
  },
  {
    id: "business",
    subjectTerms: ["business", "management"],
    questionSignals: [
      { pattern: /\bbusiness management|management style|management skill|stakeholder|corporate culture\b/i, weight: 5 },
      { pattern: /\boperations management|human resources|marketing|employee|motivation|kpi|key performance indicator\b/i, weight: 4 },
      { pattern: /\bswot|porter|change management|leadership|business objective|strategy\b/i, weight: 4 }
    ]
  },
  {
    id: "data-analytics",
    subjectTerms: ["data analytics", "data analysis", "applied computing", "analytics"],
    questionSignals: [
      { pattern: /\bdata analytics|data analysis|applied computing\b/i, weight: 8 },
      { pattern: /\binfographic|data visuali[sz]ation|dashboard|chart|graph|axis|axes|visual hierarchy\b/i, weight: 5 },
      { pattern: /\bevaluation criteria|efficiency|effectiveness|target audience|research question\b/i, weight: 5 },
      { pattern: /\bBOM\b|Climate Data Online|Melbourne Airport Station|cleaned BOM|temperature data\b/i, weight: 6 },
      { pattern: /\bdata acquisition|data cleansing|data cleaning|cleaned data|data manipulation|data dictionary|metadata|data integrity\b/i, weight: 4 },
      { pattern: /\bsummary statistics|trend chart|trend|pattern|outlier|correlation|statistical analysis|source data\b/i, weight: 3 }
    ]
  },
  {
    id: "accounting",
    subjectTerms: ["accounting"],
    questionSignals: [
      { pattern: /\bbalance sheet|income statement|ledger|journal entry|debit|credit|accounts receivable|accounts payable\b/i, weight: 5 },
      { pattern: /\bassets|liabilities|equity|cash flow|gross profit|net profit|inventory turnover\b/i, weight: 3 }
    ]
  },
  {
    id: "economics",
    subjectTerms: ["economics", "eco"],
    questionSignals: [
      { pattern: /\bsupply and demand|aggregate demand|aggregate supply|inflation|gdp|monetary policy|fiscal policy\b/i, weight: 5 },
      { pattern: /\bexchange rate|unemployment|scarcity|opportunity cost|market failure|elasticity\b/i, weight: 4 }
    ]
  },
  {
    id: "biology",
    subjectTerms: ["biology", "bio"],
    questionSignals: [
      { pattern: /\bcell|cells|dna|rna|enzyme|photosynthesis|respiration|homeostasis|immune|evolution\b/i, weight: 4 },
      { pattern: /\bgene|genetic|allele|mutation|protein synthesis|pathogen|antibody\b/i, weight: 4 }
    ]
  },
  {
    id: "chemistry",
    subjectTerms: ["chemistry", "chem"],
    questionSignals: [
      { pattern: /\bmole|molar|stoichiometry|titration|oxidation|reduction|enthalpy|hydrocarbon\b/i, weight: 4 },
      { pattern: /\bacid|base|covalent|ionic|equilibrium|reaction rate|organic chemistry\b/i, weight: 4 }
    ]
  },
  {
    id: "physics",
    subjectTerms: ["physics"],
    questionSignals: [
      { pattern: /\bforce|velocity|acceleration|momentum|energy|power|circuit|voltage|current\b/i, weight: 4 },
      { pattern: /\bnewton|magnetic field|electric field|wave|frequency|gravity|projectile\b/i, weight: 4 }
    ]
  },
  {
    id: "english",
    subjectTerms: ["english", "literature", "eal"],
    questionSignals: [
      { pattern: /\bessay|argument analysis|language analysis|text response|comparative|contention\b/i, weight: 4 },
      { pattern: /\btheme|symbolism|author|audience|tone|persuasive technique|metalanguage\b/i, weight: 3 }
    ]
  },
  {
    id: "legal",
    subjectTerms: ["legal"],
    questionSignals: [
      { pattern: /\bconstitution|parliament|court|justice|law reform|precedent|statutory interpretation\b/i, weight: 4 },
      { pattern: /\bcivil|criminal|rights|remedy|sanction|jury|high court\b/i, weight: 3 }
    ]
  },
  {
    id: "psychology",
    subjectTerms: ["psychology", "psych"],
    questionSignals: [
      { pattern: /\bbrain|neuron|memory|learning|conditioning|sleep|stress|mental health\b/i, weight: 4 },
      { pattern: /\bamygdala|hippocampus|classical conditioning|operant conditioning|consciousness\b/i, weight: 4 }
    ]
  }
];

const attachmentSummary = (attachmentNames: string[]) =>
  attachmentNames.length ? `Attachments\n${attachmentNames.map((name) => `- ${name}`).join("\n")}` : null;

const coachNoteBody = (
  question: string,
  answer: StudyAnswer,
  attachmentNames: string[],
  options: { includeTutorPlan?: boolean } = {}
) =>
  [
    "Question",
    question,
    attachmentSummary(attachmentNames),
    "Answer",
    answer.answer,
    options.includeTutorPlan !== false && answer.tutor_plan
      ? `Tutor plan
Diagnosis: ${answer.tutor_plan.diagnosis}
Teaching move: ${answer.tutor_plan.teaching_move}
Guided steps
${answer.tutor_plan.guided_steps.map((step) => `- ${step}`).join("\n")}
Your turn: ${answer.tutor_plan.your_turn}
Check question: ${answer.tutor_plan.check_question}
Next revision: ${answer.tutor_plan.next_revision}`
      : null,
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

const coachChatTitle = (question: string) =>
  `Coach chat: ${question.replace(/\s+/g, " ").trim() || "New question"}`.slice(0, 140);

const countCoachChatTurns = (body: string) => body.match(/^Turn \d+/gm)?.length ?? 0;

const coachChatTurnBody = (input: CoachChatTurn) =>
  [
    `Turn ${input.turnNumber} - ${new Date(input.createdAt).toLocaleString()}`,
    "Student",
    input.question,
    attachmentSummary(input.attachmentNames),
    "Coach",
    input.answer.answer,
    input.answer.key_points.length ? `Coach takeaways\n${input.answer.key_points.map((point) => `- ${point}`).join("\n")}` : null,
    input.answer.sources_used.length
      ? `Sources\n${input.answer.sources_used
          .map((source) => `- ${source.title}${source.detail || source.source_type ? ` (${source.detail || source.source_type})` : ""}`)
          .join("\n")}`
      : null,
    input.answer.follow_up_questions.length
      ? `Follow-up questions\n${input.answer.follow_up_questions.map((followUp) => `- ${followUp}`).join("\n")}`
      : null
  ]
    .filter(Boolean)
    .join("\n\n");

const appendCoachChatTurn = (currentBody: string | null | undefined, turn: CoachChatTurn) =>
  [currentBody?.trim() || "Coach chat", coachChatTurnBody(turn)].filter(Boolean).join("\n\n---\n\n");

const sortNotesByUpdatedDesc = (notes: StudyNote[]) =>
  [...notes].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );

const tutorTurnNoteBody = (input: {
  topic: string;
  goal: string;
  question: string;
  answer: StudyAnswer;
  attachmentNames: string[];
}) =>
  [
    "Tutor session turn",
    `Topic: ${input.topic}`,
    input.goal ? `Goal: ${input.goal}` : null,
    coachNoteBody(input.question, input.answer, input.attachmentNames, { includeTutorPlan: true })
  ]
    .filter(Boolean)
    .join("\n\n");

const tutorSessionNoteBody = (input: {
  topic: string;
  goal: string;
  startedAt: string | null;
  endedAt: string;
  eventTitle: string | null;
  turns: TutorTurn[];
}) =>
  [
    "Tutor session",
    `Topic: ${input.topic}`,
    input.goal ? `Goal: ${input.goal}` : null,
    input.eventTitle ? `Calendar booking: ${input.eventTitle}` : null,
    input.startedAt ? `Started: ${new Date(input.startedAt).toLocaleString()}` : null,
    `Ended: ${new Date(input.endedAt).toLocaleString()}`,
    `Turns: ${input.turns.length}`,
    ...input.turns.map((turn, index) =>
      [
        `Turn ${index + 1}`,
        `Student: ${turn.question}`,
        attachmentSummary(turn.attachmentNames),
        "Tutor answer",
        turn.answer.answer,
        turn.answer.tutor_plan
          ? `Tutor plan
Diagnosis: ${turn.answer.tutor_plan.diagnosis}
Your turn: ${turn.answer.tutor_plan.your_turn}
Check question: ${turn.answer.tutor_plan.check_question}
Next revision: ${turn.answer.tutor_plan.next_revision}`
          : null
      ]
        .filter(Boolean)
        .join("\n\n")
    )
  ]
    .filter(Boolean)
    .join("\n\n");

const formatSavedDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const subjectDomainScore = (subject: UserSubject, domain: SubjectDomain) => {
  const subjectName = subject.subjectName.toLowerCase();
  return domain.subjectTerms.reduce((score, term) => score + (subjectName.includes(term) ? 1 : 0), 0);
};

const questionDomainScore = (question: string, domain: SubjectDomain) =>
  domain.questionSignals.reduce((score, signal) => score + (signal.pattern.test(question) ? signal.weight : 0), 0);

const smartSubjectForQuestion = (question: string, selectedSubject: UserSubject, subjects: UserSubject[]) => {
  const rankedDomains = subjectDomains
    .map((domain) => ({
      domain,
      score:
        questionDomainScore(question, domain) +
        (domain.subjectTerms.some((term) => question.toLowerCase().includes(term)) ? 4 : 0)
    }))
    .sort((a, b) => b.score - a.score);

  const bestDomain = rankedDomains[0];
  const nextDomain = rankedDomains[1];
  if (!bestDomain || bestDomain.score < 4 || (nextDomain && bestDomain.score - nextDomain.score < 2)) {
    return selectedSubject;
  }

  if (subjectDomainScore(selectedSubject, bestDomain.domain) > 0) {
    return selectedSubject;
  }

  const matchingSubject = subjects
    .map((subject) => ({ subject, score: subjectDomainScore(subject, bestDomain.domain) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.subject.subjectName.localeCompare(b.subject.subjectName))[0]?.subject;

  return matchingSubject ?? selectedSubject;
};

const isPdfAttachment = (asset: TutorAttachment) =>
  asset.name.toLowerCase().endsWith(".pdf") || asset.mimeType?.toLowerCase().includes("pdf");

const appendTutorAttachment = (formData: FormData, asset: TutorAttachment) => {
  const fieldName = isPdfAttachment(asset) ? "attachments" : "screenshots";
  const webFile = Platform.OS === "web" ? asset.file : null;
  if (webFile) {
    formData.append(fieldName, webFile, asset.name);
    return;
  }

  formData.append(fieldName, {
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

export function StudyAskCard({
  selectedSubject,
  onRouteSubject,
  initialTutorTopic,
  initialTutorGoal,
  initialTutorEventId,
  initialTutorEventTitle
}: StudyAskCardProps) {
  const askStudyQuestion = useAppStore((state) => state.askStudyQuestion);
  const createNote = useAppStore((state) => state.createNote);
  const updateNote = useAppStore((state) => state.updateNote);
  const deleteNote = useAppStore((state) => state.deleteNote);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const notes = useAppStore((state) => state.notes);
  const subjects = useAppStore((state) => state.subjects);
  const [question, setQuestion] = useState("");
  const [coachMode, setCoachMode] = useState<CoachMode>("coach");
  const [answerMode, setAnswerMode] = useState<CoachMode>("coach");
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionGoal, setSessionGoal] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTurns, setSessionTurns] = useState<TutorTurn[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [sessionEventId, setSessionEventId] = useState<string | null>(null);
  const [sessionEventTitle, setSessionEventTitle] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [attachments, setAttachments] = useState<TutorAttachment[]>([]);
  const [answer, setAnswer] = useState<StudyAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [activeCoachChatId, setActiveCoachChatId] = useState<string | null>(null);
  const [newCoachChatPending, setNewCoachChatPending] = useState(false);
  const selectedSubjectId = selectedSubject?.id ?? null;
  const hydratedTutorEventRef = useRef<string | null>(null);

  const coachChatHistory = useMemo(
    () =>
      sortNotesByUpdatedDesc(
        notes.filter(
          (note) => note.tags.includes(coachChatTag) && (!selectedSubjectId || note.subjectId === selectedSubjectId)
        )
      ),
    [notes, selectedSubjectId]
  );
  const legacyCoachHistory = useMemo(
    () =>
      sortNotesByUpdatedDesc(
        notes.filter(
          (note) =>
            note.tags.includes(coachAnswerTag) &&
            !note.tags.includes(coachChatTag) &&
            !note.tags.includes(tutorSessionTag) &&
            (!selectedSubjectId || note.subjectId === selectedSubjectId)
        )
      ),
    [notes, selectedSubjectId]
  );
  const activeCoachChat = useMemo(() => {
    if (newCoachChatPending) return null;
    const selectedChat = activeCoachChatId
      ? coachChatHistory.find((note) => note.id === activeCoachChatId)
      : null;
    return selectedChat || coachChatHistory[0] || null;
  }, [activeCoachChatId, coachChatHistory, newCoachChatPending]);
  const activeCoachChatTurnCount = activeCoachChat ? countCoachChatTurns(activeCoachChat.body) : 0;
  const tutorSessionHistory = useMemo(
    () =>
      sortNotesByUpdatedDesc(
        notes.filter(
          (note) =>
            note.tags.includes(tutorSessionTag) &&
            !note.tags.includes(tutorTurnTag) &&
            (!selectedSubjectId || note.subjectId === selectedSubjectId)
        )
      ),
    [notes, selectedSubjectId]
  );

  const addTutorAttachments = useCallback((assets: TutorAttachment[]) => {
    if (!assets.length) return;
    setAttachments((current) => {
      const nextAssets = assets.slice(0, Math.max(0, maxTutorAttachments - current.length));
      const next = [...current, ...nextAssets];
      setMessage(
        nextAssets.length < assets.length
          ? `Up to ${maxTutorAttachments} tutor files can be attached.`
          : `${nextAssets.length} file${nextAssets.length === 1 ? "" : "s"} attached.`
      );
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
      addTutorAttachments(
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
  }, [addTutorAttachments]);

  useEffect(() => {
    const key = initialTutorEventId || initialTutorTopic || "";
    if (!key || hydratedTutorEventRef.current === key) return;
    hydratedTutorEventRef.current = key;
    const topic = initialTutorTopic?.trim() || "Tutor session";
    setSessionTopic(topic);
    setSessionGoal(initialTutorGoal?.trim() ?? "");
    setSessionEventId(initialTutorEventId ?? null);
    setSessionEventTitle(initialTutorEventTitle ?? null);
    setCoachMode("tutor");
    setSessionActive(true);
    setSessionStartedAt(new Date().toISOString());
    setSessionTurns([]);
    setQuestion((current) =>
      current.trim()
        ? current
        : `Start my tutor session on ${topic}. First, reconnect to any previous session memory, diagnose what I need, and ask me the first check question.`
    );
    setMessage("Tutor session opened from Calendar.");
  }, [initialTutorEventId, initialTutorEventTitle, initialTutorGoal, initialTutorTopic]);

  useEffect(() => {
    setActiveCoachChatId(null);
    setNewCoachChatPending(false);
    setExpandedHistoryId(null);
  }, [selectedSubjectId]);

  const addAttachments = async () => {
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/*", "application/pdf"],
      multiple: true,
      copyToCacheDirectory: true
    });

    if (result.canceled) return;

    addTutorAttachments(result.assets as TutorAttachment[]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const copyFollowUp = async (followUp: string) => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(followUp);
        setMessage("Follow-up copied.");
        return;
      } catch {
        setQuestion(followUp);
        setMessage("Could not copy automatically. The follow-up is loaded and selectable.");
        return;
      }
    }
    setQuestion(followUp);
    setMessage("Follow-up loaded. You can select the text or tap Ask.");
  };

  const startNewCoachChat = () => {
    setCoachMode("coach");
    setActiveCoachChatId(null);
    setNewCoachChatPending(true);
    setExpandedHistoryId(null);
    setQuestion("");
    setAnswer(null);
    setAttachments([]);
    setMessage("New coach chat ready.");
  };

  const openCoachChat = (note: StudyNote) => {
    setCoachMode("coach");
    setActiveCoachChatId(note.id);
    setNewCoachChatPending(false);
    setExpandedHistoryId(note.id);
    setAnswer(null);
    setMessage("Coach chat opened.");
  };

  const findCoachChatForSubject = useCallback(
    (subjectId: string) => {
      if (newCoachChatPending) return null;
      const currentChat = activeCoachChatId
        ? notes.find(
            (note) =>
              note.id === activeCoachChatId &&
              note.subjectId === subjectId &&
              note.tags.includes(coachChatTag)
          )
        : null;
      if (currentChat) return currentChat;
      return (
        sortNotesByUpdatedDesc(
          notes.filter((note) => note.subjectId === subjectId && note.tags.includes(coachChatTag))
        )[0] ?? null
      );
    },
    [activeCoachChatId, newCoachChatPending, notes]
  );

  const saveCoachTurnToChat = async (input: {
    subjectId: string;
    question: string;
    answer: StudyAnswer;
    attachmentNames: string[];
  }) => {
    const currentChat = findCoachChatForSubject(input.subjectId);
    const createdAt = new Date().toISOString();
    const turnNumber = (currentChat ? countCoachChatTurns(currentChat.body) : 0) + 1;
    const body = appendCoachChatTurn(currentChat?.body, {
      question: input.question,
      answer: input.answer,
      attachmentNames: input.attachmentNames,
      createdAt,
      turnNumber
    });

    if (currentChat) {
      const updated = await updateNote(currentChat.id, {
        body,
        tags: Array.from(new Set([...currentChat.tags, coachAnswerTag, coachChatTag]))
      });
      setActiveCoachChatId(updated.id);
      setNewCoachChatPending(false);
      return { note: updated, created: false };
    }

    const created = await createNote({
      subjectId: input.subjectId,
      title: coachChatTitle(input.question),
      body,
      noteType: "general",
      tags: [coachAnswerTag, coachChatTag]
    });
    setActiveCoachChatId(created.id);
    setNewCoachChatPending(false);
    return { note: created, created: true };
  };

  const removeCoachAnswer = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setMessage("Tap confirm to delete that saved coach item.");
      return;
    }

    setDeletingId(id);
    try {
      await deleteNote(id);
      if (expandedHistoryId === id) {
        setExpandedHistoryId(null);
      }
      if (activeCoachChatId === id) {
        setActiveCoachChatId(null);
      }
      setConfirmDeleteId(null);
      setMessage("Saved coach item deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete that saved coach item.");
    } finally {
      setDeletingId(null);
    }
  };

  const startTutorSession = () => {
    if (!selectedSubject) {
      setMessage("Choose a subject before starting a tutor session.");
      return;
    }
    const topic = sessionTopic.trim() || question.trim();
    if (!topic) {
      setMessage("Add the topic for this tutor session.");
      return;
    }
    setCoachMode("tutor");
    setSessionTopic(topic);
    setSessionActive(true);
    setSessionStartedAt(new Date().toISOString());
    setSessionTurns([]);
    setQuestion((current) =>
      current.trim()
        ? current
        : `Start my tutor session on ${topic}. Diagnose what I know, teach the first step, then give me a check question.`
    );
    setMessage(`${tutorSessionHistory.length ? `${tutorSessionHistory.length} previous tutor session${tutorSessionHistory.length === 1 ? "" : "s"} will be remembered. ` : ""}Tutor session started.`);
  };

  const endTutorSession = async () => {
    if (!selectedSubject || !sessionActive) return;
    if (!sessionTurns.length) {
      setSessionActive(false);
      setMessage("Tutor session closed. Ask at least one question to save a session transcript.");
      return;
    }

    const endedAt = new Date().toISOString();
    const topic = sessionTopic.trim() || "Tutor session";
    setSavingSession(true);
    try {
      await createNote({
        subjectId: selectedSubject.id,
        title: `Tutor session: ${topic}`.slice(0, 140),
        body: tutorSessionNoteBody({
          topic,
          goal: sessionGoal.trim(),
          startedAt: sessionStartedAt,
          endedAt,
          eventTitle: sessionEventTitle,
          turns: sessionTurns
        }),
        noteType: "general",
        tags: [coachAnswerTag, tutorSessionTag]
      });
      if (sessionEventId) {
        await updateEvent(sessionEventId, { completed: true });
      }
      setSessionActive(false);
      setSessionTurns([]);
      setSessionEventId(null);
      setSessionEventTitle(null);
      setMessage("Tutor session saved. The next tutor session can use this as memory.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this tutor session.");
    } finally {
      setSavingSession(false);
    }
  };

  const ask = async (overrideQuestion?: string, overrideMode?: CoachMode) => {
    const askedQuestion = (overrideQuestion ?? question).trim();
    const requestMode = overrideMode ?? coachMode;
    if (!selectedSubject || !askedQuestion) {
      setMessage("Choose a subject and add a question.");
      return;
    }
    if (requestMode === "tutor" && !sessionActive) {
      setCoachMode("tutor");
      setMessage("Start a tutor session first, then the tutor can teach it properly and save the transcript.");
      return;
    }

    setQuestion(askedQuestion);
    setAsking(true);
    setMessage(null);
    try {
      const questionSubject = smartSubjectForQuestion(askedQuestion, selectedSubject, subjects);
      const routed = questionSubject.id !== selectedSubject.id;
      const attachmentNames = attachments.map((asset) => asset.name);
      const formData = new FormData();
      formData.append("subjectId", questionSubject.id);
      formData.append("question", askedQuestion);
      formData.append("responseMode", requestMode === "tutor" ? "tutor" : "direct");
      const requestCoachChat = requestMode === "coach" ? findCoachChatForSubject(questionSubject.id) : null;
      if (requestCoachChat) {
        formData.append("coachChatTitle", requestCoachChat.title);
        formData.append("coachChatTranscript", requestCoachChat.body.slice(-24_000));
      }
      if (requestMode === "tutor" && sessionActive) {
        formData.append("sessionMode", "tutor_session");
        formData.append("sessionTopic", sessionTopic.trim() || askedQuestion);
        formData.append("sessionGoal", sessionGoal.trim());
        if (sessionEventId) formData.append("sessionEventId", sessionEventId);
      }
      attachments.forEach((asset) => appendTutorAttachment(formData, asset));

      const nextAnswer = await askStudyQuestion(formData);
      setAnswer(nextAnswer);
      setAnswerMode(requestMode);
      if (routed) {
        onRouteSubject?.(questionSubject);
      }
      if (requestMode === "tutor" && sessionActive) {
        setSessionTurns((current) => [
          ...current,
          { question: askedQuestion, answer: nextAnswer, createdAt: new Date().toISOString(), attachmentNames }
        ]);
      }
      try {
        if (requestMode === "tutor") {
          await createNote({
            subjectId: questionSubject.id,
            title: `Tutor turn: ${sessionTopic.trim() || askedQuestion}`.slice(0, 140),
            body: tutorTurnNoteBody({
              topic: sessionTopic.trim() || askedQuestion,
              goal: sessionGoal.trim(),
              question: askedQuestion,
              answer: nextAnswer,
              attachmentNames
            }),
            noteType: "general",
            tags: [coachAnswerTag, tutorSessionTag, tutorTurnTag]
          });
          setMessage("Tutor turn saved. Keep going or end the session to save the full transcript.");
        } else {
          const chatResult = await saveCoachTurnToChat({
            subjectId: questionSubject.id,
            question: askedQuestion,
            answer: nextAnswer,
            attachmentNames
          });
          setMessage(
            routed
              ? `Routed to ${questionSubject.subjectName} and saved in ${chatResult.created ? "a new coach chat" : "that coach chat"}.`
              : chatResult.created
                ? "Coach chat started and saved."
                : "Coach turn saved to this chat."
          );
        }
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
            {coachMode === "coach" ? "Ask coach" : "Tutor session"}
          </Text>
          <Text style={styles.muted}>{selectedSubject?.subjectName ?? "Choose a subject"}</Text>
          <Text style={styles.pasteHint}>Upload images/PDFs or paste screenshots with Ctrl+V</Text>
        </View>
        <View style={[styles.confidence, answer?.confidence === "high" && styles.confidenceHigh]}>
          <Text style={styles.confidenceText}>{answer?.confidence ?? "ready"}</Text>
        </View>
      </View>

      <SegmentedButtons
        value={coachMode}
        onValueChange={(value) => setCoachMode(value as CoachMode)}
        buttons={[
          { value: "coach", label: "Ask coach", icon: "message-question-outline" },
          { value: "tutor", label: "Tutor session", icon: "school-outline" }
        ]}
      />

      {coachMode === "coach" ? (
        <View style={styles.coachChatBox}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionHeaderText}>
              <Text style={styles.blockTitle}>{activeCoachChat ? activeCoachChat.title : "New coach chat"}</Text>
              <Text style={styles.muted}>
                {activeCoachChat
                  ? `${activeCoachChatTurnCount} turn${activeCoachChatTurnCount === 1 ? "" : "s"} saved - last updated ${formatSavedDate(activeCoachChat.updatedAt)}`
                  : "Next answer starts a separate saved chat"}
              </Text>
            </View>
            <Button mode="outlined" compact icon="plus" disabled={!selectedSubject} onPress={startNewCoachChat}>
              New chat
            </Button>
          </View>
        </View>
      ) : null}

      {coachMode === "tutor" || sessionActive ? (
        <View style={[styles.sessionBox, sessionActive && styles.sessionBoxActive]}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionHeaderText}>
              <Text style={styles.blockTitle}>{sessionActive ? "Tutor session running" : "Tutor session"}</Text>
              <Text style={styles.muted}>
                {sessionActive
                  ? `${sessionTurns.length} turn${sessionTurns.length === 1 ? "" : "s"} in this session`
                  : `${tutorSessionHistory.length} previous session${tutorSessionHistory.length === 1 ? "" : "s"} remembered`}
              </Text>
            </View>
            <Button
              mode={sessionActive ? "outlined" : "contained-tonal"}
              compact
              icon={sessionActive ? "content-save-check-outline" : "school-outline"}
              loading={savingSession}
              disabled={savingSession || !selectedSubject}
              onPress={sessionActive ? endTutorSession : startTutorSession}
            >
              {sessionActive ? "End & save" : "Start session"}
            </Button>
          </View>
          <TextInput
            mode="outlined"
            label="Session topic"
            value={sessionTopic}
            onChangeText={setSessionTopic}
            disabled={sessionActive}
          />
          <TextInput
            mode="outlined"
            label="Goal for the tutor"
            value={sessionGoal}
            onChangeText={setSessionGoal}
            disabled={sessionActive}
            multiline
            numberOfLines={2}
          />
          {sessionEventTitle ? <Text style={styles.sessionEvent}>Calendar: {sessionEventTitle}</Text> : null}
        </View>
      ) : null}

      <TextInput
        mode="outlined"
        label={coachMode === "coach" ? "Ask a direct question" : "What should we work through?"}
        value={question}
        multiline
        numberOfLines={5}
        onChangeText={setQuestion}
      />

      {attachments.length ? (
        <View style={styles.attachmentList}>
          {attachments.map((asset, index) => (
            <Pressable key={`${asset.uri}-${index}`} onPress={() => removeAttachment(index)} style={styles.attachmentPill}>
              <Text numberOfLines={1} style={styles.attachmentText}>
                {asset.name}
              </Text>
              <Text style={styles.removeText}>x</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          mode="outlined"
          icon="file-document-plus-outline"
          disabled={asking || attachments.length >= maxTutorAttachments}
          onPress={addAttachments}
        >
          Attach file
        </Button>
        <Button
          mode="contained"
          icon="send"
          loading={asking}
          disabled={asking || !selectedSubject || !question.trim()}
          onPress={() => void ask()}
        >
          {coachMode === "coach" ? "Ask coach" : "Tutor me"}
        </Button>
      </View>

      {answer ? (
        <View style={styles.answerStack}>
          <FormattedStudyText value={answer.answer} />

          {answerMode === "tutor" && answer.tutor_plan ? (
            <View style={styles.tutorPlan}>
              <View style={styles.tutorPlanHeader}>
                <Text style={styles.blockTitle}>Tutor plan</Text>
                <Text style={styles.tutorBadge}>your turn</Text>
              </View>
              <View style={styles.tutorCallout}>
                <Text style={styles.tutorLabel}>Diagnosis</Text>
                <Text style={styles.tutorText}>{answer.tutor_plan.diagnosis}</Text>
              </View>
              <View style={styles.tutorCallout}>
                <Text style={styles.tutorLabel}>Teaching move</Text>
                <Text style={styles.tutorText}>{answer.tutor_plan.teaching_move}</Text>
              </View>
              <View style={styles.guidedSteps}>
                {answer.tutor_plan.guided_steps.map((step, index) => (
                  <View key={`${step}-${index}`} style={styles.guidedStep}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                    <Text style={styles.tutorText}>{step}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.tutorCalloutStrong}>
                <Text style={styles.tutorLabel}>Your turn</Text>
                <Text style={styles.tutorText}>{answer.tutor_plan.your_turn}</Text>
              </View>
              <View style={styles.tutorCallout}>
                <Text style={styles.tutorLabel}>Check</Text>
                <Text style={styles.tutorText}>{answer.tutor_plan.check_question}</Text>
              </View>
              <View style={styles.tutorCallout}>
                <Text style={styles.tutorLabel}>Next revision</Text>
                <Text style={styles.tutorText}>{answer.tutor_plan.next_revision}</Text>
              </View>
            </View>
          ) : null}

          {answer.key_points.length ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>{answerMode === "tutor" ? "Tutor focus" : "Coach takeaways"}</Text>
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
              <Text style={styles.blockTitle}>Follow-up actions</Text>
              {answer.follow_up_questions.slice(0, 3).map((followUp) => (
                <View key={followUp} style={styles.followUpCard}>
                  <Text selectable style={styles.followUpText}>
                    {followUp}
                  </Text>
                  <View style={styles.followUpActions}>
                    <Button
                      mode="contained-tonal"
                      compact
                      icon="send"
                      disabled={asking || !selectedSubject}
                      onPress={() => void ask(followUp, answerMode)}
                    >
                      Ask
                    </Button>
                    <Button mode="text" compact icon="content-copy" onPress={() => void copyFollowUp(followUp)}>
                      Copy
                    </Button>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {(coachMode === "coach" && (coachChatHistory.length || legacyCoachHistory.length)) ||
      (coachMode === "tutor" && tutorSessionHistory.length) ? (
        <View style={styles.historyStack}>
          <View style={styles.historyHeader}>
            <Text style={styles.blockTitle}>
              {coachMode === "coach"
                ? coachChatHistory.length
                  ? "Coach chats"
                  : "Older saved answers"
                : "Tutor session transcripts"}
            </Text>
            <Text style={styles.muted}>
              {(coachMode === "coach"
                ? coachChatHistory.length || legacyCoachHistory.length
                : tutorSessionHistory.length)}{" "}
              saved{selectedSubject ? "" : " total"}
            </Text>
          </View>
          {(coachMode === "coach"
            ? coachChatHistory.length
              ? coachChatHistory
              : legacyCoachHistory
            : tutorSessionHistory
          ).map((note) => {
            const expanded = expandedHistoryId === note.id;
            const isCoachChat = note.tags.includes(coachChatTag);
            const turnCount = isCoachChat ? countCoachChatTurns(note.body) : 0;
            return (
              <View key={note.id} style={styles.historyItem}>
                <View style={styles.historyRow}>
                  <View style={styles.historyText}>
                    <Text style={styles.historyTitle}>{note.title.replace(/^(Coach chat|Coach|Tutor):\s*/, "")}</Text>
                    <Text style={styles.muted}>
                      {isCoachChat ? `${turnCount} turn${turnCount === 1 ? "" : "s"} - ` : ""}
                      {note.subject?.subjectName ?? "General"} - {formatSavedDate(note.updatedAt || note.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.historyActions}>
                    {isCoachChat ? (
                      <Button mode="text" compact icon="chat-outline" onPress={() => openCoachChat(note)}>
                        Open
                      </Button>
                    ) : null}
                    <Button
                      mode="text"
                      compact
                      icon={expanded ? "chevron-up" : "eye-outline"}
                      onPress={() => setExpandedHistoryId(expanded ? null : note.id)}
                    >
                      {expanded ? "Hide" : "View"}
                    </Button>
                    <Button
                      mode="text"
                      compact
                      icon={confirmDeleteId === note.id ? "check" : "delete-outline"}
                      textColor={confirmDeleteId === note.id ? palette.secondary : palette.muted}
                      loading={deletingId === note.id}
                      onPress={() => removeCoachAnswer(note.id)}
                    >
                      {confirmDeleteId === note.id ? "Confirm" : "Delete"}
                    </Button>
                  </View>
                </View>
                {expanded ? (
                  <View style={styles.historyBody}>
                    <FormattedStudyText value={note.body} compact />
                  </View>
                ) : null}
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
  sessionBox: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.info}33`,
    backgroundColor: `${palette.info}0F`,
    padding: 12
  },
  coachChatBox: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}33`,
    backgroundColor: `${palette.primary}0F`,
    padding: 12
  },
  sessionBoxActive: {
    borderColor: `${palette.success}55`,
    backgroundColor: `${palette.success}10`
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sessionHeaderText: {
    flex: 1,
    minWidth: 0
  },
  sessionEvent: {
    color: palette.primary,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
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
  attachmentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  attachmentPill: {
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
  attachmentText: {
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
  tutorPlan: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}44`,
    backgroundColor: `${palette.primary}0F`,
    padding: 12
  },
  tutorPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  tutorBadge: {
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.success}55`,
    backgroundColor: `${palette.success}16`,
    color: palette.success,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: "uppercase"
  },
  tutorCallout: {
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 10
  },
  tutorCalloutStrong: {
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.success}44`,
    backgroundColor: `${palette.success}12`,
    padding: 10
  },
  tutorLabel: {
    color: palette.primary,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  tutorText: {
    flex: 1,
    color: palette.text,
    lineHeight: 20
  },
  guidedSteps: {
    gap: 8
  },
  guidedStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9
  },
  stepNumber: {
    width: 22,
    height: 22,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}18`,
    color: palette.primary,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
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
    gap: 8
  },
  followUpCard: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    padding: 10
  },
  followUpText: {
    color: palette.text,
    lineHeight: 20
  },
  followUpActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
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
  historyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 2
  },
  historyTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  historyBody: {
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
