import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import {
  requireAuth,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AuthenticatedRequest
} from "../middleware/authMiddleware.js";
import { ensureGamification } from "../services/gamificationService.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { inferSchoolNameFromEmail } from "../utils/schoolEmail.js";

export const authRouter = Router();

const MAX_SUBJECTS = 8;

const subjectSchema = z.object({
  subjectName: z.string().min(2),
  unit: z.enum(["1/2", "3/4"]).default("3/4"),
  targetScore: z.number().int().min(20).max(50).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});

const optionalSchoolNameSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(120).optional().nullable()
);

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  schoolName: optionalSchoolNameSchema,
  subjects: z.array(subjectSchema).max(MAX_SUBJECTS, `Choose up to ${MAX_SUBJECTS} subjects.`).default([])
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const preferenceSchema = z.object({
  weeklyDigestOptIn: z.boolean().optional()
});

const publicUser = (user: {
  id: string;
  email: string;
  displayName: string;
  schoolName: string | null;
  avatarUrl: string | null;
  weeklyDigestOptIn: boolean;
  weeklyDigestUnsubscribedAt: Date | null;
  weeklyDigestLastSentAt: Date | null;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  schoolName: user.schoolName,
  avatarUrl: user.avatarUrl,
  weeklyDigestOptIn: user.weeklyDigestOptIn,
  weeklyDigestUnsubscribedAt: user.weeklyDigestUnsubscribedAt,
  weeklyDigestLastSentAt: user.weeklyDigestLastSentAt,
  createdAt: user.createdAt
});

const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const email = payload.email.toLowerCase().trim();
    const submittedSchoolName = payload.schoolName?.trim() || null;
    const schoolName = submittedSchoolName || inferSchoolNameFromEmail(email);
    if (schoolName && schoolName.length < 2) {
      throw new HttpError(400, "Enter your school name with at least 2 characters.");
    }
    if (!schoolName) {
      throw new HttpError(400, "Enter your school name, or use a recognised vic.edu.au school email.");
    }
    const passwordHash = await bcrypt.hash(payload.password, 12);

    try {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: payload.displayName.trim(),
          schoolName,
          gamification: { create: {} },
          subjects: {
            create: payload.subjects.map((subject) => ({
              subjectName: subject.subjectName,
              unit: subject.unit,
              targetScore: subject.targetScore ?? null,
              color: subject.color
            }))
          }
        }
      });
      await ensureGamification(user.id);

      res.status(201).json({
        user: publicUser(user),
        accessToken: signAccessToken(user),
        refreshToken: signRefreshToken(user)
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new HttpError(409, "Email is already registered");
      }
      throw error;
    }
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase().trim() }
    });
    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, "Invalid email or password");
    }

    await ensureGamification(user.id);

    res.json({
      user: publicUser(user),
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user)
    });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
    const decoded = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) {
      throw new HttpError(401, "Refresh token user no longer exists");
    }

    res.json({
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user)
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      include: { subjects: true }
    });
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    const gamification = await ensureGamification(authReq.user.id);

    res.json({
      user: publicUser(user),
      subjects: user.subjects,
      gamification
    });
  })
);

authRouter.patch(
  "/me/preferences",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = preferenceSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: authReq.user.id },
      data: {
        ...(payload.weeklyDigestOptIn === undefined
          ? {}
          : {
              weeklyDigestOptIn: payload.weeklyDigestOptIn,
              weeklyDigestUnsubscribedAt: payload.weeklyDigestOptIn ? null : new Date()
            })
      }
    });

    res.json({ user: publicUser(user) });
  })
);
