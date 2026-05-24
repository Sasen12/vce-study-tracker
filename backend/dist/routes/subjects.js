import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { ensureGamification } from "../services/gamificationService.js";
import { todayMelbourne, toDateOnly } from "../utils/date.js";
import { asyncHandler, HttpError } from "../utils/http.js";
export const subjectsRouter = Router();
subjectsRouter.use(requireAuth);
const MAX_SUBJECTS = 8;
const upsertSubjectSchema = z.object({
    subjectName: z.string().trim().min(2),
    unit: z.enum(["1/2", "3/4"]).default("3/4"),
    targetScore: z.number().int().min(20).max(50).optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});
const archiveSubjectSchema = z.object({
    reason: z.string().trim().min(2).max(120).optional().nullable(),
    completeFutureEvents: z.boolean().default(true)
});
const rolloverSubjectSchema = z.object({
    subjectName: z.string().trim().min(2).optional(),
    unit: z.enum(["1/2", "3/4"]).default("3/4"),
    targetScore: z.number().int().min(20).max(50).optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    completeFutureEvents: z.boolean().default(true)
});
const archiveSubjectForUser = async (userId, subjectId, payload) => {
    const subject = await prisma.userSubject.findFirst({
        where: { id: subjectId, userId }
    });
    if (!subject) {
        throw new HttpError(404, "Subject not found");
    }
    if (subject.archivedAt) {
        return subject;
    }
    const today = toDateOnly(todayMelbourne());
    return prisma.$transaction(async (tx) => {
        if (payload.completeFutureEvents) {
            await tx.event.updateMany({
                where: {
                    userId,
                    subjectId: subject.id,
                    completed: false,
                    eventDate: { gte: today }
                },
                data: { completed: true }
            });
        }
        return tx.userSubject.update({
            where: { id: subject.id },
            data: {
                archivedAt: new Date(),
                archivedReason: payload.reason ?? "dropped_or_changed"
            }
        });
    });
};
subjectsRouter.get("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const includeArchived = req.query.includeArchived === "true";
    const subjects = await prisma.userSubject.findMany({
        where: {
            userId: authReq.user.id,
            ...(includeArchived ? {} : { archivedAt: null })
        },
        orderBy: { subjectName: "asc" }
    });
    res.json({ subjects });
}));
subjectsRouter.post("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = upsertSubjectSchema.parse(req.body);
    const existingCount = await prisma.userSubject.count({
        where: { userId: authReq.user.id, archivedAt: null }
    });
    if (existingCount >= MAX_SUBJECTS) {
        throw new HttpError(400, `You can track up to ${MAX_SUBJECTS} active subjects at once. Archive one before adding another.`);
    }
    const duplicate = await prisma.userSubject.findFirst({
        where: {
            userId: authReq.user.id,
            archivedAt: null,
            subjectName: payload.subjectName,
            unit: payload.unit
        }
    });
    if (duplicate) {
        throw new HttpError(400, `${payload.subjectName} Unit ${payload.unit} is already active.`);
    }
    const subject = await prisma.userSubject.create({
        data: {
            userId: authReq.user.id,
            subjectName: payload.subjectName,
            unit: payload.unit,
            targetScore: payload.targetScore ?? null,
            color: payload.color
        }
    });
    const gamification = await ensureGamification(authReq.user.id);
    res.status(201).json({ subject, gamification });
}));
subjectsRouter.patch("/:id/archive", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = archiveSubjectSchema.parse(req.body ?? {});
    const subject = await archiveSubjectForUser(authReq.user.id, req.params.id, payload);
    res.json({ subject });
}));
subjectsRouter.post("/:id/rollover", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = rolloverSubjectSchema.parse(req.body ?? {});
    const current = await prisma.userSubject.findFirst({
        where: {
            id: req.params.id,
            userId: authReq.user.id,
            archivedAt: null
        }
    });
    if (!current) {
        throw new HttpError(404, "Active subject not found");
    }
    const nextSubjectName = payload.subjectName ?? current.subjectName;
    const activeCountExcludingCurrent = await prisma.userSubject.count({
        where: {
            userId: authReq.user.id,
            archivedAt: null,
            id: { not: current.id }
        }
    });
    if (activeCountExcludingCurrent >= MAX_SUBJECTS) {
        throw new HttpError(400, `You can track up to ${MAX_SUBJECTS} active subjects at once. Archive one before moving this subject.`);
    }
    const duplicate = await prisma.userSubject.findFirst({
        where: {
            userId: authReq.user.id,
            archivedAt: null,
            id: { not: current.id },
            subjectName: nextSubjectName,
            unit: payload.unit
        }
    });
    if (duplicate) {
        throw new HttpError(400, `${nextSubjectName} Unit ${payload.unit} is already active.`);
    }
    const today = toDateOnly(todayMelbourne());
    const now = new Date();
    const { subject, archivedSubject } = await prisma.$transaction(async (tx) => {
        const nextSubject = await tx.userSubject.create({
            data: {
                userId: authReq.user.id,
                subjectName: nextSubjectName,
                unit: payload.unit,
                targetScore: payload.targetScore ?? current.targetScore,
                color: payload.color ?? current.color
            }
        });
        if (payload.completeFutureEvents) {
            await tx.event.updateMany({
                where: {
                    userId: authReq.user.id,
                    subjectId: current.id,
                    completed: false,
                    eventDate: { gte: today }
                },
                data: { completed: true }
            });
        }
        const archived = await tx.userSubject.update({
            where: { id: current.id },
            data: {
                archivedAt: now,
                archivedReason: `moved_to_unit_${payload.unit.replace("/", "")}`,
                supersededBySubjectId: nextSubject.id
            }
        });
        return { subject: nextSubject, archivedSubject: archived };
    });
    const gamification = await ensureGamification(authReq.user.id);
    res.status(201).json({ subject, archivedSubject, gamification });
}));
subjectsRouter.delete("/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = archiveSubjectSchema.parse(req.body ?? {});
    await archiveSubjectForUser(authReq.user.id, req.params.id, payload);
    res.status(204).send();
}));
