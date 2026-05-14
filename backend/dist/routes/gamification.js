import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { applyTheme, applyTitle, BADGE_SHOP_ITEMS, DEFAULT_TITLE_ID, ensureGamification, syncAllBadges, THEME_SHOP_ITEMS, TITLE_SHOP_ITEMS, unlockBadge, unlockTheme, unlockTitle } from "../services/gamificationService.js";
export const gamificationRouter = Router();
gamificationRouter.use(requireAuth);
const leaderboardPreferenceSchema = z.object({
    optIn: z.boolean()
});
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date) => {
    const start = startOfDay(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return start;
};
const buildWeeklyLeaderboard = async (viewerUserId) => {
    const viewerGamification = await ensureGamification(viewerUserId);
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const participants = await prisma.user.findMany({
        where: { gamification: { is: { leaderboardOptIn: true } } },
        select: {
            id: true,
            displayName: true,
            gamification: {
                select: {
                    totalXp: true,
                    level: true,
                    activeTitle: true
                }
            },
            sessions: {
                where: {
                    createdAt: {
                        gte: weekStart,
                        lt: weekEnd
                    }
                },
                select: {
                    durationSeconds: true,
                    xpEarned: true
                }
            }
        }
    });
    const ranked = participants
        .map((participant) => {
        const weekXp = participant.sessions.reduce((sum, session) => sum + session.xpEarned, 0);
        const weekSeconds = participant.sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
        return {
            userId: participant.id,
            displayName: participant.displayName,
            totalXp: participant.gamification?.totalXp ?? 0,
            level: participant.gamification?.level ?? 1,
            activeTitle: participant.gamification?.activeTitle ?? DEFAULT_TITLE_ID,
            weekXp,
            weekMinutes: Math.round(weekSeconds / 60),
            sessionCount: participant.sessions.length,
            isCurrentUser: participant.id === viewerUserId
        };
    })
        .sort((a, b) => b.weekXp - a.weekXp || b.weekMinutes - a.weekMinutes || a.displayName.localeCompare(b.displayName))
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    return {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        entries: ranked.slice(0, 25),
        viewer: ranked.find((entry) => entry.userId === viewerUserId) ?? null,
        optedIn: viewerGamification.leaderboardOptIn,
        prompted: Boolean(viewerGamification.leaderboardPromptedAt)
    };
};
gamificationRouter.get("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const gamification = await ensureGamification(authReq.user.id);
    res.json({ gamification });
}));
gamificationRouter.get("/leaderboard", asyncHandler(async (req, res) => {
    const authReq = req;
    const leaderboard = await buildWeeklyLeaderboard(authReq.user.id);
    res.json({ leaderboard });
}));
gamificationRouter.post("/leaderboard-preference", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = leaderboardPreferenceSchema.parse(req.body);
    await ensureGamification(authReq.user.id);
    const gamification = await prisma.userGamification.update({
        where: { userId: authReq.user.id },
        data: {
            leaderboardOptIn: payload.optIn,
            leaderboardPromptedAt: new Date()
        }
    });
    const leaderboard = await buildWeeklyLeaderboard(authReq.user.id);
    res.json({ gamification, leaderboard });
}));
gamificationRouter.post("/check", asyncHandler(async (req, res) => {
    const authReq = req;
    const gamification = await syncAllBadges(authReq.user.id);
    const totals = await prisma.studySession.aggregate({
        where: { userId: authReq.user.id },
        _sum: { durationSeconds: true, xpEarned: true }
    });
    res.json({ gamification, totals });
}));
gamificationRouter.get("/shop", asyncHandler(async (_req, res) => {
    res.json({ items: THEME_SHOP_ITEMS, themes: THEME_SHOP_ITEMS, titles: TITLE_SHOP_ITEMS, badges: BADGE_SHOP_ITEMS });
}));
gamificationRouter.post("/themes/:themeId/unlock", asyncHandler(async (req, res) => {
    const authReq = req;
    try {
        const gamification = await unlockTheme(authReq.user.id, req.params.themeId);
        res.json({ gamification });
    }
    catch (error) {
        throw new HttpError(error instanceof Error && error.message === "Theme not found" ? 404 : 400, error instanceof Error ? error.message : "Could not unlock theme");
    }
}));
gamificationRouter.post("/themes/:themeId/apply", asyncHandler(async (req, res) => {
    const authReq = req;
    try {
        const gamification = await applyTheme(authReq.user.id, req.params.themeId);
        res.json({ gamification });
    }
    catch (error) {
        throw new HttpError(error instanceof Error && error.message === "Theme not found" ? 404 : 400, error instanceof Error ? error.message : "Could not apply theme");
    }
}));
gamificationRouter.post("/titles/:titleId/unlock", asyncHandler(async (req, res) => {
    const authReq = req;
    try {
        const gamification = await unlockTitle(authReq.user.id, req.params.titleId);
        res.json({ gamification });
    }
    catch (error) {
        throw new HttpError(error instanceof Error && error.message === "Title not found" ? 404 : 400, error instanceof Error ? error.message : "Could not unlock title");
    }
}));
gamificationRouter.post("/titles/:titleId/apply", asyncHandler(async (req, res) => {
    const authReq = req;
    try {
        const gamification = await applyTitle(authReq.user.id, req.params.titleId);
        res.json({ gamification });
    }
    catch (error) {
        throw new HttpError(error instanceof Error && error.message === "Title not found" ? 404 : 400, error instanceof Error ? error.message : "Could not apply title");
    }
}));
gamificationRouter.post("/badges/:badgeId/unlock", asyncHandler(async (req, res) => {
    const authReq = req;
    try {
        const gamification = await unlockBadge(authReq.user.id, req.params.badgeId);
        res.json({ gamification });
    }
    catch (error) {
        throw new HttpError(error instanceof Error && error.message === "Badge not found" ? 404 : 400, error instanceof Error ? error.message : "Could not unlock badge");
    }
}));
