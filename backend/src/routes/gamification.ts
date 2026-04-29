import { Router } from "express";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/http.js";
import { ensureGamification, syncAllBadges } from "../services/gamificationService.js";

export const gamificationRouter = Router();
gamificationRouter.use(requireAuth);

gamificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const gamification = await ensureGamification(authReq.user.id);
    res.json({ gamification });
  })
);

gamificationRouter.post(
  "/check",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const gamification = await syncAllBadges(authReq.user.id);
    const totals = await prisma.studySession.aggregate({
      where: { userId: authReq.user.id },
      _sum: { durationSeconds: true, xpEarned: true }
    });
    res.json({ gamification, totals });
  })
);

