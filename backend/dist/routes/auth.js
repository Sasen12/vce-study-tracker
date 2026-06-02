import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, signAccessToken, signRefreshToken, verifyRefreshToken } from "../middleware/authMiddleware.js";
import { ensureGamification } from "../services/gamificationService.js";
import { defaultFromEmail, escapeHtml, smtpTransport } from "../services/contactEmailService.js";
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
const optionalSchoolNameSchema = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().max(120).optional().nullable());
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
const passwordResetRequestSchema = z.object({
    email: z.string().email()
});
const passwordResetConfirmSchema = z.object({
    token: z.string().min(20),
    password: z.string().min(8)
});
const preferenceSchema = z.object({
    weeklyDigestOptIn: z.boolean().optional()
});
const publicUser = (user) => ({
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
const isUniqueConstraintError = (error) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
const passwordResetSecret = () => process.env.PASSWORD_RESET_SECRET ?? process.env.JWT_SECRET ?? "dev_password_reset_secret";
const publicSiteUrl = () => (process.env.PUBLIC_SITE_URL ?? process.env.APP_URL ?? "https://www.vceforge.space").replace(/\/$/, "");
const passwordFingerprint = (passwordHash) => crypto.createHash("sha256").update(passwordHash).digest("hex");
const signPasswordResetToken = (user) => jwt.sign({
    purpose: "password-reset",
    email: user.email,
    passwordFingerprint: passwordFingerprint(user.passwordHash)
}, passwordResetSecret(), {
    subject: user.id,
    expiresIn: "30m"
});
const verifyPasswordResetToken = (token) => {
    try {
        const payload = jwt.verify(token, passwordResetSecret());
        if (payload.purpose !== "password-reset" || !payload.sub || !payload.email || !payload.passwordFingerprint) {
            throw new HttpError(400, "Reset link is invalid or expired.");
        }
        return payload;
    }
    catch (error) {
        if (error instanceof HttpError)
            throw error;
        throw new HttpError(400, "Reset link is invalid or expired.");
    }
};
const sendPasswordResetEmail = async (user, token) => {
    const transport = await smtpTransport();
    const resetUrl = `${publicSiteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    if (!transport) {
        console.warn(`Password reset requested for ${user.email}, but SMTP is not configured. Reset URL: ${resetUrl}`);
        return false;
    }
    const from = defaultFromEmail(process.env.CONTACT_RECIPIENT_EMAIL?.trim() || "techsavvy356@gmail.com");
    const text = [
        `Hi ${user.displayName},`,
        "",
        "Use this link to reset your VCE Forge password:",
        resetUrl,
        "",
        "This link expires in 30 minutes. If you did not ask for a reset, you can ignore this email."
    ].join("\n");
    const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2>Reset your VCE Forge password</h2>
      <p>Hi ${escapeHtml(user.displayName)},</p>
      <p>Use this button to choose a new password. The link expires in 30 minutes.</p>
      <p>
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#38BDF8;color:#06111F;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:8px;">
          Reset password
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
      <p>If you did not ask for a reset, you can ignore this email.</p>
    </div>
  `;
    await transport.sendMail({
        to: user.email,
        from,
        subject: "Reset your VCE Forge password",
        text,
        html
    });
    return true;
};
authRouter.post("/register", asyncHandler(async (req, res) => {
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
    }
    catch (error) {
        if (isUniqueConstraintError(error)) {
            throw new HttpError(409, "Email is already registered");
        }
        throw error;
    }
}));
authRouter.post("/login", asyncHandler(async (req, res) => {
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
}));
authRouter.post("/password-reset/request", asyncHandler(async (req, res) => {
    const payload = passwordResetRequestSchema.parse(req.body);
    const email = payload.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
        where: { email }
    });
    if (user) {
        const token = signPasswordResetToken(user);
        try {
            await sendPasswordResetEmail(user, token);
        }
        catch (error) {
            console.error(`Password reset email failed for ${email}`, error);
        }
    }
    res.json({
        ok: true,
        message: "If that email belongs to a VCE Forge account, a reset link is on its way."
    });
}));
authRouter.post("/password-reset/confirm", asyncHandler(async (req, res) => {
    const payload = passwordResetConfirmSchema.parse(req.body);
    const decoded = verifyPasswordResetToken(payload.token);
    const user = await prisma.user.findUnique({
        where: { id: decoded.sub }
    });
    if (!user || user.email !== decoded.email || passwordFingerprint(user.passwordHash) !== decoded.passwordFingerprint) {
        throw new HttpError(400, "Reset link is invalid or expired.");
    }
    const passwordHash = await bcrypt.hash(payload.password, 12);
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
    });
    await ensureGamification(updated.id);
    res.json({
        user: publicUser(updated),
        accessToken: signAccessToken(updated),
        refreshToken: signRefreshToken(updated)
    });
}));
authRouter.post("/refresh", asyncHandler(async (req, res) => {
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
}));
authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
    const authReq = req;
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
}));
authRouter.patch("/me/preferences", requireAuth, asyncHandler(async (req, res) => {
    const authReq = req;
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
}));
