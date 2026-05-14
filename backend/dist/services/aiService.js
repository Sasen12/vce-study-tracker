import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getStudyDesignContext } from "../resources/studyDesignContext.js";
import { inferVceSubjectFromQuestion } from "../resources/subjectInference.js";
import { subjectToolProfile, visualTopicLooksRelevant } from "../resources/subjectTools.js";
import { isLanguageSubject } from "../resources/vceSubjectCatalogue.js";
const generatedQuestionVisualSchema = z.object({
    type: z.enum(["line_graph", "scatter_plot", "bar_chart", "diagram", "image_prompt"]),
    title: z.string(),
    description: z.string(),
    x_label: z.string(),
    y_label: z.string(),
    points: z.array(z.object({
        x: z.coerce.number(),
        y: z.coerce.number(),
        label: z.string()
    })),
    bars: z.array(z.object({
        label: z.string(),
        value: z.coerce.number()
    })),
    labels: z.array(z.string())
});
const generatedQuestionSchema = z.object({
    question: z.string(),
    marks: z.coerce.number().int().min(1).max(20),
    topic: z.string(),
    model_answer: z.string(),
    marking_criteria: z.array(z.string()),
    answer_options: z.array(z.object({
        text: z.string(),
        correct: z.boolean()
    })),
    visual: generatedQuestionVisualSchema.nullable()
});
const generatedQuestionsSchema = z.array(generatedQuestionSchema);
const generatedQuestionsResponseSchema = z.object({
    questions: generatedQuestionsSchema
});
const answerFeedbackSchema = z.object({
    score: z.coerce.number().min(0).max(100),
    awarded_marks: z.coerce.number().min(0),
    max_marks: z.coerce.number().min(1),
    verdict: z.enum(["needs_work", "close", "strong", "excellent"]),
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
    next_step: z.string()
});
const learningSignalSchema = z.object({
    signal_type: z.enum([
        "weakness",
        "strength",
        "mistake",
        "topic_interest",
        "study_behavior",
        "assessment_risk",
        "resource_context",
        "next_action"
    ]),
    subject: z.string().nullable().optional(),
    topic: z.string().nullable().optional(),
    title: z.string().min(1).max(160),
    detail: z.string().min(1).max(700),
    evidence: z.string().min(1).max(600),
    confidence: z.enum(["low", "medium", "high"]).default("medium"),
    next_action: z.string().nullable().optional(),
    weight: z.coerce.number().int().min(1).max(5).default(2)
});
const learningSignalsResponseSchema = z.object({
    signals: z.array(learningSignalSchema).max(4)
});
const adaptiveTaskSchema = z.object({
    date: z.string(),
    title: z.string(),
    subject: z.string(),
    minutes: z.coerce.number().int().min(5).max(180),
    mode: z.string(),
    reason: z.string(),
    topic: z.string(),
    assessment_title: z.string(),
    assessment_date: z.string(),
    event_type: z.string(),
    output: z.string(),
    time_window: z.string()
});
const dailyPlanSchema = z.object({
    date: z.string(),
    total_minutes: z.coerce.number().int().min(0).max(720),
    focus: z.string(),
    tasks: z.array(adaptiveTaskSchema),
    checkpoint: z.string()
});
const subjectRoadmapSchema = z.object({
    subject: z.string(),
    assessment_title: z.string(),
    assessment_type: z.string(),
    assessment_date: z.string(),
    topic: z.string(),
    days_until: z.coerce.number().int().min(0).max(400),
    recommended_total_minutes: z.coerce.number().int().min(0).max(5000),
    study_design_focus: z.string(),
    daily_focus: z.array(z.string())
});
const sourceEventSchema = z.object({
    id: z.string(),
    title: z.string(),
    subject: z.string(),
    event_type: z.string(),
    event_date: z.string(),
    topic: z.string(),
    days_until: z.coerce.number().int().min(0).max(400)
});
const adaptivePlanSchema = z.object({
    summary: z.string(),
    focus_areas: z.array(z.string()),
    tasks: z.array(adaptiveTaskSchema),
    daily_plan: z.array(dailyPlanSchema),
    subject_roadmaps: z.array(subjectRoadmapSchema),
    source_events: z.array(sourceEventSchema),
    checkpoints: z.array(z.string())
});
const studyAnswerSourceSchema = z.object({
    title: z.string(),
    source_type: z.string(),
    detail: z.string()
});
const tutorPlanSchema = z.object({
    diagnosis: z.string(),
    teaching_move: z.string(),
    guided_steps: z.array(z.string()),
    your_turn: z.string(),
    check_question: z.string(),
    next_revision: z.string()
});
const studyAnswerSchema = z.object({
    answer: z.string(),
    key_points: z.array(z.string()),
    sources_used: z.array(studyAnswerSourceSchema),
    follow_up_questions: z.array(z.string()),
    tutor_plan: tutorPlanSchema,
    confidence: z.enum(["low", "medium", "high"])
});
const dailyInspirationSchema = z.object({
    quote: z.string().min(4).max(220),
    tip: z.string().min(4).max(260),
    action: z.string().min(4).max(180)
});
const classNoteDraftSchema = z.object({
    title: z.string(),
    summary: z.string(),
    key_points: z.array(z.string()),
    subject_terms: z.array(z.string()),
    confusion_flags: z.array(z.string()),
    questions_to_ask: z.array(z.string()),
    retrieval_prompts: z.array(z.string()),
    next_actions: z.array(z.string())
});
const classNoteChunkSchema = z.object({
    title: z.string(),
    summary: z.string(),
    bullets: z.array(z.string()),
    action: z.string(),
    confidence: z.enum(["low", "medium", "high"])
});
const defaultModel = "gpt-5.4-mini";
const hasOpenAIKey = (apiKey) => Boolean(apiKey && !apiKey.includes("your_openai_key_here") && apiKey !== "sk-proj-...");
const studyDesignCoverageLabel = (studyDesign) => studyDesign.detailLevel === "detailed"
    ? "detailed local study-design summary"
    : "generic subject-family fallback only";
const buildStudyDesignBlock = (studyDesign) => studyDesign
    ? `\nStudy design context (${studyDesignCoverageLabel(studyDesign)}):\n${studyDesign.context}\nSource note: ${studyDesign.source}\n`
    : "\nStudy design context: No local study-design context was found for this subject.\n";
const hasStudentSourceContext = (personalContext) => Boolean(personalContext?.trim());
const isLanguagePracticeSubject = (subject) => isLanguageSubject(subject) ||
    /language|arabic|armenian|auslan|bengali|bosnian|chinese|chin hakha|greek|hebrew|croatian|dutch|filipino|french|german|hindi|hungarian|indonesian|italian|japanese|karen|khmer|korean|latin|macedonian|persian|polish|portuguese|punjabi|romanian|russian|serbian|sinhala|spanish|swedish|tamil|turkish|urdu|vietnamese|yiddish/i.test(subject);
const visualQuestionRules = ({ subject, topic, count, visualMode = "auto" }) => {
    const profile = subjectToolProfile(subject);
    if (!profile.visual) {
        return "\nVisual rules: This subject is not currently routed to visual generation. Set visual to null unless uploaded material explicitly supplies a diagram/chart the question depends on.";
    }
    const requestedVisual = visualMode === "visual";
    const topicLooksVisual = visualTopicLooksRelevant(topic);
    const visualKinds = profile.visualKinds.join(", ");
    const visualKindCount = profile.visualKinds.length;
    const visualTarget = Math.min(count, Math.max(1, Math.min(3, visualKindCount || 1)));
    const forceLine = requestedVisual
        ? `\n- Visual mode is ON. At least ${visualTarget} question${visualTarget === 1 ? "" : "s"} in the returned set should include a visual object if the topic can support it.`
        : topicLooksVisual
            ? "\n- The topic looks visual/data-based, so include visual objects whenever they make the question fairer."
            : "\n- Visual mode is AUTO. Include a visual only when the generated question genuinely needs one.";
    return `\nVisual rules:
- Subject visual profile: ${profile.visualLabel}; supported kinds: ${visualKinds || "diagram"}.
${forceLine}
- For Foundation Mathematics, General Mathematics, Mathematical Methods and Specialist Mathematics, prefer graph/table/chart visuals for functions, relations, calculus, probability, statistics, measurement, data and modelling topics.
- For science/data/geography/economics/accounting/technology topics, use charts, scatter plots, field/circuit/system diagrams, maps or data displays only when relevant.
- If a visual is included, the question text must explicitly refer to "the visual shown" or "the graph/chart/diagram shown".
- Use renderable numbers: line_graph and scatter_plot need 3-8 points sorted by x; bar_chart needs 3-6 bars; diagram/image_prompt should use labels and a concise description.
- Keep every visual self-contained. Do not rely on external images or links.
- If no visual is useful, set visual to null.`;
};
const questionQualityContract = ({ subject, studyDesign, personalContext, sourceMode }) => {
    const genericWithoutStudentSources = studyDesign?.detailLevel !== "detailed" && !hasStudentSourceContext(personalContext);
    const languageRules = isLanguagePracticeSubject(subject)
        ? `\nLanguage-subject rules:
- For ${subject}, do not pretend to know the exact current VCAA language exam format unless uploaded resources prove it.
- Prefer trustworthy skill practice: vocabulary in context, grammar repair, reading comprehension from a short supplied passage, translation with clear scope, or written response with a clear word/sentence range.
- If the task asks for one word, one phrase, one grammar transformation or one sentence, allocate 1-2 marks only.
- Allocate 3-4 marks only when the student must write several sentences or address several criteria.
- Allocate 5+ marks only for an explicitly extended response with a stated length, audience/purpose/text type, and multiple marking criteria.
- Never make a 6-mark language question that asks for one sentence.`
        : "";
    const genericRules = genericWithoutStudentSources
        ? "\nBecause this subject currently has only generic local context and no uploaded source context, generate conservative skill-builder practice. Do not exceed 4 marks unless the task is clearly multi-part and broadly valid for the subject."
        : sourceMode === "exam_bank"
            ? "\nIf uploaded exam/practice material is available in the context, mirror its style and mark density. If it is not actually available, keep the question conservative and self-contained."
            : "";
    return `Question quality contract:
- Every generated question must be self-contained, fair and answerable from the supplied topic/context.
- Marks must match the work demanded:
  - 1 mark: one fact, phrase, calculation, selection or correction.
  - 2 marks: one explained point, one sentence plus justification, or two short linked details.
  - 3-4 marks: a short paragraph, several steps, or multiple clear criteria.
  - 5+ marks: an extended or multi-part task with at least three assessable demands.
- Never allocate more than 2 marks to a question that asks for "one sentence", "one phrase", "one word", "name one", or a single simple correction.
- If you allocate 5+ marks, the question wording must explicitly ask for a structured/extended response and the marking criteria must have enough independent criteria to justify those marks.
- Multiple-choice answer options are only for the app's quick battle mode; the main generated question should still be a fair written-response practice item.
${genericRules}
${languageRules}`;
};
const studyDesignReliabilityRules = (studyDesign) => {
    const coverageRule = studyDesign?.detailLevel === "detailed"
        ? "- You may make study-design alignment claims only when the supplied detailed context supports them."
        : studyDesign?.detailLevel === "generic"
            ? "- The app only has a generic fallback for this subject right now. Do not claim exact VCAA dot points, Areas of Study, unit boundaries, required terminology or prescribed content unless uploaded notes, screenshots, PDFs or resources prove them."
            : "- No subject-specific study-design context was supplied. Do not claim exact VCAA dot points, Areas of Study, unit boundaries, required terminology or prescribed content unless uploaded notes, screenshots, PDFs or resources prove them.";
    return `Reliability rules:
- Treat the study design context as the first authority, then uploaded notes/resources/screenshots/PDF attachments, then general VCE knowledge.
${coverageRule}
- Do not invent VCAA dot points, dates, areas of study, formulas, statistics, teacher requirements or prescribed content.
- If the evidence is weak, say what is uncertain in the answer/source detail/task wording instead of sounding certain.
- If the student's topic appears outside the supplied Unit 3/4 context, flag it as possible prerequisite or off-study-design revision instead of quietly drifting into it.`;
};
const buildPrompt = ({ subject, topic, difficulty, count, personalContext, sourceMode = "balanced", visualMode = "auto" }) => {
    const studyDesign = getStudyDesignContext(subject);
    const studyDesignBlock = buildStudyDesignBlock(studyDesign);
    const personalContextBlock = personalContext
        ? `\nStudent-specific context from uploaded resources, notes and reflections:\n${personalContext}\n`
        : "";
    const sourceModeBlock = sourceMode === "exam_bank"
        ? "\nUse uploaded exam papers, practice SAC/SATs and examiner reports when relevant. Prefer adapting them into fresh questions with the same skills, command terms and marking emphasis; only reuse exact wording when it is clearly part of the student's uploaded revision material.\n"
        : "\nUse uploaded resources as supporting context. If exam papers or examiner reports are present, let them influence wording, common mistakes, and marking criteria.\n";
    return `You are a VCE exam question generator. Generate ${count} ${difficulty} practice questions for VCE ${subject} Unit 3/4, specifically on the topic of "${topic}".
${studyDesignBlock}
${personalContextBlock}
${sourceModeBlock}
${studyDesignReliabilityRules(studyDesign)}
${questionQualityContract({ subject, studyDesign, personalContext, sourceMode })}
${visualQuestionRules({ subject, topic, count, visualMode })}

Question-generation rules:
- Generate questions from the supplied topic and the study-design context first.
- If the context is generic fallback only, make the question assess the broad skill/topic without pretending it is an exact VCAA dot point.
- If the supplied topic conflicts with the detailed Unit 3/4 context, keep the model answer honest about that mismatch.
- For subjects with generic fallback context, call the item VCE-style skill practice in the wording only when exact exam format is not supported by uploaded resources.
- Do a final self-check before returning: if the mark allocation feels too high for the wording, lower the marks or rewrite the question so the demanded work fits.

For each question, provide:
1. A realistic exam-style question (match VCAA style and mark allocation)
2. A model answer with clear marking criteria

Return a JSON object with a "questions" array. Each question must include:
- question
- marks
- topic
- model_answer
- marking_criteria: string[]
- answer_options: exactly 4 short multiple-choice answers for a fast quiz mode. Exactly one option must have correct true. Distractors should reflect common VCE mistakes, not joke answers.
- visual: either null or an object with type, title, description, x_label, y_label, points, bars and labels. Use empty strings or empty arrays for visual fields that do not apply.

Only return valid JSON that matches the requested schema. No preamble, no markdown.`;
};
const mockVisualFor = (input, index) => {
    const profile = subjectToolProfile(input.subject);
    const shouldShow = profile.visual && (input.visualMode === "visual" || visualTopicLooksRelevant(input.topic));
    if (!shouldShow)
        return null;
    if (profile.graph) {
        const offset = index + 1;
        return {
            type: /bar|histogram|category|compare/i.test(input.topic) ? "bar_chart" : "line_graph",
            title: `${input.topic} visual`,
            description: `Use this ${profile.graph ? "graph" : "chart"} to support the ${input.subject} question.`,
            x_label: /time|motion|rate/i.test(input.topic) ? "time" : "x",
            y_label: /time|motion|rate/i.test(input.topic) ? "value" : "y",
            points: [
                { x: -2, y: offset + 4, label: "A" },
                { x: -1, y: offset + 1, label: "B" },
                { x: 0, y: offset, label: "C" },
                { x: 1, y: offset + 1, label: "D" },
                { x: 2, y: offset + 4, label: "E" }
            ],
            bars: [
                { label: "A", value: 3 + offset },
                { label: "B", value: 6 + offset },
                { label: "C", value: 4 + offset }
            ],
            labels: []
        };
    }
    return {
        type: "diagram",
        title: `${input.topic} diagram`,
        description: `Use the labelled diagram to answer the ${input.subject} prompt.`,
        x_label: "",
        y_label: "",
        points: [],
        bars: [],
        labels: ["input", "process", "output", "evaluation"]
    };
};
const mockQuestions = (input) => Array.from({ length: input.count }, (_, index) => {
    const visual = mockVisualFor(input, index);
    const visualQuestion = visual ? ` Use the visual shown to identify the main pattern, then justify your conclusion.` : "";
    return {
        question: isLanguagePracticeSubject(input.subject)
            ? `(${index + 1}) A ${input.difficulty} VCE ${input.subject} skill-practice question on ${input.topic}: Write ${input.difficulty === "hard" ? "4-5 connected sentences" : input.difficulty === "medium" ? "2-3 connected sentences" : "one accurate sentence"} using appropriate vocabulary and grammar for the context.`
            : `(${index + 1}) A ${input.difficulty} VCE ${input.subject} question on ${input.topic}: Explain one key concept, then apply it to a realistic exam scenario.${visualQuestion} Include a justified conclusion.`,
        marks: isLanguagePracticeSubject(input.subject)
            ? input.difficulty === "hard"
                ? 4
                : input.difficulty === "medium"
                    ? 3
                    : 2
            : input.difficulty === "hard"
                ? 6
                : input.difficulty === "medium"
                    ? 4
                    : 2,
        topic: input.topic,
        model_answer: isLanguagePracticeSubject(input.subject)
            ? `A strong response uses accurate ${input.subject} vocabulary for ${input.topic}, keeps grammar controlled, and matches the requested length and context.`
            : visual
                ? `A strong answer states the key ${input.topic} idea, reads the visual pattern accurately, uses the values or labels as evidence, and interprets the conclusion in context.`
                : `A strong answer defines the relevant ${input.topic} concept, applies VCE terminology accurately, links the explanation to the scenario, and finishes with a clear judgement.`,
        marking_criteria: [
            isLanguagePracticeSubject(input.subject) ? `Uses accurate ${input.subject} vocabulary` : "Uses accurate VCE terminology",
            visual ? "Interprets the supplied visual accurately" : isLanguagePracticeSubject(input.subject) ? "Controls grammar and sentence structure" : "Applies the concept directly to the scenario",
            isLanguagePracticeSubject(input.subject) ? "Responds to the requested context and length" : "Provides a justified conclusion"
        ],
        answer_options: [
            {
                text: isLanguagePracticeSubject(input.subject)
                    ? `Use accurate ${input.subject} vocabulary, controlled grammar and the requested response length.`
                    : visual
                        ? `Use the visual evidence, explain the pattern, and interpret it in context.`
                        : `Define ${input.topic}, apply it to the scenario using VCE terminology, then justify the conclusion.`,
                correct: true
            },
            {
                text: isLanguagePracticeSubject(input.subject)
                    ? `Use isolated vocabulary only, without forming complete sentences.`
                    : `Only define ${input.topic} without linking it to the scenario.`,
                correct: false
            },
            {
                text: isLanguagePracticeSubject(input.subject)
                    ? "Write in English instead of the target language."
                    : visual
                        ? "Read one value from the visual without explaining the pattern."
                        : "Give a conclusion first and leave out the supporting evidence.",
                correct: false
            },
            {
                text: isLanguagePracticeSubject(input.subject)
                    ? "Ignore the context, audience or required length."
                    : "List related facts without explaining how they answer the question.",
                correct: false
            }
        ],
        visual
    };
});
const singleSmallTaskPattern = /\b(one|single)\s+(sentence|phrase|word|term|example|reason|detail|correction)\b|\b(name|identify|state|give)\s+one\b|\bin\s+one\s+sentence\b/i;
const selectionTaskPattern = /\b(multiple[- ]choice|choose|select|circle|tick|which option)\b/i;
const extendedDemandPattern = /\b(extended|structured|paragraph|response|essay|article|email|letter|script|speech|dialogue|journal|blog|review|report|analysis|evaluate|justify|compare|discuss|analyse|explain)\b/i;
const explicitLengthPattern = /\b(\d{2,4}\s*[-–]\s*\d{2,4}|\d{2,4})\s*(words?|mots?)\b|\b\d+\s*[-–]?\s*(sentences?|phrases?)\b/i;
const multiDemandPattern = /\b(two|three|four|several|multiple|at least|both|compare|contrast|explain and|justify and|evaluate and|analyse and)\b/i;
const hasExtendedDemand = (question) => extendedDemandPattern.test(question) && (multiDemandPattern.test(question) || explicitLengthPattern.test(question));
const genericWithoutStudentSources = (input) => {
    const studyDesign = getStudyDesignContext(input.subject);
    return studyDesign.detailLevel !== "detailed" && !hasStudentSourceContext(input.personalContext);
};
const maxMarksForGeneratedQuestion = (input, question) => {
    const text = question.question;
    if (selectionTaskPattern.test(text))
        return 1;
    if (singleSmallTaskPattern.test(text))
        return 2;
    const languageSubject = isLanguagePracticeSubject(input.subject);
    const baseMax = input.difficulty === "hard" ? 6 : input.difficulty === "medium" ? 4 : 2;
    let max = languageSubject ? (input.difficulty === "hard" ? 5 : input.difficulty === "medium" ? 4 : 2) : baseMax;
    if (genericWithoutStudentSources(input)) {
        max = Math.min(max, 4);
    }
    if (question.marks >= 5 && !hasExtendedDemand(text)) {
        max = Math.min(max, 4);
    }
    if (languageSubject && /\bsentence\b/i.test(text) && !explicitLengthPattern.test(text)) {
        max = Math.min(max, 3);
    }
    return Math.max(1, max);
};
const withExtendedDemandIfNeeded = (input, question, marks) => {
    if (marks < 5 || hasExtendedDemand(question.question) || singleSmallTaskPattern.test(question.question)) {
        return question.question;
    }
    if (isLanguagePracticeSubject(input.subject)) {
        return `${question.question} Write 80-120 words and make sure your response has a clear audience, purpose and text type.`;
    }
    return `${question.question} Write a structured response that explains the key idea, applies it to the scenario, and justifies the final judgement.`;
};
const sanitiseQuestionVisual = (visual) => {
    if (!visual)
        return null;
    return {
        type: visual.type,
        title: visual.title.slice(0, 90),
        description: visual.description.slice(0, 260),
        x_label: visual.x_label.slice(0, 40),
        y_label: visual.y_label.slice(0, 40),
        points: visual.points
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
            .slice(0, 10)
            .map((point) => ({ x: point.x, y: point.y, label: point.label.slice(0, 24) })),
        bars: visual.bars
            .filter((bar) => Number.isFinite(bar.value))
            .slice(0, 7)
            .map((bar) => ({ label: bar.label.slice(0, 24), value: bar.value })),
        labels: visual.labels.slice(0, 8).map((label) => label.slice(0, 40))
    };
};
const sanitiseGeneratedQuestions = (input, questions) => questions.map((question) => {
    const maxMarks = maxMarksForGeneratedQuestion(input, question);
    const marks = Math.min(Math.max(1, question.marks), maxMarks);
    return {
        ...question,
        marks,
        question: withExtendedDemandIfNeeded(input, question, marks),
        marking_criteria: question.marking_criteria.length
            ? question.marking_criteria.slice(0, Math.max(marks, 3))
            : ["Answers the question directly", "Uses accurate subject knowledge", "Matches the required response length and detail"],
        visual: sanitiseQuestionVisual(question.visual)
    };
});
const normaliseWords = (text) => text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
const mockAnswerFeedback = (input) => {
    const modelWords = new Set(normaliseWords(input.modelAnswer));
    const answerWords = new Set(normaliseWords(input.studentAnswer));
    const overlap = [...answerWords].filter((word) => modelWords.has(word)).length;
    const coverage = modelWords.size ? overlap / modelWords.size : 0;
    const criteriaHits = input.markingCriteria.filter((criterion) => {
        const words = normaliseWords(criterion);
        return words.some((word) => answerWords.has(word));
    }).length;
    const criteriaScore = input.markingCriteria.length ? criteriaHits / input.markingCriteria.length : 0;
    const lengthScore = Math.min(input.studentAnswer.trim().length / 220, 1);
    const score = Math.round(Math.min(100, (coverage * 0.45 + criteriaScore * 0.35 + lengthScore * 0.2) * 100));
    const awardedMarks = Math.min(input.marks, Math.max(0, Math.round((score / 100) * input.marks)));
    const verdict = score >= 85 ? "excellent" : score >= 70 ? "strong" : score >= 45 ? "close" : "needs_work";
    return {
        score,
        awarded_marks: awardedMarks,
        max_marks: input.marks,
        verdict,
        strengths: score >= 70
            ? ["You covered the core idea and included enough detail to be creditworthy."]
            : ["You made a start on the idea, which gives us something to build from."],
        improvements: score >= 70
            ? ["Tighten the explanation by matching each sentence to a marking criterion."]
            : ["Add key terminology, apply it directly to the question, and finish with a justified conclusion."],
        next_step: `Rewrite one sentence so it clearly addresses: ${input.markingCriteria[0] ?? "the main marking criterion"}.`
    };
};
const mockLearningSignals = (input) => {
    const combined = `${input.eventType} ${input.summary} ${input.evidence ?? ""}`.toLowerCase();
    const isWeak = /wrong|mistake|confus|weak|needs_work|close|improvement|lost mark|unclear|avoid|struggl/.test(combined);
    const isStrong = /excellent|strong|correct|strength|high confidence|full marks|master/.test(combined);
    const signalType = isWeak
        ? "weakness"
        : isStrong
            ? "strength"
            : /upload|resource|pdf|textbook|worksheet/.test(combined)
                ? "resource_context"
                : /session|studied|minutes|timer/.test(combined)
                    ? "study_behavior"
                    : "topic_interest";
    const topic = input.topic?.trim() || null;
    const title = signalType === "weakness"
        ? `Watch: ${topic ?? "repeat weak area"}`
        : signalType === "strength"
            ? `Strength: ${topic ?? "recent answer"}`
            : signalType === "study_behavior"
                ? `Study pattern: ${topic ?? input.subject ?? "general study"}`
                : `Interest: ${topic ?? input.subject ?? "recent topic"}`;
    return [
        {
            signal_type: signalType,
            subject: input.subject ?? null,
            topic,
            title,
            detail: input.summary.slice(0, 650) || "The student created a new learning event.",
            evidence: (input.evidence || input.summary).slice(0, 550) || "Recorded from app activity.",
            confidence: isWeak || isStrong ? "medium" : "low",
            next_action: isWeak
                ? `Practise one short response on ${topic ?? "this weak area"} and save the next-time rule.`
                : signalType === "strength"
                    ? `Use this strength as retrieval practice before moving to a harder version.`
                    : `Add one checked question so the app can test whether this is curiosity or a gap.`,
            weight: isWeak ? 4 : isStrong ? 3 : 2
        }
    ];
};
const dateKey = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};
const daysBetween = (from, to) => {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
    return Math.max(0, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000));
};
const eventWeight = (eventType) => {
    if (eventType === "EXAM")
        return 5;
    if (eventType === "SAT")
        return 4;
    if (eventType === "PRACTICE_SAT")
        return 3;
    if (eventType === "SAC")
        return 3;
    if (eventType === "PRACTICE_SAC")
        return 2;
    return 2;
};
const eventMinutes = (event) => {
    const base = event.eventType === "EXAM"
        ? 900
        : event.eventType === "SAT"
            ? 720
            : event.eventType === "PRACTICE_SAT"
                ? 360
                : event.eventType === "SAC"
                    ? 420
                    : event.eventType === "PRACTICE_SAC"
                        ? 240
                        : 240;
    return Math.min(1800, base + Math.max(0, event.daysUntil) * eventWeight(event.eventType) * 12);
};
const isEnglishSubject = (subject) => /english|eal/i.test(subject);
const isBusinessSubject = (subject) => /business/i.test(subject);
const isGeneralMathSubject = (subject) => /general mathematics|general maths|math/i.test(subject);
const isSoftwareSubject = (subject) => /software/i.test(subject);
const isDataAnalyticsSubject = (subject) => /data analytics|data analysis/i.test(subject);
const isFrameworkTopic = (topic) => /framework|creating text|creating texts|mentor text|written explanation/i.test(topic);
const isBusinessChangeTopic = (topic) => /change|driving|restraining|kpi|leadership|transform/i.test(topic);
const isBusinessHrTopic = (topic) => /human resource|hrm|motivation|training|performance|employee|termination|dispute/i.test(topic);
const isBusinessOpsTopic = (topic) => /operations|materials|technology|csr|quality|waste|productivity/i.test(topic);
const businessLens = (topic) => {
    if (isBusinessChangeTopic(topic))
        return "change-management";
    if (isBusinessHrTopic(topic))
        return "human-resources";
    if (isBusinessOpsTopic(topic))
        return "operations";
    return "business-foundations";
};
const mathsLens = (topic) => {
    if (/network|critical path|minimum spanning|flow|matching/i.test(topic))
        return "networks";
    if (/matrix|matrices|transition/i.test(topic))
        return "matrices";
    if (/finance|loan|annuit|recursion|investment|depreciation/i.test(topic))
        return "financial recursion";
    if (/data|statistic|regression|association|probability|normal|sample/i.test(topic))
        return "data and probability";
    return "mixed exam skills";
};
const softwareLens = (topic) => {
    if (/algorithm|pseudocode|program|code|function|trace/i.test(topic))
        return "algorithms";
    if (/design|mockup|data dictionary|structure|database|interface/i.test(topic))
        return "solution design";
    if (/test|validation|debug|error/i.test(topic))
        return "testing and validation";
    if (/security|cyber|encryption|privacy|threat/i.test(topic))
        return "security";
    if (/evaluate|evaluation|criteria|project/i.test(topic))
        return "evaluation";
    return "problem-solving methodology";
};
const dataLens = (topic) => {
    if (/clean|manipulat|acquisition|source|integrity/i.test(topic))
        return "data acquisition and cleaning";
    if (/visual|infographic|dashboard|chart|design/i.test(topic))
        return "visualisation design";
    if (/stat|trend|pattern|finding|analysis/i.test(topic))
        return "data analysis";
    if (/security|privacy|ethical|cyber/i.test(topic))
        return "data ethics and security";
    if (/evaluate|project|criteria/i.test(topic))
        return "project evaluation";
    return "analytics project evidence";
};
const progressionStageFor = (daysToEvent, sequenceIndex) => {
    if (daysToEvent <= 1)
        return "final corrections";
    if (daysToEvent <= 3)
        return ["timed response", "marked correction", "timed response"][sequenceIndex % 3];
    if (daysToEvent <= 7)
        return ["mixed SAC-style practice", "marked correction", "command-term response"][sequenceIndex % 3];
    if (daysToEvent <= 14) {
        return ["weakest subtopic repair", "case application", "command-term response", "marked correction"][sequenceIndex % 4];
    }
    return ["concept repair", "case application", "command-term response", "marked correction"][sequenceIndex % 4];
};
const modeForProgress = (daysToEvent, subject = "", topic = "", sequenceIndex = 0) => {
    const stage = progressionStageFor(daysToEvent, sequenceIndex);
    if (isBusinessSubject(subject)) {
        const lens = businessLens(topic);
        if (stage === "concept repair")
            return `${lens} concept repair`;
        if (stage === "case application")
            return `${lens} case application`;
        if (stage === "command-term response")
            return `${lens} command-term response`;
        if (stage === "marked correction")
            return `${lens} marked correction and error log`;
        if (stage === "weakest subtopic repair")
            return `${lens} weakest subtopic repair`;
        if (stage === "mixed SAC-style practice")
            return `${lens} mixed SAC-style question set`;
        if (stage === "timed response")
            return `${lens} timed SAC response`;
        return `${lens} final corrections`;
    }
    if (isEnglishSubject(subject)) {
        const lens = isFrameworkTopic(topic) ? "framework writing" : "analytical writing";
        if (stage === "concept repair")
            return `${lens} prompt unpacking and idea repair`;
        if (stage === "case application")
            return `${lens} paragraph drafting`;
        if (stage === "command-term response")
            return `${lens} timed paragraph response`;
        if (stage === "marked correction")
            return `${lens} expression and evidence correction`;
        if (stage === "weakest subtopic repair")
            return `${lens} weakest writing move repair`;
        if (stage === "mixed SAC-style practice")
            return `${lens} mixed prompt drill`;
        if (stage === "timed response")
            return `${lens} timed SAC response`;
        return `${lens} final polish and written explanation`;
    }
    if (isGeneralMathSubject(subject)) {
        const lens = mathsLens(topic);
        if (stage === "concept repair")
            return `${lens} method rebuild`;
        if (stage === "case application")
            return `${lens} guided example to solo question`;
        if (stage === "command-term response")
            return `${lens} exam questions with interpretation`;
        if (stage === "marked correction")
            return `${lens} marked correction and error trap`;
        if (stage === "weakest subtopic repair")
            return `${lens} weakest skill rebuild`;
        if (stage === "mixed SAC-style practice")
            return `${lens} mixed retrieval set`;
        if (stage === "timed response")
            return `${lens} timed exam section`;
        return `${lens} final formula and error check`;
    }
    if (isSoftwareSubject(subject)) {
        const lens = softwareLens(topic);
        if (stage === "concept repair")
            return `${lens} scenario rule repair`;
        if (stage === "case application")
            return `${lens} artefact build`;
        if (stage === "command-term response")
            return `${lens} command-term scenario answer`;
        if (stage === "marked correction")
            return `${lens} justification correction`;
        if (stage === "weakest subtopic repair")
            return `${lens} weakest design decision repair`;
        if (stage === "mixed SAC-style practice")
            return `${lens} mixed VCAA scenario set`;
        if (stage === "timed response")
            return `${lens} timed scenario response`;
        return `${lens} final testing and evaluation pass`;
    }
    if (isDataAnalyticsSubject(subject)) {
        const lens = dataLens(topic);
        if (stage === "concept repair")
            return `${lens} data decision repair`;
        if (stage === "case application")
            return `${lens} evidence artefact build`;
        if (stage === "command-term response")
            return `${lens} findings response`;
        if (stage === "marked correction")
            return `${lens} evidence and evaluation correction`;
        if (stage === "weakest subtopic repair")
            return `${lens} weakest analysis link repair`;
        if (stage === "mixed SAC-style practice")
            return `${lens} mixed interpretation set`;
        if (stage === "timed response")
            return `${lens} timed data response`;
        return `${lens} final ethics and evaluation check`;
    }
    return modeForDays(daysToEvent, subject, topic);
};
const modeForDays = (daysToEvent, subject = "", topic = "") => {
    if (isEnglishSubject(subject)) {
        if (daysToEvent <= 1)
            return "polish written explanation and final edits";
        if (daysToEvent <= 3)
            return "timed response and written explanation";
        if (daysToEvent <= 7)
            return isFrameworkTopic(topic) ? "mentor text imitation and drafting" : "essay paragraph practice";
        if (daysToEvent <= 14)
            return isFrameworkTopic(topic) ? "idea bank and mentor text annotations" : "essay plan and evidence bank";
        return isFrameworkTopic(topic) ? "framework of ideas planning" : "text response planning";
    }
    if (isBusinessSubject(subject)) {
        if (daysToEvent <= 1)
            return "command-term corrections and 10-mark plan";
        if (daysToEvent <= 3)
            return "timed case-study response";
        if (daysToEvent <= 7)
            return "VCAA-style question set and marking";
        if (daysToEvent <= 14)
            return "case application and evaluation drills";
        return `${businessLens(topic)} terminology and case bank`;
    }
    if (isGeneralMathSubject(subject)) {
        if (daysToEvent <= 1)
            return "formula conditions and error corrections";
        if (daysToEvent <= 3)
            return "timed multi-part exam set";
        if (daysToEvent <= 7)
            return `${mathsLens(topic)} exam questions`;
        if (daysToEvent <= 14)
            return `${mathsLens(topic)} worked examples and error log`;
        return `${mathsLens(topic)} skill map and calculator steps`;
    }
    if (isSoftwareSubject(subject)) {
        if (daysToEvent <= 1)
            return "testing and evaluation corrections";
        if (daysToEvent <= 3)
            return "timed scenario response";
        if (daysToEvent <= 7)
            return `${softwareLens(topic)} VCAA question set`;
        if (daysToEvent <= 14)
            return `${softwareLens(topic)} artefact drills`;
        return `${softwareLens(topic)} documentation bank`;
    }
    if (isDataAnalyticsSubject(subject)) {
        if (daysToEvent <= 1)
            return "findings and evaluation corrections";
        if (daysToEvent <= 3)
            return "timed data interpretation response";
        if (daysToEvent <= 7)
            return `${dataLens(topic)} VCAA question set`;
        if (daysToEvent <= 14)
            return `${dataLens(topic)} project artefact drills`;
        return `${dataLens(topic)} evidence bank`;
    }
    if (daysToEvent <= 1)
        return "light recall and corrections";
    if (daysToEvent <= 3)
        return "timed practice";
    if (daysToEvent <= 7)
        return "exam questions";
    if (daysToEvent <= 14)
        return "worked examples and active recall";
    return "notes and topic map";
};
const outputForMode = (mode, subject = "", topic = "") => {
    if (isEnglishSubject(subject)) {
        if (mode.includes("prompt unpacking"))
            return "Prompt breakdown, five idea angles and one assessor-focus sentence";
        if (mode.includes("paragraph drafting"))
            return "One drafted paragraph with two deliberate craft/analysis choices";
        if (mode.includes("timed paragraph") || mode.includes("timed SAC"))
            return "Timed response section, self-marked for clarity, evidence and prompt relevance";
        if (mode.includes("correction") || mode.includes("weakest"))
            return "One upgraded paragraph with sharper evidence, expression and a note for next time";
        if (mode.includes("mixed prompt"))
            return "Three mini plans, three opening sentences and one chosen best plan";
        if (mode.includes("final polish"))
            return "Final edit checklist plus written explanation or analysis notes";
        if (mode.includes("written explanation"))
            return "Timed creative/analytical piece plus a written explanation of authorial choices";
        if (mode.includes("mentor"))
            return "Annotated mentor-text moves and one drafted paragraph in the chosen framework";
        if (mode.includes("idea bank") || mode.includes("framework"))
            return "Framework idea bank, audience-purpose-context grid, and thesis/voice options";
        if (mode.includes("essay plan"))
            return "Essay contention, paragraph plan, evidence bank and topic sentences";
        if (mode.includes("paragraph"))
            return "Two TEEL-style analytical paragraphs with feedback fixes";
        if (isFrameworkTopic(topic))
            return "Framework of Ideas plan, mentor-text annotations and a written explanation outline";
        return "Essay plan, evidence bank and timed paragraph";
    }
    if (isBusinessSubject(subject)) {
        if (mode.includes("final corrections"))
            return "Top 3 error-log fixes, one model sentence for each and a 5-minute SAC checklist";
        if (mode.includes("timed"))
            return "One timed 6-10 mark case-study response plus self-marked corrections";
        if (mode.includes("question set"))
            return "Three SAC-style questions with different command terms and one corrected redo";
        if (mode.includes("weakest"))
            return "Weakest-subtopic table with definition, case example, advantage, limitation and one repair paragraph";
        if (mode.includes("marked correction"))
            return "One corrected previous answer, clearer command-term sentence and error-log entry";
        if (mode.includes("command-term"))
            return "One 6-10 mark response plan, command-term checklist and corrected final paragraph";
        if (mode.includes("case application"))
            return "One new business case, stakeholder/KPI link, cause-effect notes and limitation";
        if (mode.includes("concept repair") || mode.includes("terminology"))
            return "5 hard terms, misconception notes and closed-book oral recall check";
        if (mode.includes("evaluation"))
            return "Two-case application table, advantages/limitations and one evaluate paragraph";
        if (isBusinessChangeTopic(topic))
            return "KPI/change strategy cause-effect chain, two stakeholder impacts and one evaluation paragraph";
        if (isBusinessHrTopic(topic))
            return "HR strategy comparison table, one applied case-study paragraph and corrections";
        if (isBusinessOpsTopic(topic))
            return "Operations strategy application table, two stakeholder impacts and one case paragraph";
        return "8-term business bank, 2 case examples and one analyse/evaluate paragraph";
    }
    if (isGeneralMathSubject(subject)) {
        if (mode.includes("method rebuild"))
            return "Four-step method card with calculator/CAS setup and one easy example";
        if (mode.includes("guided example"))
            return "One guided example, one solo question and a confidence-drop note";
        if (mode.includes("exam questions") || mode.includes("mixed retrieval"))
            return "Four mixed exam questions with every missed mark categorised";
        if (mode.includes("marked correction") || mode.includes("weakest"))
            return "Redo of one error plus a new trap question for the same mistake";
        if (mode.includes("timed"))
            return "Timed exam section marked for method, timing and communication";
        if (mode.includes("final formula"))
            return "Formula/condition checklist and top error redo";
        if (mode.includes("formula conditions"))
            return "Formula/condition list, corrected error log and two redo questions";
        if (mode.includes("timed"))
            return "Timed exam set with full working, calculator/CAS notes and final conclusions";
        if (mode.includes("worked examples"))
            return "Worked examples, calculator/CAS steps, common errors and redo set";
        if (mode.includes("skill map"))
            return "Skill map, formula conditions, calculator/CAS steps and mixed retrieval questions";
        return "Exam questions with working, interpretation and error corrections";
    }
    if (isSoftwareSubject(subject)) {
        if (mode.includes("scenario rule"))
            return "Rule sheet with tiny scenario examples and a closed-book explanation";
        if (mode.includes("artefact build"))
            return "One technical artefact labelled with user need plus a justification sentence";
        if (mode.includes("command-term"))
            return "One scenario answer using the exact command term and scenario evidence";
        if (mode.includes("justification correction") || mode.includes("weakest"))
            return "Rewritten technical explanation plus test, validation or evaluation detail";
        if (mode.includes("mixed VCAA"))
            return "Three scenario prompts and one corrected redo";
        if (mode.includes("timed"))
            return "Timed scenario response with marking corrections";
        if (mode.includes("final testing"))
            return "Final testing, validation and evaluation checklist";
        if (mode.includes("testing"))
            return "Test table, validation notes, evaluation criteria and corrected scenario response";
        if (mode.includes("timed"))
            return "Timed scenario response with design justification and marking corrections";
        if (mode.includes("question set"))
            return "VCAA-style questions, pseudocode/design evidence and self-marked corrections";
        if (mode.includes("artefact"))
            return "Requirements/design artefact, pseudocode or test cases plus justification notes";
        if (mode.includes("documentation"))
            return "Problem-solving-methodology evidence bank and technical artefact checklist";
        return "Technical artefact plus VCAA command-term explanation";
    }
    if (isDataAnalyticsSubject(subject)) {
        if (mode.includes("data decision"))
            return "Data decision note with one risk, consequence and mitigation";
        if (mode.includes("evidence artefact"))
            return "One data artefact annotated for audience, purpose and limitation";
        if (mode.includes("findings response") || mode.includes("mixed interpretation"))
            return "Three interpretation prompts and one corrected evidence link";
        if (mode.includes("evidence and evaluation") || mode.includes("weakest"))
            return "Upgraded finding/evaluation sentence with missing limitation or ethics point";
        if (mode.includes("timed"))
            return "Timed data response marked for evidence and justification";
        if (mode.includes("final ethics"))
            return "Final ethics, security and evaluation checklist";
        if (mode.includes("findings"))
            return "Findings paragraph, evaluation fixes and security/ethics checklist";
        if (mode.includes("timed"))
            return "Timed data interpretation response with visualisation evidence and corrections";
        if (mode.includes("question set"))
            return "VCAA-style data questions, visualisation critique and marking corrections";
        if (mode.includes("artefact"))
            return "Data dictionary, cleaning log, visualisation sketch or analysis notes";
        if (mode.includes("evidence bank"))
            return "Analytics evidence bank, data-cleaning decisions and visualisation rationale";
        return "Data artefact plus interpretation/evaluation response";
    }
    if (mode.includes("notes"))
        return "Clean notes, formula list, or concept map";
    if (mode.includes("worked"))
        return "Worked examples plus a mini error log";
    if (mode.includes("exam"))
        return "Generated questions and marked corrections";
    if (mode.includes("timed"))
        return "Timed response set and fixes";
    return "One-page recall sheet";
};
const taskTitleFor = (subject, topic, mode) => {
    if (isEnglishSubject(subject)) {
        if (isFrameworkTopic(topic))
            return `Framework of Ideas: ${mode}`;
        return `English response: ${mode}`;
    }
    if (isBusinessSubject(subject)) {
        const lens = businessLens(topic);
        if (lens === "change-management")
            return `Business change: ${mode}`;
        if (lens === "human-resources")
            return `HRM case application: ${mode}`;
        if (lens === "operations")
            return `Operations strategy: ${mode}`;
        return `Business case study: ${mode}`;
    }
    if (isGeneralMathSubject(subject))
        return `General Maths ${mathsLens(topic)}: ${mode}`;
    if (isSoftwareSubject(subject))
        return `Software ${softwareLens(topic)}: ${mode}`;
    if (isDataAnalyticsSubject(subject))
        return `Data Analytics ${dataLens(topic)}: ${mode}`;
    return `${topic}: ${mode}`;
};
const reasonForTask = (event, daysToEvent, blockSource) => {
    const timing = event.eventType === "STUDY"
        ? "No assessment is logged for this block, so it keeps subject momentum."
        : `${event.eventType} "${event.title}" is ${daysToEvent === 0 ? "today" : `in ${daysToEvent} days`}.`;
    if (isBusinessSubject(event.subject)) {
        return `${blockSource ? `Fits your ${blockSource} study block. ` : ""}${timing} Business work is focused on VCAA command terms, case application and evaluation, not formulas.`;
    }
    if (isEnglishSubject(event.subject)) {
        return `${blockSource ? `Fits your ${blockSource} study block. ` : ""}${timing} English work is focused on drafting, analysis and written expression.`;
    }
    if (isGeneralMathSubject(event.subject)) {
        return `${blockSource ? `Fits your ${blockSource} study block. ` : ""}${timing} General Maths work is focused on method, conditions, interpretation and correcting errors.`;
    }
    if (isSoftwareSubject(event.subject)) {
        return `${blockSource ? `Fits your ${blockSource} study block. ` : ""}${timing} Software work is focused on technical artefacts, scenario justification and evaluation.`;
    }
    if (isDataAnalyticsSubject(event.subject)) {
        return `${blockSource ? `Fits your ${blockSource} study block. ` : ""}${timing} Data Analytics work is focused on data artefacts, interpretation, visualisation and evaluation.`;
    }
    return blockSource ? `${timing} This uses your calendar study time.` : timing;
};
const studyDesignFocusFor = (event) => {
    if (isBusinessSubject(event.subject)) {
        return `Use the ${event.topic} area of the Business Management study design, then practise VCAA command terms through case application, stakeholder/KPI links, advantages/limitations and evaluate-style paragraphs.`;
    }
    if (isEnglishSubject(event.subject)) {
        return isFrameworkTopic(event.topic)
            ? `Use the English Creating texts study design focus: Framework of Ideas, mentor texts, audience, purpose, context, form, voice, language choices and written explanation.`
            : `Use the English study design focus on close analysis, evidence, audience, purpose, context, expression and structured written responses.`;
    }
    if (isGeneralMathSubject(event.subject)) {
        return `Use the ${event.topic} area of the General Mathematics study design, then practise methods with formula conditions, calculator/CAS steps, interpretation and corrected errors.`;
    }
    if (isSoftwareSubject(event.subject)) {
        return `Use the ${event.topic} area of the Software Development study design, then produce technical artefacts, justify design decisions and mark scenario responses.`;
    }
    if (isDataAnalyticsSubject(event.subject)) {
        return `Use the ${event.topic} area of the Data Analytics study design, then produce data artefacts, interpret findings, justify visualisations and evaluate decisions.`;
    }
    return `Use the ${event.topic} parts of the study design, then turn them into targeted recall, practice responses and corrections.`;
};
const dailyFocusFor = (event) => {
    if (isBusinessSubject(event.subject)) {
        return [
            "Build a terminology and contemporary example bank for the exact topic.",
            "Practise applying concepts to a case study using VCAA command terms.",
            "Write analyse/compare/evaluate paragraphs with advantages and limitations.",
            "Mark against criteria, rewrite weak links and update the mistake log."
        ];
    }
    if (isEnglishSubject(event.subject)) {
        return isFrameworkTopic(event.topic)
            ? [
                "Annotate mentor text moves for form, voice, audience and purpose.",
                "Build a Framework of Ideas angle bank with possible prompts and contexts.",
                "Draft and edit a paragraph or section with deliberate language choices.",
                "Write a short written explanation justifying authorial choices."
            ]
            : [
                "Build contention, evidence and topic sentence options.",
                "Write close-analysis paragraph drills.",
                "Practise timed response structure and expression.",
                "Edit for clarity, specificity and evidence integration."
            ];
    }
    if (isGeneralMathSubject(event.subject)) {
        return [
            "Identify formulas, conditions and calculator/CAS steps for the exact topic.",
            "Complete worked examples with full working and contextual conclusions.",
            "Do mixed exam questions and mark every step against the solution.",
            "Rewrite errors into an error log and redo one similar question."
        ];
    }
    if (isSoftwareSubject(event.subject)) {
        return [
            "Build or refine a technical artefact: requirements, design, pseudocode or tests.",
            "Practise scenario-based VCAA questions using command terms.",
            "Justify design/security/testing decisions with precise terminology.",
            "Mark the response and update the project/evaluation checklist."
        ];
    }
    if (isDataAnalyticsSubject(event.subject)) {
        return [
            "Build or refine a data artefact: dictionary, cleaning log, visualisation or findings.",
            "Practise interpreting data and justifying visualisation choices.",
            "Answer security, ethics and evaluation prompts with scenario evidence.",
            "Mark corrections and update the analytics evidence bank."
        ];
    }
    return [
        "Build or tidy the topic notes from the study design and uploaded resources.",
        "Make active recall prompts and worked examples.",
        "Generate VCE-style questions and mark them against criteria.",
        "Redo mistakes and finish with timed retrieval."
    ];
};
const studyBlocksForDay = (input, day) => input.studyBlocks.filter((block) => block.date === day);
const mockPlan = (input) => {
    const start = new Date(`${input.planDate}T00:00:00.000Z`);
    const sortedEvents = [...input.events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    const lastEventDate = sortedEvents[sortedEvents.length - 1]?.eventDate;
    const sortedStudyBlocks = [...input.studyBlocks].sort((a, b) => a.date.localeCompare(b.date));
    const lastStudyBlockDate = sortedStudyBlocks[sortedStudyBlocks.length - 1]?.date;
    const lastPlannedDate = [lastEventDate, lastStudyBlockDate].filter(Boolean).sort().at(-1);
    const eventSpan = lastPlannedDate ? daysBetween(input.planDate, lastPlannedDate) + 1 : 7;
    const daysToPlan = Math.max(1, Math.min(input.horizonDays, eventSpan || input.horizonDays));
    const sourceEvents = [
        ...sortedEvents.map((event) => ({
            id: event.id,
            title: event.title,
            subject: event.subject,
            event_type: event.eventType,
            event_date: event.eventDate,
            topic: event.topic,
            days_until: event.daysUntil
        })),
        ...input.studyBlocks
            .filter((block, index, blocks) => blocks.findIndex((candidate) => candidate.id === block.id) === index)
            .map((block) => ({
            id: block.id,
            title: block.title,
            subject: block.subject,
            event_type: "STUDY_TIME",
            event_date: `${block.date} ${block.startTime}-${block.endTime}`,
            topic: block.source,
            days_until: daysBetween(input.planDate, block.date)
        }))
    ];
    const subjectRoadmaps = sortedEvents.map((event) => ({
        subject: event.subject,
        assessment_title: event.title,
        assessment_type: event.eventType,
        assessment_date: event.eventDate,
        topic: event.topic,
        days_until: event.daysUntil,
        recommended_total_minutes: eventMinutes(event),
        study_design_focus: studyDesignFocusFor(event),
        daily_focus: dailyFocusFor(event)
    }));
    const dailyPlan = Array.from({ length: daysToPlan }, (_, dayIndex) => {
        const day = dateKey(addDays(start, dayIndex));
        const dayStudyBlocks = studyBlocksForDay(input, day);
        const activeEvents = sortedEvents
            .filter((event) => event.eventDate >= day)
            .map((event) => ({
            event,
            daysToEvent: daysBetween(day, event.eventDate),
            score: eventWeight(event.eventType) / Math.max(1, daysBetween(day, event.eventDate) + 1)
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(3, Math.max(1, sortedEvents.length)));
        const fallbackSubjects = input.subjects.slice(0, 2).map((subject, index) => ({
            event: {
                id: `subject-${index}`,
                title: "General weekly study",
                eventType: "STUDY",
                eventDate: day,
                subject,
                topic: "current class content",
                daysUntil: 0
            },
            daysToEvent: 7,
            score: 1
        }));
        const targets = activeEvents.length ? activeEvents : fallbackSubjects;
        const minutesPerTask = Math.max(20, Math.floor(input.availableMinutes / Math.max(1, targets.length)));
        const flexibleTasks = targets.map(({ event, daysToEvent }, targetIndex) => {
            const mode = modeForProgress(daysToEvent, event.subject, event.topic, dayIndex + targetIndex);
            return {
                date: day,
                title: taskTitleFor(event.subject, event.topic, mode),
                subject: event.subject,
                minutes: minutesPerTask,
                mode,
                reason: reasonForTask(event, daysToEvent),
                topic: event.topic,
                assessment_title: event.title,
                assessment_date: event.eventDate,
                event_type: event.eventType,
                output: outputForMode(mode, event.subject, event.topic),
                time_window: "Flexible"
            };
        });
        const tasks = dayStudyBlocks.length
            ? dayStudyBlocks.map((block, blockIndex) => {
                const target = targets[blockIndex % targets.length] ?? targets[0];
                const mode = modeForProgress(target.daysToEvent, target.event.subject, target.event.topic, dayIndex + blockIndex);
                return {
                    date: day,
                    title: taskTitleFor(target.event.subject, target.event.topic, mode),
                    subject: target.event.subject,
                    minutes: Math.max(10, block.durationMinutes),
                    mode,
                    reason: reasonForTask(target.event, target.daysToEvent, block.source),
                    topic: target.event.topic,
                    assessment_title: target.event.title,
                    assessment_date: target.event.eventDate,
                    event_type: target.event.eventType,
                    output: outputForMode(mode, target.event.subject, target.event.topic),
                    time_window: `${block.startTime}-${block.endTime}`
                };
            })
            : flexibleTasks;
        return {
            date: day,
            total_minutes: tasks.reduce((sum, task) => sum + task.minutes, 0),
            focus: dayStudyBlocks.length
                ? `${dayStudyBlocks.length} scheduled study block${dayStudyBlocks.length === 1 ? "" : "s"}`
                : tasks[0]?.assessment_title ?? "General study",
            tasks,
            checkpoint: "Finish by writing what still feels weak so the next plan can adapt."
        };
    });
    const tasks = dailyPlan.flatMap((day) => day.tasks);
    const summary = sortedEvents.length
        ? `Built from ${sortedEvents.length} upcoming calendar assessment${sortedEvents.length === 1 ? "" : "s"}, starting with the closest SAC/SAT/exam and working backwards day by day.`
        : "No upcoming calendar assessments were found, so this roadmap keeps each subject moving with notes, recall and practice.";
    return {
        summary,
        focus_areas: subjectRoadmaps.length
            ? subjectRoadmaps.map((roadmap) => `${roadmap.subject}: ${roadmap.topic} for ${roadmap.assessment_type} on ${roadmap.assessment_date}`)
            : input.subjects.map((subject) => isBusinessSubject(subject)
                ? `${subject}: terminology, case application and command-term practice`
                : isEnglishSubject(subject)
                    ? `${subject}: writing craft, evidence and timed responses`
                    : isGeneralMathSubject(subject)
                        ? `${subject}: worked methods, calculator steps and error correction`
                        : isSoftwareSubject(subject)
                            ? `${subject}: technical artefacts, scenarios and evaluation`
                            : isDataAnalyticsSubject(subject)
                                ? `${subject}: data artefacts, visualisation and evaluation`
                                : `${subject}: targeted recall and mixed practice`),
        tasks,
        daily_plan: dailyPlan,
        subject_roadmaps: subjectRoadmaps,
        source_events: sourceEvents,
        checkpoints: [
            "Each day: produce something markable, not just passive revision.",
            "After practice: mark mistakes and turn them into tomorrow's correction block.",
            "Two days before a SAC/SAT/exam: switch from learning content to timed responses and corrections."
        ]
    };
};
const fallbackDailyInspirations = [
    {
        quote: "Small honest effort beats dramatic panic.",
        tip: "Start with the question you most want to avoid; it usually points straight at the next mark.",
        action: "Spend 12 minutes fixing one weak point, then write the corrected version from memory."
    },
    {
        quote: "You do not need a perfect day, just a useful next block.",
        tip: "Marking your own work is revision too. Keep the mistake, the rule, and the corrected answer together.",
        action: "Choose one saved question and add a two-line mistake log."
    },
    {
        quote: "Confidence is built in receipts, not moods.",
        tip: "Make each session produce evidence: a paragraph, a worked example, a marked answer, or a tiny plan.",
        action: "Before you stop, write the exact thing you produced today."
    },
    {
        quote: "A calm repeat is still progress.",
        tip: "If a topic feels messy, reduce it to three words: definition, method, example.",
        action: "Turn one messy page of notes into three closed-book prompts."
    },
    {
        quote: "The next mark is usually hiding in the correction.",
        tip: "Do not just read the model answer. Compare it sentence by sentence with yours.",
        action: "Rewrite one answer using the marking criteria as a checklist."
    }
];
const hashString = (value) => [...value].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 2166136261);
const mockDailyInspiration = (input) => {
    const base = fallbackDailyInspirations[hashString(`${input.date}:${input.subjects.join("|")}`) % fallbackDailyInspirations.length];
    const nextEvent = [...input.upcomingEvents].sort((a, b) => a.daysUntil - b.daysUntil)[0];
    const subject = input.subjects[hashString(input.date) % Math.max(1, input.subjects.length)] ?? "your hardest subject";
    if (nextEvent && nextEvent.daysUntil <= 7) {
        return {
            quote: base.quote,
            tip: `${nextEvent.title} is close. Keep revision active: attempt, mark, correct, then repeat the weakest bit.`,
            action: `Do one ${nextEvent.subject} task for ${nextEvent.eventType.toLowerCase()} prep today.`
        };
    }
    if ((input.todayMinutes ?? 0) > 0) {
        return {
            quote: base.quote,
            tip: "You have already started today. Use the next block to consolidate instead of scattering your focus.",
            action: `Add one quick recall check for ${subject}.`
        };
    }
    return base;
};
const buildDailyInspirationPrompt = (input) => `You are a calm VCE study coach for a Year 12 student in Melbourne.

Date: ${input.date}
Student: ${input.displayName ?? "Student"}
Subjects: ${input.subjects.join(", ") || "No subjects supplied"}
Current streak: ${input.currentStreak ?? 0}
Minutes studied today: ${input.todayMinutes ?? 0}
Upcoming assessments:
${input.upcomingEvents
    .map((event) => `- ${event.daysUntil} days: ${event.eventType} - ${event.subject} - ${event.title}`)
    .join("\n") || "- None logged"}

Create one fresh daily home-screen study card.
Rules:
- Keep it simple, grounded and not cringe.
- The quote must be original, not attributed to a real person.
- The tip should be practical for VCE study.
- The action should be one tiny thing the student can do today.
- Avoid long motivational speeches.

Return only valid JSON with:
- quote
- tip
- action`;
const modelSupportsReasoning = (model) => /^(gpt-5|o\d|o[1-4]|computer-use)/.test(model);
export const generateDailyInspiration = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return mockDailyInspiration(input);
    }
    try {
        const model = process.env.OPENAI_MODEL ?? defaultModel;
        const openai = new OpenAI({ apiKey });
        const response = await openai.responses.parse({
            model,
            input: buildDailyInspirationPrompt(input),
            max_output_tokens: 650,
            store: false,
            reasoning: modelSupportsReasoning(model) ? { effort: "low" } : undefined,
            text: {
                verbosity: "low",
                format: zodTextFormat(dailyInspirationSchema, "daily_vce_inspiration")
            }
        });
        const parsed = response.output_parsed;
        if (!parsed) {
            throw new Error("OpenAI returned an empty or unparseable daily inspiration payload");
        }
        return parsed;
    }
    catch (error) {
        console.warn("Falling back to deterministic daily inspiration", error);
        return mockDailyInspiration(input);
    }
};
export const generatePracticeQuestions = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return sanitiseGeneratedQuestions(input, mockQuestions(input));
    }
    const model = process.env.OPENAI_MODEL ?? defaultModel;
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.parse({
        model,
        input: buildPrompt(input),
        max_output_tokens: 2500,
        store: false,
        reasoning: modelSupportsReasoning(model) ? { effort: "low" } : undefined,
        text: {
            verbosity: "medium",
            format: zodTextFormat(generatedQuestionsResponseSchema, "vce_practice_questions")
        }
    });
    const parsed = response.output_parsed;
    if (!parsed) {
        throw new Error("OpenAI returned an empty or unparseable question payload");
    }
    return sanitiseGeneratedQuestions(input, parsed.questions);
};
const buildAnswerFeedbackPrompt = (input) => `You are a strict but encouraging VCE marker.

Subject: ${input.subject ?? "VCE subject"}
Topic: ${input.topic ?? "Not supplied"}
Marks available: ${input.marks}

Question:
${input.question}

Student answer:
${input.studentAnswer}

Model answer:
${input.modelAnswer}

Marking criteria:
${input.markingCriteria.map((criterion) => `- ${criterion}`).join("\n") || "- No criteria supplied"}

Grade the answer for VCE exam practice. Be fair, specific and concise.
Return only valid JSON with:
- score: 0 to 100
- awarded_marks
- max_marks
- verdict: one of needs_work, close, strong, excellent
- strengths: string[]
- improvements: string[]
- next_step: one practical sentence the student should do next`;
const buildLearningSignalPrompt = (input) => {
    const payloadText = input.payload === undefined
        ? "No structured payload."
        : JSON.stringify(input.payload, null, 2).replace(/\s+/g, " ").slice(0, 4000);
    return `You are the memory extraction layer for a VCE student study app.

Convert this app activity into 1 to 3 durable learning signals. A signal should describe something the app should remember for future coaching, planning and exam-risk prediction. Do not invent facts beyond the evidence.

Event type: ${input.eventType}
Subject: ${input.subject ?? "Unknown"}
Topic: ${input.topic ?? "Unknown"}
Summary:
${input.summary}

Evidence:
${input.evidence || "No extra evidence supplied."}

Structured payload:
${payloadText}

Signal rules:
- Prefer specific weaknesses, strengths, recurring topics, saved mistakes, assessment risk, study behaviour, resource context, or next action.
- If the evidence shows confusion or lost marks, create a weakness or mistake signal.
- If the evidence shows a strong answer, create a strength signal.
- If the event is just asking, generating or uploading, create a topic_interest or resource_context signal unless a clearer weakness is visible.
- Keep evidence short and concrete, like "Asked for evaluation criteria and needed clarification".
- next_action must be something the student can do in one study block.
- weight is 1 low importance, 5 high importance.

Return only valid JSON with:
- signals: array of { signal_type, subject, topic, title, detail, evidence, confidence, next_action, weight }`;
};
export const extractLearningSignalsFromMemoryEvent = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return mockLearningSignals(input);
    }
    try {
        const model = process.env.OPENAI_MODEL ?? defaultModel;
        const openai = new OpenAI({ apiKey });
        const response = await openai.responses.parse({
            model,
            input: buildLearningSignalPrompt(input),
            max_output_tokens: 1100,
            store: false,
            reasoning: modelSupportsReasoning(model) ? { effort: "low" } : undefined,
            text: {
                verbosity: "low",
                format: zodTextFormat(learningSignalsResponseSchema, "student_learning_signals")
            }
        });
        return response.output_parsed?.signals.length ? response.output_parsed.signals : mockLearningSignals(input);
    }
    catch (error) {
        console.warn("Falling back to deterministic learning signal extraction", error);
        return mockLearningSignals(input);
    }
};
export const evaluateStudentAnswer = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return mockAnswerFeedback(input);
    }
    const model = process.env.OPENAI_MODEL ?? defaultModel;
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.parse({
        model,
        input: buildAnswerFeedbackPrompt(input),
        max_output_tokens: 1200,
        store: false,
        reasoning: modelSupportsReasoning(model) ? { effort: "low" } : undefined,
        text: {
            verbosity: "medium",
            format: zodTextFormat(answerFeedbackSchema, "vce_answer_feedback")
        }
    });
    const parsed = response.output_parsed;
    if (!parsed) {
        throw new Error("OpenAI returned an empty or unparseable answer feedback payload");
    }
    return {
        ...parsed,
        max_marks: input.marks,
        awarded_marks: Math.min(input.marks, Math.max(0, parsed.awarded_marks))
    };
};
const buildPlanPrompt = (input) => `You are an adaptive VCE study planner for a Year 12 student in Melbourne.

Build an automatic daily roadmap starting on ${input.planDate}. The student can study about ${input.availableMinutes} minutes per day. Plan up to ${input.horizonDays} days, but stop naturally after the relevant upcoming assessments.
Subjects: ${input.subjects.join(", ") || "No subjects supplied"}
${input.priority ? `Student priority: ${input.priority}` : ""}

Study design context by subject:
${input.subjects
    .map((subject) => {
    const studyDesign = getStudyDesignContext(subject);
    return `### ${subject}\nCoverage: ${studyDesignCoverageLabel(studyDesign)}\n${studyDesign.context}\nSource: ${studyDesign.source}`;
})
    .join("\n\n")}

Study design reliability rules:
- Treat each subject's study-design context as the first authority, then uploaded notes/resources, then general VCE knowledge.
- When a subject is marked "generic subject-family fallback only", do not claim exact VCAA dot points, Areas of Study, unit boundaries, required terminology or prescribed content unless uploaded notes/resources prove them.
- Do not invent VCAA dates, formulas, statistics, teacher requirements or prescribed content.
- If the evidence is weak, make the task wording conservative instead of sounding certain.

Upcoming calendar assessments, already sorted by date:
${input.events
    .map((event) => `- ${event.eventDate} (${event.daysUntil} days): ${event.eventType} - ${event.subject} - ${event.title}. Topic clue: ${event.topic}. ${event.description ? `Description: ${event.description}` : ""}`)
    .join("\n") || "No upcoming calendar assessments logged."}

Scheduled study blocks from the student's calendar:
${input.scheduledStudyBlocks || "No scheduled study blocks logged. Use the fallback daily minutes."}

Recent class reflections:
${input.recentReflections || "No reflections logged yet."}

Student memory map and extracted learning signals:
${input.studentMemoryContext || "No student memory map has been built yet."}

Calendar summary:
${input.upcomingEvents || "No upcoming events logged."}

Recent study sessions:
${input.recentSessions || "No recent sessions logged."}

Student notes:
${input.notesContext || "No notes yet."}

Uploaded textbook / Obsidian context:
${input.resourceContext || "No uploaded resources yet."}

Make the plan seamless and assessment-first:
- First use the calendar SACs, SATs, exams and tasks to decide priority.
- Treat SAC/SAT as real assessments. Treat PRACTICE_SAC/PRACTICE_SAT as lower-stakes rehearsal checkpoints that support the nearest real SAC/SAT/exam.
- Treat the event title and description as the topic clue, then align it to the subject's study design and uploaded textbook/notes context.
- When a subject only has generic fallback context, make tasks skill/topic based and avoid exact VCAA dot-point claims unless the student's notes or uploaded resources supply them.
- Work backwards from each assessment date and calculate what to do each day.
- If scheduled study blocks exist for a day, treat those windows as the actual available time and place work inside them.
- Respect fortnightly week 1 / week 2 study blocks exactly as listed.
- Split time across subjects based on urgency, assessment type and days remaining.
- Include only tasks that fit the subject. Use generated VCE-style questions, marking, corrections and timed practice, but do not force "notes", "worked examples" or "formula" language into subjects where it does not belong.
- Keep daily work realistic for the available minutes.
- If several assessments compete, prioritise the closest and highest-stakes one while keeping small maintenance blocks for the others.
- Prioritise things the student did not understand in class.
- Include active recall, exam-style practice, corrections and short review blocks.
- Do not repeat the same task pattern on consecutive days for the same assessment. Build a progression: first repair understanding, then apply to a case/problem, then write exam-style responses, then mark mistakes and revisit the weakest link.
- If a similar topic appears again, make the next task depend on the previous output: use a different case/example, a different command term, a timed version, a correction pass, or a harder mixed question set.
- Every task should feel like a tutoring move, not a generic chore. It should answer: what exactly do I produce, what do I compare it against, and how does it make tomorrow's task smarter?
- Use recent reflections, notes and uploaded resources to personalise the work. If the student says something did not click, make a repair task before asking for timed practice.
- Avoid consecutive duplicate titles, modes, outputs or checkpoints for the same subject. If the same assessment appears repeatedly, each day must visibly change the learning stage.
- For General Mathematics, prefer worked examples, formula conditions, calculator/CAS steps, error logs and mixed retrieval.
- For Business Management, do not use formulas, calculation drills or economics-style graph work. Use terminology banks, contemporary case examples, stakeholder/KPI links, management strategy comparison, advantages/limitations, command-term unpacking, case-study application, 6-10 mark response plans and evaluate-style paragraphs.
- For English, do not use formula lists, calculation-style worked examples or generic concept maps. Use essay-writing actions: close reading, contention/thesis, paragraph scaffolds, quote/evidence banks, language-feature analysis, mentor text annotations, drafting, editing, timed paragraphs, full timed responses and written explanation/commentary.
- Make titles specific: avoid generic titles like "notes and topic map" unless the subject genuinely needs that. Name the skill being practised and the expected output.
- Make every task understandable on its own: include a count or concrete scope where possible, such as "8 key terms", "2 contemporary examples", "one 6-10 mark response", "3 exam questions", "one drafted paragraph" or "one test table".
- The output field must name the thing the student physically produces and how they check it. Avoid vague outputs like "case bank" unless it also says how many examples and what response/correction follows.
- For an English "frameworks", "framework of ideas" or "creating texts" SAC, align it to the English study design's Creating texts area: Framework of Ideas, mentor texts, audience, purpose, context, form, voice, language choices, drafting/editing, and written explanation of authorial choices.

Return only valid JSON with:
- summary
- focus_areas: string[]
- tasks: flat list of all tasks, each with date, title, subject, minutes, mode, reason, topic, assessment_title, assessment_date, event_type, output, time_window
- daily_plan: { date, total_minutes, focus, tasks, checkpoint }[]
- subject_roadmaps: { subject, assessment_title, assessment_type, assessment_date, topic, days_until, recommended_total_minutes, study_design_focus, daily_focus }[]
- source_events: { id, title, subject, event_type, event_date, topic, days_until }[]
- checkpoints: string[]`;
export const generateAdaptiveStudyPlan = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return mockPlan(input);
    }
    try {
        const model = process.env.OPENAI_MODEL ?? defaultModel;
        const openai = new OpenAI({ apiKey });
        const response = await openai.responses.parse({
            model,
            input: buildPlanPrompt(input),
            max_output_tokens: 3500,
            store: false,
            reasoning: modelSupportsReasoning(model) ? { effort: "low" } : undefined,
            text: {
                verbosity: "low",
                format: zodTextFormat(adaptivePlanSchema, "adaptive_vce_study_plan")
            }
        });
        const parsed = response.output_parsed;
        if (!parsed) {
            throw new Error("OpenAI returned an empty or unparseable study plan");
        }
        return parsed;
    }
    catch (error) {
        console.warn("Falling back to deterministic calendar roadmap", error);
        return mockPlan(input);
    }
};
const mockTranscriptForSubject = (subject) => {
    const label = subject ?? "VCE class";
    if (subject && isBusinessSubject(subject)) {
        return `Today the class revised operations management. The teacher explained that operations strategies should be connected to business objectives, stakeholders and key performance indicators. Key examples included technology, quality management, waste minimisation and corporate social responsibility. The main reminder was that SAC answers need more than definitions: they need a case example, a benefit, a limitation and a clear link to the command term.`;
    }
    if (subject && isEnglishSubject(subject)) {
        return `Today the class discussed how to move from ideas into written expression. The teacher focused on audience, purpose and context, then showed how authorial choices shape voice, structure and language. The main reminder was to avoid vague commentary and explain why the choice suits the intended effect.`;
    }
    if (subject && isGeneralMathSubject(subject)) {
        return `Today the class worked through a VCE mathematics method. The teacher modelled how to identify the information given, choose the correct process, complete the calculator or algebra steps, then interpret the answer in context. The main reminder was to record restrictions, units and common error checks.`;
    }
    return `Today the ${label} class covered several examinable ideas. The teacher moved between definitions, worked examples and likely assessment traps. The main reminder was to convert class content into retrieval questions, not just copy passive notes.`;
};
const mockClassNotes = (input) => {
    const subject = input.subject ?? "VCE";
    if (isBusinessSubject(subject)) {
        return {
            title: "Class notes: operations strategy links",
            summary: "The class focused on turning operations terminology into SAC-ready application. The strongest answers connect a strategy to an objective, stakeholder impact and KPI instead of stopping at a definition.",
            key_points: [
                "Operations strategies need a business objective, not just a memorised definition.",
                "A strong case example should show cause, effect, benefit and limitation.",
                "Stakeholder impact and KPI links make evaluate/analyse answers more markable."
            ],
            subject_terms: ["operations management", "quality management", "technology", "CSR", "KPI", "stakeholder"],
            confusion_flags: ["Check whether each strategy has a specific contemporary example."],
            questions_to_ask: ["Which operations strategy is easiest to evaluate with a real business case?"],
            retrieval_prompts: [
                "Explain quality management without looking at notes.",
                "Link one operations strategy to one KPI and one stakeholder.",
                "Write one limitation sentence for a technology strategy."
            ],
            next_actions: ["Build a two-column case bank: strategy on the left, business example and KPI on the right."]
        };
    }
    return {
        title: `Class notes: ${subject}`,
        summary: "The class introduced key examinable ideas and showed how they should be turned into active recall, worked examples and short assessment-style responses.",
        key_points: [
            "Capture the idea in your own words before copying formal wording.",
            "Turn the teacher's examples into retrieval questions.",
            "Flag unclear points while the class is still fresh."
        ],
        subject_terms: [],
        confusion_flags: ["Review the transcript for any term that still feels vague."],
        questions_to_ask: ["What is the most likely way this appears in assessment?"],
        retrieval_prompts: ["Close the notes and explain the lesson in 90 seconds.", "Write three questions from today's class."],
        next_actions: ["Make one short practice task from the weakest idea in these notes."]
    };
};
const mockClassNoteChunk = (input) => {
    const subject = input.subject ?? "VCE";
    if (isBusinessSubject(subject)) {
        return {
            title: "Operations strategy link",
            summary: "The teacher is connecting operations terms to business objectives, stakeholders and KPI evidence.",
            bullets: [
                "Do not stop at definitions; apply each strategy to a real business case.",
                "Use one stakeholder impact and one measurable KPI to make the answer assessable."
            ],
            action: "Capture one strategy, one business example, one KPI and one limitation before the next chunk.",
            confidence: "medium"
        };
    }
    return {
        title: `${subject} class point`,
        summary: "This section contains a likely examinable idea that should become an active recall prompt.",
        bullets: ["Write the idea in your own words.", "Turn the teacher's example into a question you can answer tomorrow."],
        action: "Mark any unclear term now so the final notes can flag it.",
        confidence: "medium"
    };
};
export const transcribeClassAudio = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return mockTranscriptForSubject(input.subject);
    }
    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";
    const transcription = await openai.audio.transcriptions.create({
        file: await toFile(input.audio.buffer, input.audio.fileName, { type: input.audio.mimeType }),
        model,
        language: "en",
        prompt: `This is classroom audio for ${input.subject ?? "a VCE subject"}. Preserve VCE terminology, teacher instructions, examples, dates, assessment hints and student questions.`
    });
    const text = typeof transcription === "string" ? transcription : transcription.text;
    return text.trim();
};
const buildClassNotesPrompt = (input) => {
    const studyDesign = input.subject ? getStudyDesignContext(input.subject) : null;
    const studyDesignBlock = buildStudyDesignBlock(studyDesign);
    return `You are a VCE class notetaker and study coach.

Subject: ${input.subject ?? "General VCE study"}
Class date: ${input.classDate ?? "Not supplied"}
${studyDesignBlock}
Existing student context:
${input.context || "No prior notes, reflections or uploaded resources were supplied."}

Teacher transcript:
${input.transcript}

Turn this into study-ready notes. Do not dump the transcript. Extract what the student needs to revise, what is likely assessable, and what they should do next.
${studyDesignReliabilityRules(studyDesign)}

Rules:
- Use subject-specific language. Business Management notes should mention strategies, stakeholders, KPIs, command terms and case examples where relevant.
- English notes should focus on ideas, evidence, authorial choices, audience, purpose, context, voice, structure and written explanation where relevant.
- Mathematics notes should focus on method, conditions, calculator/CAS steps, interpretation and error traps where relevant.
- Software Development and Data Analytics notes should focus on artefacts, decisions, criteria, testing, security, data handling, findings and evaluation where relevant.
- If the transcript is unclear, put the uncertainty in confusion_flags instead of inventing details.
- retrieval_prompts should be closed-book prompts the student can use tomorrow.
- next_actions should be small concrete actions that can feed the roadmap.

Return only valid JSON with:
- title
- summary
- key_points: string[]
- subject_terms: string[]
- confusion_flags: string[]
- questions_to_ask: string[]
- retrieval_prompts: string[]
- next_actions: string[]`;
};
export const generateClassNotesFromTranscript = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return mockClassNotes(input);
    }
    const model = process.env.OPENAI_MODEL ?? defaultModel;
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.parse({
        model,
        input: buildClassNotesPrompt(input),
        max_output_tokens: 2200,
        store: false,
        reasoning: modelSupportsReasoning(model) ? { effort: "low" } : undefined,
        text: {
            verbosity: "medium",
            format: zodTextFormat(classNoteDraftSchema, "vce_class_notes")
        }
    });
    const parsed = response.output_parsed;
    if (!parsed) {
        throw new Error("OpenAI returned an empty or unparseable class note payload");
    }
    return parsed;
};
const buildClassNoteChunkPrompt = (input) => {
    const studyDesign = input.subject ? getStudyDesignContext(input.subject) : null;
    const studyDesignBlock = buildStudyDesignBlock(studyDesign);
    return `You are making live class note cards for a VCE student while class is still happening.

Subject: ${input.subject ?? "General VCE study"}
Elapsed time: ${input.elapsedSeconds ?? 0} seconds
Chunk number: ${input.chunkIndex ?? 0}
${studyDesignBlock}
Student context:
${input.context || "No extra context supplied."}

Transcript chunk:
${input.transcript}

Create one polished live note card from only this chunk.
${studyDesignReliabilityRules(studyDesign)}

Rules:
- Do not mention that this is a transcript.
- Keep it short enough to read during class.
- Preserve subject-specific language and any teacher instruction.
- If the chunk is weak, vague, or noisy, set confidence to low and make the action about clarifying.
- Business Management cards should prefer terms, case examples, stakeholders, KPIs, advantages, limitations and command terms.
- English cards should prefer ideas, authorial choices, voice, audience, purpose, context and evidence.
- Maths cards should prefer method, calculator/CAS steps, conditions, interpretation and error traps.

Return only valid JSON with:
- title: short card title
- summary: 1 sentence
- bullets: 1 to 3 short strings
- action: one concrete thing the student should capture/check now
- confidence: low, medium, or high`;
};
export const generateClassNoteChunkFromTranscript = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return mockClassNoteChunk(input);
    }
    const model = process.env.OPENAI_MODEL ?? defaultModel;
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.parse({
        model,
        input: buildClassNoteChunkPrompt(input),
        max_output_tokens: 900,
        store: false,
        reasoning: modelSupportsReasoning(model) ? { effort: "low" } : undefined,
        text: {
            verbosity: "low",
            format: zodTextFormat(classNoteChunkSchema, "vce_class_note_chunk")
        }
    });
    const parsed = response.output_parsed;
    if (!parsed) {
        throw new Error("OpenAI returned an empty or unparseable class note chunk");
    }
    return parsed;
};
const inferSubjectFromQuestion = inferVceSubjectFromQuestion;
const requestedWordCount = (question) => {
    const minimumMatch = question.match(/\b(?:at\s+least|minimum|min\.?|no\s+less\s+than)\s+(?:about\s+|around\s+|roughly\s+)?(\d{2,4})\s*[- ]?words?d?\b/i);
    if (minimumMatch)
        return { count: Number(minimumMatch[1]), mode: "minimum" };
    const maximumMatch = question.match(/\b(?:under|below|less\s+than|fewer\s+than|no\s+more\s+than|maximum|max\.?)\s+(?:about\s+|around\s+|roughly\s+)?(\d{2,4})\s*[- ]?words?d?\b/i);
    if (maximumMatch)
        return { count: Number(maximumMatch[1]), mode: "maximum" };
    const targetBeforeMatch = question.match(/\b(?:exactly|about|around|roughly|approximately|approx\.?)?\s*(?:a|an)?\s*(\d{2,4})\s*[- ]?words?d?\s+(?:response|answer|paragraph|explanation|summary|piece|version)\b/i);
    if (targetBeforeMatch)
        return { count: Number(targetBeforeMatch[1]), mode: "target" };
    const targetAfterMatch = question.match(/\b(?:response|answer|paragraph|explanation|summary|piece|version)\s+(?:that\s+is\s+)?(?:of\s+)?(?:(?:around|about|roughly|approximately|approx\.?)\s+)?(\d{2,4})\s*[- ]?words?d?\b/i);
    if (targetAfterMatch)
        return { count: Number(targetAfterMatch[1]), mode: "target" };
    return null;
};
const requestedMarkCount = (question) => {
    const match = question.match(/\b(\d{1,2})\s*[- ]?marks?\b/i);
    return match ? Number(match[1]) : null;
};
const countAnswerWords = (answer) => answer.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
const stripAnswerLabel = (answer) => answer
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*(?:direct answer|final answer|model answer|answer|version|\d{2,4}\s*[- ]?words?d?\s*(?:version|response|answer)?)\s*[:.-]?\s*/i, "")
    .trim();
const wordCountCandidateScore = (wordCount, request) => {
    if (request.mode === "minimum")
        return wordCount >= request.count ? wordCount - request.count : request.count * 10 - wordCount;
    if (request.mode === "maximum")
        return wordCount <= request.count ? request.count - wordCount : wordCount * 10;
    return Math.abs(wordCount - request.count);
};
const normaliseWordCountAnswer = (answer, request) => {
    const sections = answer
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}|(?=^#{1,6}\s)|(?=^\s*(?:direct answer|final answer|model answer|answer|version|\d{2,4}\s*[- ]?words?d?\s*(?:version|response|answer)?)\s*[:.-])/gim)
        .map(stripAnswerLabel)
        .filter((section) => countAnswerWords(section) >= 5);
    const candidates = [stripAnswerLabel(answer), ...sections].filter(Boolean);
    const best = candidates
        .map((candidate) => ({ candidate, wordCount: countAnswerWords(candidate) }))
        .sort((a, b) => wordCountCandidateScore(a.wordCount, request) - wordCountCandidateScore(b.wordCount, request))[0];
    return best?.candidate.trim() || answer;
};
const mockStudyAnswer = (input) => {
    const subject = input.subject ?? inferSubjectFromQuestion(input.question) ?? "your selected subject";
    const hasAttachments = Boolean(input.screenshots?.length || input.attachedDocumentLabels?.length);
    const isTutorMode = input.sessionMode === "tutor_session" || input.responseMode === "tutor";
    if (!isTutorMode) {
        return {
            answer: `## Direct answer
For ${subject}, answer the exact question first, then back it with one reason or example. If this is an exam response, make the command word obvious and use the subject term the marker expects.

## Why
A direct coach answer should help you move quickly: definition, application, then the mark-earning link.

## Example
Turn "this strategy improves performance" into "this strategy improves performance because it affects a measurable KPI such as productivity, profit or customer satisfaction."`,
            key_points: [
                "Lead with the answer before adding detail.",
                "Use one precise subject term and one application sentence.",
                "Ask for marking or a similar question if you want to practise it."
            ],
            sources_used: input.sourceLabels?.slice(0, 4).map((label) => ({ title: label, source_type: "local", detail: "Available app context" })) ??
                [],
            follow_up_questions: [
                "Give me one similar question to practise.",
                "Mark my attempt and show what to fix.",
                "Explain the key term in simpler words."
            ],
            tutor_plan: {
                diagnosis: "The student wants a fast answer, not a full tutoring session.",
                teaching_move: "Answer directly, then offer a practice next step.",
                guided_steps: [
                    "State the direct answer.",
                    "Add the marker-friendly reason.",
                    "Use one example or application sentence."
                ],
                your_turn: "Write one answer sentence and one evidence/application sentence.",
                check_question: "Which phrase in the question tells you what the answer must do?",
                next_revision: "Try one similar question or ask for marking on your attempt."
            },
            confidence: input.context || hasAttachments ? "medium" : "low"
        };
    }
    return {
        answer: `## Tutor read
You are probably not missing the whole topic; you need a clearer method for turning the question into marks.

## Guided explanation
Start by naming the key idea in ${subject}. Then link it to the exact evidence, scenario, data or wording in the question. Finish with the consequence, judgement or final interpreted result.

## Your turn
Write one sentence that uses a subject term and one sentence that applies it to the question. ${hasAttachments ? "A real OpenAI key would let me tutor from the attached image or PDF context." : ""}`,
        key_points: [
            "Identify the exact skill the question is testing before answering.",
            "Explain one step, then make the student apply that step.",
            "End with a check question so the student has to retrieve, not just read."
        ],
        sources_used: input.sourceLabels?.slice(0, 4).map((label) => ({ title: label, source_type: "local", detail: "Available app context" })) ?? [],
        follow_up_questions: [
            "Can you quiz me on this with one hint at a time?",
            "Can you mark my attempt and show the next fix?",
            "Can you give me a similar question without showing the answer first?"
        ],
        tutor_plan: {
            diagnosis: "The student needs a guided method, not just a final answer.",
            teaching_move: "Model the first move, then hand one small task back to the student.",
            guided_steps: [
                "Name the command word or skill being tested.",
                "Choose the exact formula, term, evidence or rule that matches the question.",
                "Apply it to the scenario and finish with an interpreted conclusion."
            ],
            your_turn: "Write a two-sentence attempt using one subject term and one application sentence.",
            check_question: "Which word or piece of data in the question tells you what method to use?",
            next_revision: "Save the check question as a flashcard or redo one similar question tomorrow."
        },
        confidence: input.context || hasAttachments ? "medium" : "low"
    };
};
const buildStudyAnswerPrompt = (input) => {
    const subject = input.subject ?? inferSubjectFromQuestion(input.question);
    const studyDesign = subject ? getStudyDesignContext(subject) : null;
    const studyDesignBlock = buildStudyDesignBlock(studyDesign);
    const subjectLabel = `${subject ?? "General VCE study"}${input.subjectUnit ? ` Unit ${input.subjectUnit}` : ""}`;
    const responseMode = input.sessionMode === "tutor_session" || input.responseMode === "tutor" ? "tutor" : "direct";
    const wordCountRequest = requestedWordCount(input.question);
    const markCount = requestedMarkCount(input.question);
    const screenshotBlock = input.screenshots?.length
        ? `\nThe student attached ${input.screenshots.length} screenshot${input.screenshots.length === 1 ? "" : "s"}. Read them carefully and use them as primary context when relevant.\n`
        : "";
    const attachedDocumentBlock = input.attachedDocumentLabels?.length
        ? `\nThe student attached PDF context extracted from:\n${input.attachedDocumentLabels.map((label) => `- ${label}`).join("\n")}\nTreat attached PDFs as primary uploaded material when they are relevant to the question.\n`
        : "";
    const sourceBlock = input.sourceLabels?.length
        ? `\nAvailable local source labels:\n${input.sourceLabels.map((label) => `- ${label}`).join("\n")}\n`
        : "";
    const learningSignalsBlock = input.learningSignals
        ? `\nRecent learning signals from the student's app history:\n${input.learningSignals}\n`
        : "\nRecent learning signals from the student's app history: none available.\n";
    const coachChatBlock = responseMode === "direct" && input.coachChatTranscript?.trim()
        ? `\nCurrent Ask Coach chat memory${input.coachChatTitle ? ` (${input.coachChatTitle})` : ""}:\n${input.coachChatTranscript.slice(-18_000)}\nUse this as the active chat thread. Continue from earlier turns when relevant, but answer the newest question directly.\n`
        : responseMode === "direct"
            ? "\nCurrent Ask Coach chat memory: new chat or no prior turns.\n"
            : "";
    const directModeBlock = responseMode === "direct"
        ? `\nDirect Ask Coach mode is active.
Mode rules:
- The student wants a direct answer without entering a full tutoring session.
- Answer the exact question first, then add the shortest useful explanation, example or method.
- If current chat memory is present, use it like ChatGPT-style conversation history so follow-up questions make sense.
- If the student asks for a SAC/exam answer or rewrite, the "Direct answer" section must be the actual response they can submit, not a comment about the response.
- Do not force a full diagnosis, agenda or long "your turn" sequence in the main answer.
- Still make follow_up_questions useful as tap-ready next actions, such as practice, marking or simplifying.\n`
        : "";
    const assessmentConstraintBlock = wordCountRequest || markCount
        ? `\nExplicit assessment constraints detected:
${markCount ? `- Mark allocation: ${markCount} mark${markCount === 1 ? "" : "s"}. Match the density and command-term depth expected for that mark allocation.` : ""}
${wordCountRequest
            ? wordCountRequest.mode === "minimum"
                ? `- Minimum word count: at least ${wordCountRequest.count} words. This is a hard requirement for the model answer itself.
- Count only the student's final answer response, not the explanatory notes, headings, sources, key_points or tutor_plan.
- To avoid undershooting, write roughly ${wordCountRequest.count + 10}-${wordCountRequest.count + 25} words in the final answer section unless the student requests an exact maximum.
- Before returning JSON, mentally count the final answer words and revise if it is below ${wordCountRequest.count}.`
                : wordCountRequest.mode === "maximum"
                    ? `- Maximum word count: no more than ${wordCountRequest.count} words in the model answer itself.
- Count only the student's final answer response, not explanatory notes, headings, sources, key_points or tutor_plan.
- Before returning JSON, mentally count the final answer words and revise if it is above ${wordCountRequest.count}.`
                    : `- Target word count: about ${wordCountRequest.count} words in the model answer itself.
- Count only the student's final answer response, not explanatory notes, headings, sources, key_points or tutor_plan.
- The final answer should be within ${Math.max(1, wordCountRequest.count - 5)}-${wordCountRequest.count + 5} words unless the student explicitly asks for a minimum or maximum.
- Before returning JSON, mentally count the final answer words and revise if it is far below or above ${wordCountRequest.count}.`
            : ""}
- Do not claim the answer satisfies a word or mark requirement unless it actually does.\n`
        : "";
    const tutorSessionBlock = responseMode === "tutor"
        ? `\nTutor session mode is active.
Session topic: ${input.sessionTopic || "Not specified"}
Session goal: ${input.sessionGoal || "Help the student learn this topic properly."}
Calendar booking: ${input.sessionEventTitle || "No calendar booking attached"}
Session status: ${input.sessionMode === "tutor_session" ? "Saved tutor-session turn" : "Tutor-style response"}

Session rules:
- Treat this as one turn inside an ongoing human-style tutoring session.
- The student chose tutoring because they want teaching, not a wall of answers.
- Open by reconnecting to any previous tutor-session memory if it is present, but do not fake memory if it is absent.
- Keep a clear agenda: diagnose, teach one bite-sized idea, make the student attempt, then set the next checkpoint.
- Use a human tutor tone: specific, calm, and responsive to what the student is probably feeling stuck on.
- Do not solve the whole thing before the student's attempt unless they explicitly ask for a model answer.
- End with one concrete task or question for the student to answer next. Do not end with "let me know if".\n`
        : "";
    const modeBehaviourBlock = responseMode === "direct"
        ? `Direct coach behaviour:
- Start with the answer, not a tutoring agenda.
- Keep the main answer compact and exam-useful.
- Use a worked example only if it makes the answer clearer.
- If the question is vague, give the likely answer and one clarifying question.
- The required tutor_plan JSON should be brief and treated as optional next-step coaching, not shown as a full session plan.`
        : `Tutor behaviour:
- Diagnose what the student is likely stuck on before explaining.
- Teach the next useful step, not everything you know.
- Prefer hints, worked thinking, checking questions and "your turn" tasks over giving a finished answer only.
- If the student asks for the answer, give a model only after showing the method and explain why it earns marks.
- If the student is doing maths/science/accounting, show setup, one guided step, final interpretation and a quick error check.
- If the student is doing English/humanities/health/business/legal, show command-term unpacking, evidence/application, a stronger sentence and marker cues.
- If this is the first turn on a topic, quickly set a mini-agenda and ask one baseline check question.
- If this is a later turn, use the previous tutor-session memory to continue from the last attempt or confusion point.
- If the student submits an attempt, mark the attempt first, then give the next exact rewrite or calculation step.
- If the question is vague, ask one clarifying question but still give a useful provisional tutoring path.
- Do not say "as an AI", "I can help with that", or generic encouragement without teaching value.
- Keep the answer compact enough to study from, but include enough scaffolding that the student can attempt the next step alone.`;
    const answerFormattingRule = wordCountRequest
        ? `answer must contain only the final student-ready answer text that obeys the word-count request. Do not include markdown headings, labels such as "Direct answer" or "${wordCountRequest.count}-word version", explanatory comments, multiple versions, word-count notes, sources, or coach commentary inside answer.`
        : responseMode === "direct"
            ? 'answer should use short markdown headings such as "Direct answer", "Why", "Example" and "Next move".'
            : 'answer should use short markdown headings such as "Tutor read", "Mini lesson", "Worked together" and "Your turn".';
    return `You are ${responseMode === "direct"
        ? "a practical VCE study coach who gives direct answers when the student asks for them"
        : "a precise, encouraging VCE tutor sitting beside the student"}. You are not a chatbot.

Subject: ${subjectLabel}

Student question:
${input.question}
${screenshotBlock}
${attachedDocumentBlock}
${studyDesignBlock}
Student notes, reflections and uploaded textbook/resource context:
${input.context || "No matching uploaded text context was found."}
${sourceBlock}
${learningSignalsBlock}
${coachChatBlock}
${directModeBlock}
${assessmentConstraintBlock}
${tutorSessionBlock}

${modeBehaviourBlock}

Use the subject's study design and uploaded materials where they are relevant, including attached PDFs and screenshots. If the context does not prove something, say what is uncertain and answer from VCE-safe general knowledge.
${studyDesignReliabilityRules(studyDesign)}

Confidence rules:
- Use high confidence only when the answer is backed by detailed study-design context, uploaded resources, screenshots, attached PDFs, or clearly standard subject knowledge.
- Use medium confidence when the answer is mostly general VCE knowledge and does not rely on exact study-design claims.
- Use low confidence when no subject is selected, only generic fallback context is available for a precise syllabus question, screenshots are unclear, or the student asks whether something is definitely in the study design and the supplied context does not prove it.
- If you use study-design context, include it in sources_used with source_type "study_design" and detail saying whether it was detailed local context or generic fallback.

For screenshots:
- Extract the important visible question, diagram, table, working or feedback.
- Explain what it means for the selected subject.
- If the screenshot is unclear, say what you can and cannot read.

For attached PDFs:
- Use the extracted PDF context as the student's supplied worksheet, notes, textbook or assessment material.
- Name the attached PDF in sources_used when it influences the answer.
- If the extracted text is partial or does not contain the answer, say that and tutor from the closest relevant evidence.

Answer formatting rules:
- ${answerFormattingRule}
- key_points should be practical coach/tutor takeaways, not a summary of generic content.
- follow_up_questions must be short tap-ready prompts the student can click to ask next, such as marking an attempt, getting a hint, simplifying the idea, or generating a similar question.
- tutor_plan.diagnosis should name the misconception, missing step, or study behaviour to correct.
- tutor_plan.teaching_move should name the specific tutoring move used.
- tutor_plan.guided_steps should contain 3 to 5 short steps the student can follow.
- tutor_plan.your_turn must be a concrete task the student can do now.
- tutor_plan.check_question must be a retrieval question that checks understanding.
- tutor_plan.next_revision must say what to review or practise next.

Return only valid JSON with:
- answer: a clear answer in student-friendly prose
- key_points: short strings with the main takeaways
- sources_used: objects with title, source_type and detail
- follow_up_questions: short suggested follow-up questions the student could ask
- tutor_plan: diagnosis, teaching_move, guided_steps, your_turn, check_question and next_revision
- confidence: low, medium or high`;
};
export const answerStudyQuestion = async (input) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!hasOpenAIKey(apiKey)) {
        return mockStudyAnswer(input);
    }
    const model = process.env.OPENAI_MODEL ?? defaultModel;
    const openai = new OpenAI({ apiKey });
    const prompt = buildStudyAnswerPrompt(input);
    const screenshots = input.screenshots ?? [];
    const responseInput = screenshots.length
        ? [
            {
                role: "user",
                content: [
                    { type: "input_text", text: prompt },
                    ...screenshots.map((screenshot) => ({
                        type: "input_image",
                        detail: "high",
                        image_url: `data:${screenshot.mimeType};base64,${screenshot.base64}`
                    }))
                ]
            }
        ]
        : prompt;
    const response = await openai.responses.parse({
        model,
        input: responseInput,
        max_output_tokens: 2800,
        store: false,
        reasoning: modelSupportsReasoning(model) ? { effort: "low" } : undefined,
        text: {
            verbosity: "medium",
            format: zodTextFormat(studyAnswerSchema, "vce_study_answer")
        }
    });
    const parsed = response.output_parsed;
    if (!parsed) {
        throw new Error("OpenAI returned an empty or unparseable study answer");
    }
    const wordCountRequest = requestedWordCount(input.question);
    return wordCountRequest
        ? { ...parsed, answer: normaliseWordCountAnswer(parsed.answer, wordCountRequest) }
        : parsed;
};
