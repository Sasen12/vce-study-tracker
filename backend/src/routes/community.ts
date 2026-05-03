import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { isAdminEmail, requireAdmin } from "../services/adminService.js";
import { grantThemeToUser, THEME_SHOP_ITEMS } from "../services/gamificationService.js";
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

const giftThemeSchema = z.object({
  themeId: z.string().trim().min(1),
  equip: z.boolean().default(true)
});

const trackedScreens = ["home", "study", "calendar", "questions", "community", "shop", "profile"] as const;
type TrackedScreen = (typeof trackedScreens)[number];

const usageEventSchema = z.object({
  screen: z.enum(trackedScreens),
  action: z.literal("view").default("view")
});

const screenLabels: Record<TrackedScreen, string> = {
  home: "Home",
  study: "Study",
  calendar: "Calendar",
  questions: "Questions",
  community: "Community",
  shop: "Shop",
  profile: "Profile"
};

const LEADERBOARD_INVITE_TITLE = "Weekly leaderboard invite";
const LEADERBOARD_INVITE_MESSAGE =
  "Sasen reopened the weekly leaderboard invite. Join from the pop-up or Community > Leaderboard if you want your weekly XP to count.";
const BASE_CHAT_MINUTES = 3;
const STUDY_MINUTES_PER_CHAT_MINUTE = 5;
const MAX_DAILY_CHAT_MINUTES = 60;
const USAGE_EVENT_THROTTLE_MS = 60_000;

const serialiseFeedback = (
  item: {
    id: string;
    userId: string;
    category: string;
    message: string;
    status: string;
    createdAt: Date;
    user?: {
      displayName: string;
      email: string;
    };
  },
  isAdmin: boolean
) => ({
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

const publicUser = (user: { displayName: string }) => ({
  displayName: user.displayName
});

const adminUserSelect = {
  id: true,
  email: true,
  displayName: true,
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
} as const;

const cosmeticsAsArray = (cosmetics: unknown) =>
  Array.isArray(cosmetics) ? cosmetics.filter((cosmetic): cosmetic is string => typeof cosmetic === "string") : [];

const serialiseAdminUser = (user: {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  gamification: {
    totalXp: number;
    xpBalance: number;
    level: number;
    leaderboardOptIn: boolean;
    unlockedCosmetics: unknown;
    activeTheme: string;
    activeTitle: string;
  } | null;
  _count: {
    subjects: number;
    sessions: number;
    feedbackItems: number;
    chatMessages: number;
  };
}) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt,
  level: user.gamification?.level ?? 1,
  totalXp: user.gamification?.totalXp ?? 0,
  xpBalance: user.gamification?.xpBalance ?? 0,
  leaderboardOptIn: user.gamification?.leaderboardOptIn ?? false,
  unlockedCosmetics: cosmeticsAsArray(user.gamification?.unlockedCosmetics),
  activeTheme: user.gamification?.activeTheme ?? "midnight",
  activeTitle: user.gamification?.activeTitle ?? "year_12_rookie",
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

const adminUserById = async (id: string) => {
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

const chatAllowanceFor = async (userId: string) => {
  const { start, end } = todayRange();
  const [study, used] = await Promise.all([
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
        createdAt: {
          gte: start,
          lt: end
        }
      }
    })
  ]);

  const studiedMinutes = Math.floor((study._sum.durationSeconds ?? 0) / 60);
  const earnedMinutes = Math.floor(studiedMinutes / STUDY_MINUTES_PER_CHAT_MINUTE);
  const totalMinutes = Math.min(MAX_DAILY_CHAT_MINUTES, BASE_CHAT_MINUTES + earnedMinutes);

  return {
    baseMinutes: BASE_CHAT_MINUTES,
    studiedMinutes,
    earnedMinutes: Math.max(0, totalMinutes - BASE_CHAT_MINUTES),
    totalMinutes,
    usedMinutes: used,
    remainingMinutes: Math.max(0, totalMinutes - used),
    minutesPerMessage: 1,
    studyMinutesPerChatMinute: STUDY_MINUTES_PER_CHAT_MINUTE
  };
};

const communityPayload = async (user: AuthenticatedRequest["user"]) => {
  const isAdmin = isAdminEmail(user.email);
  const [feedback, chatDesc, allowance, users] = await Promise.all([
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
      take: 80,
      include: {
        user: {
          select: { displayName: true }
        }
      }
    }),
    chatAllowanceFor(user.id),
    isAdmin ? adminUsers() : Promise.resolve([])
  ]);

  const chat = chatDesc.reverse().map((message) => ({
    id: message.id,
    userId: message.userId,
    message: message.message,
    createdAt: message.createdAt,
    user: publicUser(message.user),
    isCurrentUser: message.userId === user.id
  }));

  return { isAdmin, feedback: feedback.map((item) => serialiseFeedback(item, isAdmin)), chat, allowance, users };
};

const serialiseGiftMessage = (gift: {
  id: string;
  title: string;
  message: string;
  giftType: string;
  giftId: string;
  readAt: Date | null;
  createdAt: Date;
}) => ({
  id: gift.id,
  title: gift.title,
  message: gift.message,
  giftType: gift.giftType,
  giftId: gift.giftId,
  readAt: gift.readAt,
  createdAt: gift.createdAt
});

const startOfHour = (date: Date) => {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  return start;
};

const uniqueCount = (values: string[]) => new Set(values).size;

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
            email: true
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
        email: true
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

  const userRows = new Map(
    studentUsers.map((user) => [
      user.id,
      {
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        lastSeenAt: null as Date | null,
        lastScreen: null as string | null,
        events24h: 0,
        events7d: 0,
        studyMinutes7d: 0,
        chatMessages7d: 0,
        feedback7d: 0
      }
    ])
  );

  for (const event of studentUsageEvents) {
    const row = userRows.get(event.userId);
    if (!row) continue;
    row.events7d += 1;
    if (event.createdAt >= dayAgo) row.events24h += 1;
    if (!row.lastSeenAt || event.createdAt > row.lastSeenAt) {
      row.lastSeenAt = event.createdAt;
      row.lastScreen = event.screen;
    }
  }

  for (const session of studentSessions) {
    const row = userRows.get(session.userId);
    if (row) row.studyMinutes7d += Math.round(session.durationSeconds / 60);
  }

  for (const chat of studentChats) {
    const row = userRows.get(chat.userId);
    if (row) row.chatMessages7d += 1;
  }

  for (const feedback of studentFeedback) {
    const row = userRows.get(feedback.userId);
    if (row) row.feedback7d += 1;
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
      screen: event.screen,
      label: screenLabels[event.screen as TrackedScreen] ?? event.screen,
      action: event.action,
      createdAt: event.createdAt
    }))
  };
};

communityRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = await communityPayload(authReq.user);
    res.json(payload);
  })
);

communityRouter.post(
  "/feedback",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
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
  })
);

communityRouter.get(
  "/gifts",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const gifts = await prisma.userGiftMessage.findMany({
      where: { userId: authReq.user.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    res.json({ gifts: gifts.map(serialiseGiftMessage) });
  })
);

communityRouter.patch(
  "/gifts/:id/read",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
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
  })
);

communityRouter.post(
  "/usage-events",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
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
  })
);

communityRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    requireAdmin(authReq.user);

    const analytics = await buildUsageAnalytics();
    res.json({ analytics });
  })
);

communityRouter.post(
  "/leaderboard/resend-invite",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    requireAdmin(authReq.user);

    const resentCount = await resendLeaderboardInvite();
    res.json({ resentCount });
  })
);

communityRouter.post(
  "/chat",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = chatSchema.parse(req.body);
    const allowance = await chatAllowanceFor(authReq.user.id);

    if (allowance.remainingMinutes <= 0) {
      throw new HttpError(
        429,
        `You are out of chat minutes for today. Study ${STUDY_MINUTES_PER_CHAT_MINUTE} more minutes to earn another chat minute.`
      );
    }

    const chatMessage = await prisma.communityChatMessage.create({
      data: {
        userId: authReq.user.id,
        message: payload.message
      },
      include: {
        user: {
          select: { displayName: true }
        }
      }
    });

    const nextAllowance = await chatAllowanceFor(authReq.user.id);
    res.status(201).json({
      chatMessage: {
        id: chatMessage.id,
        userId: chatMessage.userId,
        message: chatMessage.message,
        createdAt: chatMessage.createdAt,
        user: publicUser(chatMessage.user),
        isCurrentUser: true
      },
      allowance: nextAllowance
    });
  })
);

communityRouter.delete(
  "/chat/:id",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    requireAdmin(authReq.user);

    const id = z.string().uuid().parse(req.params.id);
    const existing = await prisma.communityChatMessage.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Chat message not found");
    }

    await prisma.communityChatMessage.delete({ where: { id } });
    res.status(204).send();
  })
);

communityRouter.post(
  "/users/:id/gifts/theme",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    requireAdmin(authReq.user);

    const userId = z.string().uuid().parse(req.params.id);
    const payload = giftThemeSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) {
      throw new HttpError(404, "User not found");
    }

    try {
      await grantThemeToUser(userId, payload.themeId, payload.equip);
    } catch (error) {
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
  })
);
