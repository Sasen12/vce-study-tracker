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

export const authRouter = Router();

const MAX_SUBJECTS = 8;

const subjectSchema = z.object({
  subjectName: z.string().min(2),
  unit: z.enum(["1/2", "3/4"]).default("3/4"),
  targetScore: z.number().int().min(20).max(50).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  subjects: z.array(subjectSchema).max(MAX_SUBJECTS, `Choose up to ${MAX_SUBJECTS} subjects.`).default([])
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const publicUser = (user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt
});

const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const email = payload.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(payload.password, 12);

    try {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: payload.displayName.trim(),
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
