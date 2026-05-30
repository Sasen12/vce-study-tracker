import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { isAdminEmail, requireAdmin } from "../services/adminService.js";
import { addXp, DEFAULT_TITLE_ID, ensureGamification, grantThemeToUser, levelFromXp, THEME_SHOP_ITEMS } from "../services/gamificationService.js";
import { asyncHandler, HttpError } from "../utils/http.js";
export const communityRouter = Router();
communityRouter.use(requireAuth);
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
const questionWallSchema = z.object({
    subjectName: z.string().trim().min(2).max(80).optional().nullable(),
    message: z.string().trim().min(8).max(360)
});
const questionAnswerSchema = z.object({
    message: z.string().trim().min(8).max(600)
});
const liveRoomHeartbeatSchema = z.object({
    roomId: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/)
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
const USAGE_EVENT_THROTTLE_MS = 60_000;
const SUBJECT_ROOM_PREFIX = "[[subject-room:";
const SUBJECT_ROOM_MESSAGE_PATTERN = /^\[\[subject-room:([a-z0-9-]+)\]\]\s*([\s\S]*)$/;
const QUESTION_WALL_PREFIX = "[[question-wall:";
const QUESTION_WALL_MESSAGE_PATTERN = /^\[\[question-wall:(q|a):([a-z0-9-]+)\]\]\s*(?:(.*?)\s*\|\|\s*)?([\s\S]*)$/;
const LIVE_ROOM_ACTION_PREFIX = "study-room:";
const COMMUNITY_SQUADS = [
    {
        id: "english",
        name: "English squad",
        shortName: "English",
        color: "#60A5FA",
        aliases: ["english", "english as an additional language", "english language", "literature"]
    },
    {
        id: "methods",
        name: "Methods squad",
        shortName: "Methods",
        color: "#A78BFA",
        aliases: ["mathematical methods", "methods"]
    },
    {
        id: "general-maths",
        name: "General Maths squad",
        shortName: "General Maths",
        color: "#FF6B6B",
        aliases: ["general mathematics", "general maths"]
    },
    {
        id: "business",
        name: "Business squad",
        shortName: "Business",
        color: "#F59E0B",
        aliases: ["business management"]
    },
    {
        id: "software-dev",
        name: "Software Dev squad",
        shortName: "Software Dev",
        color: "#34D399",
        aliases: ["software development", "applied computing software development"]
    },
    {
        id: "data-analytics",
        name: "Data Analytics squad",
        shortName: "Data Analytics",
        color: "#22D3EE",
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
        color: "#FF6B6B"
    },
    {
        id: "english-essay-lock-in",
        title: "English Essay Lock In",
        subjectHint: "English",
        squadId: "english",
        targetMinutes: 45,
        color: "#60A5FA"
    },
    {
        id: "business-40-mark-rescue",
        title: "Business 40 Mark Rescue",
        subjectHint: "Business Management",
        squadId: "business",
        targetMinutes: 40,
        color: "#F59E0B"
    },
    {
        id: "software-dev-sat-sprint",
        title: "Software Dev SAT Sprint",
        subjectHint: "Software Development",
        squadId: "software-dev",
        targetMinutes: 50,
        color: "#34D399"
    }
];
const PUBLIC_MISSION = {
    id: "weekly-lock-in",
    title: "Weekly Lock-In",
    reward: `Finish all four to claim ${WEEKLY_MISSION_XP} XP and the Weekly Lock-In badge.`,
    items: [
        { id: "deep-work", label: "Complete 3 deep work sessions", target: 3 },
        { id: "questions", label: "Answer or save 2 questions", target: 2 },
        { id: "notes", label: "Upload or write 1 note", target: 1 },
        { id: "practice", label: "Do 1 practice quiz", target: 1 }
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
const isCommunitySystemMessage = (message) => Boolean(parseSubjectRoomMessage(message) || parseQuestionWallMessage(message));
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date) => {
    const start = startOfDay(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return start;
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
const buildQuestionWall = async (viewerUserId) => {
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
        const parsed = parseQuestionWallMessage(row.message);
        if (!parsed)
            continue;
        if (parsed.kind === "q") {
            questions.set(parsed.questionId, {
                id: parsed.questionId,
                subjectName: parsed.subjectName,
                message: parsed.message,
                createdAt: row.createdAt,
                answerCount: 0,
                isCurrentUser: row.userId === viewerUserId,
                answers: []
            });
            continue;
        }
        const question = questions.get(parsed.questionId);
        if (!question)
            continue;
        question.answers.push({
            id: row.id,
            message: parsed.message,
            createdAt: row.createdAt,
            user: publicUser(row.user),
            isCurrentUser: row.userId === viewerUserId
        });
        question.answerCount = question.answers.length;
    }
    return Array.from(questions.values())
        .map((question) => ({
        ...question,
        answers: question.answers.slice(-4)
    }))
        .sort((a, b) => {
        const aLatest = a.answers[a.answers.length - 1]?.createdAt ?? a.createdAt;
        const bLatest = b.answers[b.answers.length - 1]?.createdAt ?? b.createdAt;
        return bLatest.getTime() - aLatest.getTime();
    })
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
    return {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        week,
        today,
        improved,
        streaks
    };
};
const buildWeeklySubjectSquads = async (viewerUserId) => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const [subjects, sessions, savedQuestions, wall] = await Promise.all([
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
        prisma.studySession.findMany({
            where: {
                createdAt: { gte: weekStart, lt: weekEnd },
                user: { gamification: { is: { leaderboardOptIn: true } } }
            },
            select: {
                userId: true,
                durationSeconds: true,
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
    return COMMUNITY_SQUADS.map((squad) => {
        const memberRows = subjects.filter((subject) => squadForSubjectName(subject.subjectName)?.id === squad.id);
        const memberIds = new Set(memberRows.map((subject) => subject.userId));
        const sessionRows = sessions.filter((session) => squadForSubjectName(session.subject?.subjectName)?.id === squad.id);
        const questionCount = savedQuestions.filter((question) => squadForSubjectName(question.subject?.subjectName)?.id === squad.id).length;
        const wallAnswerCount = wall
            .filter((question) => squadForSubjectName(question.subjectName)?.id === squad.id)
            .reduce((sum, question) => sum + question.answerCount, 0);
        const contributorMinutes = new Map();
        for (const session of sessionRows) {
            const current = contributorMinutes.get(session.userId) ?? { displayName: session.user.displayName, minutes: 0 };
            current.minutes += Math.round(session.durationSeconds / 60);
            contributorMinutes.set(session.userId, current);
        }
        const topContributor = Array.from(contributorMinutes.values()).sort((a, b) => b.minutes - a.minutes || a.displayName.localeCompare(b.displayName))[0];
        return {
            id: squad.id,
            name: squad.name,
            shortName: squad.shortName,
            color: squad.color,
            weeklyMinutes: Math.round(sessionRows.reduce((sum, session) => sum + session.durationSeconds, 0) / 60),
            topContributor: topContributor ? { displayName: topContributor.displayName, minutes: topContributor.minutes } : null,
            questionsAnswered: questionCount + wallAnswerCount,
            streakCount: new Set(memberRows
                .filter((subject) => (subject.user.gamification?.currentStreak ?? 0) > 0)
                .map((subject) => subject.userId)).size,
            memberCount: memberIds.size,
            viewerJoined: memberIds.has(viewerUserId)
        };
    });
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
        return {
            ...room,
            weeklyMinutes,
            activeCount: activeStudents.length,
            activeStudents
        };
    });
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
    return {
        id: PUBLIC_MISSION.id,
        title: PUBLIC_MISSION.title,
        reward: rewardClaimed ? `Reward secured: ${WEEKLY_MISSION_XP} XP and Weekly Lock-In badge.` : PUBLIC_MISSION.reward,
        items,
        complete,
        rewardClaimed
    };
};
const communityPayload = async (user) => {
    const isAdmin = isAdminEmail(user.email);
    await ensureDefaultCommunityVisibility(user.id);
    const [feedback, chatDesc, allowance, users, landingContacts, squads, liveRooms, questionWall, mission, boards] = await Promise.all([
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
        buildWeeklySubjectSquads(user.id),
        buildLiveStudyRooms(),
        buildQuestionWall(user.id),
        buildPublicMission(user.id),
        buildCommunityLeaderboards(user.id)
    ]);
    const chat = chatDesc
        .filter((message) => !isCommunitySystemMessage(message.message))
        .slice(0, 80)
        .reverse()
        .map((message) => serialiseChatMessage(message, user.id));
    return {
        isAdmin,
        feedback: feedback.map((item) => serialiseFeedback(item, isAdmin)),
        landingContacts: landingContacts.map(serialisePublicContact),
        chat,
        allowance,
        users,
        squads,
        liveRooms,
        questionWall,
        mission,
        boards
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
    await prisma.communityChatMessage.create({
        data: {
            userId: authReq.user.id,
            message: `${QUESTION_WALL_PREFIX}q:${questionId}]] ${subjectName} || ${payload.message}`
        }
    });
    const questionWall = await buildQuestionWall(authReq.user.id);
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
    const [questionWall, allowance] = await Promise.all([buildQuestionWall(authReq.user.id), chatAllowanceFor(authReq.user.id)]);
    res.status(201).json({ questionWall, allowance });
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
    const chat = chatDesc
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
    requireAdmin(authReq.user);
    const id = z.string().uuid().parse(req.params.id);
    const existing = await prisma.communityChatMessage.findUnique({ where: { id } });
    if (!existing) {
        throw new HttpError(404, "Chat message not found");
    }
    await prisma.communityChatMessage.delete({ where: { id } });
    res.status(204).send();
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
