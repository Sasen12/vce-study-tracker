import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { evaluateStudentAnswer, generatePracticeQuestions } from "../services/aiService.js";
import { addXp, awardQuestionBadges } from "../services/gamificationService.js";
import { contextSnippet, contextSnippetForQuery } from "../services/resourceService.js";

export const questionsRouter = Router();
questionsRouter.use(requireAuth);

type ContextReflection = {
  classDate: Date;
  classSummary: string;
  understood: string;
  confused: string;
};

type ContextNote = {
  title: string;
  body: string;
};

type ContextResource = {
  fileName: string;
  sourceType: string;
  extractedText: string;
};

const generateSchema = z.object({
  subjectId: z.string().uuid(),
  topic: z.string().min(2).max(100),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  sourceMode: z.enum(["balanced", "exam_bank"]).default("balanced")
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

const buildPersonalContext = async (
  userId: string,
  subjectId: string,
  subjectName: string,
  query: string,
  sourceMode: "balanced" | "exam_bank" = "balanced"
) => {
  const [notes, resources, reflections] = await Promise.all([
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
    })
  ]);

  const sortedResources = [...resources].sort((a: ContextResource, b: ContextResource) => {
    const aExam = examSourceTypes.has(a.sourceType) ? 1 : 0;
    const bExam = examSourceTypes.has(b.sourceType) ? 1 : 0;
    if (sourceMode === "exam_bank" && aExam !== bExam) return bExam - aExam;
    return 0;
  });

  return [
    ...reflections.map((reflection: ContextReflection) =>
      contextSnippet(
        `${subjectName} reflection ${reflection.classDate.toISOString().slice(0, 10)}`,
        `Class: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}`
      )
    ),
    ...notes.map((note: ContextNote) => contextSnippetForQuery(`${subjectName} note: ${note.title}`, note.body, query)),
    ...sortedResources.slice(0, sourceMode === "exam_bank" ? 8 : 5).map((resource: ContextResource) =>
      contextSnippetForQuery(`${resource.sourceType}: ${resource.fileName}`, resource.extractedText, query, examSourceTypes.has(resource.sourceType) ? 2200 : 1400)
    )
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, sourceMode === "exam_bank" ? 14000 : 9000);
};

questionsRouter.get(
  "/saved",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const savedQuestions = await prisma.savedQuestion.findMany({
      where: { userId: authReq.user.id },
      include: { subject: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ savedQuestions });
  })
);

questionsRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = generateSchema.parse(req.body);
    const subject = await prisma.userSubject.findFirst({
      where: { id: payload.subjectId, userId: authReq.user.id }
    });
    if (!subject) throw new HttpError(404, "Subject not found");

    const personalContext = await buildPersonalContext(
      authReq.user.id,
      payload.subjectId,
      subject.subjectName,
      payload.topic,
      payload.sourceMode
    );

    const questions = await generatePracticeQuestions({
      subject: subject.subjectName,
      topic: payload.topic,
      difficulty: payload.difficulty,
      count: payload.count,
      personalContext,
      sourceMode: payload.sourceMode
    });

    const gamification = await addXp(authReq.user.id, payload.count * 5);
    res.json({ questions, gamification });
  })
);

questionsRouter.post(
  "/timer-check",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = timerCheckSchema.parse(req.body);
    const subject = await prisma.userSubject.findFirst({
      where: { id: payload.subjectId, userId: authReq.user.id }
    });
    if (!subject) throw new HttpError(404, "Subject not found");

    const personalContext = await buildPersonalContext(authReq.user.id, payload.subjectId, subject.subjectName, payload.topic, "exam_bank");
    const [question] = await generatePracticeQuestions({
      subject: subject.subjectName,
      topic: payload.topic,
      difficulty: payload.difficulty,
      count: 1,
      personalContext,
      sourceMode: "exam_bank"
    });

    res.json({ question });
  })
);

questionsRouter.post(
  "/save",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = saveSchema.parse(req.body);
    if (payload.subjectId) {
      const subject = await prisma.userSubject.findFirst({
        where: { id: payload.subjectId, userId: authReq.user.id }
      });
      if (!subject) throw new HttpError(404, "Subject not found");
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
    res.status(201).json({ savedQuestion, gamification });
  })
);

questionsRouter.post(
  "/check-answer",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = checkAnswerSchema.parse(req.body);
    const subject = payload.subjectId
      ? await prisma.userSubject.findFirst({
          where: { id: payload.subjectId, userId: authReq.user.id }
        })
      : null;
    if (payload.subjectId && !subject) throw new HttpError(404, "Subject not found");

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

    res.json({ feedback, gamification, xpEarned });
  })
);
