import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { calculateSessionXp, recordStudySessionEffects } from "../services/gamificationService.js";
import { recordStudentMemory } from "../services/studentMemoryService.js";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

const createSessionSchema = z.object({
  subjectId: z.string().uuid(),
  durationSeconds: z.number().int().min(60),
  notes: z.string().max(1000).optional().nullable(),
  bonusXp: z.number().int().min(0).max(500).default(0),
  createdAt: z.string().datetime().optional()
});

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date: Date) => {
  const start = startOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

sessionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const sessions = await prisma.studySession.findMany({
      where: { userId: authReq.user.id },
      include: { subject: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json({ sessions });
  })
);

sessionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = createSessionSchema.parse(req.body);
    const subject = await prisma.userSubject.findFirst({
      where: { id: payload.subjectId, userId: authReq.user.id, archivedAt: null }
    });
    if (!subject) {
      throw new HttpError(404, "Subject not found");
    }

    const xpEarned = calculateSessionXp(payload.durationSeconds) + payload.bonusXp;
    const createdAt = payload.createdAt ? new Date(payload.createdAt) : new Date();
    const session = await prisma.studySession.create({
      data: {
        userId: authReq.user.id,
        subjectId: subject.id,
        durationSeconds: payload.durationSeconds,
        notes: payload.notes,
        xpEarned,
        createdAt
      },
      include: { subject: true }
    });

    const gamification = await recordStudySessionEffects({
      userId: authReq.user.id,
      subjectId: session.subjectId,
      durationSeconds: session.durationSeconds,
      xpEarned,
      createdAt: session.createdAt
    });

    await recordStudentMemory(
      {
        userId: authReq.user.id,
        subjectId: subject.id,
        subjectName: subject.subjectName,
        eventType: "study_session_completed",
        sourceType: "study_session",
        sourceId: session.id,
        title: `${subject.subjectName} study session`,
        summary: `Studied ${subject.subjectName} for ${Math.round(session.durationSeconds / 60)} minutes.${session.notes ? ` Notes: ${session.notes}` : ""}`,
        importance: session.durationSeconds >= 45 * 60 ? 3 : 2,
        payload: {
          durationSeconds: session.durationSeconds,
          xpEarned,
          notes: session.notes,
          createdAt: session.createdAt.toISOString()
        }
      },
      {
        topic: session.notes ?? subject.subjectName,
        signals: [
          {
            signalType: "study_behavior",
            topic: session.notes ?? "Study time",
            title: `${Math.round(session.durationSeconds / 60)} min study block`,
            detail: `Completed a ${Math.round(session.durationSeconds / 60)} minute ${subject.subjectName} study session.`,
            evidence: session.notes || "Study timer completed.",
            nextAction: session.notes
              ? "Use these session notes to choose the next retrieval or correction task."
              : "Add a short note next time so the app can link time spent to topic mastery.",
            weight: session.durationSeconds >= 45 * 60 ? 3 : 2
          }
        ]
      }
    );

    res.status(201).json({ session, gamification });
  })
);

sessionsRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const sessions = await prisma.studySession.findMany({
      where: { userId: authReq.user.id, createdAt: { gte: monthStart } },
      include: { subject: true },
      orderBy: { createdAt: "desc" }
    });

    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const totals = {
      todaySeconds: 0,
      weekSeconds: 0,
      monthSeconds: 0,
      perSubject: {} as Record<string, { subjectName: string; color: string; seconds: number }>
    };

    for (const session of sessions) {
      totals.monthSeconds += session.durationSeconds;
      if (session.createdAt >= weekStart) totals.weekSeconds += session.durationSeconds;
      if (session.createdAt >= dayStart) totals.todaySeconds += session.durationSeconds;
      if (session.subject) {
        totals.perSubject[session.subject.id] ??= {
          subjectName: session.subject.subjectName,
          color: session.subject.color,
          seconds: 0
        };
        totals.perSubject[session.subject.id].seconds += session.durationSeconds;
      }
    }

    res.json({ stats: totals });
  })
);
