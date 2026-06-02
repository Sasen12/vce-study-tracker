import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { Chess } from "chess.js";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { isAdminEmail, requireAdmin } from "../services/adminService.js";
import { defaultFromEmail, escapeHtml, smtpTransport } from "../services/contactEmailService.js";
import { addXp, DEFAULT_TITLE_ID, ensureGamification, grantThemeToUser, levelFromXp, THEME_SHOP_ITEMS } from "../services/gamificationService.js";
import { createWeeklyDigestUnsubscribeToken } from "../services/weeklyDigestService.js";
import { asyncHandler, HttpError } from "../utils/http.js";
export const communityRouter = Router();
communityRouter.use(requireAuth);
const QUESTION_TYPES = ["Homework help", "SAC prep", "Exam revision", "Concept help", "Motivation"];
const questionTypeSchema = z.enum(QUESTION_TYPES);
const feedbackSchema = z.object({
    category: z.enum(["bug", "feature", "content", "other"]).default("other"),
    message: z.string().trim().min(5).max(1200)
});
const chatSchema = z.object({
    message: z.string().trim().min(1).max(280)
});
const subjectRoomIdSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
const giftThemeSchema = z.object({
    themeId: z.string().trim().min(1),
    equip: z.boolean().default(true)
});
const giftCoinsSchema = z.object({
    amount: z.coerce.number().int().min(1).max(5000),
    message: z.string().trim().min(3).max(180).optional().nullable()
});
const adminEmailSchema = z.object({
    audience: z.enum(["opted_in", "all", "single"]).default("opted_in"),
    userId: z.string().uuid().optional().nullable(),
    subject: z.string().trim().min(4).max(120),
    message: z.string().trim().min(10).max(5000)
});
const questionWallSchema = z.object({
    subjectName: z.string().trim().min(2).max(80).optional().nullable(),
    questionType: questionTypeSchema.optional().nullable().default("Concept help"),
    message: z.string().trim().min(8).max(360)
});
const questionAnswerSchema = z.object({
    message: z.string().trim().min(8).max(600)
});
const reportSchema = z.object({
    contentType: z.enum(["chat", "room-chat", "question", "answer"]),
    contentId: z.string().trim().min(1).max(120),
    messageId: z.string().uuid().optional().nullable(),
    reportedUserId: z.string().uuid().optional().nullable(),
    reason: z.string().trim().min(3).max(600).optional().nullable()
});
const reportStatusSchema = z.object({
    status: z.enum(["new", "reviewing", "resolved", "ignored"])
});
const liveRoomHeartbeatSchema = z.object({
    roomId: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/)
});
const chessMatchCodeSchema = z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(/^FORGE-\d{4}-R\d+-M\d+$/i)
    .transform((value) => value.toUpperCase());
const chessMoveSchema = z.object({
    from: z.string().trim().regex(/^[a-h][1-8]$/),
    to: z.string().trim().regex(/^[a-h][1-8]$/),
    promotion: z.enum(["q", "r", "b", "n"]).optional().default("q")
});
const trackedScreens = ["home", "insights", "study", "calendar", "questions", "community", "shop", "pro", "profile", "more"];
const usageEventSchema = z.object({
    screen: z.enum(trackedScreens),
    action: z.literal("view").default("view")
});
const screenLabels = {
    home: "Home",
    insights: "Insights",
    study: "Study",
    calendar: "Calendar",
    questions: "Questions",
    community: "Community",
    shop: "Shop",
    pro: "Pro",
    profile: "Profile",
    more: "More"
};
const LEADERBOARD_INVITE_TITLE = "Weekly leaderboard invite";
const LEADERBOARD_INVITE_MESSAGE = "Sasen reopened the weekly leaderboard invite. Join from the pop-up or Community > Leaderboard if you want your weekly XP to count.";
const CHAT_UNLOCK_STUDY_MINUTES = 10;
const CHAT_UNLOCK_MESSAGES = 5;
const ROOM_CHAT_UNLOCK_STUDY_MINUTES = 30;
const HELP_BONUS_MESSAGES = 3;
const MAX_DAILY_CHAT_MESSAGES = 60;
const WEEKLY_MISSION_BADGE_ID = "weekly_lock_in";
const WEEKLY_MISSION_XP = 80;
const CHESS_SIGNUP_CLOSE_DAY = 2;
const CHESS_SIGNUP_CLOSE_HOUR = 20;
const CHESS_CADENCE_WEEKS = 3;
const configuredChessCommunityUnlockMinutes = Number.parseInt(process.env.CHESS_COMMUNITY_UNLOCK_MINUTES ?? "600", 10);
const CHESS_COMMUNITY_UNLOCK_MINUTES = Number.isFinite(configuredChessCommunityUnlockMinutes)
    ? configuredChessCommunityUnlockMinutes
    : 600;
const CHESS_CADENCE_ANCHOR_WEEK_START = new Date(2026, 5, 1);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const USAGE_EVENT_THROTTLE_MS = 60_000;
const SUBJECT_ROOM_PREFIX = "[[subject-room:";
const SUBJECT_ROOM_MESSAGE_PATTERN = /^\[\[subject-room:([a-z0-9-]+)\]\]\s*([\s\S]*)$/;
const QUESTION_WALL_PREFIX = "[[question-wall:";
const QUESTION_WALL_MESSAGE_PATTERN = /^\[\[question-wall:(q|a):([a-z0-9-]+)\]\]\s*(?:(.*?)\s*\|\|\s*)?([\s\S]*)$/;
const QUESTION_TYPE_PATTERN = /^\[\[type:([a-z-]+)\]\]\s*/;
const LIVE_ROOM_ACTION_PREFIX = "study-room:";
const questionTypeSlug = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const questionTypeFromSlug = (slug) => QUESTION_TYPES.find((type) => questionTypeSlug(type) === slug) ?? "Concept help";
const COMMUNITY_SQUADS = [
    {
        id: "english",
        name: "English squad",
        shortName: "English",
        color: "#60A5FA",
        identity: "Essay reps, quotes, argument pressure and language analysis without the panic.",
        aliases: ["english", "english as an additional language", "english language", "literature"]
    },
    {
        id: "methods",
        name: "Methods squad",
        shortName: "Methods",
        color: "#A78BFA",
        identity: "CAS checks, algebra reps and methods questions that stop becoming mysterious.",
        aliases: ["mathematical methods", "methods"]
    },
    {
        id: "general-maths",
        name: "General Maths squad",
        shortName: "General Maths",
        color: "#FF6B6B",
        identity: "Networks, finance, matrices and exam-style reps with clean working.",
        aliases: ["general mathematics", "general maths"]
    },
    {
        id: "business",
        name: "Business squad",
        shortName: "Business",
        color: "#F59E0B",
        identity: "Command terms, case links and answers that actually hit the marks.",
        aliases: ["business management"]
    },
    {
        id: "software-dev",
        name: "Software Dev squad",
        shortName: "Software Dev",
        color: "#34D399",
        identity: "SAT progress, SRS clarity, bugs fixed and theory that links to the folio.",
        aliases: ["software development", "applied computing software development"]
    },
    {
        id: "data-analytics",
        name: "Data Analytics squad",
        shortName: "Data Analytics",
        color: "#22D3EE",
        identity: "Data questions, SAT evidence, visualisations and clean exam explanations.",
        aliases: ["data analytics", "applied computing data analytics"]
    }
];
const LIVE_STUDY_ROOMS = [
    {
        id: "general-maths-sac-grind",
        title: "General Maths SAC Grind",
        subjectHint: "General Mathematics",
        squadId: "general-maths",
        targetMinutes: 35,
        color: "#FF6B6B",
        description: "A room for SAC pressure, finance models, matrices and one worked solution at a time.",
        focusPrompt: "One question. One clean method. No wandering."
    },
    {
        id: "english-essay-lock-in",
        title: "English Essay Lock In",
        subjectHint: "English",
        squadId: "english",
        targetMinutes: 45,
        color: "#60A5FA",
        description: "Essay blocks, quote repair, topic sentences and language analysis reps.",
        focusPrompt: "One paragraph, one quote, one sharper contention."
    },
    {
        id: "business-40-mark-rescue",
        title: "Business 40 Mark Rescue",
        subjectHint: "Business Management",
        squadId: "business",
        targetMinutes: 40,
        color: "#F59E0B",
        description: "Command terms, 10-markers, case study links and SAC rescue work.",
        focusPrompt: "One command term, one case link, one mark saved."
    },
    {
        id: "software-dev-sat-sprint",
        title: "Software Dev SAT Sprint",
        subjectHint: "Software Development",
        squadId: "software-dev",
        targetMinutes: 50,
        color: "#34D399",
        description: "SAT build time, SRS cleanup, pseudocode, testing and folio evidence.",
        focusPrompt: "One SAT section, one commit, one clean explanation."
    }
];
const PUBLIC_MISSION = {
    id: "weekly-lock-in",
    title: "Weekly Lock-In",
    reward: `Finish all four to claim ${WEEKLY_MISSION_XP} XP and the Weekly Lock-In badge.`,
    items: [
        {
            id: "deep-work",
            label: "Complete 3 deep work sessions",
            target: 3,
            action: "study",
            actionLabel: "Start timer",
            helper: "Deep blocks power your squad and your streak."
        },
        {
            id: "questions",
            label: "Answer or save 2 questions",
            target: 2,
            action: "questions",
            actionLabel: "Open Q&A",
            helper: "Help someone or bank a question for revision."
        },
        {
            id: "notes",
            label: "Upload or write 1 note",
            target: 1,
            action: "notes",
            actionLabel: "Open notes",
            helper: "Turn class chaos into memory the coach can use."
        },
        {
            id: "practice",
            label: "Do 1 practice quiz",
            target: 1,
            action: "practice",
            actionLabel: "Forge quiz",
            helper: "Practice questions count as evidence, not just vibes."
        }
    ]
};
const serialiseFeedback = (item, isAdmin) => ({
    id: item.id,
    userId: item.userId,
    category: item.category,
    message: item.message,
    status: item.status,
    createdAt: item.createdAt,
    ...(isAdmin && item.user
        ? {
            user: {
                displayName: item.user.displayName,
                email: item.user.email
            }
        }
        : {})
});
const serialisePublicContact = (row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    yearLevel: row.yearLevel,
    school: row.school,
    subject: row.subject,
    question: row.question,
    deliveryStatus: row.deliveryStatus,
    deliveryError: row.deliveryError,
    adminStatus: row.adminStatus,
    createdAt: row.createdAt
});
const publicContactsForAdmin = async () => prisma.$queryRaw `
    SELECT
      id,
      name,
      email,
      year_level AS "yearLevel",
      school,
      subject,
      question,
      delivery_status AS "deliveryStatus",
      delivery_error AS "deliveryError",
      admin_status AS "adminStatus",
      created_at AS "createdAt"
    FROM public_contact_submissions
    ORDER BY
      CASE admin_status
        WHEN 'new' THEN 0
        WHEN 'replied' THEN 1
        ELSE 2
      END,
      created_at DESC
    LIMIT 100
  `;
const todayRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
        start: today,
        end: tomorrow
    };
};
const publicUser = (user) => ({
    displayName: user.displayName
});
const subjectRoomIdFor = (subjectName) => {
    const slug = subjectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72);
    return slug || "subject";
};
const subjectRoomMarkerFor = (roomId) => `${SUBJECT_ROOM_PREFIX}${roomId}]]`;
const parseSubjectRoomMessage = (message) => {
    const match = SUBJECT_ROOM_MESSAGE_PATTERN.exec(message);
    return match ? { roomId: match[1], message: match[2].trim() } : null;
};
const normaliseSubjectName = (subjectName) => subjectName
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const squadForSubjectName = (subjectName) => {
    if (!subjectName)
        return null;
    const normalised = normaliseSubjectName(subjectName);
    return COMMUNITY_SQUADS.find((squad) => squad.aliases.some((alias) => normalised.includes(alias))) ?? null;
};
const parseQuestionWallMessage = (message) => {
    const match = QUESTION_WALL_MESSAGE_PATTERN.exec(message);
    if (!match)
        return null;
    return {
        kind: match[1],
        questionId: match[2],
        subjectName: match[3]?.trim() || null,
        message: match[4].trim()
    };
};
const extractQuestionType = (message) => {
    const match = QUESTION_TYPE_PATTERN.exec(message);
    if (!match) {
        return { questionType: "Concept help", message };
    }
    return {
        questionType: questionTypeFromSlug(match[1]),
        message: message.replace(QUESTION_TYPE_PATTERN, "").trim()
    };
};
const activityTime = (date) => date.toISOString();
const isCommunitySystemMessage = (message) => Boolean(parseSubjectRoomMessage(message) || parseQuestionWallMessage(message));
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date) => {
    const start = startOfDay(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return start;
};
const addWeeks = (date, weeks) => {
    const next = new Date(date);
    next.setDate(next.getDate() + weeks * 7);
    return next;
};
const weeksSinceChessAnchor = (weekStart) => Math.max(0, Math.floor((startOfWeek(weekStart).getTime() - startOfWeek(CHESS_CADENCE_ANCHOR_WEEK_START).getTime()) / WEEK_MS));
const isChessCadenceWeek = (weekStart) => weeksSinceChessAnchor(weekStart) % CHESS_CADENCE_WEEKS === 0;
const nextChessCadenceWeekStart = (weekStart) => {
    const weeksSinceAnchor = weeksSinceChessAnchor(weekStart);
    const weeksUntilNext = CHESS_CADENCE_WEEKS - (weeksSinceAnchor % CHESS_CADENCE_WEEKS);
    return addWeeks(startOfWeek(weekStart), weeksUntilNext === CHESS_CADENCE_WEEKS ? CHESS_CADENCE_WEEKS : weeksUntilNext);
};
const withRank = (entries) => entries
    .sort((a, b) => b.score - a.score || (a.displayName ?? "").localeCompare(b.displayName ?? ""))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
const ensureDefaultCommunityVisibility = async (userId) => {
    const gamification = await ensureGamification(userId);
    if (gamification.leaderboardPromptedAt || gamification.leaderboardOptIn)
        return gamification;
    return prisma.userGamification.update({
        where: { userId },
        data: {
            leaderboardOptIn: true,
            leaderboardPromptedAt: new Date()
        }
    });
};
const mutedUserIdsFor = async (userId) => {
    const rows = await prisma.communityUserMute.findMany({
        where: { userId },
        select: { mutedUserId: true }
    });
    return new Set(rows.map((row) => row.mutedUserId));
};
const mutedUsersFor = async (userId) => {
    const rows = await prisma.communityUserMute.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 60,
        include: {
            mutedUser: {
                select: {
                    displayName: true,
                    email: true,
                    schoolName: true
                }
            }
        }
    });
    return rows.map((row) => ({
        mutedUserId: row.mutedUserId,
        displayName: row.mutedUser.displayName,
        email: row.mutedUser.email,
        schoolName: row.mutedUser.schoolName,
        createdAt: row.createdAt
    }));
};
const serialiseCommunityReport = (report) => ({
    id: report.id,
    contentType: report.contentType,
    contentId: report.contentId,
    messageId: report.messageId,
    reason: report.reason,
    status: ["new", "reviewing", "resolved", "ignored"].includes(report.status) ? report.status : "new",
    createdAt: report.createdAt,
    reporter: report.reporter,
    reportedUser: report.reportedUser ?? null
});
const communityReportsForAdmin = async () => prisma.communityReport
    .findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
        reporter: { select: { displayName: true, email: true } },
        reportedUser: { select: { displayName: true, email: true } }
    }
})
    .then((reports) => reports.map(serialiseCommunityReport));
const messageForReport = async (payload) => {
    const explicitMessageId = payload.messageId ?? (z.string().uuid().safeParse(payload.contentId).success ? payload.contentId : null);
    if (explicitMessageId) {
        const message = await prisma.communityChatMessage.findUnique({
            where: { id: explicitMessageId },
            select: { id: true, userId: true }
        });
        if (message)
            return message;
    }
    if (payload.contentType === "question") {
        return prisma.communityChatMessage.findFirst({
            where: {
                message: { startsWith: `${QUESTION_WALL_PREFIX}q:${payload.contentId}]]` }
            },
            select: { id: true, userId: true }
        });
    }
    return null;
};
const serialiseChatMessage = (item, viewerUserId) => {
    const roomMessage = parseSubjectRoomMessage(item.message);
    return {
        id: item.id,
        userId: item.userId,
        message: roomMessage?.message ?? item.message,
        subjectRoomId: roomMessage?.roomId ?? null,
        createdAt: item.createdAt,
        user: publicUser(item.user),
        isCurrentUser: item.userId === viewerUserId
    };
};
const subjectRoomsForUser = async (userId) => {
    const subjects = await prisma.userSubject.findMany({
        where: { userId, archivedAt: null },
        orderBy: [{ subjectName: "asc" }, { unit: "asc" }],
        select: {
            id: true,
            subjectName: true,
            unit: true,
            color: true
        }
    });
    const rooms = new Map();
    for (const subject of subjects) {
        const id = subjectRoomIdFor(subject.subjectName);
        if (!rooms.has(id)) {
            rooms.set(id, {
                id,
                subjectName: subject.subjectName,
                unit: subject.unit,
                color: subject.color
            });
        }
    }
    return Array.from(rooms.values());
};
const requireSubjectRoomForUser = async (userId, roomId) => {
    const rooms = await subjectRoomsForUser(userId);
    const room = rooms.find((item) => item.id === roomId);
    if (!room) {
        throw new HttpError(403, "Add this subject before joining its room.");
    }
    return room;
};
const adminUserSelect = {
    id: true,
    email: true,
    displayName: true,
    schoolName: true,
    createdAt: true,
    gamification: {
        select: {
            totalXp: true,
            xpBalance: true,
            level: true,
            leaderboardOptIn: true,
            unlockedCosmetics: true,
            activeTheme: true,
            activeTitle: true
        }
    },
    _count: {
        select: {
            subjects: true,
            sessions: true,
            feedbackItems: true,
            chatMessages: true
        }
    }
};
const cosmeticsAsArray = (cosmetics) => Array.isArray(cosmetics) ? cosmetics.filter((cosmetic) => typeof cosmetic === "string") : [];
const badgesAsArray = (badges) => Array.isArray(badges) ? badges.filter((badge) => typeof badge === "string") : [];
const serialiseAdminUser = (user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    schoolName: user.schoolName,
    createdAt: user.createdAt,
    level: user.gamification?.level ?? 1,
    totalXp: user.gamification?.totalXp ?? 0,
    xpBalance: user.gamification?.xpBalance ?? 0,
    leaderboardOptIn: user.gamification?.leaderboardOptIn ?? false,
    unlockedCosmetics: cosmeticsAsArray(user.gamification?.unlockedCosmetics),
    activeTheme: user.gamification?.activeTheme ?? "midnight",
    activeTitle: user.gamification?.activeTitle ?? DEFAULT_TITLE_ID,
    subjectCount: user._count.subjects,
    sessionCount: user._count.sessions,
    feedbackCount: user._count.feedbackItems,
    chatMessageCount: user._count.chatMessages
});
const adminUsers = async () => {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: adminUserSelect
    });
    return users.map(serialiseAdminUser);
};
const adminUserById = async (id) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: adminUserSelect
    });
    return user ? serialiseAdminUser(user) : null;
};
const appBaseUrl = () => (process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://www.vceforge.space").trim().replace(/\/$/, "");
const adminEmailReplyTo = () => process.env.ADMIN_REPLY_EMAIL?.trim() ||
    process.env.CONTACT_RECIPIENT_EMAIL?.trim() ||
    process.env.CONTACT_SMTP_USER?.trim() ||
    process.env.SMTP_USER?.trim() ||
    undefined;
const messageHtml = (message) => message
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
const buildAdminEmail = (recipient, subject, message) => {
    const appUrl = appBaseUrl();
    const unsubscribeUrl = `${appUrl}/api/digest/unsubscribe/${createWeeklyDigestUnsubscribeToken(recipient)}`;
    const greeting = `Hey ${recipient.displayName},`;
    const text = [
        greeting,
        "",
        message,
        "",
        `Open VCE Forge: ${appUrl}`,
        "",
        "You are receiving this because you created a VCE Forge account.",
        `Turn off weekly emails: ${unsubscribeUrl}`
    ].join("\n");
    const html = `
    <div style="margin:0;background:#07111d;color:#f4f7ff;font-family:Arial,sans-serif;line-height:1.5;padding:28px;">
      <div style="max-width:640px;margin:0 auto;background:#0f1d2d;border:1px solid #1f4260;border-radius:8px;padding:28px;">
        <p style="margin:0 0 8px;color:#38bdf8;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">VCE Forge admin update</p>
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.08;">${escapeHtml(subject)}</h1>
        <p style="margin:0 0 14px;">${escapeHtml(greeting)}</p>
        ${messageHtml(message)}
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#38bdf8;color:#07111d;text-decoration:none;font-weight:800;border-radius:6px;padding:12px 18px;margin-top:8px;">Open VCE Forge</a>
        <p style="margin:24px 0 0;color:#8fa2bd;font-size:12px;">
          You are receiving this because you created a VCE Forge account.
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8bdcff;">Turn off weekly emails</a>.
        </p>
      </div>
    </div>
  `;
    return { text, html };
};
const resendLeaderboardInvite = async () => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            gamification: {
                select: {
                    leaderboardOptIn: true
                }
            }
        }
    });
    const targetUserIds = users
        .filter((user) => !isAdminEmail(user.email) && !user.gamification?.leaderboardOptIn)
        .map((user) => user.id);
    if (!targetUserIds.length) {
        return 0;
    }
    const giftId = `leaderboard_invite_${Date.now()}`;
    await prisma.$transaction([
        prisma.userGamification.updateMany({
            where: {
                userId: { in: targetUserIds },
                leaderboardOptIn: false
            },
            data: {
                leaderboardPromptedAt: null
            }
        }),
        prisma.userGiftMessage.createMany({
            data: targetUserIds.map((userId) => ({
                userId,
                title: LEADERBOARD_INVITE_TITLE,
                message: LEADERBOARD_INVITE_MESSAGE,
                giftType: "leaderboard",
                giftId
            }))
        })
    ]);
    return targetUserIds.length;
};
const chatAllowanceFor = async (userId) => {
    const { start, end } = todayRange();
    const [study, used, helped] = await Promise.all([
        prisma.studySession.aggregate({
            where: {
                userId,
                createdAt: {
                    gte: start,
                    lt: end
                }
            },
            _sum: { durationSeconds: true }
        }),
        prisma.communityChatMessage.count({
            where: {
                userId,
                NOT: {
                    message: { startsWith: QUESTION_WALL_PREFIX }
                },
                createdAt: {
                    gte: start,
                    lt: end
                }
            }
        }),
        prisma.communityChatMessage.count({
            where: {
                userId,
                message: { startsWith: `${QUESTION_WALL_PREFIX}a:` },
                createdAt: {
                    gte: start,
                    lt: end
                }
            }
        })
    ]);
    const studiedMinutes = Math.floor((study._sum.durationSeconds ?? 0) / 60);
    const unlockedMessages = studiedMinutes >= CHAT_UNLOCK_STUDY_MINUTES ? CHAT_UNLOCK_MESSAGES : 0;
    const unlimitedRoomChat = studiedMinutes >= ROOM_CHAT_UNLOCK_STUDY_MINUTES;
    const bonusMessages = helped * HELP_BONUS_MESSAGES;
    const totalMessages = unlimitedRoomChat
        ? 999
        : Math.min(MAX_DAILY_CHAT_MESSAGES, unlockedMessages + bonusMessages);
    return {
        baseMinutes: 0,
        studiedMinutes,
        earnedMinutes: totalMessages,
        totalMinutes: totalMessages,
        usedMinutes: used,
        remainingMinutes: unlimitedRoomChat ? 999 : Math.max(0, totalMessages - used),
        minutesPerMessage: 1,
        studyMinutesPerChatMinute: CHAT_UNLOCK_STUDY_MINUTES,
        unlockStudyMinutes: CHAT_UNLOCK_STUDY_MINUTES,
        unlockedMessages: CHAT_UNLOCK_MESSAGES,
        roomUnlimitedStudyMinutes: ROOM_CHAT_UNLOCK_STUDY_MINUTES,
        unlimitedRoomChat,
        bonusMessages
    };
};
const buildQuestionWall = async (viewerUserId, mutedUserIds = new Set()) => {
    const rows = await prisma.communityChatMessage.findMany({
        where: { message: { startsWith: QUESTION_WALL_PREFIX } },
        orderBy: { createdAt: "asc" },
        take: 400,
        include: {
            user: {
                select: { displayName: true }
            }
        }
    });
    const questions = new Map();
    for (const row of rows) {
        if (mutedUserIds.has(row.userId) && row.userId !== viewerUserId)
            continue;
        const parsed = parseQuestionWallMessage(row.message);
        if (!parsed)
            continue;
        if (parsed.kind === "q") {
            const typed = extractQuestionType(parsed.message);
            questions.set(parsed.questionId, {
                id: parsed.questionId,
                subjectName: parsed.subjectName,
                questionType: typed.questionType,
                userId: row.userId,
                message: typed.message,
                createdAt: row.createdAt,
                answerCount: 0,
                isCurrentUser: row.userId === viewerUserId,
                answeredByViewer: false,
                savedByViewer: false,
                lastActivityAt: row.createdAt,
                status: "Open",
                helpfulScore: 0,
                answers: []
            });
            continue;
        }
        const question = questions.get(parsed.questionId);
        if (!question)
            continue;
        question.answers.push({
            id: row.id,
            userId: row.userId,
            message: parsed.message,
            createdAt: row.createdAt,
            user: publicUser(row.user),
            isCurrentUser: row.userId === viewerUserId,
            helpfulVotes: 0,
            votedHelpfulByViewer: false
        });
        question.answerCount = question.answers.length;
        question.answeredByViewer = question.answeredByViewer || row.userId === viewerUserId;
        if (row.createdAt > question.lastActivityAt) {
            question.lastActivityAt = row.createdAt;
        }
    }
    const questionIds = Array.from(questions.keys());
    const answerIds = Array.from(questions.values()).flatMap((question) => question.answers.map((answer) => answer.id));
    const [saves, votes] = await Promise.all([
        questionIds.length
            ? prisma.communityQuestionSave.findMany({
                where: { userId: viewerUserId, questionId: { in: questionIds } },
                select: { questionId: true }
            })
            : Promise.resolve([]),
        answerIds.length
            ? prisma.communityQuestionHelpfulVote.findMany({
                where: { answerMessageId: { in: answerIds } },
                select: { answerMessageId: true, userId: true }
            })
            : Promise.resolve([])
    ]);
    const savedQuestionIds = new Set(saves.map((save) => save.questionId));
    const helpfulVotesByAnswer = new Map();
    for (const vote of votes) {
        const current = helpfulVotesByAnswer.get(vote.answerMessageId) ?? { count: 0, votedByViewer: false };
        current.count += 1;
        current.votedByViewer = current.votedByViewer || vote.userId === viewerUserId;
        helpfulVotesByAnswer.set(vote.answerMessageId, current);
    }
    return Array.from(questions.values())
        .map((question) => {
        const answers = question.answers.map((answer) => {
            const helpful = helpfulVotesByAnswer.get(answer.id);
            return {
                ...answer,
                helpfulVotes: helpful?.count ?? 0,
                votedHelpfulByViewer: helpful?.votedByViewer ?? false
            };
        });
        const { userId: _userId, ...publicQuestion } = question;
        return {
            ...publicQuestion,
            savedByViewer: savedQuestionIds.has(question.id),
            status: question.answerCount > 0 ? "Answered" : Date.now() - question.createdAt.getTime() > 12 * 60 * 60 * 1000 ? "Needs explanation" : "Open",
            helpfulScore: answers.reduce((sum, answer) => sum + answer.helpfulVotes, 0) + answers.length * 2 + (question.answeredByViewer ? 1 : 0),
            answers: answers.slice(-4).map(({ userId, ...answer }) => answer)
        };
    })
        .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
        .slice(0, 30);
};
const buildCommunityLeaderboards = async (viewerUserId) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const participants = await prisma.user.findMany({
        where: { gamification: { is: { leaderboardOptIn: true } } },
        select: {
            id: true,
            displayName: true,
            gamification: {
                select: {
                    totalXp: true,
                    level: true,
                    activeTitle: true,
                    currentStreak: true
                }
            },
            sessions: {
                where: {
                    createdAt: { gte: previousWeekStart, lt: weekEnd }
                },
                select: {
                    durationSeconds: true,
                    xpEarned: true,
                    createdAt: true,
                    subject: { select: { subjectName: true } }
                }
            },
            savedQuestions: {
                where: { createdAt: { gte: weekStart, lt: weekEnd } },
                select: { id: true }
            },
            notes: {
                where: { createdAt: { gte: weekStart, lt: weekEnd } },
                select: { id: true }
            },
            resources: {
                where: { createdAt: { gte: weekStart, lt: weekEnd } },
                select: { id: true }
            },
            chatMessages: {
                where: { createdAt: { gte: weekStart, lt: weekEnd }, message: { startsWith: `${QUESTION_WALL_PREFIX}a:` } },
                select: { id: true, helpfulVotes: { select: { id: true } } }
            }
        }
    });
    const rows = participants.map((participant) => {
        const weekSessions = participant.sessions.filter((session) => session.createdAt >= weekStart);
        const previousSessions = participant.sessions.filter((session) => session.createdAt < weekStart);
        const todaySessions = weekSessions.filter((session) => session.createdAt >= todayStart);
        const weekMinutes = Math.round(weekSessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
        const previousMinutes = Math.round(previousSessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
        const todayMinutes = Math.round(todaySessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
        const weekXp = weekSessions.reduce((sum, session) => sum + session.xpEarned, 0);
        const helpfulAnswers = participant.chatMessages.length + participant.chatMessages.reduce((sum, answer) => sum + answer.helpfulVotes.length, 0);
        const deepSessions = weekSessions.filter((session) => session.durationSeconds >= 45 * 60).length;
        const challengeScore = Math.min(3, deepSessions) +
            Math.min(2, participant.savedQuestions.length + helpfulAnswers) +
            Math.min(1, participant.notes.length + participant.resources.length) +
            Math.min(1, participant.savedQuestions.length);
        return {
            userId: participant.id,
            displayName: participant.displayName,
            totalXp: participant.gamification?.totalXp ?? 0,
            level: participant.gamification?.level ?? 1,
            activeTitle: participant.gamification?.activeTitle ?? DEFAULT_TITLE_ID,
            weekXp,
            weekMinutes,
            todayMinutes,
            previousMinutes,
            improvementMinutes: Math.max(0, weekMinutes - previousMinutes),
            sessionCount: weekSessions.length,
            currentStreak: participant.gamification?.currentStreak ?? 0,
            helpfulAnswers,
            challengeScore,
            isCurrentUser: participant.id === viewerUserId
        };
    });
    const boardEntry = (row, score) => ({
        ...row,
        score
    });
    const week = withRank(rows.map((row) => boardEntry(row, row.weekXp))).slice(0, 25);
    const today = withRank(rows.map((row) => boardEntry(row, row.todayMinutes))).filter((entry) => entry.score > 0).slice(0, 25);
    const improved = withRank(rows.map((row) => boardEntry(row, row.improvementMinutes))).filter((entry) => entry.score > 0).slice(0, 25);
    const streaks = withRank(rows.map((row) => boardEntry(row, row.currentStreak))).filter((entry) => entry.score > 0).slice(0, 25);
    const helpful = withRank(rows.map((row) => boardEntry(row, row.helpfulAnswers))).filter((entry) => entry.score > 0).slice(0, 25);
    const challenge = withRank(rows.map((row) => boardEntry(row, row.challengeScore))).filter((entry) => entry.score > 0).slice(0, 25);
    return {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        week,
        today,
        improved,
        streaks,
        helpful,
        challenge
    };
};
const buildWeeklySubjectSquads = async (viewerUserId) => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const [subjects, viewerSubjects, sessions, savedQuestions, wall] = await Promise.all([
        prisma.userSubject.findMany({
            where: {
                archivedAt: null,
                user: { gamification: { is: { leaderboardOptIn: true } } }
            },
            select: {
                userId: true,
                subjectName: true,
                user: {
                    select: {
                        displayName: true,
                        gamification: {
                            select: { currentStreak: true }
                        }
                    }
                }
            }
        }),
        prisma.userSubject.findMany({
            where: {
                userId: viewerUserId,
                archivedAt: null
            },
            select: {
                subjectName: true
            }
        }),
        prisma.studySession.findMany({
            where: {
                createdAt: { gte: previousWeekStart, lt: weekEnd },
                user: { gamification: { is: { leaderboardOptIn: true } } }
            },
            select: {
                userId: true,
                durationSeconds: true,
                createdAt: true,
                subject: { select: { subjectName: true } },
                user: { select: { displayName: true } }
            }
        }),
        prisma.savedQuestion.findMany({
            where: {
                createdAt: { gte: weekStart, lt: weekEnd },
                user: { gamification: { is: { leaderboardOptIn: true } } }
            },
            select: {
                subject: { select: { subjectName: true } }
            }
        }),
        buildQuestionWall(viewerUserId)
    ]);
    const viewerSquadIds = new Set(viewerSubjects
        .map((subject) => squadForSubjectName(subject.subjectName)?.id)
        .filter((squadId) => Boolean(squadId)));
    return COMMUNITY_SQUADS.filter((squad) => viewerSquadIds.has(squad.id)).map((squad) => {
        const memberRows = subjects.filter((subject) => squadForSubjectName(subject.subjectName)?.id === squad.id);
        const memberIds = new Set(memberRows.map((subject) => subject.userId));
        const allSessionRows = sessions.filter((session) => squadForSubjectName(session.subject?.subjectName)?.id === squad.id);
        const sessionRows = allSessionRows.filter((session) => session.createdAt >= weekStart);
        const previousSessionRows = allSessionRows.filter((session) => session.createdAt < weekStart);
        const todayRows = sessionRows.filter((session) => session.createdAt >= startOfDay(now));
        const questionCount = savedQuestions.filter((question) => squadForSubjectName(question.subject?.subjectName)?.id === squad.id).length;
        const squadWallQuestions = wall.filter((question) => squadForSubjectName(question.subjectName)?.id === squad.id);
        const wallAnswerCount = squadWallQuestions.reduce((sum, question) => sum + question.answerCount, 0);
        const openQuestionCount = squadWallQuestions.filter((question) => question.answerCount === 0).length;
        const contributorMinutes = new Map();
        for (const session of sessionRows) {
            const current = contributorMinutes.get(session.userId) ?? { displayName: session.user.displayName, minutes: 0 };
            current.minutes += Math.round(session.durationSeconds / 60);
            contributorMinutes.set(session.userId, current);
        }
        const previousContributorMinutes = new Map();
        for (const session of previousSessionRows) {
            const current = previousContributorMinutes.get(session.userId) ?? { displayName: session.user.displayName, minutes: 0 };
            current.minutes += Math.round(session.durationSeconds / 60);
            previousContributorMinutes.set(session.userId, current);
        }
        const helperCounts = new Map();
        for (const question of squadWallQuestions) {
            for (const answer of question.answers) {
                helperCounts.set(answer.user.displayName, (helperCounts.get(answer.user.displayName) ?? 0) + 1);
            }
        }
        const topContributor = Array.from(contributorMinutes.values()).sort((a, b) => b.minutes - a.minutes || a.displayName.localeCompare(b.displayName))[0];
        const topHelperEntry = Array.from(helperCounts.entries()).sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB))[0];
        const mostImproved = Array.from(contributorMinutes.entries())
            .map(([userId, current]) => ({
            displayName: current.displayName,
            minutesGained: Math.max(0, current.minutes - (previousContributorMinutes.get(userId)?.minutes ?? 0))
        }))
            .filter((entry) => entry.minutesGained > 0)
            .sort((a, b) => b.minutesGained - a.minutesGained || a.displayName.localeCompare(b.displayName))[0];
        const rankedContributors = Array.from(contributorMinutes.entries()).sort(([, a], [, b]) => b.minutes - a.minutes || a.displayName.localeCompare(b.displayName));
        const viewerRankIndex = rankedContributors.findIndex(([userId]) => userId === viewerUserId);
        const viewerMinutes = contributorMinutes.get(viewerUserId)?.minutes ?? 0;
        const weeklyMinutes = Math.round(sessionRows.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
        const todayMinutes = Math.round(todayRows.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
        const weeklyGoalMinutes = Math.max(180, memberIds.size * 90);
        const goalProgress = Math.min(100, Math.round((weeklyMinutes / weeklyGoalMinutes) * 100));
        const activeTodayCount = new Set(todayRows.map((session) => session.userId)).size;
        const remainingMinutes = Math.max(0, weeklyGoalMinutes - weeklyMinutes);
        const pushMinutes = Math.min(25, remainingMinutes || 25);
        const momentum = todayMinutes > 0
            ? "Active today"
            : goalProgress >= 75
                ? "Closing goal"
                : questionCount + wallAnswerCount > 0
                    ? "Question energy"
                    : "Waiting for work";
        let nextNudge = `Goal hit. Keep ${squad.shortName} moving.`;
        if (memberIds.has(viewerUserId) && viewerMinutes === 0) {
            nextNudge = `Log ${pushMinutes}m so ${squad.shortName} has your name on the board.`;
        }
        else if (openQuestionCount > 0) {
            nextNudge = `${openQuestionCount} open question${openQuestionCount === 1 ? "" : "s"} need${openQuestionCount === 1 ? "s" : ""} a clean answer.`;
        }
        else if (activeTodayCount === 0) {
            nextNudge = `First ${pushMinutes}m today wakes ${squad.shortName} up.`;
        }
        else if (remainingMinutes > 0) {
            nextNudge = `${pushMinutes}m pushes ${squad.shortName} closer to the squad goal.`;
        }
        return {
            id: squad.id,
            name: squad.name,
            shortName: squad.shortName,
            color: squad.color,
            identity: squad.identity,
            weeklyMinutes,
            weeklyGoalMinutes,
            goalProgress,
            todayMinutes,
            viewerMinutes,
            viewerRank: viewerRankIndex >= 0 ? viewerRankIndex + 1 : null,
            momentum,
            openQuestionCount,
            activeTodayCount,
            nextNudge,
            topContributor: topContributor ? { displayName: topContributor.displayName, minutes: topContributor.minutes } : null,
            topHelper: topHelperEntry ? { displayName: topHelperEntry[0], answers: topHelperEntry[1] } : null,
            mostImproved: mostImproved ?? null,
            questionsAnswered: questionCount + wallAnswerCount,
            streakCount: new Set(memberRows
                .filter((subject) => (subject.user.gamification?.currentStreak ?? 0) > 0)
                .map((subject) => subject.userId)).size,
            memberCount: memberIds.size,
            viewerJoined: memberIds.has(viewerUserId)
        };
    });
};
const nextSuggestedRoomSession = (roomId, fromDate) => {
    const roomIndex = Math.max(0, LIVE_STUDY_ROOMS.findIndex((room) => room.id === roomId));
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    const baseMinutes = next.getMinutes();
    const roundedMinutes = baseMinutes < 30 ? 30 : 60;
    next.setMinutes(roundedMinutes, 0, 0);
    next.setMinutes(next.getMinutes() + roomIndex * 10);
    return next;
};
const buildLiveStudyRooms = async () => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const activeCutoff = new Date(now.getTime() - 2 * 60 * 1000);
    const [presence, sessions] = await Promise.all([
        prisma.userUsageEvent.findMany({
            where: {
                action: { startsWith: LIVE_ROOM_ACTION_PREFIX },
                createdAt: { gte: activeCutoff },
                user: { gamification: { is: { leaderboardOptIn: true } } }
            },
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { id: true, displayName: true }
                }
            }
        }),
        prisma.studySession.findMany({
            where: {
                createdAt: { gte: weekStart },
                user: { gamification: { is: { leaderboardOptIn: true } } }
            },
            select: {
                durationSeconds: true,
                createdAt: true,
                subject: { select: { subjectName: true } }
            }
        })
    ]);
    const activeByRoom = new Map();
    for (const event of presence) {
        const roomId = event.action.replace(LIVE_ROOM_ACTION_PREFIX, "");
        if (!LIVE_STUDY_ROOMS.some((room) => room.id === roomId))
            continue;
        const room = activeByRoom.get(roomId) ?? new Map();
        if (!room.has(event.userId)) {
            room.set(event.userId, { displayName: event.user.displayName, lastSeenAt: event.createdAt });
        }
        activeByRoom.set(roomId, room);
    }
    return LIVE_STUDY_ROOMS.map((room) => {
        const activeStudents = Array.from(activeByRoom.get(room.id)?.values() ?? []);
        const weeklyMinutes = Math.round(sessions
            .filter((session) => squadForSubjectName(session.subject?.subjectName)?.id === room.squadId)
            .reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
        const weeklyGoalMinutes = room.targetMinutes * 8;
        const goalProgress = Math.min(100, Math.round((weeklyMinutes / weeklyGoalMinutes) * 100));
        const roomState = activeStudents.length ? "live" : weeklyMinutes > 0 ? "warming" : "quiet";
        const roomSessions = sessions.filter((session) => squadForSubjectName(session.subject?.subjectName)?.id === room.squadId);
        const recentlyActiveAt = roomSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt ?? null;
        const activityPreview = activeStudents.length
            ? `${activeStudents.length} student${activeStudents.length === 1 ? "" : "s"} currently studying here.`
            : recentlyActiveAt
                ? `Recently active from ${room.subjectHint} study.`
                : `No one inside yet. Start the first ${room.targetMinutes}m lock-in.`;
        return {
            ...room,
            nextSessionAt: nextSuggestedRoomSession(room.id, now).toISOString(),
            recentlyActiveAt,
            activityPreview,
            emptyCta: `Start ${room.targetMinutes}m room`,
            weeklyMinutes,
            weeklyGoalMinutes,
            goalProgress,
            roomState,
            activeCount: activeStudents.length,
            activeStudents
        };
    });
};
const buildCommunityActivityFeed = async () => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const [sessions, wallRows, roomEvents] = await Promise.all([
        prisma.studySession.findMany({
            where: {
                createdAt: { gte: weekStart },
                durationSeconds: { gte: 10 * 60 },
                user: { gamification: { is: { leaderboardOptIn: true } } }
            },
            orderBy: { createdAt: "desc" },
            take: 18,
            select: {
                durationSeconds: true,
                createdAt: true,
                subject: { select: { subjectName: true } },
                user: { select: { email: true } }
            }
        }),
        prisma.communityChatMessage.findMany({
            where: { createdAt: { gte: weekStart }, message: { startsWith: QUESTION_WALL_PREFIX } },
            orderBy: { createdAt: "desc" },
            take: 80,
            select: {
                id: true,
                message: true,
                createdAt: true,
                user: { select: { email: true } }
            }
        }),
        prisma.userUsageEvent.findMany({
            where: {
                createdAt: { gte: weekStart },
                action: { startsWith: LIVE_ROOM_ACTION_PREFIX },
                user: { gamification: { is: { leaderboardOptIn: true } } }
            },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
                id: true,
                action: true,
                createdAt: true,
                user: { select: { email: true } }
            }
        })
    ]);
    const questionSubjects = new Map();
    for (const row of wallRows) {
        const parsed = parseQuestionWallMessage(row.message);
        if (parsed?.kind === "q") {
            questionSubjects.set(parsed.questionId, parsed.subjectName ?? "General");
        }
    }
    const activity = [
        ...sessions
            .filter((session) => !isAdminEmail(session.user.email))
            .map((session) => {
            const minutes = Math.round(session.durationSeconds / 60);
            const subjectName = session.subject?.subjectName ?? "VCE";
            return {
                id: `study-${session.createdAt.getTime()}-${subjectName}`,
                type: "study",
                title: `${subjectName} study logged`,
                detail: `A ${subjectName} student completed ${minutes} minutes.`,
                createdAt: activityTime(session.createdAt),
                color: "#38BDF8",
                icon: "timer-outline"
            };
        }),
        ...wallRows
            .filter((row) => !isAdminEmail(row.user.email))
            .map((row) => {
            const parsed = parseQuestionWallMessage(row.message);
            if (!parsed)
                return null;
            const subjectName = parsed.kind === "q" ? parsed.subjectName ?? "General" : questionSubjects.get(parsed.questionId) ?? "General";
            return {
                id: `wall-${row.id}`,
                type: parsed.kind === "q" ? "question" : "answer",
                title: parsed.kind === "q" ? `${subjectName} question posted` : `${subjectName} question answered`,
                detail: parsed.kind === "q"
                    ? "Someone asked for help without putting their name on it."
                    : "A student helped the room move one question forward.",
                createdAt: activityTime(row.createdAt),
                color: parsed.kind === "q" ? "#A78BFA" : "#4ADE80",
                icon: parsed.kind === "q" ? "comment-question-outline" : "hand-heart-outline"
            };
        })
            .filter((item) => Boolean(item)),
        ...roomEvents
            .filter((event) => !isAdminEmail(event.user.email))
            .map((event) => {
            const roomId = event.action.replace(LIVE_ROOM_ACTION_PREFIX, "");
            const room = LIVE_STUDY_ROOMS.find((item) => item.id === roomId);
            return {
                id: `room-${event.id}`,
                type: "room",
                title: room ? `${room.title} opened` : "Study room opened",
                detail: room ? room.focusPrompt : "Someone started a public study room.",
                createdAt: activityTime(event.createdAt),
                color: room?.color ?? "#60A5FA",
                icon: "door-open"
            };
        })
    ];
    return activity
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
};
const buildCommunityPulse = (squads, liveRooms, questionWall, gamification, activityFeed) => {
    const topSquad = [...squads].sort((a, b) => b.weeklyMinutes - a.weeklyMinutes)[0];
    const viewerRanks = squads.map((squad) => squad.viewerRank).filter((rank) => typeof rank === "number");
    return {
        snapshot: {
            weeklyStudyMinutes: squads.reduce((sum, squad) => sum + squad.viewerMinutes, 0),
            bestSquadRank: viewerRanks.length ? Math.min(...viewerRanks) : null,
            questionsHelped: questionWall.filter((question) => question.answeredByViewer).length,
            badgesEarned: badgesAsArray(gamification.badges).length,
            currentStreak: gamification.currentStreak,
            joinedSquads: squads.filter((squad) => squad.viewerJoined).length
        },
        activityFeed,
        weeklyMinutes: squads.reduce((sum, squad) => sum + squad.weeklyMinutes, 0),
        activeNow: liveRooms.reduce((sum, room) => sum + room.activeCount, 0),
        openQuestions: questionWall.filter((question) => question.answerCount === 0).length,
        helpfulAnswers: questionWall.reduce((sum, question) => sum + question.answerCount, 0),
        topSquad: topSquad && topSquad.weeklyMinutes > 0
            ? {
                id: topSquad.id,
                name: topSquad.shortName,
                minutes: topSquad.weeklyMinutes,
                color: topSquad.color
            }
            : null
    };
};
const awardPublicMissionIfReady = async (userId, complete) => {
    if (!complete)
        return false;
    const gamification = await ensureGamification(userId);
    const badges = badgesAsArray(gamification.badges);
    if (badges.includes(WEEKLY_MISSION_BADGE_ID)) {
        return true;
    }
    const totalXp = gamification.totalXp + WEEKLY_MISSION_XP;
    await prisma.userGamification.update({
        where: { userId },
        data: {
            totalXp,
            xpBalance: { increment: WEEKLY_MISSION_XP },
            level: levelFromXp(totalXp),
            badges: Array.from(new Set([...badges, WEEKLY_MISSION_BADGE_ID]))
        }
    });
    return true;
};
const buildPublicMission = async (viewerUserId) => {
    const weekStart = startOfWeek(new Date());
    const [deepSessions, savedQuestions, notes, resources, wallAnswers] = await Promise.all([
        prisma.studySession.count({
            where: { userId: viewerUserId, createdAt: { gte: weekStart }, durationSeconds: { gte: 45 * 60 } }
        }),
        prisma.savedQuestion.count({ where: { userId: viewerUserId, createdAt: { gte: weekStart } } }),
        prisma.studyNote.count({ where: { userId: viewerUserId, createdAt: { gte: weekStart } } }),
        prisma.studyResource.count({ where: { userId: viewerUserId, createdAt: { gte: weekStart } } }),
        prisma.communityChatMessage.count({
            where: { userId: viewerUserId, message: { startsWith: `${QUESTION_WALL_PREFIX}a:` }, createdAt: { gte: weekStart } }
        })
    ]);
    const values = {
        "deep-work": deepSessions,
        questions: savedQuestions + wallAnswers,
        notes: notes + resources,
        practice: savedQuestions
    };
    const items = PUBLIC_MISSION.items.map((item) => ({
        ...item,
        progress: Math.min(item.target, values[item.id] ?? 0),
        complete: (values[item.id] ?? 0) >= item.target
    }));
    const complete = items.every((item) => item.complete);
    const rewardClaimed = await awardPublicMissionIfReady(viewerUserId, complete);
    const nextIncomplete = items.find((item) => !item.complete);
    return {
        id: PUBLIC_MISSION.id,
        title: PUBLIC_MISSION.title,
        reward: rewardClaimed ? `Reward secured: ${WEEKLY_MISSION_XP} XP and Weekly Lock-In badge.` : PUBLIC_MISSION.reward,
        items,
        complete,
        rewardClaimed,
        nextAction: nextIncomplete
            ? {
                id: nextIncomplete.id,
                label: nextIncomplete.actionLabel,
                action: nextIncomplete.action
            }
            : null
    };
};
const chessSignupClosesAt = (weekStart) => {
    const closesAt = new Date(weekStart);
    closesAt.setDate(closesAt.getDate() + (CHESS_SIGNUP_CLOSE_DAY - 1));
    closesAt.setHours(CHESS_SIGNUP_CLOSE_HOUR, 0, 0, 0);
    return closesAt;
};
const chessRoundCount = (entryCount) => (entryCount > 1 ? Math.ceil(Math.log2(entryCount)) : 1);
const chessRoundStartsAt = (weekStart, roundIndex) => {
    const startsAt = new Date(weekStart);
    if (roundIndex === 0) {
        startsAt.setDate(startsAt.getDate() + 2);
        startsAt.setHours(19, 30, 0, 0);
        return startsAt;
    }
    startsAt.setDate(startsAt.getDate() + 6);
    startsAt.setHours(19, 30 + (roundIndex - 1) * 90, 0, 0);
    return startsAt;
};
const chessRoundEndsAt = (weekStart, roundIndex) => new Date(chessRoundStartsAt(weekStart, roundIndex).getTime() + 90 * 60 * 1000);
const chessRoundLabel = (roundIndex, totalRounds) => {
    const roundsFromFinal = totalRounds - roundIndex - 1;
    if (roundsFromFinal === 0)
        return "Final";
    if (roundsFromFinal === 1)
        return "Semi final";
    if (roundsFromFinal === 2)
        return "Quarter final";
    return `Knockout round ${roundIndex + 1}`;
};
const chessRoundsForWeek = (weekStart, now, entryCount) => {
    const totalRounds = chessRoundCount(entryCount);
    return Array.from({ length: totalRounds }, (_, roundIndex) => {
        const startsAt = chessRoundStartsAt(weekStart, roundIndex);
        const endsAt = chessRoundEndsAt(weekStart, roundIndex);
        return {
            id: `round-${roundIndex + 1}`,
            label: chessRoundLabel(roundIndex, totalRounds),
            startsAt,
            status: now < startsAt ? "upcoming" : now <= endsAt ? "live" : "done"
        };
    });
};
const chessMatchCode = (weekStart, round, pairIndex) => {
    const weekKey = weekStart.toISOString().slice(5, 10).replace("-", "");
    return `FORGE-${weekKey}-R${round}-M${pairIndex + 1}`;
};
const chessTournamentAvailabilityForWeek = async (weekStart) => {
    const nextWeekStart = addWeeks(weekStart, 1);
    const communityStudy = await prisma.studySession.aggregate({
        where: {
            createdAt: {
                gte: weekStart,
                lt: nextWeekStart
            }
        },
        _sum: { durationSeconds: true }
    });
    const communityMinutes = Math.floor((communityStudy._sum.durationSeconds ?? 0) / 60);
    const cadenceWeek = isChessCadenceWeek(weekStart);
    const communityGoalMet = communityMinutes >= CHESS_COMMUNITY_UNLOCK_MINUTES;
    return {
        available: cadenceWeek || communityGoalMet,
        cadenceWeek,
        communityGoalMet,
        communityMinutes,
        communityGoalMinutes: CHESS_COMMUNITY_UNLOCK_MINUTES,
        nextScheduledWeekStart: nextChessCadenceWeekStart(weekStart),
        unlockReason: cadenceWeek ? "cadence" : communityGoalMet ? "community_goal" : "locked"
    };
};
const chessMatchInclude = {
    whiteUser: { select: { id: true, displayName: true } },
    blackUser: { select: { id: true, displayName: true } },
    winnerUser: { select: { id: true, displayName: true } }
};
const chessStatusCopy = (status, winnerName, result) => {
    if (result === "no-show")
        return winnerName ? `${winnerName} won by no-show.` : "Won by no-show.";
    if (status === "white_win")
        return winnerName ? `${winnerName} won by checkmate.` : "White won by checkmate.";
    if (status === "black_win")
        return winnerName ? `${winnerName} won by checkmate.` : "Black won by checkmate.";
    if (status === "draw")
        return "Draw.";
    return "Active match.";
};
const chessTournamentResultCopy = (status, result, winnerName) => {
    if (!status)
        return "Scheduled";
    if (status === "active")
        return result ? `In progress - ${result}` : "In progress";
    return chessStatusCopy(status, winnerName, result);
};
const buildChessKnockoutBracket = ({ entries, matchRecords, rounds, signupOpen, viewerUserId, weekStart }) => {
    const matchesByCode = new Map(matchRecords.map((match) => [match.matchCode, match]));
    const pairings = [];
    const tournamentMatches = [];
    let participants = [...entries];
    for (const [roundIndex, round] of rounds.entries()) {
        if (participants.length < 2)
            break;
        const winners = [];
        let roundComplete = true;
        let pairIndex = 0;
        for (let index = 0; index < participants.length; index += 2) {
            const whiteEntry = participants[index];
            const blackEntry = participants[index + 1];
            if (!whiteEntry)
                continue;
            if (!blackEntry) {
                winners.push(whiteEntry);
                tournamentMatches.push({
                    id: `${round.id}-bye-${whiteEntry.userId}`,
                    round: roundIndex + 1,
                    label: round.label,
                    startsAt: round.startsAt.toISOString(),
                    matchCode: null,
                    status: "bye",
                    result: null,
                    resultCopy: "Bye - advances",
                    canOpen: false,
                    canTiebreak: false,
                    canClaimNoShow: false,
                    viewerColor: whiteEntry.userId === viewerUserId ? "white" : null,
                    white: { displayName: whiteEntry.user.displayName },
                    black: null
                });
                continue;
            }
            const matchCode = chessMatchCode(weekStart, roundIndex + 1, pairIndex);
            const pairing = {
                matchCode,
                round: roundIndex + 1,
                pairIndex,
                label: round.label,
                startsAt: round.startsAt,
                whiteEntry,
                blackEntry
            };
            pairings.push(pairing);
            pairIndex += 1;
            const record = matchesByCode.get(matchCode);
            const status = record?.status ?? "scheduled";
            const viewerIsWhite = whiteEntry.userId === viewerUserId;
            const viewerIsBlack = blackEntry.userId === viewerUserId;
            const noShowClaimColor = !signupOpen && round.status === "done" && (!record || record.status === "active")
                ? new Chess(record?.fen ?? new Chess().fen()).turn() === "w"
                    ? "black"
                    : "white"
                : null;
            tournamentMatches.push({
                id: matchCode,
                round: roundIndex + 1,
                label: round.label,
                startsAt: round.startsAt.toISOString(),
                matchCode,
                status: status,
                result: record?.result ?? null,
                resultCopy: chessTournamentResultCopy(record?.status, record?.result, record?.winnerUser?.displayName ?? null),
                canOpen: !signupOpen && (viewerIsWhite || viewerIsBlack),
                canTiebreak: !signupOpen && record?.status === "draw" && (viewerIsWhite || viewerIsBlack),
                canClaimNoShow: noShowClaimColor === "white" ? viewerIsWhite : noShowClaimColor === "black" ? viewerIsBlack : false,
                viewerColor: viewerIsWhite ? "white" : viewerIsBlack ? "black" : null,
                white: { displayName: whiteEntry.user.displayName },
                black: { displayName: blackEntry.user.displayName }
            });
            if (record?.status === "white_win") {
                winners.push(whiteEntry);
            }
            else if (record?.status === "black_win") {
                winners.push(blackEntry);
            }
            else {
                roundComplete = false;
            }
        }
        if (!roundComplete) {
            for (const futureRound of rounds.slice(roundIndex + 1)) {
                tournamentMatches.push({
                    id: `${futureRound.id}-waiting`,
                    round: Number(futureRound.id.replace("round-", "")),
                    label: futureRound.label,
                    startsAt: futureRound.startsAt.toISOString(),
                    matchCode: null,
                    status: "waiting",
                    result: null,
                    resultCopy: "Waiting for winners",
                    canOpen: false,
                    canTiebreak: false,
                    canClaimNoShow: false,
                    viewerColor: null,
                    white: null,
                    black: null
                });
            }
            return { pairings, tournamentMatches, remainingParticipants: participants, complete: false };
        }
        participants = winners;
    }
    return {
        pairings,
        tournamentMatches,
        remainingParticipants: participants,
        complete: entries.length > 1 && participants.length === 1
    };
};
const serialiseChessMatch = (match, viewerUserId, pairing) => {
    const game = new Chess(match.fen);
    const viewerColor = match.whiteUserId === viewerUserId ? "white" : "black";
    const turn = game.turn() === "w" ? "white" : "black";
    const opponent = viewerColor === "white" ? match.blackUser : match.whiteUser;
    const canMove = match.status === "active" && !pairing.signupOpen && turn === viewerColor;
    const canTiebreak = match.status === "draw" && !pairing.signupOpen;
    const noShowDeadlineAt = chessRoundEndsAt(match.weekStart, match.round - 1);
    const canClaimNoShow = match.status === "active" && !pairing.signupOpen && new Date() > noShowDeadlineAt && turn !== viewerColor;
    return {
        id: match.id,
        matchCode: match.matchCode,
        weekStart: match.weekStart.toISOString(),
        round: match.round,
        label: pairing.label,
        startsAt: pairing.startsAt.toISOString(),
        fen: match.fen,
        pgn: match.pgn,
        status: match.status,
        result: match.result,
        resultCopy: chessStatusCopy(match.status, match.winnerUser?.displayName ?? null, match.result),
        viewerColor,
        turn,
        canMove,
        canTiebreak,
        canClaimNoShow,
        noShowDeadlineAt: noShowDeadlineAt.toISOString(),
        signupOpen: pairing.signupOpen,
        white: { displayName: match.whiteUser.displayName },
        black: { displayName: match.blackUser.displayName },
        opponent: { displayName: opponent.displayName },
        lastMove: match.lastMoveFrom && match.lastMoveTo
            ? {
                from: match.lastMoveFrom,
                to: match.lastMoveTo,
                san: match.lastMoveSan,
                at: match.lastMoveAt?.toISOString() ?? null
            }
            : null,
        inCheck: game.isCheck(),
        checkmate: game.isCheckmate(),
        draw: game.isDraw()
    };
};
const resolveChessPairing = async (matchCode, viewerUserId) => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const signupClosesAt = chessSignupClosesAt(weekStart);
    const [entries, matchRecords, availability] = await Promise.all([
        prisma.communityChessTournamentEntry.findMany({
            where: { weekStart },
            orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
            include: { user: { select: { displayName: true } } }
        }),
        prisma.communityChessMatch.findMany({
            where: { weekStart },
            include: chessMatchInclude
        }),
        chessTournamentAvailabilityForWeek(weekStart)
    ]);
    const signupOpen = availability.available && now <= signupClosesAt;
    const rounds = chessRoundsForWeek(weekStart, now, entries.length);
    const bracket = buildChessKnockoutBracket({ entries, matchRecords, rounds, signupOpen, viewerUserId, weekStart });
    for (const pairing of bracket.pairings) {
        if (pairing.matchCode !== matchCode)
            continue;
        const viewerIsPlayer = pairing.whiteEntry.userId === viewerUserId || pairing.blackEntry.userId === viewerUserId;
        if (!viewerIsPlayer) {
            throw new HttpError(403, "This chess match belongs to another pairing.");
        }
        return { ...pairing, weekStart, signupOpen };
    }
    throw new HttpError(404, "Chess match not found for this week's pairings.");
};
const ensureChessMatch = async (pairing) => prisma.communityChessMatch.upsert({
    where: { matchCode: pairing.matchCode },
    update: {},
    create: {
        weekStart: pairing.weekStart,
        round: pairing.round,
        matchCode: pairing.matchCode,
        whiteUserId: pairing.whiteEntry.userId,
        blackUserId: pairing.blackEntry.userId,
        fen: new Chess().fen(),
        pgn: ""
    },
    include: chessMatchInclude
});
const buildChessTournament = async (viewerUserId) => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const signupClosesAt = chessSignupClosesAt(weekStart);
    const [study, viewerEntry, entries, matchRecords, availability] = await Promise.all([
        prisma.studySession.aggregate({
            where: { userId: viewerUserId, createdAt: { gte: weekStart } },
            _sum: { durationSeconds: true }
        }),
        prisma.communityChessTournamentEntry.findUnique({
            where: { userId_weekStart: { userId: viewerUserId, weekStart } }
        }),
        prisma.communityChessTournamentEntry.findMany({
            where: { weekStart },
            orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
            include: { user: { select: { id: true, displayName: true } } }
        }),
        prisma.communityChessMatch.findMany({
            where: { weekStart },
            include: chessMatchInclude
        }),
        chessTournamentAvailabilityForWeek(weekStart)
    ]);
    const signupOpen = availability.available && now <= signupClosesAt;
    const viewerMinutes = Math.floor((study._sum.durationSeconds ?? 0) / 60);
    const joined = Boolean(viewerEntry);
    const rounds = chessRoundsForWeek(weekStart, now, entries.length);
    const nextRound = rounds.find((round) => round.status !== "done") ?? rounds[rounds.length - 1];
    const bracket = buildChessKnockoutBracket({ entries, matchRecords, rounds, signupOpen, viewerUserId, weekStart });
    const decisiveLosses = new Set();
    for (const match of matchRecords) {
        if (match.status === "white_win") {
            decisiveLosses.add(match.blackUserId);
        }
        else if (match.status === "black_win") {
            decisiveLosses.add(match.whiteUserId);
        }
    }
    const championUserId = bracket.complete ? bracket.remainingParticipants[0]?.userId : null;
    const aliveUserIds = new Set(bracket.remainingParticipants.map((entry) => entry.userId));
    const matchRecordsByCode = new Map(matchRecords.map((match) => [match.matchCode, match]));
    const viewerMatches = joined
        ? bracket.tournamentMatches
            .filter((match) => match.viewerColor ||
            (match.status === "waiting" && aliveUserIds.has(viewerUserId)))
            .map((match) => ({
            id: match.id,
            round: match.round,
            label: match.label,
            startsAt: match.startsAt,
            status: match.status === "bye"
                ? "bye"
                : match.viewerColor
                    ? "paired"
                    : "waiting",
            color: match.viewerColor ?? "either",
            matchCode: match.matchCode ?? null,
            opponent: match.viewerColor === "white"
                ? match.black ?? null
                : match.viewerColor === "black"
                    ? match.white ?? null
                    : null
        }))
        : rounds.map((round, roundIndex) => ({
            id: `${round.id}-signup`,
            round: roundIndex + 1,
            label: round.label,
            startsAt: round.startsAt.toISOString(),
            status: "signup",
            color: "either",
            matchCode: null,
            opponent: null
        }));
    if (joined && championUserId === viewerUserId) {
        viewerMatches.push({
            id: "champion",
            round: rounds.length,
            label: "Champion",
            startsAt: (rounds[rounds.length - 1] ?? nextRound).startsAt.toISOString(),
            status: "champion",
            color: "either",
            matchCode: null,
            opponent: null
        });
    }
    else if (joined && decisiveLosses.has(viewerUserId)) {
        viewerMatches.push({
            id: "eliminated",
            round: rounds.length,
            label: "Knockout status",
            startsAt: (rounds[rounds.length - 1] ?? nextRound).startsAt.toISOString(),
            status: "eliminated",
            color: "either",
            matchCode: null,
            opponent: null
        });
    }
    const standingsByUser = new Map();
    for (const entry of entries) {
        standingsByUser.set(entry.userId, {
            displayName: entry.user.displayName,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            matchesRemaining: 0,
            status: "alive",
            isCurrentUser: entry.userId === viewerUserId
        });
    }
    for (const pairing of bracket.pairings) {
        const record = matchRecordsByCode.get(pairing.matchCode);
        const whiteStanding = standingsByUser.get(pairing.whiteEntry.userId);
        const blackStanding = standingsByUser.get(pairing.blackEntry.userId);
        if (record?.status === "white_win") {
            if (whiteStanding) {
                whiteStanding.played += 1;
                whiteStanding.wins += 1;
                whiteStanding.points += 1;
            }
            if (blackStanding) {
                blackStanding.played += 1;
                blackStanding.losses += 1;
            }
        }
        else if (record?.status === "black_win") {
            if (blackStanding) {
                blackStanding.played += 1;
                blackStanding.wins += 1;
                blackStanding.points += 1;
            }
            if (whiteStanding) {
                whiteStanding.played += 1;
                whiteStanding.losses += 1;
            }
        }
        else if (record?.status === "draw") {
            if (whiteStanding) {
                whiteStanding.played += 1;
                whiteStanding.draws += 1;
                whiteStanding.points += 0.5;
            }
            if (blackStanding) {
                blackStanding.played += 1;
                blackStanding.draws += 1;
                blackStanding.points += 0.5;
            }
        }
        else {
            if (whiteStanding)
                whiteStanding.matchesRemaining += 1;
            if (blackStanding)
                blackStanding.matchesRemaining += 1;
        }
    }
    for (const [userId, standing] of standingsByUser.entries()) {
        if (championUserId === userId) {
            standing.status = "champion";
        }
        else if (decisiveLosses.has(userId)) {
            standing.status = "eliminated";
        }
    }
    const standings = Array.from(standingsByUser.values()).sort((a, b) => b.points - a.points ||
        b.wins - a.wins ||
        b.played - a.played ||
        a.displayName.localeCompare(b.displayName));
    const viewerHasOpenMatch = bracket.tournamentMatches.some((match) => match.canOpen && match.matchCode && (match.status === "scheduled" || match.status === "active"));
    const missedGameRule = "Missed games: after the round window, the player waiting on the opponent can claim a no-show win.";
    const lockedCopy = `Chess knockout is locked this week. It runs every ${CHESS_CADENCE_WEEKS} weeks, or sooner when the community reaches ${availability.communityGoalMinutes} study minutes. Current total: ${availability.communityMinutes}.`;
    const openCopy = availability.unlockReason === "community_goal"
        ? `Community unlocked this week's chess knockout by hitting ${availability.communityMinutes}/${availability.communityGoalMinutes} study minutes. ${missedGameRule}`
        : `Scheduled chess knockout week is live. ${missedGameRule}`;
    const closedCopy = availability.available
        ? `Signups are closed for this tournament. ${missedGameRule}`
        : lockedCopy;
    const statusCopy = joined
        ? signupOpen
            ? `You are signed up. The knockout bracket locks Tuesday 8pm. ${missedGameRule}`
            : championUserId === viewerUserId
                ? "You won this week's chess knockout."
                : decisiveLosses.has(viewerUserId)
                    ? "You were knocked out. You can still watch the bracket finish."
                    : viewerHasOpenMatch
                        ? `Your knockout match is ready. ${missedGameRule}`
                        : `You are still alive. Waiting for the next knockout opponent. ${missedGameRule}`
        : signupOpen
            ? `Sign up before Tuesday 8pm to enter this week's knockout bracket. ${openCopy}`
            : closedCopy;
    return {
        weekStart: weekStart.toISOString(),
        signupClosesAt: signupClosesAt.toISOString(),
        signupOpen,
        requiredMinutes: 0,
        viewerMinutes,
        communityMinutes: availability.communityMinutes,
        communityGoalMinutes: availability.communityGoalMinutes,
        communityGoalMet: availability.communityGoalMet,
        cadenceWeek: availability.cadenceWeek,
        tournamentAvailable: availability.available,
        unlockReason: availability.unlockReason,
        nextScheduledWeekStart: availability.nextScheduledWeekStart.toISOString(),
        eligible: availability.available || joined,
        joined,
        joinedCount: entries.length,
        pairingCount: bracket.pairings.length,
        nextRoundAt: nextRound.startsAt.toISOString(),
        statusCopy,
        rounds: rounds.map((round) => ({
            id: round.id,
            label: round.label,
            startsAt: round.startsAt.toISOString(),
            status: signupOpen && !joined ? "signup" : round.status
        })),
        viewerMatches,
        tournamentMatches: bracket.tournamentMatches,
        standings
    };
};
const communityPayload = async (user) => {
    const isAdmin = isAdminEmail(user.email);
    const gamification = await ensureDefaultCommunityVisibility(user.id);
    const mutedUserIds = await mutedUserIdsFor(user.id);
    const [feedback, chatDesc, allowance, users, landingContacts, reports, mutedUsers, squads, liveRooms, questionWall, mission, boards, activityFeed, chessTournament] = await Promise.all([
        prisma.userFeedback.findMany({
            where: isAdmin ? {} : { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: isAdmin ? 100 : 20,
            include: {
                user: {
                    select: {
                        displayName: true,
                        email: true
                    }
                }
            }
        }),
        prisma.communityChatMessage.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
            include: {
                user: {
                    select: { displayName: true }
                }
            }
        }),
        chatAllowanceFor(user.id),
        isAdmin ? adminUsers() : Promise.resolve([]),
        isAdmin ? publicContactsForAdmin() : Promise.resolve([]),
        isAdmin ? communityReportsForAdmin() : Promise.resolve([]),
        mutedUsersFor(user.id),
        buildWeeklySubjectSquads(user.id),
        buildLiveStudyRooms(),
        buildQuestionWall(user.id, mutedUserIds),
        buildPublicMission(user.id),
        buildCommunityLeaderboards(user.id),
        buildCommunityActivityFeed(),
        buildChessTournament(user.id)
    ]);
    const chat = chatDesc
        .filter((message) => !isCommunitySystemMessage(message.message))
        .filter((message) => message.userId === user.id || !mutedUserIds.has(message.userId))
        .slice(0, 80)
        .reverse()
        .map((message) => serialiseChatMessage(message, user.id));
    return {
        isAdmin,
        feedback: feedback.map((item) => serialiseFeedback(item, isAdmin)),
        landingContacts: landingContacts.map(serialisePublicContact),
        reports,
        mutedUsers,
        chat,
        allowance,
        users,
        pulse: buildCommunityPulse(squads, liveRooms, questionWall, gamification, activityFeed),
        squads,
        liveRooms,
        questionWall,
        mission,
        boards,
        chessTournament
    };
};
const serialiseGiftMessage = (gift) => ({
    id: gift.id,
    title: gift.title,
    message: gift.message,
    giftType: gift.giftType,
    giftId: gift.giftId,
    readAt: gift.readAt,
    createdAt: gift.createdAt
});
const startOfHour = (date) => {
    const start = new Date(date);
    start.setMinutes(0, 0, 0);
    return start;
};
const uniqueCount = (values) => new Set(values).size;
const buildUsageAnalytics = async () => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [usageEvents, sessions, chatMessages, feedbackItems, users] = await Promise.all([
        prisma.userUsageEvent.findMany({
            where: { createdAt: { gte: weekAgo } },
            orderBy: { createdAt: "desc" },
            take: 5000,
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        schoolName: true
                    }
                }
            }
        }),
        prisma.studySession.findMany({
            where: { createdAt: { gte: weekAgo } },
            select: {
                userId: true,
                durationSeconds: true,
                createdAt: true
            }
        }),
        prisma.communityChatMessage.findMany({
            where: { createdAt: { gte: weekAgo } },
            select: {
                userId: true,
                createdAt: true
            }
        }),
        prisma.userFeedback.findMany({
            where: { createdAt: { gte: weekAgo } },
            select: {
                userId: true,
                createdAt: true
            }
        }),
        prisma.user.findMany({
            select: {
                id: true,
                displayName: true,
                email: true,
                schoolName: true
            }
        })
    ]);
    const studentUsers = users.filter((user) => !isAdminEmail(user.email));
    const studentIds = new Set(studentUsers.map((user) => user.id));
    const studentUsageEvents = usageEvents.filter((event) => studentIds.has(event.userId));
    const usage24h = studentUsageEvents.filter((event) => event.createdAt >= dayAgo);
    const usage10m = studentUsageEvents.filter((event) => event.createdAt >= tenMinutesAgo);
    const studentSessions = sessions.filter((session) => studentIds.has(session.userId));
    const studentChats = chatMessages.filter((message) => studentIds.has(message.userId));
    const studentFeedback = feedbackItems.filter((item) => studentIds.has(item.userId));
    const userRows = new Map(studentUsers.map((user) => [
        user.id,
        {
            userId: user.id,
            displayName: user.displayName,
            email: user.email,
            schoolName: user.schoolName,
            lastSeenAt: null,
            lastScreen: null,
            events24h: 0,
            events7d: 0,
            studyMinutes7d: 0,
            chatMessages7d: 0,
            feedback7d: 0
        }
    ]));
    for (const event of studentUsageEvents) {
        const row = userRows.get(event.userId);
        if (!row)
            continue;
        row.events7d += 1;
        if (event.createdAt >= dayAgo)
            row.events24h += 1;
        if (!row.lastSeenAt || event.createdAt > row.lastSeenAt) {
            row.lastSeenAt = event.createdAt;
            row.lastScreen = event.screen;
        }
    }
    for (const session of studentSessions) {
        const row = userRows.get(session.userId);
        if (row)
            row.studyMinutes7d += Math.round(session.durationSeconds / 60);
    }
    for (const chat of studentChats) {
        const row = userRows.get(chat.userId);
        if (row)
            row.chatMessages7d += 1;
    }
    for (const feedback of studentFeedback) {
        const row = userRows.get(feedback.userId);
        if (row)
            row.feedback7d += 1;
    }
    const currentHour = startOfHour(now);
    const hourBuckets = Array.from({ length: 24 }, (_, index) => {
        const hourStart = new Date(currentHour);
        hourStart.setHours(currentHour.getHours() - (23 - index));
        return hourStart;
    });
    const hourly = hourBuckets.map((hourStart) => {
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hourStart.getHours() + 1);
        const events = usage24h.filter((event) => event.createdAt >= hourStart && event.createdAt < hourEnd);
        return {
            hourStart,
            eventCount: events.length,
            uniqueUsers: uniqueCount(events.map((event) => event.userId))
        };
    });
    const screens = trackedScreens.map((screen) => {
        const events = studentUsageEvents.filter((event) => event.screen === screen);
        return {
            screen,
            label: screenLabels[screen],
            eventCount: events.length,
            uniqueUsers: uniqueCount(events.map((event) => event.userId)),
            lastSeenAt: events[0]?.createdAt ?? null
        };
    });
    return {
        generatedAt: now,
        totals: {
            activeNow: uniqueCount(usage10m.map((event) => event.userId)),
            activeToday: uniqueCount(usage24h.map((event) => event.userId)),
            active7Days: uniqueCount(studentUsageEvents.map((event) => event.userId)),
            trackedEvents24h: usage24h.length,
            studyMinutes7d: studentSessions.reduce((sum, session) => sum + Math.round(session.durationSeconds / 60), 0),
            chatMessages7d: studentChats.length,
            feedback7d: studentFeedback.length
        },
        hourly,
        screens,
        users: Array.from(userRows.values()).sort((a, b) => {
            const aTime = a.lastSeenAt?.getTime() ?? 0;
            const bTime = b.lastSeenAt?.getTime() ?? 0;
            return bTime - aTime || b.events7d - a.events7d || a.displayName.localeCompare(b.displayName);
        }),
        recent: studentUsageEvents.slice(0, 80).map((event) => ({
            id: event.id,
            userId: event.userId,
            displayName: event.user.displayName,
            email: event.user.email,
            schoolName: event.user.schoolName,
            screen: event.screen,
            label: screenLabels[event.screen] ?? event.screen,
            action: event.action,
            createdAt: event.createdAt
        }))
    };
};
communityRouter.get("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = await communityPayload(authReq.user);
    res.json(payload);
}));
communityRouter.get("/chess-tournament", asyncHandler(async (req, res) => {
    const authReq = req;
    const chessTournament = await buildChessTournament(authReq.user.id);
    res.json({ chessTournament });
}));
communityRouter.get("/chess-tournament/matches/:matchCode", asyncHandler(async (req, res) => {
    const authReq = req;
    const matchCode = chessMatchCodeSchema.parse(req.params.matchCode);
    const pairing = await resolveChessPairing(matchCode, authReq.user.id);
    if (pairing.signupOpen) {
        throw new HttpError(403, "Pairings lock Tuesday 8pm. You can open this match once signups close.");
    }
    const match = await ensureChessMatch(pairing);
    res.json({ match: serialiseChessMatch(match, authReq.user.id, pairing) });
}));
communityRouter.post("/chess-tournament/matches/:matchCode/move", asyncHandler(async (req, res) => {
    const authReq = req;
    const matchCode = chessMatchCodeSchema.parse(req.params.matchCode);
    const payload = chessMoveSchema.parse(req.body);
    const pairing = await resolveChessPairing(matchCode, authReq.user.id);
    if (pairing.signupOpen) {
        throw new HttpError(403, "Pairings lock Tuesday 8pm. You can play this match once signups close.");
    }
    const match = await ensureChessMatch(pairing);
    if (match.status !== "active") {
        throw new HttpError(400, "This chess match has already finished.");
    }
    const game = new Chess(match.fen);
    const viewerTurn = match.whiteUserId === authReq.user.id ? "w" : "b";
    if (game.turn() !== viewerTurn) {
        throw new HttpError(403, "It is not your turn in this chess match.");
    }
    let move;
    try {
        move = game.move({ from: payload.from, to: payload.to, promotion: payload.promotion });
    }
    catch {
        throw new HttpError(400, "That is not a legal chess move.");
    }
    if (!move) {
        throw new HttpError(400, "That is not a legal chess move.");
    }
    const now = new Date();
    const moveList = [match.pgn?.trim(), move.san].filter(Boolean).join(" ");
    let status = "active";
    let result = null;
    let winnerUserId = null;
    if (game.isCheckmate()) {
        const whiteWon = game.turn() === "b";
        status = whiteWon ? "white_win" : "black_win";
        result = whiteWon ? "1-0" : "0-1";
        winnerUserId = whiteWon ? match.whiteUserId : match.blackUserId;
    }
    else if (game.isDraw()) {
        status = "draw";
        result = "1/2-1/2";
    }
    const updated = await prisma.communityChessMatch.update({
        where: { id: match.id },
        data: {
            fen: game.fen(),
            pgn: moveList,
            status,
            result,
            winnerUserId,
            lastMoveFrom: move.from,
            lastMoveTo: move.to,
            lastMoveSan: move.san,
            lastMoveAt: now
        },
        include: chessMatchInclude
    });
    res.json({ match: serialiseChessMatch(updated, authReq.user.id, pairing) });
}));
communityRouter.post("/chess-tournament/matches/:matchCode/tiebreak", asyncHandler(async (req, res) => {
    const authReq = req;
    const matchCode = chessMatchCodeSchema.parse(req.params.matchCode);
    const pairing = await resolveChessPairing(matchCode, authReq.user.id);
    if (pairing.signupOpen) {
        throw new HttpError(403, "Pairings lock Tuesday 8pm. Tiebreaks open after signups close.");
    }
    const match = await ensureChessMatch(pairing);
    if (match.status !== "draw") {
        throw new HttpError(400, "A tiebreak can only start after a drawn chess match.");
    }
    const updated = await prisma.communityChessMatch.update({
        where: { id: match.id },
        data: {
            fen: new Chess().fen(),
            pgn: "",
            status: "active",
            result: null,
            winnerUserId: null,
            lastMoveFrom: null,
            lastMoveTo: null,
            lastMoveSan: null,
            lastMoveAt: null
        },
        include: chessMatchInclude
    });
    res.json({ match: serialiseChessMatch(updated, authReq.user.id, pairing) });
}));
communityRouter.post("/chess-tournament/matches/:matchCode/no-show", asyncHandler(async (req, res) => {
    const authReq = req;
    const matchCode = chessMatchCodeSchema.parse(req.params.matchCode);
    const pairing = await resolveChessPairing(matchCode, authReq.user.id);
    if (pairing.signupOpen) {
        throw new HttpError(403, "Pairings lock Tuesday 8pm. No-show claims open after the match window.");
    }
    const noShowDeadlineAt = chessRoundEndsAt(pairing.weekStart, pairing.round - 1);
    if (new Date() <= noShowDeadlineAt) {
        throw new HttpError(400, "No-show claims open after this round's match window closes.");
    }
    const match = await ensureChessMatch(pairing);
    if (match.status !== "active") {
        throw new HttpError(400, "This chess match has already finished.");
    }
    const game = new Chess(match.fen);
    const viewerColor = match.whiteUserId === authReq.user.id ? "white" : "black";
    const turn = game.turn() === "w" ? "white" : "black";
    if (turn === viewerColor) {
        throw new HttpError(403, "It is your turn. Make a move before you can claim a no-show.");
    }
    const updated = await prisma.communityChessMatch.update({
        where: { id: match.id },
        data: {
            status: viewerColor === "white" ? "white_win" : "black_win",
            result: "no-show",
            winnerUserId: authReq.user.id
        },
        include: chessMatchInclude
    });
    res.json({ match: serialiseChessMatch(updated, authReq.user.id, pairing) });
}));
communityRouter.post("/feedback", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = feedbackSchema.parse(req.body);
    const feedback = await prisma.userFeedback.create({
        data: {
            userId: authReq.user.id,
            category: payload.category,
            message: payload.message
        },
        include: {
            user: {
                select: {
                    displayName: true,
                    email: true
                }
            }
        }
    });
    res.status(201).json({ feedback: serialiseFeedback(feedback, isAdminEmail(authReq.user.email)) });
}));
communityRouter.get("/gifts", asyncHandler(async (req, res) => {
    const authReq = req;
    const gifts = await prisma.userGiftMessage.findMany({
        where: { userId: authReq.user.id },
        orderBy: { createdAt: "desc" },
        take: 10
    });
    res.json({ gifts: gifts.map(serialiseGiftMessage) });
}));
communityRouter.patch("/gifts/:id/read", asyncHandler(async (req, res) => {
    const authReq = req;
    const id = z.string().uuid().parse(req.params.id);
    const gift = await prisma.userGiftMessage.findFirst({ where: { id, userId: authReq.user.id } });
    if (!gift) {
        throw new HttpError(404, "Gift message not found");
    }
    const updated = await prisma.userGiftMessage.update({
        where: { id },
        data: { readAt: new Date() }
    });
    res.json({ gift: serialiseGiftMessage(updated) });
}));
communityRouter.post("/usage-events", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = usageEventSchema.parse(req.body);
    const recentCutoff = new Date(Date.now() - USAGE_EVENT_THROTTLE_MS);
    const recent = await prisma.userUsageEvent.findFirst({
        where: {
            userId: authReq.user.id,
            screen: payload.screen,
            action: payload.action,
            createdAt: { gte: recentCutoff }
        },
        orderBy: { createdAt: "desc" }
    });
    if (recent) {
        res.json({ usageEvent: recent, throttled: true });
        return;
    }
    const usageEvent = await prisma.userUsageEvent.create({
        data: {
            userId: authReq.user.id,
            screen: payload.screen,
            action: payload.action
        }
    });
    res.status(201).json({ usageEvent, throttled: false });
}));
communityRouter.get("/analytics", asyncHandler(async (req, res) => {
    const authReq = req;
    requireAdmin(authReq.user);
    const analytics = await buildUsageAnalytics();
    res.json({ analytics });
}));
communityRouter.post("/live-rooms/:roomId/heartbeat", asyncHandler(async (req, res) => {
    const authReq = req;
    const paramsRoomId = liveRoomHeartbeatSchema.shape.roomId.parse(req.params.roomId);
    const payload = liveRoomHeartbeatSchema.parse({ ...req.body, roomId: paramsRoomId });
    const room = LIVE_STUDY_ROOMS.find((item) => item.id === payload.roomId);
    if (!room) {
        throw new HttpError(404, "Study room not found");
    }
    await ensureDefaultCommunityVisibility(authReq.user.id);
    await prisma.userUsageEvent.create({
        data: {
            userId: authReq.user.id,
            screen: "community",
            action: `${LIVE_ROOM_ACTION_PREFIX}${room.id}`
        }
    });
    const liveRooms = await buildLiveStudyRooms();
    res.status(201).json({ liveRooms });
}));
communityRouter.post("/question-wall", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = questionWallSchema.parse(req.body);
    const questionId = randomUUID();
    const subjectName = payload.subjectName?.trim() || "General";
    const questionType = payload.questionType ?? "Concept help";
    await prisma.communityChatMessage.create({
        data: {
            userId: authReq.user.id,
            message: `${QUESTION_WALL_PREFIX}q:${questionId}]] ${subjectName} || [[type:${questionTypeSlug(questionType)}]] ${payload.message}`
        }
    });
    const questionWall = await buildQuestionWall(authReq.user.id, await mutedUserIdsFor(authReq.user.id));
    res.status(201).json({ questionWall });
}));
communityRouter.post("/question-wall/:questionId/answers", asyncHandler(async (req, res) => {
    const authReq = req;
    const questionId = z.string().uuid().parse(req.params.questionId);
    const payload = questionAnswerSchema.parse(req.body);
    const question = await prisma.communityChatMessage.findFirst({
        where: {
            message: { startsWith: `${QUESTION_WALL_PREFIX}q:${questionId}]]` }
        },
        select: { id: true, userId: true }
    });
    if (!question) {
        throw new HttpError(404, "Question not found");
    }
    if (question.userId === authReq.user.id) {
        throw new HttpError(400, "Let another student answer your question.");
    }
    const existingAnswer = await prisma.communityChatMessage.findFirst({
        where: {
            userId: authReq.user.id,
            message: { startsWith: `${QUESTION_WALL_PREFIX}a:${questionId}]]` }
        },
        select: { id: true }
    });
    if (existingAnswer) {
        throw new HttpError(400, "You have already answered this question.");
    }
    await prisma.communityChatMessage.create({
        data: {
            userId: authReq.user.id,
            message: `${QUESTION_WALL_PREFIX}a:${questionId}]] ${payload.message}`
        }
    });
    await addXp(authReq.user.id, 10);
    const [questionWall, allowance] = await Promise.all([
        buildQuestionWall(authReq.user.id, await mutedUserIdsFor(authReq.user.id)),
        chatAllowanceFor(authReq.user.id)
    ]);
    res.status(201).json({ questionWall, allowance });
}));
communityRouter.post("/question-wall/:questionId/save", asyncHandler(async (req, res) => {
    const authReq = req;
    const questionId = z.string().uuid().parse(req.params.questionId);
    const question = await prisma.communityChatMessage.findFirst({
        where: {
            message: { startsWith: `${QUESTION_WALL_PREFIX}q:${questionId}]]` }
        },
        select: { id: true }
    });
    if (!question) {
        throw new HttpError(404, "Question not found");
    }
    await prisma.communityQuestionSave.upsert({
        where: { userId_questionId: { userId: authReq.user.id, questionId } },
        create: { userId: authReq.user.id, questionId },
        update: {}
    });
    const questionWall = await buildQuestionWall(authReq.user.id, await mutedUserIdsFor(authReq.user.id));
    res.json({ questionWall });
}));
communityRouter.delete("/question-wall/:questionId/save", asyncHandler(async (req, res) => {
    const authReq = req;
    const questionId = z.string().uuid().parse(req.params.questionId);
    await prisma.communityQuestionSave
        .delete({
        where: { userId_questionId: { userId: authReq.user.id, questionId } }
    })
        .catch(() => undefined);
    const questionWall = await buildQuestionWall(authReq.user.id, await mutedUserIdsFor(authReq.user.id));
    res.json({ questionWall });
}));
communityRouter.post("/question-wall/answers/:answerId/helpful", asyncHandler(async (req, res) => {
    const authReq = req;
    const answerId = z.string().uuid().parse(req.params.answerId);
    const answer = await prisma.communityChatMessage.findUnique({
        where: { id: answerId },
        select: { id: true, userId: true, message: true }
    });
    const parsed = answer ? parseQuestionWallMessage(answer.message) : null;
    if (!answer || parsed?.kind !== "a") {
        throw new HttpError(404, "Answer not found");
    }
    if (answer.userId === authReq.user.id) {
        throw new HttpError(400, "Let another student mark your answer helpful.");
    }
    const existing = await prisma.communityQuestionHelpfulVote.findUnique({
        where: { userId_answerMessageId: { userId: authReq.user.id, answerMessageId: answer.id } }
    });
    if (existing) {
        await prisma.communityQuestionHelpfulVote.delete({ where: { id: existing.id } });
    }
    else {
        await prisma.communityQuestionHelpfulVote.create({
            data: {
                userId: authReq.user.id,
                answerMessageId: answer.id
            }
        });
        await addXp(answer.userId, 4);
    }
    const questionWall = await buildQuestionWall(authReq.user.id, await mutedUserIdsFor(authReq.user.id));
    res.json({ questionWall });
}));
communityRouter.post("/reports", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = reportSchema.parse(req.body);
    const message = await messageForReport(payload);
    const report = await prisma.communityReport.create({
        data: {
            reporterId: authReq.user.id,
            reportedUserId: payload.reportedUserId ?? message?.userId ?? null,
            messageId: message?.id ?? null,
            contentType: payload.contentType,
            contentId: payload.contentId,
            reason: payload.reason?.trim() || "Reported from Community"
        },
        include: {
            reporter: { select: { displayName: true, email: true } },
            reportedUser: { select: { displayName: true, email: true } }
        }
    });
    res.status(201).json({ report: serialiseCommunityReport(report) });
}));
communityRouter.patch("/reports/:id/status", asyncHandler(async (req, res) => {
    const authReq = req;
    requireAdmin(authReq.user);
    const id = z.string().uuid().parse(req.params.id);
    const payload = reportStatusSchema.parse(req.body);
    const report = await prisma.communityReport.update({
        where: { id },
        data: { status: payload.status },
        include: {
            reporter: { select: { displayName: true, email: true } },
            reportedUser: { select: { displayName: true, email: true } }
        }
    });
    res.json({ report: serialiseCommunityReport(report) });
}));
communityRouter.post("/users/:id/mute", asyncHandler(async (req, res) => {
    const authReq = req;
    const mutedUserId = z.string().uuid().parse(req.params.id);
    if (mutedUserId === authReq.user.id) {
        throw new HttpError(400, "You cannot mute yourself.");
    }
    const user = await prisma.user.findUnique({ where: { id: mutedUserId }, select: { id: true } });
    if (!user) {
        throw new HttpError(404, "User not found");
    }
    await prisma.communityUserMute.upsert({
        where: { userId_mutedUserId: { userId: authReq.user.id, mutedUserId } },
        create: { userId: authReq.user.id, mutedUserId },
        update: {}
    });
    res.status(201).json({ mutedUserId });
}));
communityRouter.delete("/users/:id/mute", asyncHandler(async (req, res) => {
    const authReq = req;
    const mutedUserId = z.string().uuid().parse(req.params.id);
    await prisma.communityUserMute
        .delete({
        where: { userId_mutedUserId: { userId: authReq.user.id, mutedUserId } }
    })
        .catch(() => undefined);
    res.status(204).send();
}));
communityRouter.post("/chess-tournament/join", asyncHandler(async (req, res) => {
    const authReq = req;
    const now = new Date();
    const weekStart = startOfWeek(now);
    const signupClosesAt = chessSignupClosesAt(weekStart);
    const availability = await chessTournamentAvailabilityForWeek(weekStart);
    if (!availability.available) {
        throw new HttpError(403, `Chess tournament is locked this week. It runs every ${CHESS_CADENCE_WEEKS} weeks, or when the community reaches ${availability.communityGoalMinutes} study minutes. Current total: ${availability.communityMinutes}.`);
    }
    if (now > signupClosesAt) {
        throw new HttpError(403, "Chess tournament signups are closed for this week. Next signup opens Monday.");
    }
    const study = await prisma.studySession.aggregate({
        where: { userId: authReq.user.id, createdAt: { gte: weekStart } },
        _sum: { durationSeconds: true }
    });
    const viewerMinutes = Math.floor((study._sum.durationSeconds ?? 0) / 60);
    await prisma.communityChessTournamentEntry.upsert({
        where: { userId_weekStart: { userId: authReq.user.id, weekStart } },
        create: {
            userId: authReq.user.id,
            weekStart,
            minutesAtEntry: viewerMinutes
        },
        update: {
            minutesAtEntry: viewerMinutes
        }
    });
    const chessTournament = await buildChessTournament(authReq.user.id);
    res.status(201).json({ chessTournament });
}));
communityRouter.post("/leaderboard/resend-invite", asyncHandler(async (req, res) => {
    const authReq = req;
    requireAdmin(authReq.user);
    const resentCount = await resendLeaderboardInvite();
    res.json({ resentCount });
}));
communityRouter.get("/subject-rooms", asyncHandler(async (req, res) => {
    const authReq = req;
    const rooms = await subjectRoomsForUser(authReq.user.id);
    res.json({ rooms });
}));
communityRouter.get("/subject-rooms/:roomId/chat", asyncHandler(async (req, res) => {
    const authReq = req;
    const roomId = subjectRoomIdSchema.parse(req.params.roomId);
    const room = await requireSubjectRoomForUser(authReq.user.id, roomId);
    const roomMarker = subjectRoomMarkerFor(room.id);
    const chatDesc = await prisma.communityChatMessage.findMany({
        where: {
            message: { startsWith: roomMarker }
        },
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
            user: {
                select: { displayName: true }
            }
        }
    });
    const mutedUserIds = await mutedUserIdsFor(authReq.user.id);
    const chat = chatDesc
        .filter((message) => message.userId === authReq.user.id || !mutedUserIds.has(message.userId))
        .reverse()
        .map((message) => serialiseChatMessage(message, authReq.user.id));
    res.json({ room, chat });
}));
communityRouter.post("/subject-rooms/:roomId/chat", asyncHandler(async (req, res) => {
    const authReq = req;
    const roomId = subjectRoomIdSchema.parse(req.params.roomId);
    const room = await requireSubjectRoomForUser(authReq.user.id, roomId);
    const payload = chatSchema.parse(req.body);
    const allowance = await chatAllowanceFor(authReq.user.id);
    if (allowance.remainingMinutes <= 0) {
        throw new HttpError(429, `Study ${CHAT_UNLOCK_STUDY_MINUTES} minutes today to unlock ${CHAT_UNLOCK_MESSAGES} messages. Study ${ROOM_CHAT_UNLOCK_STUDY_MINUTES} minutes for unlimited chat today.`);
    }
    const chatMessage = await prisma.communityChatMessage.create({
        data: {
            userId: authReq.user.id,
            message: `${subjectRoomMarkerFor(room.id)} ${payload.message}`
        },
        include: {
            user: {
                select: { displayName: true }
            }
        }
    });
    const nextAllowance = await chatAllowanceFor(authReq.user.id);
    res.status(201).json({
        room,
        chatMessage: serialiseChatMessage(chatMessage, authReq.user.id),
        allowance: nextAllowance
    });
}));
communityRouter.post("/chat", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = chatSchema.parse(req.body);
    const allowance = await chatAllowanceFor(authReq.user.id);
    if (allowance.remainingMinutes <= 0) {
        throw new HttpError(429, `Study ${CHAT_UNLOCK_STUDY_MINUTES} minutes today to unlock ${CHAT_UNLOCK_MESSAGES} messages. Help on the question wall for bonus messages.`);
    }
    const chatMessage = await prisma.communityChatMessage.create({
        data: {
            userId: authReq.user.id,
            message: payload.message.replace(SUBJECT_ROOM_PREFIX, "")
        },
        include: {
            user: {
                select: { displayName: true }
            }
        }
    });
    const nextAllowance = await chatAllowanceFor(authReq.user.id);
    res.status(201).json({
        chatMessage: serialiseChatMessage(chatMessage, authReq.user.id),
        allowance: nextAllowance
    });
}));
communityRouter.delete("/chat/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const id = z.string().uuid().parse(req.params.id);
    const existing = await prisma.communityChatMessage.findUnique({ where: { id } });
    if (!existing) {
        throw new HttpError(404, "Chat message not found");
    }
    if (existing.userId !== authReq.user.id && !isAdminEmail(authReq.user.email)) {
        requireAdmin(authReq.user);
    }
    await prisma.communityChatMessage.delete({ where: { id } });
    res.status(204).send();
}));
communityRouter.post("/admin-email", asyncHandler(async (req, res) => {
    const authReq = req;
    requireAdmin(authReq.user);
    const payload = adminEmailSchema.parse(req.body);
    if (payload.audience === "single" && !payload.userId) {
        throw new HttpError(400, "Choose a user before sending a direct email.");
    }
    const where = payload.audience === "single"
        ? { id: payload.userId ?? "" }
        : payload.audience === "opted_in"
            ? { weeklyDigestOptIn: true, weeklyDigestUnsubscribedAt: null }
            : {};
    const users = await prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: {
            id: true,
            email: true,
            displayName: true
        }
    });
    if (payload.audience === "single" && !users.length) {
        throw new HttpError(404, "User not found");
    }
    const recipients = Array.from(new Map(users
        .filter((user) => payload.audience === "single" || !isAdminEmail(user.email))
        .map((user) => [user.email.trim().toLowerCase(), user])).values());
    if (!recipients.length) {
        throw new HttpError(400, "No recipients matched that audience.");
    }
    const transport = await smtpTransport();
    if (!transport) {
        throw new HttpError(503, "SMTP is not configured on the backend.");
    }
    const from = defaultFromEmail("VCE Forge <no-reply@vceforge.space>");
    const replyTo = adminEmailReplyTo();
    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
        const email = buildAdminEmail(recipient, payload.subject, payload.message);
        try {
            await transport.sendMail({
                to: recipient.email,
                from,
                replyTo,
                subject: payload.subject,
                text: email.text,
                html: email.html
            });
            sent += 1;
        }
        catch (error) {
            failed += 1;
            console.error(`Admin email failed for ${recipient.email}`, error);
        }
    }
    if (!sent && failed) {
        throw new HttpError(502, "Email delivery failed for every recipient. Check SMTP auth on the backend.");
    }
    res.json({
        attempted: recipients.length,
        sent,
        failed
    });
}));
communityRouter.post("/users/:id/gifts/theme", asyncHandler(async (req, res) => {
    const authReq = req;
    requireAdmin(authReq.user);
    const userId = z.string().uuid().parse(req.params.id);
    const payload = giftThemeSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
        throw new HttpError(404, "User not found");
    }
    try {
        await grantThemeToUser(userId, payload.themeId, payload.equip);
    }
    catch (error) {
        throw new HttpError(error instanceof Error && error.message === "Theme not found" ? 404 : 400, error instanceof Error ? error.message : "Could not gift theme");
    }
    const theme = THEME_SHOP_ITEMS.find((item) => item.id === payload.themeId);
    await prisma.userGiftMessage.create({
        data: {
            userId,
            title: "You received a theme gift",
            message: `Sasen gifted you ${theme?.name ?? "a new theme"}. It has been unlocked${payload.equip ? " and equipped" : ""} for free.`,
            giftType: "theme",
            giftId: payload.themeId
        }
    });
    const user = await adminUserById(userId);
    res.json({ user });
}));
communityRouter.post("/users/:id/gifts/coins", asyncHandler(async (req, res) => {
    const authReq = req;
    requireAdmin(authReq.user);
    const userId = z.string().uuid().parse(req.params.id);
    const payload = giftCoinsSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
        throw new HttpError(404, "User not found");
    }
    await ensureGamification(userId);
    const giftMessage = payload.message?.trim() || `Sasen gifted you ${payload.amount} coins. Spend them in the Shop when you are ready.`;
    await prisma.$transaction([
        prisma.userGamification.update({
            where: { userId },
            data: {
                xpBalance: { increment: payload.amount }
            }
        }),
        prisma.userGiftMessage.create({
            data: {
                userId,
                title: `${payload.amount} coin gift`,
                message: giftMessage,
                giftType: "coins",
                giftId: `coins:${payload.amount}:${Date.now()}`
            }
        })
    ]);
    const user = await adminUserById(userId);
    res.json({ user });
}));
