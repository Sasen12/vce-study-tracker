import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
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

const recentSubmissions = new Map<string, number[]>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;

const checkRateLimit = (key: string) => {
  const now = Date.now();
  const recent = (recentSubmissions.get(key) ?? []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= MAX_SUBMISSIONS_PER_WINDOW) {
    throw new HttpError(429, "Too many messages. Try again in a few minutes.");
  }
  recent.push(now);
  recentSubmissions.set(key, recent);
};

contactRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    checkRateLimit(req.ip || "unknown");

    const result = contactSchema.safeParse(req.body);
    if (!result.success) {
      throw new HttpError(400, result.error.issues[0]?.message ?? "Check the contact form and try again.");
    }

    const message = result.data;
    const inserted = await prisma.$queryRaw<{ id: string }[]>`
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
    let deliveryError: string | null = null;

    try {
      const emailResult = await sendContactEmail(message);
      delivered = emailResult.sent;
      deliveryError = emailResult.sent ? null : emailResult.reason;
    } catch (error) {
      deliveryError = error instanceof Error ? error.message : "Email delivery failed";
      console.error("Contact email delivery failed", error);
    }

    if (id) {
      await prisma.$executeRaw`
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
  })
);
