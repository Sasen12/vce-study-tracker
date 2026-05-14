import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { addXp, awardGoalBadges } from "../services/gamificationService.js";
export const goalsRouter = Router();
goalsRouter.use(requireAuth);
const goalSchema = z.object({
    subjectId: z.string().uuid(),
    targetStudyScore: z.number().int().min(20).max(50).optional().nullable(),
    weeklyHoursTarget: z.number().min(0).max(20).multipleOf(0.5).optional().nullable()
});
goalsRouter.get("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const goals = await prisma.goal.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { createdAt: "asc" }
    });
    res.json({ goals });
}));
goalsRouter.post("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = goalSchema.parse(req.body);
    const subject = await prisma.userSubject.findFirst({
        where: { id: payload.subjectId, userId: authReq.user.id }
    });
    if (!subject)
        throw new HttpError(404, "Subject not found");
    const goal = await prisma.goal.upsert({
        where: { userId_subjectId: { userId: authReq.user.id, subjectId: payload.subjectId } },
        create: {
            userId: authReq.user.id,
            subjectId: payload.subjectId,
            targetStudyScore: payload.targetStudyScore ?? subject.targetScore,
            weeklyHoursTarget: payload.weeklyHoursTarget ?? 5
        },
        update: {
            targetStudyScore: payload.targetStudyScore,
            weeklyHoursTarget: payload.weeklyHoursTarget
        },
        include: { subject: true }
    });
    await addXp(authReq.user.id, 10);
    const gamification = await awardGoalBadges(authReq.user.id);
    res.status(201).json({ goal, gamification });
}));
goalsRouter.put("/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const current = await prisma.goal.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!current)
        throw new HttpError(404, "Goal not found");
    const payload = goalSchema.partial().parse(req.body);
    const goal = await prisma.goal.update({
        where: { id: current.id },
        data: {
            targetStudyScore: payload.targetStudyScore,
            weeklyHoursTarget: payload.weeklyHoursTarget
        },
        include: { subject: true }
    });
    const gamification = await awardGoalBadges(authReq.user.id);
    res.json({ goal, gamification });
}));
