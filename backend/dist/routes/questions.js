import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { limitAiUsage } from "../middleware/aiUsageLimit.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { evaluateStudentAnswer, generatePracticeQuestions } from "../services/aiService.js";
import { addXp, awardQuestionBadges } from "../services/gamificationService.js";
import { contextSnippet, contextSnippetForQuery } from "../services/resourceService.js";
import { recordStudentMemory, subjectKeyFor } from "../services/studentMemoryService.js";
export const questionsRouter = Router();
questionsRouter.use(requireAuth);
const generateSchema = z.object({
    subjectId: z.string().uuid(),
    topic: z.string().min(2).max(100),
    difficulty: z.enum(["easy", "medium", "hard"]),
    count: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    sourceMode: z.enum(["balanced", "exam_bank"]).default("balanced"),
    visualMode: z.enum(["auto", "visual"]).default("auto")
});
const saveSchema = z.object({
    subjectId: z.string().uuid().optional().nullable(),
    question: z.string().min(5),
    modelAnswer: z.string().min(5),
    topic: z.string().optional().nullable(),
    difficulty: z.string().optional().nullable(),
    marks: z.number().int().optional().nullable(),
    markingCriteria: z.array(z.string()).default([])
});
const checkAnswerSchema = z.object({
    subjectId: z.string().uuid().optional().nullable(),
    question: z.string().min(5),
    studentAnswer: z.string().min(2).max(6000),
    modelAnswer: z.string().min(5),
    topic: z.string().optional().nullable(),
    marks: z.number().int().min(1).max(20),
    markingCriteria: z.array(z.string()).default([])
});
const timerCheckSchema = z.object({
    subjectId: z.string().uuid(),
    topic: z.string().min(2).max(100),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
});
const examSourceTypes = new Set(["exam", "exam_report", "practice_sac", "practice_sat"]);
const buildPersonalContext = async (userId, subjectId, subjectName, query, sourceMode = "balanced") => {
    const currentSubjectKey = subjectKeyFor(subjectId, subjectName);
    const [notes, resources, reflections, subjectMemory, learningSignals] = await Promise.all([
        prisma.studyNote.findMany({
            where: { userId, subjectId },
            orderBy: { updatedAt: "desc" },
            take: 5
        }),
        prisma.studyResource.findMany({
            where: { userId, subjectId },
            orderBy: { createdAt: "desc" },
            take: 14
        }),
        prisma.studyReflection.findMany({
            where: { userId, subjectId },
            orderBy: { classDate: "desc" },
            take: 5
        }),
        prisma.studentSubjectMemory.findUnique({
            where: { userId_subjectKey: { userId, subjectKey: currentSubjectKey } }
        }),
        prisma.learningSignal.findMany({
            where: { userId, subjectKey: currentSubjectKey },
            orderBy: { createdAt: "desc" },
            take: 10
        })
    ]);
    const sortedResources = [...resources].sort((a, b) => {
        const aExam = examSourceTypes.has(a.sourceType) ? 1 : 0;
        const bExam = examSourceTypes.has(b.sourceType) ? 1 : 0;
        if (sourceMode === "exam_bank" && aExam !== bExam)
            return bExam - aExam;
        return 0;
    });
    return [
        subjectMemory
            ? contextSnippet(`${subjectName} student memory map`, `Risk: ${subjectMemory.riskLevel}
Predicted next task: ${subjectMemory.predictedNextTask ?? "Not enough data"}
Weak areas: ${JSON.stringify(subjectMemory.weakAreas)}
Common mistakes: ${JSON.stringify(subjectMemory.commonMistakes)}
Strengths: ${JSON.stringify(subjectMemory.strengths)}
Recent topics: ${JSON.stringify(subjectMemory.recentTopics)}`)
            : "",
        learningSignals
            .slice(0, 6)
            .map((signal) => contextSnippet(`${subjectName} learning signal: ${signal.signalType}`, `${signal.topic ?? "General"} - ${signal.title}. ${signal.detail} Evidence: ${signal.evidence}. Next: ${signal.nextAction ?? ""}`))
            .join("\n\n"),
        ...reflections.map((reflection) => contextSnippet(`${subjectName} reflection ${reflection.classDate.toISOString().slice(0, 10)}`, `Class: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}`)),
        ...notes.map((note) => contextSnippetForQuery(`${subjectName} note: ${note.title}`, note.body, query)),
        ...sortedResources.slice(0, sourceMode === "exam_bank" ? 8 : 5).map((resource) => contextSnippetForQuery(`${resource.sourceType}: ${resource.fileName}`, resource.extractedText, query, examSourceTypes.has(resource.sourceType) ? 2200 : 1400))
    ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, sourceMode === "exam_bank" ? 14000 : 9000);
};
questionsRouter.get("/saved", asyncHandler(async (req, res) => {
    const authReq = req;
    const savedQuestions = await prisma.savedQuestion.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { createdAt: "desc" }
    });
    res.json({ savedQuestions });
}));
questionsRouter.post("/generate", limitAiUsage({ cost: (req) => Number(req.body?.count ?? 1) }), asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = generateSchema.parse(req.body);
    const subject = await prisma.userSubject.findFirst({
        where: { id: payload.subjectId, userId: authReq.user.id, archivedAt: null }
    });
    if (!subject)
        throw new HttpError(404, "Subject not found");
    const personalContext = await buildPersonalContext(authReq.user.id, payload.subjectId, subject.subjectName, payload.topic, payload.sourceMode);
    const questions = await generatePracticeQuestions({
        subject: subject.subjectName,
        topic: payload.topic,
        difficulty: payload.difficulty,
        count: payload.count,
        personalContext,
        sourceMode: payload.sourceMode,
        visualMode: payload.visualMode
    });
    const gamification = await addXp(authReq.user.id, payload.count * 5);
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject.id,
        subjectName: subject.subjectName,
        eventType: "practice_questions_generated",
        sourceType: "questions",
        title: `${payload.count} ${payload.difficulty} questions: ${payload.topic}`,
        summary: `Generated ${payload.count} ${payload.difficulty} ${subject.subjectName} questions on ${payload.topic} using ${payload.sourceMode} mode.`,
        importance: payload.sourceMode === "exam_bank" ? 3 : 2,
        payload: {
            topic: payload.topic,
            difficulty: payload.difficulty,
            count: payload.count,
            sourceMode: payload.sourceMode,
            visualMode: payload.visualMode,
            generatedTopics: questions.map((question) => question.topic)
        }
    }, {
        topic: payload.topic,
        signals: [
            {
                signalType: "topic_interest",
                topic: payload.topic,
                title: "Practice requested",
                detail: `Generated ${payload.count} practice question${payload.count === 1 ? "" : "s"} on ${payload.topic}.`,
                evidence: `${payload.difficulty} difficulty, ${payload.sourceMode} source mode.`,
                nextAction: "Check at least one answer so the app can distinguish practice from mastery.",
                weight: payload.sourceMode === "exam_bank" ? 3 : 2
            }
        ]
    });
    res.json({ questions, gamification });
}));
questionsRouter.post("/timer-check", limitAiUsage(), asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = timerCheckSchema.parse(req.body);
    const subject = await prisma.userSubject.findFirst({
        where: { id: payload.subjectId, userId: authReq.user.id, archivedAt: null }
    });
    if (!subject)
        throw new HttpError(404, "Subject not found");
    const personalContext = await buildPersonalContext(authReq.user.id, payload.subjectId, subject.subjectName, payload.topic, "exam_bank");
    const [question] = await generatePracticeQuestions({
        subject: subject.subjectName,
        topic: payload.topic,
        difficulty: payload.difficulty,
        count: 1,
        personalContext,
        sourceMode: "exam_bank"
    });
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject.id,
        subjectName: subject.subjectName,
        eventType: "timer_check_question_generated",
        sourceType: "timer_check",
        title: `Timer check: ${payload.topic}`,
        summary: `Generated a timer check question for ${subject.subjectName} on ${payload.topic}.`,
        importance: 3,
        payload: {
            topic: payload.topic,
            difficulty: payload.difficulty,
            question: question?.question,
            marks: question?.marks
        }
    }, {
        topic: payload.topic,
        signals: [
            {
                signalType: "study_behavior",
                topic: payload.topic,
                title: "Timer check started",
                detail: `The student requested timed checking practice on ${payload.topic}.`,
                evidence: "Timer check generated from Questions.",
                nextAction: "Mark the timed answer and save the mistake if the score is weak.",
                weight: 3
            }
        ]
    });
    res.json({ question });
}));
questionsRouter.post("/save", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = saveSchema.parse(req.body);
    let subject = null;
    if (payload.subjectId) {
        subject = await prisma.userSubject.findFirst({
            where: { id: payload.subjectId, userId: authReq.user.id, archivedAt: null }
        });
        if (!subject)
            throw new HttpError(404, "Subject not found");
    }
    const savedQuestion = await prisma.savedQuestion.create({
        data: {
            userId: authReq.user.id,
            subjectId: payload.subjectId ?? null,
            question: payload.question,
            modelAnswer: payload.modelAnswer,
            topic: payload.topic,
            difficulty: payload.difficulty,
            marks: payload.marks,
            markingCriteria: payload.markingCriteria
        },
        include: { subject: true }
    });
    const gamification = await awardQuestionBadges(authReq.user.id);
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject?.id ?? null,
        subjectName: subject?.subjectName ?? savedQuestion.subject?.subjectName ?? "General study",
        eventType: "question_saved",
        sourceType: "saved_question",
        sourceId: savedQuestion.id,
        title: savedQuestion.question,
        summary: `Saved a ${payload.difficulty ?? "practice"} question${payload.topic ? ` on ${payload.topic}` : ""}.`,
        importance: 3,
        payload: {
            question: savedQuestion.question,
            modelAnswer: savedQuestion.modelAnswer,
            topic: savedQuestion.topic,
            difficulty: savedQuestion.difficulty,
            marks: savedQuestion.marks,
            markingCriteria: savedQuestion.markingCriteria
        }
    }, {
        topic: savedQuestion.topic ?? savedQuestion.question,
        signals: [
            {
                signalType: "topic_interest",
                topic: savedQuestion.topic ?? "Saved question",
                title: "Saved practice question",
                detail: `The student saved a question${savedQuestion.topic ? ` on ${savedQuestion.topic}` : ""} for review.`,
                evidence: savedQuestion.question,
                nextAction: "Review this question with spaced recall and check a fresh answer later.",
                weight: 3
            }
        ]
    });
    res.status(201).json({ savedQuestion, gamification });
}));
questionsRouter.post("/check-answer", limitAiUsage(), asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = checkAnswerSchema.parse(req.body);
    const subject = payload.subjectId
        ? await prisma.userSubject.findFirst({
            where: { id: payload.subjectId, userId: authReq.user.id, archivedAt: null }
        })
        : null;
    if (payload.subjectId && !subject)
        throw new HttpError(404, "Subject not found");
    const feedback = await evaluateStudentAnswer({
        subject: subject?.subjectName,
        topic: payload.topic,
        question: payload.question,
        studentAnswer: payload.studentAnswer,
        modelAnswer: payload.modelAnswer,
        markingCriteria: payload.markingCriteria,
        marks: payload.marks
    });
    const xpEarned = Math.max(2, Math.round(feedback.score / 12) + (feedback.verdict === "excellent" ? 4 : 0));
    const gamification = await addXp(authReq.user.id, xpEarned);
    const isWeak = feedback.verdict === "needs_work" || feedback.verdict === "close";
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject?.id ?? null,
        subjectName: subject?.subjectName ?? "General study",
        eventType: "answer_checked",
        sourceType: "checked_answer",
        title: payload.question,
        summary: `Checked answer scored ${feedback.awarded_marks}/${feedback.max_marks} (${feedback.score}%, ${feedback.verdict}). Next step: ${feedback.next_step}`,
        importance: isWeak ? 5 : 4,
        payload: {
            question: payload.question,
            topic: payload.topic,
            studentAnswer: payload.studentAnswer,
            modelAnswer: payload.modelAnswer,
            markingCriteria: payload.markingCriteria,
            feedback,
            xpEarned
        }
    }, {
        topic: payload.topic ?? payload.question,
        evidence: [...feedback.improvements, feedback.next_step].join("\n"),
        extractAiSignals: true,
        signals: [
            {
                signalType: isWeak ? "weakness" : "strength",
                topic: payload.topic ?? "Checked answer",
                title: isWeak ? "Checked answer weakness" : "Checked answer strength",
                detail: isWeak
                    ? feedback.improvements.join(" ") || feedback.next_step
                    : feedback.strengths.join(" ") || "The answer met the marking criteria well.",
                evidence: `${feedback.awarded_marks}/${feedback.max_marks} marks, verdict ${feedback.verdict}.`,
                nextAction: feedback.next_step,
                weight: isWeak ? 5 : feedback.verdict === "excellent" ? 4 : 3
            },
            ...(isWeak
                ? [
                    {
                        signalType: "mistake",
                        topic: payload.topic ?? "Checked answer",
                        title: "Lost marks in checked answer",
                        detail: feedback.improvements.join(" ") || feedback.next_step,
                        evidence: payload.studentAnswer.slice(0, 500),
                        nextAction: "Save this as a mistake after rewriting the weakest sentence.",
                        weight: 4
                    }
                ]
                : [])
        ]
    });
    res.json({ feedback, gamification, xpEarned });
}));
