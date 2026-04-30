import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
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

const BASE_CHAT_MINUTES = 3;
const STUDY_MINUTES_PER_CHAT_MINUTE = 5;
const MAX_DAILY_CHAT_MINUTES = 60;
const DEFAULT_ADMIN_EMAILS = ["sasenb@gmail.com"];
const ADMIN_EMAILS = new Set(
  [...DEFAULT_ADMIN_EMAILS, ...(process.env.ADMIN_EMAILS ?? "").split(",")]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const isAdminEmail = (email: string) => ADMIN_EMAILS.has(email.trim().toLowerCase());

const requireAdmin = (user: AuthenticatedRequest["user"]) => {
  if (!isAdminEmail(user.email)) {
    throw new HttpError(403, "Admin only");
  }
};

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
  const [feedback, chatDesc, allowance] = await Promise.all([
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
    chatAllowanceFor(user.id)
  ]);

  const chat = chatDesc.reverse().map((message) => ({
    id: message.id,
    userId: message.userId,
    message: message.message,
    createdAt: message.createdAt,
    user: publicUser(message.user),
    isCurrentUser: message.userId === user.id
  }));

  return { isAdmin, feedback: feedback.map((item) => serialiseFeedback(item, isAdmin)), chat, allowance };
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
