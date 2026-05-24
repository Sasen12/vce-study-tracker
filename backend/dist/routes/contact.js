import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../services/adminService.js";
import { sendContactEmail } from "../services/contactEmailService.js";
import { asyncHandler, HttpError } from "../utils/http.js";
export const contactRouter = Router();
const contactSchema = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    yearLevel: z.string().trim().max(50).optional().nullable(),
    school: z.string().trim().max(120).optional().nullable(),
    subject: z.string().trim().max(120).optional().nullable(),
    question: z.string().trim().min(10).max(2000)
});
const recentSubmissions = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const adminStatusSchema = z.object({
    adminStatus: z.enum(["new", "replied", "archived"])
});
const serialiseContactSubmission = (row) => ({
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
const checkRateLimit = (key) => {
    const now = Date.now();
    const recent = (recentSubmissions.get(key) ?? []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
    if (recent.length >= MAX_SUBMISSIONS_PER_WINDOW) {
        throw new HttpError(429, "Too many messages. Try again in a few minutes.");
    }
    recent.push(now);
    recentSubmissions.set(key, recent);
};
contactRouter.post("/", asyncHandler(async (req, res) => {
    checkRateLimit(req.ip || "unknown");
    const result = contactSchema.safeParse(req.body);
    if (!result.success) {
        throw new HttpError(400, result.error.issues[0]?.message ?? "Check the contact form and try again.");
    }
    const message = result.data;
    const inserted = await prisma.$queryRaw `
      INSERT INTO public_contact_submissions (name, email, year_level, school, subject, question, delivery_status)
      VALUES (
        ${message.name},
        ${message.email.toLowerCase()},
        ${message.yearLevel || null},
        ${message.school || null},
        ${message.subject || null},
        ${message.question},
        'pending'
      )
      RETURNING id
    `;
    const id = inserted[0]?.id;
    let delivered = false;
    let deliveryError = null;
    try {
        const emailResult = await sendContactEmail(message);
        delivered = emailResult.sent;
        deliveryError = emailResult.sent ? null : emailResult.reason;
    }
    catch (error) {
        deliveryError = error instanceof Error ? error.message : "Email delivery failed";
        console.error("Contact email delivery failed", error);
    }
    if (id) {
        await prisma.$executeRaw `
        UPDATE public_contact_submissions
        SET delivery_status = ${delivered ? "sent" : "saved"},
            delivery_error = ${deliveryError}
        WHERE id = ${id}::uuid
      `;
    }
    res.status(201).json({
        ok: true,
        delivered,
        message: delivered
            ? "Message sent. I will reply as soon as I can."
            : "Message received. I will reply as soon as I can."
    });
}));
contactRouter.patch("/:id/status", requireAuth, asyncHandler(async (req, res) => {
    const authReq = req;
    requireAdmin(authReq.user);
    const id = z.string().uuid().parse(req.params.id);
    const payload = adminStatusSchema.parse(req.body);
    const rows = await prisma.$queryRaw `
      UPDATE public_contact_submissions
      SET admin_status = ${payload.adminStatus}
      WHERE id = ${id}::uuid
      RETURNING
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
    `;
    const submission = rows[0];
    if (!submission) {
        throw new HttpError(404, "Contact message not found");
    }
    res.json({ submission: serialiseContactSubmission(submission) });
}));
