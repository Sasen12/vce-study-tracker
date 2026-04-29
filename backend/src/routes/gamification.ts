import { Router } from "express";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { applyTheme, ensureGamification, syncAllBadges, THEME_SHOP_ITEMS, unlockTheme } from "../services/gamificationService.js";

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

gamificationRouter.get(
  "/shop",
  asyncHandler(async (_req, res) => {
    res.json({ items: THEME_SHOP_ITEMS });
  })
);

gamificationRouter.post(
  "/themes/:themeId/unlock",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const gamification = await unlockTheme(authReq.user.id, req.params.themeId);
      res.json({ gamification });
    } catch (error) {
      throw new HttpError(error instanceof Error && error.message === "Theme not found" ? 404 : 400, error instanceof Error ? error.message : "Could not unlock theme");
    }
  })
);

gamificationRouter.post(
  "/themes/:themeId/apply",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const gamification = await applyTheme(authReq.user.id, req.params.themeId);
      res.json({ gamification });
    } catch (error) {
      throw new HttpError(error instanceof Error && error.message === "Theme not found" ? 404 : 400, error instanceof Error ? error.message : "Could not apply theme");
    }
  })
);
