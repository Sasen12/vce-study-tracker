import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { AppCard } from "@/components/ui/AppCard";
import { SubjectSelector } from "@/components/ui/SubjectSelector";
import { StudyAskCard } from "@/components/session/StudyAskCard";
import { motion } from "@/constants/motion";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import type { AdaptiveStudyTask, DailyStudyPlan, PlanSourceEvent, StudyEvent, StudyReflection, SubjectRoadmap, UserSubject } from "@/types";
import { eventDateKey, isAssessmentEvent, isStudyTimeEvent, recurrenceLabel } from "@/utils/studyEvents";

type StudyCoachPanelProps = {
  subjects: UserSubject[];
  selectedSubjectId: string | null;
  onSelectSubject: (subject: UserSubject) => void;
  initialTutorTopic?: string;
  initialTutorGoal?: string;
  initialTutorEventId?: string;
  initialTutorEventTitle?: string;
};

const todayString = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const eventAccent = (eventType: string) => {
  if (eventType === "EXAM") return palette.secondary;
  if (eventType === "SAT" || eventType === "PRACTICE_SAT") return "#F472B6";
  if (eventType === "SAC" || eventType === "PRACTICE_SAC") return palette.warning;
  if (eventType === "STUDY_TIME") return palette.success;
  return palette.info;
};

const compactDate = (date: string) => date.slice(5).replace("-", "/");
const readableDate = (date: string) =>
  new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00`)
  );
const normalizeSubject = (subject?: string | null) => subject?.trim().toLowerCase() ?? "";
const subjectMatches = (selectedSubject: UserSubject | null, subject?: string | null) =>
  !selectedSubject || normalizeSubject(subject) === normalizeSubject(selectedSubject.subjectName);
const sourceMatchesSubject = (selectedSubject: UserSubject | null, event: PlanSourceEvent) =>
  subjectMatches(selectedSubject, event.subject) ||
  (event.event_type === "STUDY_TIME" && /flexible|study/i.test(event.subject));
const isEnglishTask = (subject: string) => /english|eal/i.test(subject);
const isBusinessTask = (subject: string) => /business/i.test(subject);
const isGeneralMathTask = (subject: string) => /general mathematics|general maths|math/i.test(subject);
const isSoftwareTask = (subject: string) => /software/i.test(subject);
const isDataAnalyticsTask = (subject: string) => /data analytics|data analysis/i.test(subject);
const isFrameworkTask = (text: string) => /framework|creating text|creating texts|mentor text|written explanation/i.test(text);
const dateDiffDays = (from?: string, to?: string) => {
  if (!from || !to) return null;
  const fromTime = Date.parse(`${from.slice(0, 10)}T00:00:00.000Z`);
  const toTime = Date.parse(`${to.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
  return Math.max(0, Math.ceil((toTime - fromTime) / 86_400_000));
};
const liveAssessmentForTask = (task: AdaptiveStudyTask, assessments: StudyEvent[]) => {
  const taskText = `${task.title} ${task.topic ?? ""} ${task.assessment_title ?? ""}`.toLowerCase();
  return (
    assessments.find((event) => {
      const eventTitle = event.title.toLowerCase();
      const eventSubject = event.subject?.subjectName ?? "";
      const subjectMatch = !eventSubject || normalizeSubject(eventSubject) === normalizeSubject(task.subject);
      const titleMatch =
        taskText.includes(eventTitle) ||
        Boolean(task.assessment_title && eventTitle.includes(task.assessment_title.toLowerCase()));
      return subjectMatch && titleMatch;
    }) ?? null
  );
};
const refreshTaskDeadline = (task: AdaptiveStudyTask, assessments: StudyEvent[]): AdaptiveStudyTask => {
  const assessment = liveAssessmentForTask(task, assessments);
  if (!assessment) return task;
  return {
    ...task,
    assessment_title: assessment.title,
    assessment_date: eventDateKey(assessment),
    event_type: assessment.eventType
  };
};
const cleanTopic = (task: AdaptiveStudyTask) => {
  const rawTopic = task.topic || task.assessment_title || task.title;
  const assessmentPrefix = task.assessment_title ? `${task.assessment_title}:` : "";
  const withoutPrefix =
    assessmentPrefix && rawTopic.toLowerCase().startsWith(assessmentPrefix.toLowerCase())
      ? rawTopic.slice(assessmentPrefix.length)
      : rawTopic;
  return withoutPrefix.replace(/^general weekly study$/i, "current class content").trim() || "this topic";
};
const subjectTopicLabel = (task: AdaptiveStudyTask) => {
  const text = `${task.title} ${task.topic ?? ""} ${task.assessment_title ?? ""}`;
  if (isBusinessTask(task.subject)) {
    if (/operations|materials|quality|csr|productivity/i.test(text)) return "Operations";
    if (/change|kpi|leadership|driving|restraining|transform/i.test(text)) return "Change management";
    if (/hr|human|motivation|training|performance|employee/i.test(text)) return "HRM";
    return "Business";
  }
  if (isEnglishTask(task.subject)) return isFrameworkTask(text) ? "Framework of Ideas" : "English response";
  if (isGeneralMathTask(task.subject)) {
    if (/network|critical path|minimum spanning|flow|matching/i.test(text)) return "Networks";
    if (/matrix|matrices|transition/i.test(text)) return "Matrices";
    if (/finance|loan|annuit|recursion|investment|depreciation/i.test(text)) return "Finance";
    if (/data|statistic|regression|association|probability|normal|sample/i.test(text)) return "Data/statistics";
    return "General Maths";
  }
  if (isSoftwareTask(task.subject)) {
    if (/algorithm|pseudocode|program|code|function|trace/i.test(text)) return "Algorithms";
    if (/design|mockup|data dictionary|structure|database|interface/i.test(text)) return "Solution design";
    if (/test|validation|debug|error/i.test(text)) return "Testing";
    if (/security|cyber|encryption|privacy|threat/i.test(text)) return "Security";
    return "Software";
  }
  if (isDataAnalyticsTask(task.subject)) {
    if (/clean|manipulat|acquisition|source|integrity/i.test(text)) return "Data cleaning";
    if (/visual|infographic|dashboard|chart|design/i.test(text)) return "Visualisation";
    if (/stat|trend|pattern|finding|analysis/i.test(text)) return "Analysis";
    if (/security|privacy|ethical|cyber/i.test(text)) return "Ethics/security";
    return "Data Analytics";
  }
  return task.subject;
};
const learningStage = (task: AdaptiveStudyTask, dayIndex: number, taskIndex = 0) => {
  const daysUntil = dateDiffDays(task.date, task.assessment_date);
  const sequenceIndex = dayIndex + taskIndex;
  if (daysUntil !== null) {
    if (daysUntil <= 1) return "final-fix";
    if (daysUntil <= 3) return ["timed", "correct", "timed"][sequenceIndex % 3];
    if (daysUntil <= 7) return ["mixed-practice", "correct", "exam"][sequenceIndex % 3];
    if (daysUntil <= 14) return ["weakness", "apply", "exam", "correct"][sequenceIndex % 4];
  }
  return ["learn", "apply", "exam", "correct"][sequenceIndex % 4];
};
const stageLabel = (stage: string) => {
  if (stage === "learn") return "Learn";
  if (stage === "apply") return "Apply";
  if (stage === "exam") return "Practice";
  if (stage === "correct") return "Correct";
  if (stage === "weakness") return "Repair";
  if (stage === "mixed-practice") return "Mixed";
  if (stage === "timed") return "Timed";
  return "Final";
};
const stageIcon = (stage: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  if (stage === "learn") return "lightbulb-on-outline";
  if (stage === "apply") return "briefcase-search-outline";
  if (stage === "exam") return "pencil-outline";
  if (stage === "correct") return "auto-fix";
  if (stage === "weakness") return "tools";
  if (stage === "mixed-practice") return "shuffle-variant";
  if (stage === "timed") return "timer-outline";
  return "flag-checkered";
};
const stageColor = (stage: string) => {
  if (stage === "learn") return palette.info;
  if (stage === "apply") return palette.success;
  if (stage === "exam") return palette.primary;
  if (stage === "correct") return palette.warning;
  if (stage === "weakness") return palette.secondary;
  if (stage === "mixed-practice") return "#22D3EE";
  if (stage === "timed") return "#F472B6";
  return palette.text;
};
const displayTaskTitle = (task: AdaptiveStudyTask, dayIndex: number, taskIndex = 0) => {
  const stage = learningStage(task, dayIndex, taskIndex);
  const topic = subjectTopicLabel(task);
  if (isBusinessTask(task.subject)) {
    if (stage === "learn") return `${topic}: learn terms without memorising`;
    if (stage === "apply") return `${topic}: apply one real business case`;
    if (stage === "exam") return `${topic}: command-term response practice`;
    if (stage === "correct") return `${topic}: mark mistakes and upgrade`;
    if (stage === "weakness") return `${topic}: weakest subtopic repair`;
    if (stage === "mixed-practice") return `${topic}: mixed SAC-style questions`;
    if (stage === "timed") return `${topic}: timed SAC response`;
    return `${topic}: final correction pass`;
  }
  if (isEnglishTask(task.subject)) {
    if (stage === "learn") return `${topic}: unpack the prompt and mentor moves`;
    if (stage === "apply") return `${topic}: build ideas into a paragraph`;
    if (stage === "exam") return `${topic}: timed writing rep`;
    if (stage === "correct") return `${topic}: edit for sharper expression`;
    if (stage === "weakness") return `${topic}: repair the weakest writing move`;
    if (stage === "mixed-practice") return `${topic}: mixed prompt drills`;
    if (stage === "timed") return `${topic}: timed response under SAC conditions`;
    return `${topic}: final polish and explanation`;
  }
  if (isGeneralMathTask(task.subject)) {
    if (stage === "learn") return `${topic}: rebuild the method`;
    if (stage === "apply") return `${topic}: guided example to solo question`;
    if (stage === "exam") return `${topic}: exam questions with marking`;
    if (stage === "correct") return `${topic}: error-log repair`;
    if (stage === "weakness") return `${topic}: weakest skill rebuild`;
    if (stage === "mixed-practice") return `${topic}: mixed retrieval set`;
    if (stage === "timed") return `${topic}: timed exam section`;
    return `${topic}: final formula and error check`;
  }
  if (isSoftwareTask(task.subject)) {
    if (stage === "learn") return `${topic}: understand the scenario rule`;
    if (stage === "apply") return `${topic}: build the artefact`;
    if (stage === "exam") return `${topic}: command-term scenario answer`;
    if (stage === "correct") return `${topic}: improve justification`;
    if (stage === "weakness") return `${topic}: repair weakest design decision`;
    if (stage === "mixed-practice") return `${topic}: mixed VCAA scenario set`;
    if (stage === "timed") return `${topic}: timed scenario response`;
    return `${topic}: final testing/evaluation pass`;
  }
  if (isDataAnalyticsTask(task.subject)) {
    if (stage === "learn") return `${topic}: clarify the data decision`;
    if (stage === "apply") return `${topic}: create the evidence artefact`;
    if (stage === "exam") return `${topic}: findings response practice`;
    if (stage === "correct") return `${topic}: upgrade evidence and evaluation`;
    if (stage === "weakness") return `${topic}: repair weakest analysis link`;
    if (stage === "mixed-practice") return `${topic}: mixed interpretation set`;
    if (stage === "timed") return `${topic}: timed data response`;
    return `${topic}: final ethics/evaluation check`;
  }
  return task.title;
};

const filterDailyPlanBySubject = (dailyPlan: DailyStudyPlan[], selectedSubject: UserSubject | null) =>
  dailyPlan
    .map((day) => {
      const tasks = day.tasks.filter((task) => subjectMatches(selectedSubject, task.subject));
      return {
        ...day,
        tasks,
        total_minutes: tasks.reduce((sum, task) => sum + task.minutes, 0),
        focus: selectedSubject ? `${selectedSubject.subjectName}: ${tasks.length} task${tasks.length === 1 ? "" : "s"}` : day.focus
      };
    })
    .filter((day) => day.tasks.length);

const fallbackDailyPlanBySubject = (
  tasks: AdaptiveStudyTask[],
  planDate: string,
  selectedSubject: UserSubject | null
): DailyStudyPlan[] => {
  const filteredTasks = tasks.filter((task) => subjectMatches(selectedSubject, task.subject));
  if (!filteredTasks.length) return [];
  return [
    {
      date: planDate.slice(0, 10),
      total_minutes: filteredTasks.reduce((sum, task) => sum + task.minutes, 0),
      focus: selectedSubject ? `${selectedSubject.subjectName}: current plan` : "Current plan",
      tasks: filteredTasks,
      checkpoint: ""
    }
  ];
};

const displayTaskSteps = (task: AdaptiveStudyTask, output?: string, dayIndex = 0, taskIndex = 0) => {
  const topic = cleanTopic(task);
  const mode = `${task.mode} ${task.title} ${output ?? ""}`;
  const stage = learningStage(task, dayIndex, taskIndex);

  if (isBusinessTask(task.subject)) {
    if (stage === "learn") {
      return [
        `Pick 5 terms from ${topic} you could not explain cleanly.`,
        "For each term, write: definition, why it matters, one mistake students make.",
        "Cover the definitions and explain them out loud without looking."
      ];
    }
    if (stage === "apply") {
      return [
        "Choose one real business or class case you have not used yet.",
        `Link it to ${topic} with one stakeholder impact and one KPI or objective.`,
        "Write 4 dot points showing cause, effect, benefit and limitation."
      ];
    }
    if (stage === "exam" || /timed|10-mark|response/i.test(mode)) {
      return [
        `Answer one 6-10 mark question on ${topic} using a command term.`,
        "Plan before writing: key term, case evidence, stakeholder/KPI link, judgement.",
        "Self-mark it and rewrite the weakest sentence."
      ];
    }
    if (stage === "correct") {
      return [
        "Open yesterday's answer or notes and find the weakest link.",
        "Rewrite it with a clearer command-term sentence and a specific business example.",
        "Add that mistake to a short error log so the next session targets it."
      ];
    }
    if (stage === "weakness") {
      return [
        `Pick the part of ${topic} you would least want on the SAC.`,
        "Make a mini table: definition, case example, advantage, limitation.",
        "Write one paragraph that directly fixes that weak spot."
      ];
    }
    if (stage === "mixed-practice") {
      return [
        `Do 3 short SAC-style questions across ${topic}.`,
        "Use different command terms: describe, analyse and evaluate.",
        "Mark them, then redo the one with the weakest application."
      ];
    }
    if (stage === "timed") {
      return [
        "Set a timer and write one full SAC-style response.",
        "Force yourself to include terminology, case evidence and a final judgement.",
        "Mark immediately and rewrite only the paragraph that cost the most marks."
      ];
    }
    return [
      "Read your error log and pick the top 3 repeat problems.",
      "Fix each with one model sentence you could reuse under pressure.",
      "Finish by writing a 5-minute final checklist for the SAC."
    ];
  }

  if (isEnglishTask(task.subject)) {
    if (stage === "learn") {
      return isFrameworkTask(mode)
        ? [
            "Read one mentor passage and mark 3 choices: voice, form and audience.",
            `Write 5 possible angles for ${topic}, each with a different purpose.`,
            "Choose the angle that feels least generic and explain why in one sentence."
          ]
        : [
            `Break ${topic} into contention, audience/purpose and 3 evidence targets.`,
            "Write one sentence for what the assessor is actually rewarding.",
            "Circle the part you would usually make vague."
          ];
    }
    if (stage === "apply") {
      return isFrameworkTask(mode)
        ? [
            "Pick one angle and draft a paragraph with a deliberate voice.",
            "Add 2 mentor-text moves without copying the mentor text.",
            "Write 2 sentences explaining the authorial choice you made."
          ]
        : [
            "Draft one analytical paragraph from your strongest topic sentence.",
            "Embed one piece of evidence and explain the writer's choice.",
            "Underline any sentence that does not prove the contention."
          ];
    }
    if (stage === "exam" || stage === "timed") {
      return [
        "Set a timer and write one response section without pausing to perfect it.",
        "Spend 5 minutes marking clarity, evidence and relevance to the prompt.",
        "Rewrite only the sentence that most weakens the response."
      ];
    }
    if (stage === "correct" || stage === "weakness") {
      return [
        "Open your last paragraph and find the vaguest sentence.",
        "Rewrite it with a more specific verb, image, quote or language feature.",
        "Add one note about what you will deliberately repeat next time."
      ];
    }
    if (stage === "mixed-practice") {
      return [
        "Make 3 mini plans for 3 different prompts or angles.",
        "For each, write only the first sentence and one evidence/mentor move.",
        "Choose the plan that would score best and explain why."
      ];
    }
    if (isFrameworkTask(mode)) {
      return [
        "Choose one prompt angle and list 5 concrete ideas or images.",
        "Annotate 2 mentor-text moves for voice, form, audience or purpose.",
        "Draft one paragraph, then write 3 sentences explaining your authorial choices."
      ];
    }
    return [
      `Write a contention and 3 topic sentences for ${topic}.`,
      "Add evidence or language features beside each topic sentence.",
      "Draft one timed paragraph and edit the first two vague sentences."
    ];
  }

  if (isGeneralMathTask(task.subject)) {
    if (stage === "learn") {
      return [
        `Write the method for ${topic} as 4 numbered steps, not a paragraph.`,
        "Add the calculator/CAS command or setup beside the step where it matters.",
        "Do one easy example while saying why each step is allowed."
      ];
    }
    if (stage === "apply") {
      return [
        "Do one worked example with full working visible.",
        "Then do a similar question without looking at the example.",
        "Compare the two and mark the exact step where confidence dropped."
      ];
    }
    if (stage === "exam" || stage === "mixed-practice") {
      return [
        `Do 4 mixed exam-style questions that include ${topic}.`,
        "Write interpretation sentences, not just final numbers.",
        "Mark every lost mark as concept, setup, calculator or communication."
      ];
    }
    if (stage === "correct" || stage === "weakness") {
      return [
        "Open your last error and classify it: formula, condition, setup, calculator or wording.",
        "Redo that question from blank paper.",
        "Create one new question that would catch the same mistake."
      ];
    }
    if (stage === "timed") {
      return [
        "Set a timer and complete a short exam section without notes.",
        "Skip cleanly if stuck, then return with remaining time.",
        "Mark timing, method and communication separately."
      ];
    }
    return [
      `Pick 3 exam-style questions on ${topic}.`,
      "Show full working plus calculator/CAS steps and state any conditions.",
      "Mark each step, log the error type and redo one similar question."
    ];
  }

  if (isSoftwareTask(task.subject)) {
    if (stage === "learn") {
      return [
        `Turn ${topic} into a one-page rule sheet with definitions and when to use them.`,
        "Add one tiny scenario beside each rule.",
        "Cover the sheet and explain the scenario decision from memory."
      ];
    }
    if (stage === "apply") {
      return [
        "Build one artefact: requirements table, data dictionary, design, pseudocode or test table.",
        "Label the artefact with the user need or problem it solves.",
        "Write one justification sentence for the design choice."
      ];
    }
    if (stage === "exam" || stage === "timed") {
      return [
        "Answer one VCAA-style scenario question using the command term exactly.",
        "Include a specific artefact, constraint or stakeholder in the answer.",
        "Mark whether your justification actually answers why, not just what."
      ];
    }
    if (stage === "correct" || stage === "weakness") {
      return [
        "Find one weak technical explanation from your notes or last answer.",
        "Rewrite it with precise terminology and a scenario link.",
        "Add one test, validation or evaluation detail that would earn a mark."
      ];
    }
    if (stage === "mixed-practice") {
      return [
        "Do 3 small scenario prompts: one design, one testing, one evaluation/security.",
        "Answer each in 4-5 lines with evidence from the scenario.",
        "Rank them from strongest to weakest and redo the weakest."
      ];
    }
    return [
      `Create one technical artefact for ${topic}: table, design, pseudocode or test case.`,
      "Answer one scenario question using the exact command term.",
      "Mark it for terminology, justification and link to the user need."
    ];
  }

  if (isDataAnalyticsTask(task.subject)) {
    if (stage === "learn") {
      return [
        `Write the data decision behind ${topic}: source, cleaning, visualisation or evaluation.`,
        "Add one risk: bias, privacy, validity, integrity or security.",
        "Explain how that risk would change the decision."
      ];
    }
    if (stage === "apply") {
      return [
        "Create one artefact: data dictionary row, cleaning log, chart sketch or findings note.",
        "Annotate why the artefact is suitable for the audience/purpose.",
        "Add one limitation that a marker could reward."
      ];
    }
    if (stage === "exam" || stage === "mixed-practice") {
      return [
        "Answer 3 short data interpretation prompts with evidence.",
        "Use one visualisation/design term and one ethics/security term across the set.",
        "Redo the answer with the weakest evidence link."
      ];
    }
    if (stage === "correct" || stage === "weakness") {
      return [
        "Pick one weak finding, visualisation choice or evaluation sentence.",
        "Rewrite it so the evidence and audience/purpose are explicit.",
        "Add the missing security, ethics or limitation point."
      ];
    }
    if (stage === "timed") {
      return [
        "Set a timer and write one data interpretation or evaluation response.",
        "Use evidence first, then explain what it means.",
        "Mark for accuracy, justification and audience/purpose."
      ];
    }
    return [
      `Create one data artefact for ${topic}: cleaning note, chart sketch, findings or evaluation point.`,
      "Explain the decision using evidence from the data or scenario.",
      "Mark it for accuracy, justification and ethics/security where relevant."
    ];
  }

  return [
    `Make a short recall sheet for ${topic}.`,
    "Do 3 practice questions or prompts.",
    "Mark mistakes and write the first correction you will do next."
  ];
};
const displayTaskOutput = (subject: string, title: string, output?: string) => {
  if (isBusinessTask(subject)) {
    if (!output || /formula|concept map|worked examples|terminology bank|example bank|case bank|case-study examples/i.test(output)) {
      if (/change|kpi|leadership|driving|restraining/i.test(title)) {
        return "KPI/change strategy cause-effect chain, 2 stakeholder impacts and one evaluate paragraph";
      }
      if (/hr|human|motivation|training|performance|employee/i.test(title)) {
        return "HR strategy comparison table, one applied case-study paragraph and corrections";
      }
      if (/operations|materials|quality|csr|productivity/i.test(title)) {
        return "Operations strategy application table, 2 stakeholder impacts and one case paragraph";
      }
      return "8-term business bank, 2 contemporary examples and one analyse/evaluate paragraph";
    }
    return output;
  }
  if (!isEnglishTask(subject)) return output;
  if (!output || /formula|concept map|worked examples/i.test(output)) {
    if (isFrameworkTask(title)) {
      return "Framework idea bank, mentor-text annotations, draft paragraph and written explanation outline";
    }
    return "Essay contention, paragraph plan, evidence bank and timed paragraph";
  }
  return output;
};
const displayTaskMake = (task: AdaptiveStudyTask, dayIndex: number, taskIndex = 0) => {
  const baseOutput = displayTaskOutput(task.subject, task.title, task.output);
  const stage = learningStage(task, dayIndex, taskIndex);

  if (isBusinessTask(task.subject)) {
    if (stage === "learn") return "5 hard terms, misconception notes and a closed-book recall check";
    if (stage === "apply") return "One new business case with stakeholder impact, KPI/objective link and limitation";
    if (stage === "exam") return "One planned 6-10 mark answer and a rewritten weakest sentence";
    if (stage === "correct") return "Updated error log and one upgraded paragraph from a previous response";
    if (stage === "weakness") return "Weakest-subtopic table and one repair paragraph";
    if (stage === "mixed-practice") return "3 SAC-style answers using different command terms and one corrected redo";
    if (stage === "timed") return "One timed SAC response plus immediate marking corrections";
    return "Top 3 error fixes and a 5-minute SAC checklist";
  }
  if (isEnglishTask(task.subject)) {
    if (stage === "learn") return "Prompt breakdown, 5 idea angles and one assessor-focus sentence";
    if (stage === "apply") return "One drafted paragraph plus 2 deliberate craft/analysis choices";
    if (stage === "exam") return "One timed response section and a rewritten weakest sentence";
    if (stage === "correct" || stage === "weakness") return "One upgraded paragraph with sharper evidence/expression";
    if (stage === "mixed-practice") return "3 mini plans and the strongest opening sentence";
    if (stage === "timed") return "Timed SAC-style response section plus immediate edits";
    return "Final polish checklist and written explanation/analysis notes";
  }
  if (isGeneralMathTask(task.subject)) {
    if (stage === "learn") return "4-step method card with calculator/CAS setup and one easy example";
    if (stage === "apply") return "One guided example, one solo question and confidence-drop note";
    if (stage === "exam" || stage === "mixed-practice") return "4 mixed exam questions and an error category for every miss";
    if (stage === "correct" || stage === "weakness") return "Redo of one error plus a new trap question";
    if (stage === "timed") return "Timed exam section marked for method, timing and communication";
    return "Formula/condition checklist and top error redo";
  }
  if (isSoftwareTask(task.subject)) {
    if (stage === "learn") return "Rule sheet with tiny scenario examples";
    if (stage === "apply") return "One technical artefact plus a justification sentence";
    if (stage === "exam") return "One command-term scenario answer with evidence";
    if (stage === "correct" || stage === "weakness") return "Rewritten technical explanation plus test/evaluation detail";
    if (stage === "mixed-practice") return "3 scenario prompts and one corrected redo";
    if (stage === "timed") return "Timed scenario response with marking corrections";
    return "Final testing, validation and evaluation checklist";
  }
  if (isDataAnalyticsTask(task.subject)) {
    if (stage === "learn") return "Data decision note with one risk and mitigation";
    if (stage === "apply") return "One data artefact annotated for audience/purpose";
    if (stage === "exam" || stage === "mixed-practice") return "3 interpretation prompts and one corrected evidence link";
    if (stage === "correct" || stage === "weakness") return "Upgraded finding/evaluation sentence with missing limitation";
    if (stage === "timed") return "Timed data response marked for evidence and justification";
    return "Final ethics, security and evaluation checklist";
  }
  return baseOutput;
};

function ClassLogItem({
  reflection,
  expanded,
  onToggle
}: {
  reflection: StudyReflection;
  expanded: boolean;
  onToggle: () => void;
}) {
  const dateKey = reflection.classDate.slice(0, 10);

  return (
    <View style={styles.classLogItem}>
      <View style={styles.classLogHeader}>
        <View style={styles.classLogTitleBlock}>
          <Text style={styles.taskTitle}>{reflection.subject?.subjectName ?? "General"}</Text>
          <Text style={styles.muted}>{readableDate(dateKey)}</Text>
        </View>
        <Button mode="text" compact icon={expanded ? "chevron-up" : "chevron-down"} onPress={onToggle}>
          {expanded ? "Hide" : "View"}
        </Button>
      </View>

      <Text numberOfLines={expanded ? undefined : 2} style={styles.reason}>
        {reflection.classSummary}
      </Text>

      {expanded ? (
        <View style={styles.classLogDetails}>
          <View style={styles.classLogDetail}>
            <Text style={styles.classLogLabel}>Made sense</Text>
            <Text style={styles.classLogBody}>{reflection.understood}</Text>
          </View>
          <View style={styles.classLogDetail}>
            <Text style={styles.classLogLabel}>Did not click</Text>
            <Text style={styles.classLogBody}>{reflection.confused}</Text>
          </View>
          {reflection.nextAction ? (
            <View style={styles.classLogDetail}>
              <Text style={styles.classLogLabel}>Next move</Text>
              <Text style={styles.classLogBody}>{reflection.nextAction}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function StudyCoachPanel({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  initialTutorTopic,
  initialTutorGoal,
  initialTutorEventId,
  initialTutorEventTitle
}: StudyCoachPanelProps) {
  const { events, reflections, latestPlan, createReflection, generatePlan } = useAppStore();
  const [classDate, setClassDate] = useState(todayString());
  const [classSummary, setClassSummary] = useState("");
  const [understood, setUnderstood] = useState("");
  const [confused, setConfused] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [availableMinutes, setAvailableMinutes] = useState("90");
  const [horizonDays, setHorizonDays] = useState("28");
  const [priority, setPriority] = useState("");
  const [savingReflection, setSavingReflection] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [autoPlanning, setAutoPlanning] = useState(false);
  const [roadmapView, setRoadmapView] = useState("timeline");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const lastAutoPlanKeyRef = useRef<string | null>(null);

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const visibleClassLogs = useMemo(
    () => reflections.filter((reflection) => !selectedSubject || reflection.subjectId === selectedSubject.id),
    [reflections, selectedSubject]
  );
  const upcomingAssessments = useMemo(
    () =>
      events
        .filter((event) => !event.completed && isAssessmentEvent(event) && eventDateKey(event) >= todayString())
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [events]
  );
  const studyTimeEvents = useMemo(
    () =>
      events
        .filter((event) => !event.completed && isStudyTimeEvent(event))
        .sort((a, b) => `${eventDateKey(a)}${a.startTime ?? ""}`.localeCompare(`${eventDateKey(b)}${b.startTime ?? ""}`)),
    [events]
  );
  const visibleUpcomingAssessments = useMemo(
    () => upcomingAssessments.filter((event) => subjectMatches(selectedSubject, event.subject?.subjectName)),
    [selectedSubject, upcomingAssessments]
  );
  const visibleStudyTimeEvents = useMemo(
    () => studyTimeEvents.filter((event) => !selectedSubject || !event.subject || subjectMatches(selectedSubject, event.subject.subjectName)),
    [selectedSubject, studyTimeEvents]
  );
  const allDailyPlan = useMemo(() => latestPlan?.dailyPlan ?? [], [latestPlan?.dailyPlan]);
  const allSubjectRoadmaps = useMemo(() => latestPlan?.subjectRoadmaps ?? [], [latestPlan?.subjectRoadmaps]);
  const allSourceEvents = useMemo(() => latestPlan?.sourceEvents ?? [], [latestPlan?.sourceEvents]);
  const dailyPlan = useMemo(
    () => {
      const plan = allDailyPlan.length
        ? filterDailyPlanBySubject(allDailyPlan, selectedSubject)
        : latestPlan
          ? fallbackDailyPlanBySubject(latestPlan.tasks, latestPlan.planDate, selectedSubject)
          : [];
      return plan.map((day) => ({
        ...day,
        tasks: day.tasks.map((task) => refreshTaskDeadline(task, upcomingAssessments))
      }));
    },
    [allDailyPlan, latestPlan, selectedSubject, upcomingAssessments]
  );
  const subjectRoadmaps = useMemo(
    () => allSubjectRoadmaps.filter((roadmap: SubjectRoadmap) => subjectMatches(selectedSubject, roadmap.subject)),
    [allSubjectRoadmaps, selectedSubject]
  );
  const sourceEvents = useMemo(
    () => {
      const liveEvents = new Map(upcomingAssessments.map((event) => [event.id, event]));
      return allSourceEvents
        .map((event: PlanSourceEvent) => {
          const liveEvent = liveEvents.get(event.id);
          if (!liveEvent) return event;
          const liveDate = eventDateKey(liveEvent);
          return {
            ...event,
            title: liveEvent.title,
            subject: liveEvent.subject?.subjectName ?? event.subject,
            event_type: liveEvent.eventType,
            event_date: liveDate,
            topic: liveEvent.description?.trim() || liveEvent.title,
            days_until: dateDiffDays(todayString(), liveDate) ?? event.days_until
          };
        })
        .filter((event: PlanSourceEvent) => sourceMatchesSubject(selectedSubject, event));
    },
    [allSourceEvents, selectedSubject, upcomingAssessments]
  );
  const assessmentSources = useMemo(
    () => sourceEvents.filter((event) => event.event_type !== "STUDY_TIME"),
    [sourceEvents]
  );
  const roadmapStats = useMemo(() => {
    const totalMinutes = dailyPlan.reduce((sum, day) => sum + day.total_minutes, 0);
    const taskCount = dailyPlan.reduce((sum, day) => sum + day.tasks.length, 0);
    const studyBlocks = sourceEvents.filter((event) => event.event_type === "STUDY_TIME").length;
    const nextAssessment = [...assessmentSources].sort((a, b) => a.days_until - b.days_until)[0];
    return {
      totalMinutes,
      taskCount,
      studyBlocks,
      nextAssessment
    };
  }, [assessmentSources, dailyPlan, sourceEvents]);
  const roadmapEventSignature = useMemo(
    () =>
      [...upcomingAssessments, ...studyTimeEvents]
        .map((event) => {
          if (isStudyTimeEvent(event)) {
            return [
              event.id,
              `${eventDateKey(event)} ${event.startTime ?? ""}-${event.endTime ?? ""}`,
              event.eventType,
              event.subject?.subjectName ?? "Flexible study",
              recurrenceLabel(event.recurrence)
            ].join("|");
          }
          const topic = event.description?.trim() ? `${event.title}: ${event.description.trim()}` : event.title;
          return [event.id, eventDateKey(event), event.eventType, event.subject?.subjectName ?? "No subject", topic].join("|");
        })
        .join("::"),
    [studyTimeEvents, upcomingAssessments]
  );
  const latestPlanEventSignature = useMemo(
    () =>
      allSourceEvents
        .map((event) => [event.id, event.event_date, event.event_type, event.subject, event.topic].join("|"))
        .join("::"),
    [allSourceEvents]
  );
  const hasCurrentRoadmap =
    Boolean(latestPlan?.dailyPlan?.length) && roadmapEventSignature === latestPlanEventSignature;
  const subjectColorFor = (subjectName: string) =>
    subjects.find((subject) => normalizeSubject(subject.subjectName) === normalizeSubject(subjectName))?.color ?? palette.primary;
  const timelineMissions = useMemo(
    () =>
      dailyPlan.slice(0, 14).flatMap((day, dayIndex) =>
        day.tasks.map((task, taskIndex) => {
          const stage = learningStage(task, dayIndex, taskIndex);
          const color =
            subjects.find((subject) => normalizeSubject(subject.subjectName) === normalizeSubject(task.subject))?.color ??
            palette.primary;
          return {
            id: `${day.date}-${task.title}-${taskIndex}`,
            date: day.date,
            title: displayTaskTitle(task, dayIndex, taskIndex),
            output: displayTaskMake(task, dayIndex, taskIndex),
            steps: displayTaskSteps(task, displayTaskMake(task, dayIndex, taskIndex), dayIndex, taskIndex),
            stage,
            color,
            minutes: task.minutes,
            subject: task.subject
          };
        })
      ),
    [dailyPlan, subjects]
  );
  const nextMission = timelineMissions[0] ?? null;
  const learningArc = timelineMissions.slice(0, 6);

  useEffect(() => {
    if (!subjects.length || (!upcomingAssessments.length && !studyTimeEvents.length) || planning || autoPlanning || hasCurrentRoadmap) {
      return;
    }

    const minutes = Number(availableMinutes) || 90;
    const days = Number(horizonDays) || 28;
    const autoPlanKey = `${roadmapEventSignature}|${minutes}|${days}|${priority.trim()}`;
    if (lastAutoPlanKeyRef.current === autoPlanKey) {
      return;
    }

    const timeout = setTimeout(async () => {
      setAutoPlanning(true);
      try {
        await generatePlan({
          planDate: todayString(),
          availableMinutes: minutes,
          horizonDays: days,
          priority: priority.trim() || null
        });
        lastAutoPlanKeyRef.current = autoPlanKey;
        setMessage("Study roadmap updated from calendar.");
      } catch (error) {
        lastAutoPlanKeyRef.current = null;
        setMessage(error instanceof Error ? error.message : "Could not update the roadmap automatically.");
      } finally {
        setAutoPlanning(false);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [
    autoPlanning,
    availableMinutes,
    generatePlan,
    hasCurrentRoadmap,
    horizonDays,
    planning,
    priority,
    roadmapEventSignature,
    studyTimeEvents.length,
    subjects.length,
    upcomingAssessments.length
  ]);

  const saveReflection = async () => {
    if (!selectedSubject || !classSummary.trim() || !understood.trim() || !confused.trim()) {
      setMessage("Fill the class log first.");
      return;
    }

    setSavingReflection(true);
    try {
      const savedLog = await createReflection({
        subjectId: selectedSubject.id,
        classDate,
        classSummary: classSummary.trim(),
        understood: understood.trim(),
        confused: confused.trim(),
        nextAction: nextAction.trim() || null
      });
      setExpandedLogId(savedLog.id);
      setClassSummary("");
      setUnderstood("");
      setConfused("");
      setNextAction("");
      setMessage("Class log saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save class log.");
    } finally {
      setSavingReflection(false);
    }
  };

  const createPlan = async () => {
    setPlanning(true);
    try {
      const minutes = Number(availableMinutes) || 90;
      const days = Number(horizonDays) || 28;
      await generatePlan({
        planDate: todayString(),
        availableMinutes: minutes,
        horizonDays: days,
        priority: priority.trim() || null
      });
      lastAutoPlanKeyRef.current = `${roadmapEventSignature}|${minutes}|${days}|${priority.trim()}`;
      setMessage("Calendar roadmap generated.");
    } catch (error) {
      lastAutoPlanKeyRef.current = null;
      setMessage(error instanceof Error ? error.message : "Could not generate plan.");
    } finally {
      setPlanning(false);
    }
  };

  return (
    <View style={styles.stack}>
      <SubjectSelector subjects={subjects} selectedId={selectedSubjectId} onSelect={onSelectSubject} />

      <StudyAskCard
        selectedSubject={selectedSubject}
        onRouteSubject={onSelectSubject}
        initialTutorTopic={initialTutorTopic}
        initialTutorGoal={initialTutorGoal}
        initialTutorEventId={initialTutorEventId}
        initialTutorEventTitle={initialTutorEventTitle}
      />

      <AppCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text variant="titleLarge" style={styles.title}>
              Class log
            </Text>
            <Text style={styles.muted}>{selectedSubject?.subjectName ?? "Choose a subject"}</Text>
          </View>
          <TextInput
            mode="outlined"
            value={classDate}
            onChangeText={setClassDate}
            dense
            style={styles.dateInput}
            textColor={palette.text}
          />
        </View>

        <TextInput
          mode="outlined"
          label="What happened in class?"
          value={classSummary}
          multiline
          onChangeText={setClassSummary}
        />
        <TextInput mode="outlined" label="What made sense?" value={understood} multiline onChangeText={setUnderstood} />
        <TextInput mode="outlined" label="What did not click?" value={confused} multiline onChangeText={setConfused} />
        <TextInput mode="outlined" label="Next move" value={nextAction} onChangeText={setNextAction} />

        <Button mode="contained" icon="content-save" loading={savingReflection} onPress={saveReflection}>
          Save class log
        </Button>
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text variant="titleMedium" style={styles.title}>
              Saved class logs
            </Text>
            <Text style={styles.muted}>{selectedSubject ? `${selectedSubject.subjectName} logs` : "All subjects"}</Text>
            <Text style={styles.muted}>
              {visibleClassLogs.length} log{visibleClassLogs.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
        {visibleClassLogs.length ? (
          visibleClassLogs.map((reflection) => (
            <ClassLogItem
              key={reflection.id}
              reflection={reflection}
              expanded={expandedLogId === reflection.id}
              onToggle={() => setExpandedLogId((current) => (current === reflection.id ? null : reflection.id))}
            />
          ))
        ) : (
          <Text style={styles.muted}>No saved class logs yet.</Text>
        )}
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerText}>
            <Text variant="titleLarge" style={styles.title}>
              Study roadmap
            </Text>
            <Text style={styles.muted}>
              {selectedSubject ? `${selectedSubject.subjectName} only` : "All subjects"}
              {" - "}
              {visibleUpcomingAssessments.length
                ? `${visibleUpcomingAssessments.length} upcoming assessment${visibleUpcomingAssessments.length === 1 ? "" : "s"}`
                : "no upcoming assessment"}
            </Text>
            {visibleStudyTimeEvents.length ? (
              <Text style={styles.muted}>
                {visibleStudyTimeEvents.length} scheduled study block{visibleStudyTimeEvents.length === 1 ? "" : "s"} included
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.planControls}>
          <TextInput
            mode="outlined"
            label="Daily min"
            value={availableMinutes}
            keyboardType="number-pad"
            onChangeText={setAvailableMinutes}
            style={styles.minutesInput}
          />
          <TextInput
            mode="outlined"
            label="Days"
            value={horizonDays}
            keyboardType="number-pad"
            onChangeText={setHorizonDays}
            style={styles.daysInput}
          />
          <TextInput
            mode="outlined"
            label="Extra focus"
            value={priority}
            onChangeText={setPriority}
            style={styles.priorityInput}
          />
        </View>
        <Button mode="contained" icon="calendar-sync" loading={planning || autoPlanning} disabled={planning || autoPlanning} onPress={createPlan}>
          Refresh roadmap
        </Button>

        <Text style={styles.autoStatus}>
          {autoPlanning
            ? "Updating automatically from your calendar..."
            : visibleUpcomingAssessments.length
              ? hasCurrentRoadmap
                ? `Synced with ${selectedSubject ? `${selectedSubject.subjectName}'s` : "your"} current calendar.`
                : `Will update automatically from ${selectedSubject ? `${selectedSubject.subjectName}'s` : "your"} calendar items.`
              : visibleStudyTimeEvents.length
                ? `Will plan ${selectedSubject ? selectedSubject.subjectName : "study"} around your scheduled study times.`
                : selectedSubject
                  ? `Add a ${selectedSubject.subjectName} SAC, SAT, exam or study time in Calendar to build this automatically.`
                  : "Add SACs, SATs, exams or study times in Calendar to build this automatically."}
          </Text>

        {latestPlan ? (
          <View style={styles.planStack}>
            <Animated.View entering={motion.card()} layout={motion.layout()} style={styles.commandDeck}>
              <View style={styles.commandHeader}>
                <View style={styles.commandPulse} />
                <View style={styles.commandText}>
                  <Text style={styles.commandKicker}>{selectedSubject ? `${selectedSubject.subjectName} roadmap` : "Roadmap live"}</Text>
                  <Text style={styles.summary}>
                    {dailyPlan.length
                      ? selectedSubject
                        ? `Showing only ${selectedSubject.subjectName} tasks from the calendar roadmap.`
                        : latestPlan.summary
                      : selectedSubject
                        ? `No ${selectedSubject.subjectName} tasks are in the latest roadmap yet. Add an assessment or refresh after updating Calendar.`
                        : latestPlan.summary}
                  </Text>
                </View>
              </View>
              <View style={styles.statGrid}>
                <View style={styles.statTile}>
                  <Text style={styles.statNumber}>{dailyPlan.length}</Text>
                  <Text style={styles.statLabel}>days</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statNumber}>{Math.round(roadmapStats.totalMinutes / 60)}h</Text>
                  <Text style={styles.statLabel}>planned</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statNumber}>{roadmapStats.taskCount}</Text>
                  <Text style={styles.statLabel}>tasks</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statNumber}>{roadmapStats.studyBlocks}</Text>
                  <Text style={styles.statLabel}>blocks</Text>
                </View>
              </View>
            </Animated.View>

            {assessmentSources.length && roadmapView !== "timeline" ? (
              <Animated.View entering={motion.card(70)} style={styles.laneStack}>
                <Text style={styles.sectionTitle}>Assessment lanes</Text>
                <View style={styles.assessmentStrip}>
                  {assessmentSources.slice(0, 5).map((event, index) => (
                    <Animated.View
                      key={`${event.id}-${event.event_type}-${index}`}
                      entering={motion.listItem(index)}
                      style={[styles.assessmentPill, { borderColor: `${eventAccent(event.event_type)}88` }]}
                    >
                      <View style={[styles.typeDot, { backgroundColor: eventAccent(event.event_type) }]} />
                      <Text style={[styles.assessmentType, { color: eventAccent(event.event_type) }]}>{event.event_type}</Text>
                      <Text numberOfLines={1} style={styles.assessmentTitle}>
                        {event.subject}
                      </Text>
                      <Text numberOfLines={1} style={styles.muted}>
                        {compactDate(event.event_date)} - {event.days_until}d
                      </Text>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>
            ) : null}

            <SegmentedButtons
              value={roadmapView}
              onValueChange={setRoadmapView}
              buttons={[
                { value: "timeline", label: "Timeline" },
                { value: "subjects", label: "Subjects" },
                { value: "sources", label: "Sources" }
              ]}
            />

            {roadmapView === "timeline" && nextMission ? (
              <Animated.View entering={motion.card(40)} style={styles.roadmapBrief}>
                <View style={styles.briefHeader}>
                  <View style={styles.briefIcon}>
                    <MaterialCommunityIcons name="map-clock-outline" color={palette.primary} size={22} />
                  </View>
                  <View style={styles.briefCopy}>
                    <Text style={styles.commandKicker}>Next mission</Text>
                    <Text style={styles.briefTitle}>{nextMission.title}</Text>
                    <Text style={styles.briefMeta}>
                      {readableDate(nextMission.date)} - {nextMission.minutes} min - {nextMission.subject}
                    </Text>
                  </View>
                  {roadmapStats.nextAssessment ? (
                    <View style={styles.countdownBadge}>
                      <MaterialCommunityIcons name="calendar-clock" color={palette.warning} size={14} />
                      <Text style={styles.countdownNumber}>{roadmapStats.nextAssessment.days_until}d</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.briefDeliverable}>
                  <MaterialCommunityIcons name="bullseye-arrow" color={palette.success} size={17} />
                  <Text style={styles.briefDeliverableText}>{nextMission.output}</Text>
                </View>
                <View style={styles.briefStepList}>
                  {nextMission.steps.slice(0, 3).map((step, index) => (
                    <View key={`${nextMission.id}-brief-step-${index}`} style={styles.briefStep}>
                      <Text style={styles.briefStepNumber}>{index + 1}</Text>
                      <Text style={styles.briefStepText}>{step}</Text>
                    </View>
                  ))}
                </View>
                {learningArc.length > 1 ? (
                  <View style={styles.arcStrip}>
                    {learningArc.map((mission) => (
                      <View key={mission.id} style={styles.arcItem}>
                        <MaterialCommunityIcons name={stageIcon(mission.stage)} color={stageColor(mission.stage)} size={13} />
                        <Text style={styles.arcLabel} numberOfLines={1}>
                          {stageLabel(mission.stage)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {roadmapView === "timeline" ? (
              <View style={styles.timelineStack}>
                {dailyPlan.length ? (
                  dailyPlan.slice(0, 14).map((day, dayIndex) => {
                    const firstTask = day.tasks[0];
                    const firstStage = firstTask ? learningStage(firstTask, dayIndex, 0) : "learn";
                    const firstColor = firstTask ? subjectColorFor(firstTask.subject) : palette.primary;
                    const isExpanded = expandedDay === day.date;
                    const totalMinutes = day.total_minutes || day.tasks.reduce((sum, task) => sum + task.minutes, 0);
                    return (
                      <Animated.View key={day.date} entering={motion.listItem(dayIndex)} layout={motion.layout()} style={styles.dayNode}>
                        <View style={styles.timelineRail}>
                          <View style={[styles.dayDot, { borderColor: firstColor }]} />
                          <View style={styles.railLine} />
                        </View>
                        <View style={styles.compactDayPanel}>
                          <Pressable
                            onPress={() => setExpandedDay((current) => (current === day.date ? null : day.date))}
                            style={styles.compactDayRow}
                          >
                            <View style={styles.compactDateLockup}>
                              <Text style={styles.dayDate}>{readableDate(day.date)}</Text>
                              <Text style={styles.dayIso}>{day.date}</Text>
                            </View>
                            <View style={styles.compactDayMain}>
                              <View style={styles.compactTitleRow}>
                                <View style={[styles.tinyStageDot, { backgroundColor: stageColor(firstStage) }]} />
                                <Text style={styles.dayFocus} numberOfLines={1}>
                                  {day.focus}
                                </Text>
                              </View>
                              <Text style={styles.reason} numberOfLines={1}>
                                {day.tasks.length} mission{day.tasks.length === 1 ? "" : "s"} - {firstTask ? displayTaskTitle(firstTask, dayIndex, 0) : "Plan"}
                              </Text>
                            </View>
                            <View style={styles.compactDayMeta}>
                              <Text style={styles.dayMinutes}>{totalMinutes}m</Text>
                              <MaterialCommunityIcons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                color={palette.muted}
                                size={18}
                              />
                            </View>
                          </Pressable>
                          {isExpanded ? (
                            <View style={styles.expandedMissions}>
                              {day.tasks.map((task, index) => {
                                const output = displayTaskMake(task, dayIndex, index);
                                const stage = learningStage(task, dayIndex, index);
                                const taskColor = subjectColorFor(task.subject);
                                return (
                                  <View key={`${day.date}-${task.title}-${index}`} style={styles.expandedMissionRow}>
                                    <View style={[styles.expandedStageIcon, { borderColor: `${stageColor(stage)}66` }]}>
                                      <MaterialCommunityIcons name={stageIcon(stage)} color={stageColor(stage)} size={15} />
                                    </View>
                                    <View style={styles.expandedMissionText}>
                                      <Text style={styles.taskTitle} numberOfLines={1}>
                                        {displayTaskTitle(task, dayIndex, index)}
                                      </Text>
                                      <Text style={styles.taskMetaText} numberOfLines={1}>
                                        {task.subject} - {task.minutes} min
                                      </Text>
                                      <Text style={styles.expandedOutput} numberOfLines={2}>
                                        Make: {output}
                                      </Text>
                                    </View>
                                    <View style={[styles.subjectDot, { backgroundColor: taskColor }]} />
                                  </View>
                                );
                              })}
                              {day.checkpoint ? (
                                <View style={styles.compactCheckpoint}>
                                  <MaterialCommunityIcons name="notebook-check-outline" color={palette.success} size={15} />
                                  <Text style={styles.checkpoint}>{day.checkpoint}</Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </Animated.View>
                    );
                  })
                ) : (
                  <Text style={styles.muted}>
                    {selectedSubject
                      ? `No ${selectedSubject.subjectName} roadmap tasks found. Add a ${selectedSubject.subjectName} assessment in Calendar, then refresh.`
                      : "Refresh the roadmap after adding assessments."}
                  </Text>
                )}
              </View>
            ) : null}

            {roadmapView === "subjects" ? (
              <View style={styles.roadmapStack}>
                {subjectRoadmaps.length ? (
                  subjectRoadmaps.slice(0, 6).map((roadmap, index) => {
                    const roadmapColor = subjectColorFor(roadmap.subject);
                    return (
                      <Animated.View
                        key={`${roadmap.assessment_title}-${index}`}
                        entering={motion.listItem(index)}
                        style={[styles.roadmapItem, { borderColor: `${roadmapColor}44`, backgroundColor: `${roadmapColor}0D` }]}
                      >
                        <View style={[styles.roadmapAccent, { backgroundColor: roadmapColor }]} />
                        <View style={styles.roadmapHeader}>
                          <View style={styles.roadmapSubjectLockup}>
                            <View style={[styles.roadmapIcon, { borderColor: `${roadmapColor}66`, backgroundColor: `${roadmapColor}18` }]}>
                              <MaterialCommunityIcons name="map-marker-path" color={roadmapColor} size={18} />
                            </View>
                            <View style={styles.taskText}>
                              <Text style={styles.taskTitle}>{roadmap.subject}</Text>
                              <Text style={styles.muted}>
                                {roadmap.assessment_type} - {roadmap.assessment_date}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.roadmapMinutesPill}>
                            <MaterialCommunityIcons name="clock-fast" color={palette.success} size={15} />
                            <Text style={styles.roadmapMinutes}>{Math.round(roadmap.recommended_total_minutes / 60)}h</Text>
                          </View>
                        </View>
                        <Text style={styles.reason}>{roadmap.study_design_focus}</Text>
                        <View style={styles.focusGrid}>
                          {roadmap.daily_focus.slice(0, 4).map((focus, focusIndex) => (
                            <View
                              key={`${roadmap.subject}-${focusIndex}`}
                              style={[styles.focusChip, { borderColor: `${roadmapColor}33`, backgroundColor: `${roadmapColor}10` }]}
                            >
                              <Text style={[styles.focusChipNumber, { color: roadmapColor }]}>{focusIndex + 1}</Text>
                              <Text style={styles.focusChipText} numberOfLines={2}>
                                {focus}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </Animated.View>
                    );
                  })
                ) : (
                  <Text style={styles.muted}>Refresh the roadmap after adding assessments.</Text>
                )}
              </View>
            ) : null}

            {roadmapView === "sources" ? (
              <View style={styles.roadmapStack}>
                {sourceEvents.slice(0, 12).map((event, index) => (
                  <Animated.View
                    key={`${event.id}-${event.event_type}-${index}`}
                    entering={motion.listItem(index)}
                    style={styles.sourceItem}
                  >
                    <View style={[styles.sourceAccent, { backgroundColor: eventAccent(event.event_type) }]} />
                    <View style={styles.taskText}>
                      <Text style={styles.taskTitle}>{event.title}</Text>
                      <Text style={styles.muted}>
                        {event.subject} - {event.event_type} - {event.event_date}
                      </Text>
                      <Text style={styles.reason}>{event.topic}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </AppCard>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  card: {
    gap: 12
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center"
  },
  headerText: {
    flex: 1
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted
  },
  dateInput: {
    width: 142,
    backgroundColor: palette.surface
  },
  planControls: {
    flexDirection: "row",
    gap: 10
  },
  minutesInput: {
    width: 96
  },
  daysInput: {
    width: 82
  },
  priorityInput: {
    flex: 1
  },
  planStack: {
    gap: 12
  },
  commandDeck: {
    gap: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.28)",
    backgroundColor: "rgba(96,165,250,0.08)",
    padding: 14
  },
  commandHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  commandPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.success,
    marginTop: 5
  },
  commandText: {
    flex: 1,
    gap: 4
  },
  commandKicker: {
    color: palette.info,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    textTransform: "uppercase"
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statTile: {
    minWidth: 86,
    flex: 1,
    minHeight: 68,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10
  },
  statNumber: {
    color: palette.text,
    fontSize: 24,
    fontFamily: "Outfit_700Bold"
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12
  },
  summary: {
    color: palette.text,
    lineHeight: 20
  },
  autoStatus: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18
  },
  roadmapBrief: {
    gap: 10,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.26)",
    backgroundColor: "rgba(124,110,255,0.06)",
    padding: 12
  },
  briefHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  briefIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}18`
  },
  briefCopy: {
    flex: 1,
    gap: 2
  },
  briefTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    lineHeight: 21
  },
  briefMeta: {
    color: palette.muted,
    lineHeight: 18
  },
  countdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.warning}55`,
    backgroundColor: `${palette.warning}12`,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  countdownNumber: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 16
  },
  briefDeliverable: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.success}33`,
    backgroundColor: `${palette.success}10`,
    padding: 10
  },
  briefDeliverableText: {
    flex: 1,
    color: palette.text,
    lineHeight: 19
  },
  briefStepList: {
    gap: 7
  },
  briefStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  briefStepNumber: {
    width: 20,
    height: 20,
    borderRadius: 7,
    overflow: "hidden",
    textAlign: "center",
    color: palette.primary,
    borderWidth: 1,
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}12`,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    lineHeight: 18
  },
  briefStepText: {
    flex: 1,
    color: palette.text,
    lineHeight: 19
  },
  arcStrip: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 1
  },
  arcItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  arcLabel: {
    color: palette.muted,
    fontSize: 11,
    fontFamily: "Outfit_700Bold"
  },
  taskRow: {
    flexDirection: "row",
    gap: 0,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 0
  },
  taskAccent: {
    width: 5
  },
  taskStack: {
    gap: 10,
    paddingTop: 10
  },
  taskMinutes: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.primary}22`,
    borderWidth: 1,
    borderColor: `${palette.primary}55`
  },
  taskMinutesText: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  taskMinutesUnit: {
    color: palette.muted,
    fontSize: 10
  },
  taskText: {
    flex: 1,
    gap: 8,
    padding: 12
  },
  taskTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap"
  },
  stageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  stageChipText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  minuteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  minuteChipText: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  taskMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  subjectDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  taskMetaText: {
    flex: 1,
    color: palette.muted,
    lineHeight: 18
  },
  stepStack: {
    gap: 8,
    paddingTop: 2
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  stepText: {
    flex: 1,
    color: palette.text,
    lineHeight: 20
  },
  outputBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.success}33`,
    backgroundColor: `${palette.success}10`,
    padding: 10
  },
  outputText: {
    flex: 1,
    color: palette.text,
    lineHeight: 19
  },
  assessmentStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  laneStack: {
    gap: 10
  },
  assessmentPill: {
    width: 140,
    minHeight: 76,
    gap: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    padding: 10
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  assessmentType: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  assessmentTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  roadmapStack: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  timelineStack: {
    gap: 12
  },
  dayNode: {
    flexDirection: "row",
    gap: 10
  },
  timelineRail: {
    width: 18,
    alignItems: "center"
  },
  dayDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: palette.success,
    backgroundColor: palette.surface
  },
  railLine: {
    flex: 1,
    width: 2,
    minHeight: 80,
    backgroundColor: "rgba(74,222,128,0.22)",
    marginTop: 4
  },
  dayPanel: {
    flex: 1,
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 14
  },
  compactDayPanel: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  compactDayRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12
  },
  compactDateLockup: {
    width: 126,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.18)",
    backgroundColor: "rgba(124,110,255,0.07)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  compactDayMain: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  compactTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  tinyStageDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  compactDayMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}33`,
    backgroundColor: `${palette.primary}0F`,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  expandedMissions: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    padding: 12,
    paddingTop: 10
  },
  expandedMissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 10
  },
  expandedStageIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  expandedMissionText: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  expandedOutput: {
    color: palette.text,
    lineHeight: 18
  },
  compactCheckpoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 2
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  roadmapItem: {
    gap: 10,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: palette.surfaceRaised,
    padding: 12
  },
  roadmapAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  roadmapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  roadmapSubjectLockup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  roadmapIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  roadmapMinutesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.success}33`,
    backgroundColor: `${palette.success}10`,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  roadmapMinutes: {
    color: palette.success,
    fontFamily: "Outfit_700Bold"
  },
  focusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  focusChip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 38,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.18)",
    backgroundColor: "rgba(96,165,250,0.08)",
    paddingHorizontal: 9,
    paddingVertical: 8
  },
  focusChipNumber: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Outfit_700Bold"
  },
  focusChipText: {
    flex: 1,
    color: palette.text,
    fontSize: 12,
    lineHeight: 16
  },
  sourceItem: {
    minHeight: 70,
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    padding: 12
  },
  sourceAccent: {
    width: 4,
    borderRadius: 2
  },
  dayBlock: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap"
  },
  dateLockup: {
    minWidth: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.22)",
    backgroundColor: "rgba(124,110,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  dayHeaderText: {
    flex: 1,
    minWidth: 180
  },
  dayDate: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  dayIso: {
    color: palette.muted,
    fontSize: 12
  },
  dayFocus: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  dayMinutesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}44`,
    backgroundColor: `${palette.primary}12`,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  dayMinutes: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  taskTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  reason: {
    color: palette.muted,
    lineHeight: 19
  },
  checkpoint: {
    flex: 1,
    color: palette.success,
    lineHeight: 19
  },
  checkpointBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10
  },
  classLogItem: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10
  },
  classLogHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  classLogTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  classLogDetails: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12
  },
  classLogDetail: {
    gap: 4
  },
  classLogLabel: {
    color: palette.primary,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  classLogBody: {
    color: palette.text,
    lineHeight: 20
  },
  message: {
    color: palette.success,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  }
});
