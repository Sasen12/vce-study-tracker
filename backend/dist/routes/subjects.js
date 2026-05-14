import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { ensureGamification } from "../services/gamificationService.js";
import { asyncHandler, HttpError } from "../utils/http.js";
export const subjectsRouter = Router();
subjectsRouter.use(requireAuth);
const MAX_SUBJECTS = 8;
const upsertSubjectSchema = z.object({
    subjectName: z.string().min(2),
    unit: z.enum(["1/2", "3/4"]).default("3/4"),
    targetScore: z.number().int().min(20).max(50).optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});
subjectsRouter.get("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const subjects = await prisma.userSubject.findMany({
        where: { userId: authReq.user.id },
        orderBy: { subjectName: "asc" }
    });
    res.json({ subjects });
}));
subjectsRouter.post("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = upsertSubjectSchema.parse(req.body);
    const existingCount = await prisma.userSubject.count({
        where: { userId: authReq.user.id }
    });
    if (existingCount >= MAX_SUBJECTS) {
        throw new HttpError(400, `You can track up to ${MAX_SUBJECTS} subjects at once. Remove one before adding another.`);
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
subjectsRouter.delete("/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const subject = await prisma.userSubject.findFirst({
        where: { id: req.params.id, userId: authReq.user.id }
    });
    if (!subject) {
        throw new HttpError(404, "Subject not found");
    }
    await prisma.userSubject.delete({ where: { id: subject.id } });
    res.status(204).send();
}));
