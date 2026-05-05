import type {
  Gamification,
  Goal,
  SavedQuestion,
  StudyEvent,
  StudyNote,
  StudyResource,
  StudySession,
  UserSubject
} from "@/types";

export const mistakeTag = "mistake-log";
export const flashcardTag = "flashcard";
export const sacPanicTag = "sac-panic-plan";
export const coachAnswerTag = "coach-answer";

export type MistakeNoteDraft = {
  question: string;
  studentAnswer: string;
  issue: string;
  correctIdea: string;
  nextRule: string;
  topic?: string | null;
  commandTerm?: string | null;
};

export type ParsedMistake = MistakeNoteDraft & {
  id: string;
  title: string;
  subjectName?: string | null;
  createdAt: string;
};

export type FlashcardDraft = {
  front: string;
  back: string;
  sourceTitle: string;
  cardType: "normal" | "mistake" | "command" | "blurt";
};

export type ParsedFlashcard = FlashcardDraft & {
  id: string;
  title: string;
  subjectName?: string | null;
  createdAt: string;
};

export type WeaknessSummary = {
  title: string;
  body: string;
  weakSubject?: UserSubject | null;
  weakTopic?: string | null;
  repeatedMistake?: string | null;
  nextAction: string;
};

export type WeeklyReport = {
  totalMinutes: number;
  strongestSubject: string;
  ignoredSubject?: string | null;
  questionCount: number;
  mistakeCount: number;
  streak: number;
  nextMove: string;
  lines: string[];
};

export type SacPanicPlan = {
  title: string;
  daysUntil: number;
  reviseToday: string[];
  practice: string[];
  commonMistakes: string[];
  checklist: string[];
  summaryNotes: string[];
  body: string;
};

export type StudySearchResult = {
  id: string;
  type: "Note" | "Question" | "Event" | "File" | "Mistake" | "Flashcard" | "Coach";
  title: string;
  detail: string;
  route: "/(tabs)/study" | "/(tabs)/questions" | "/(tabs)/calendar";
};

export const commandTermPrompts = [
  {
    term: "Define",
    subjectHint: "Most VCE subjects",
    weakAnswer: "Market share is how much of the market a business has.",
    prompt: "Improve this into a precise definition with the key idea and no waffle.",
    modelAnswer: "Market share is the percentage of total sales in a market held by one business over a specific period.",
    criteria: ["Precise meaning", "Uses measurable language", "Avoids extra explanation"]
  },
  {
    term: "Describe",
    subjectHint: "Sciences, Humanities, PE, Tech",
    weakAnswer: "Motivation makes employees work harder.",
    prompt: "Improve this by giving clear characteristics, not just a vague effect.",
    modelAnswer: "Motivation is the internal or external drive that encourages employees to put effort into work tasks and persist toward business objectives.",
    criteria: ["Gives characteristics", "Mentions effort or persistence", "Links to the context"]
  },
  {
    term: "Explain",
    subjectHint: "Business, Health, Legal, Psychology",
    weakAnswer: "Training is good because employees learn new skills.",
    prompt: "Improve this by showing cause and effect.",
    modelAnswer: "Training improves employee skills and knowledge, which can reduce errors and increase productivity because employees complete tasks more efficiently.",
    criteria: ["Uses because/therefore logic", "Shows cause and effect", "Links to an outcome"]
  },
  {
    term: "Analyse",
    subjectHint: "Business, English, Humanities, Tech",
    weakAnswer: "This strategy helps because it improves productivity.",
    prompt: "Improve this by breaking the idea into parts and linking back to the objective.",
    modelAnswer: "This strategy can improve productivity by reducing wasted time in the production process. Higher productivity lowers unit costs, helping the business meet its objective of improving efficiency.",
    criteria: ["Breaks down how it works", "Uses evidence or a mechanism", "Links back to the objective"]
  },
  {
    term: "Evaluate",
    subjectHint: "Business, Legal, Health, English",
    weakAnswer: "This method is effective but has some disadvantages.",
    prompt: "Improve this by weighing strengths and limits, then making a judgement.",
    modelAnswer: "This method is effective in the short term because it gives clear direction, but it may reduce employee input and motivation. Overall, it is most suitable during urgent change rather than long-term improvement.",
    criteria: ["Gives both sides", "Makes a judgement", "Uses context to decide"]
  },
  {
    term: "Justify",
    subjectHint: "Data, Software, Business, Legal",
    weakAnswer: "I would choose this design because it is better.",
    prompt: "Improve this by giving a clear decision and evidence-based reason.",
    modelAnswer: "I would choose this design because it directly addresses the user's need for faster data entry while reducing validation errors through constrained input fields.",
    criteria: ["States a decision", "Gives evidence", "Links to criteria or user need"]
  },
  {
    term: "Compare",
    subjectHint: "English, Humanities, Sciences",
    weakAnswer: "The two methods are different because one is faster.",
    prompt: "Improve this by naming both sides and using a clear similarity or difference.",
    modelAnswer: "Method A is faster because it requires fewer steps, whereas Method B is slower but produces more detailed evidence for checking the result.",
    criteria: ["Names both sides", "Uses comparative language", "Explains the basis of comparison"]
  }
];

const normalise = (value?: string | null) => value?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";

const dateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value.slice(0, 10) : "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const weekStart = () => {
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

const sectionValue = (body: string, heading: string) => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}:\\s*([\\s\\S]*?)(?=\\n\\n[A-Z][^\\n:]{1,48}:|$)`, "i").exec(body);
  return match?.[1]?.trim() ?? "";
};

const oneLine = (value: string, fallback = "Not recorded") => value.replace(/\s+/g, " ").trim() || fallback;

export const hasTag = (note: StudyNote, tag: string) => note.tags?.includes(tag);

export const isMistakeNote = (note: StudyNote) => hasTag(note, mistakeTag) || note.noteType === "mistake_log";

export const isFlashcardNote = (note: StudyNote) => hasTag(note, flashcardTag);

export const isSacPanicNote = (note: StudyNote) => hasTag(note, sacPanicTag);

export const formatMistakeNoteBody = (draft: MistakeNoteDraft) =>
  [
    `Topic:\n${draft.topic?.trim() || "General"}`,
    `Command term:\n${draft.commandTerm?.trim() || "Not sure"}`,
    `Question:\n${draft.question.trim()}`,
    `What I wrote:\n${draft.studentAnswer.trim() || "Not recorded"}`,
    `What went wrong:\n${draft.issue.trim() || "The answer needs a clearer link to the marking criteria."}`,
    `Correct idea:\n${draft.correctIdea.trim() || "Use the model answer and marking criteria to rebuild this."}`,
    `How to avoid this next time:\n${draft.nextRule.trim() || "State the command-term job, then link each point back to the question."}`
  ].join("\n\n");

export const parseMistakeNote = (note: StudyNote): ParsedMistake => ({
  id: note.id,
  title: note.title,
  subjectName: note.subject?.subjectName,
  createdAt: note.createdAt,
  topic: sectionValue(note.body, "Topic") || note.title.replace(/^Mistake:\s*/i, ""),
  commandTerm: sectionValue(note.body, "Command term"),
  question: sectionValue(note.body, "Question") || note.title,
  studentAnswer: sectionValue(note.body, "What I wrote"),
  issue: sectionValue(note.body, "What went wrong") || sectionValue(note.body, "Fix for the roadmap"),
  correctIdea: sectionValue(note.body, "Correct idea") || sectionValue(note.body, "Model answer"),
  nextRule: sectionValue(note.body, "How to avoid this next time") || "Redo this as a fresh answer, then mark against the criteria."
});

export const formatFlashcardNoteBody = (card: FlashcardDraft) =>
  [
    `Type:\n${card.cardType}`,
    `Source:\n${card.sourceTitle}`,
    `Front:\n${card.front.trim()}`,
    `Back:\n${card.back.trim()}`
  ].join("\n\n");

export const parseFlashcardNote = (note: StudyNote): ParsedFlashcard => ({
  id: note.id,
  title: note.title,
  subjectName: note.subject?.subjectName,
  createdAt: note.createdAt,
  cardType: (sectionValue(note.body, "Type") as ParsedFlashcard["cardType"]) || "normal",
  sourceTitle: sectionValue(note.body, "Source") || note.title,
  front: sectionValue(note.body, "Front") || note.title,
  back: sectionValue(note.body, "Back") || note.body
});

export const flashcardsFromNote = (note: StudyNote, limit = 4): FlashcardDraft[] => {
  if (isFlashcardNote(note)) return [];
  if (isMistakeNote(note)) {
    const mistake = parseMistakeNote(note);
    return [
      {
        cardType: "mistake",
        sourceTitle: note.title,
        front: `What is the fix for this mistake? ${oneLine(mistake.question).slice(0, 140)}`,
        back: `${oneLine(mistake.correctIdea)}\n\nNext-time rule: ${oneLine(mistake.nextRule)}`,
      },
      {
        cardType: "command",
        sourceTitle: note.title,
        front: `What command-term habit would stop this happening again?`,
        back: oneLine(mistake.nextRule)
      }
    ];
  }

  const cleanBody = note.body
    .replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 35 && !line.startsWith("#"))
    .slice(0, limit);

  return cleanBody.map((line, index) => ({
    cardType: index % 2 === 0 ? "normal" : "blurt",
    sourceTitle: note.title,
    front: index % 2 === 0 ? `Explain this idea from ${note.title}: ${line.slice(0, 80)}...` : `Blurt everything you remember about: ${note.title}`,
    back: line
  }));
};

export const buildWeaknessSummary = ({
  subjects,
  sessions,
  goals,
  notes,
  savedQuestions,
  events
}: {
  subjects: UserSubject[];
  sessions: StudySession[];
  goals: Goal[];
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  events: StudyEvent[];
}): WeaknessSummary => {
  const start = weekStart();
  const subjectScores = subjects.map((subject) => {
    const weekMinutes =
      sessions
        .filter((session) => session.subjectId === subject.id && new Date(session.createdAt) >= start)
        .reduce((sum, session) => sum + session.durationSeconds, 0) / 60;
    const targetMinutes = Number(goals.find((goal) => goal.subjectId === subject.id)?.weeklyHoursTarget ?? 4) * 60;
    const mistakeCount = notes.filter((note) => isMistakeNote(note) && note.subjectId === subject.id).length;
    const savedCount = savedQuestions.filter((question) => question.subjectId === subject.id).length;
    return {
      subject,
      weekMinutes,
      targetMinutes,
      score: targetMinutes ? weekMinutes / targetMinutes - mistakeCount * 0.08 - (savedCount ? 0 : 0.05) : 1 - mistakeCount * 0.08
    };
  });

  const weak = subjectScores.sort((a, b) => a.score - b.score)[0];
  const mistakeTopics = notes
    .filter(isMistakeNote)
    .map(parseMistakeNote)
    .filter((mistake) => !weak?.subject || normalise(mistake.subjectName) === normalise(weak.subject.subjectName));
  const topicCounts = new Map<string, number>();
  mistakeTopics.forEach((mistake) => {
    const key = oneLine(mistake.topic ?? "General");
    topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1);
  });
  const weakTopic = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const urgent = events
    .filter((event) => !event.completed && event.subjectId === weak?.subject.id)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
  const repeatedMistake = mistakeTopics[0]?.issue ? oneLine(mistakeTopics[0].issue).slice(0, 180) : null;
  const subjectName = weak?.subject.subjectName ?? "your weakest subject";

  return {
    title: weak ? `${subjectName} needs the next repair` : "Weakness Coach is ready",
    body: repeatedMistake
      ? `Pattern spotted: ${repeatedMistake}`
      : weakTopic
        ? `${weakTopic} has the most mistake evidence right now.`
        : urgent
          ? `${urgent.title} is the nearest pressure point for ${subjectName}.`
          : "Create one mistake log or checked answer and this gets sharper.",
    weakSubject: weak?.subject ?? null,
    weakTopic,
    repeatedMistake,
    nextAction: weakTopic
      ? `Do one ${weakTopic} question, mark it, then save the correction.`
      : weak
        ? `Start a focused block for ${subjectName}.`
        : "Generate a question and check the answer."
  };
};

export const buildWeeklyReport = ({
  subjects,
  sessions,
  goals,
  notes,
  savedQuestions,
  gamification
}: {
  subjects: UserSubject[];
  sessions: StudySession[];
  goals: Goal[];
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  gamification?: Gamification | null;
}): WeeklyReport => {
  const start = weekStart();
  const end = addDays(start, 7);
  const weeklySessions = sessions.filter((session) => isBetween(session.createdAt, start, end));
  const totalMinutes = Math.round(weeklySessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
  const minutesBySubject = subjects.map((subject) => ({
    subject,
    minutes: Math.round(
      weeklySessions
        .filter((session) => session.subjectId === subject.id)
        .reduce((sum, session) => sum + session.durationSeconds, 0) / 60
    )
  }));
  const strongest = [...minutesBySubject].sort((a, b) => b.minutes - a.minutes)[0];
  const ignored = minutesBySubject.find((item) => item.minutes === 0 && Number(goals.find((goal) => goal.subjectId === item.subject.id)?.weeklyHoursTarget ?? 0) > 0);
  const questionCount = savedQuestions.filter((question) => new Date(question.createdAt) >= start).length;
  const mistakeCount = notes.filter((note) => isMistakeNote(note) && new Date(note.createdAt) >= start).length;
  const strongestSubject = strongest?.minutes ? strongest.subject.subjectName : "No clear strongest yet";
  const nextMove = ignored
    ? `Give ${ignored.subject.subjectName} one small session before it drifts further.`
    : mistakeCount
      ? "Review this week's mistake cards before starting new content."
      : questionCount
        ? "Turn one saved question into a marked answer."
        : "Do a short question set so next week's report has accuracy evidence.";

  return {
    totalMinutes,
    strongestSubject,
    ignoredSubject: ignored?.subject.subjectName ?? null,
    questionCount,
    mistakeCount,
    streak: gamification?.currentStreak ?? 0,
    nextMove,
    lines: [
      `You studied ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m this week.`,
      strongest?.minutes ? `Strongest subject: ${strongest.subject.subjectName} with ${strongest.minutes} minutes.` : "No subject has momentum yet.",
      ignored ? `Ignored this week: ${ignored.subject.subjectName}.` : "No goal subject was completely ignored.",
      `${questionCount} saved question${questionCount === 1 ? "" : "s"} and ${mistakeCount} mistake log${mistakeCount === 1 ? "" : "s"} added.`,
      `Streak: ${gamification?.currentStreak ?? 0} day${(gamification?.currentStreak ?? 0) === 1 ? "" : "s"}.`
    ]
  };
};

export const buildSacPanicPlan = ({
  subject,
  topic,
  sacDate,
  notes,
  savedQuestions,
  sessions
}: {
  subject: UserSubject;
  topic: string;
  sacDate: string;
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  sessions: StudySession[];
}): SacPanicPlan => {
  const target = new Date(`${sacDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
  const subjectMistakes = notes.filter((note) => isMistakeNote(note) && note.subjectId === subject.id).map(parseMistakeNote);
  const topicMistakes = subjectMistakes.filter((mistake) => normalise(`${mistake.topic} ${mistake.question}`).includes(normalise(topic)));
  const relevantQuestions = savedQuestions.filter(
    (question) => question.subjectId === subject.id && normalise(`${question.topic} ${question.question}`).includes(normalise(topic))
  );
  const recentMinutes = Math.round(
    sessions
      .filter((session) => session.subjectId === subject.id && new Date(session.createdAt) >= addDays(new Date(), -7))
      .reduce((sum, session) => sum + session.durationSeconds, 0) / 60
  );
  const latestNotes = notes
    .filter((note) => note.subjectId === subject.id && !isFlashcardNote(note))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  const reviseToday =
    daysUntil <= 1
      ? [
          `Make a one-page ${topic} summary from memory first.`,
          "Patch only the gaps you could not remember.",
          "Finish with two timed responses and mark them immediately."
        ]
      : daysUntil <= 3
        ? [
            `Rebuild the core ${topic} ideas today.`,
            "Do one easy check, one medium application, one timed SAC-style response.",
            "Write a 5-line error list before stopping."
          ]
        : [
            `Spend 25 minutes mapping the ${topic} content.`,
            "Use the next session for mixed practice, not rereading.",
            "Keep the final day for correction and summary only."
          ];

  const practice = relevantQuestions.length
    ? relevantQuestions.slice(0, 3).map((question) => question.topic || question.question.slice(0, 80))
    : [`Generate 3 ${topic} questions in Forge.`, "Check one written answer with AI feedback.", "Save any weak answer to Mistake Log."];

  const commonMistakes = topicMistakes.length
    ? topicMistakes.slice(0, 3).map((mistake) => oneLine(mistake.issue))
    : [
        "Answering the topic but missing the command term.",
        "Explaining benefits without linking back to the scenario/objective.",
        "Not marking the response against criteria after writing it."
      ];

  const checklist = [
    "Know the command terms likely to appear.",
    "Have one clean summary sheet.",
    "Redo at least one mistake from the log.",
    "Attempt one timed response.",
    "Write the final 5 things to remember before the SAC."
  ];

  const summaryNotes = latestNotes.length
    ? latestNotes.map((note) => `${note.title}: ${oneLine(note.body).slice(0, 140)}`)
    : [`No ${subject.subjectName} notes yet. Create one summary note for ${topic}.`, `${recentMinutes} minutes logged for ${subject.subjectName} in the last 7 days.`];

  const title = `${subject.subjectName} SAC Panic Plan: ${topic}`;
  const body = [
    `${title}`,
    `SAC date: ${sacDate}`,
    `Days until: ${daysUntil}`,
    "",
    "What to revise today:",
    ...reviseToday.map((item) => `- ${item}`),
    "",
    "Questions to practise:",
    ...practice.map((item) => `- ${item}`),
    "",
    "Common mistakes to avoid:",
    ...commonMistakes.map((item) => `- ${item}`),
    "",
    "Mini checklist:",
    ...checklist.map((item) => `- ${item}`),
    "",
    "Last-minute summary notes:",
    ...summaryNotes.map((item) => `- ${item}`)
  ].join("\n");

  return { title, daysUntil, reviseToday, practice, commonMistakes, checklist, summaryNotes, body };
};

export const globalStudySearch = ({
  query,
  notes,
  savedQuestions,
  events,
  resources
}: {
  query: string;
  notes: StudyNote[];
  savedQuestions: SavedQuestion[];
  events: StudyEvent[];
  resources: StudyResource[];
}): StudySearchResult[] => {
  const term = normalise(query);
  if (term.length < 2) return [];
  const matches = (value?: string | null) => normalise(value).includes(term);

  return [
    ...notes
      .filter((note) => matches(note.title) || matches(note.body) || matches(note.subject?.subjectName))
      .slice(0, 6)
      .map((note) => ({
        id: note.id,
        type: isFlashcardNote(note) ? "Flashcard" as const : isMistakeNote(note) ? "Mistake" as const : hasTag(note, coachAnswerTag) ? "Coach" as const : "Note" as const,
        title: note.title,
        detail: `${note.subject?.subjectName ?? "General"} - ${dateKey(note.updatedAt)}`,
        route: "/(tabs)/study" as const
      })),
    ...savedQuestions
      .filter((question) => matches(question.question) || matches(question.modelAnswer) || matches(question.topic) || matches(question.subject?.subjectName))
      .slice(0, 5)
      .map((question) => ({
        id: question.id,
        type: "Question" as const,
        title: question.topic || question.question.slice(0, 80),
        detail: `${question.subject?.subjectName ?? "Saved"} - ${question.difficulty ?? "practice"}`,
        route: "/(tabs)/questions" as const
      })),
    ...events
      .filter((event) => matches(event.title) || matches(event.description) || matches(event.subject?.subjectName))
      .slice(0, 5)
      .map((event) => ({
        id: event.id,
        type: "Event" as const,
        title: event.title,
        detail: `${event.subject?.subjectName ?? "No subject"} - ${event.eventDate.slice(0, 10)}`,
        route: "/(tabs)/calendar" as const
      })),
    ...resources
      .filter((resource) => matches(resource.fileName) || matches(resource.extractedTextPreview) || matches(resource.subject?.subjectName))
      .slice(0, 5)
      .map((resource) => ({
        id: resource.id,
        type: "File" as const,
        title: resource.fileName,
        detail: `${resource.subject?.subjectName ?? "General"} - ${resource.sourceType}`,
        route: "/(tabs)/study" as const
      }))
  ].slice(0, 12);
};

