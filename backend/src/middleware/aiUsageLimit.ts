import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "./authMiddleware.js";
import { todayMelbourne } from "../utils/date.js";
import { HttpError } from "../utils/http.js";

type CostInput = number | ((req: AuthenticatedRequest) => number);

type LimitOptions = {
  cost?: CostInput;
};

type UsageCounter = {
  date: string;
  used: number;
};

const userUsage = new Map<string, UsageCounter>();
let globalUsage: UsageCounter = { date: todayMelbourne(), used: 0 };

const parsePositiveLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const perUserDailyLimit = () => parsePositiveLimit(process.env.AI_DAILY_LIMIT_PER_USER, 20);
const globalDailyLimit = () => parsePositiveLimit(process.env.AI_DAILY_LIMIT_GLOBAL, 250);
const defaultUnlimitedDomains = ["rivercrest.vic.edu.au", "hillcrest.vic.edu.au"];
const defaultUnlimitedEmails = ["lakeeeshahaffi@yahoo.com"];

const unlimitedDomains = () => {
  const configured = process.env.AI_UNLIMITED_EMAIL_DOMAINS;
  if (!configured?.trim()) return defaultUnlimitedDomains;

  return configured
    .split(",")
    .map((domain) => domain.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
};

const hasUnlimitedAi = (email: string) => {
  const normalisedEmail = email.trim().toLowerCase();
  const configuredEmails = process.env.AI_UNLIMITED_EMAILS;
  const unlimitedEmails = configuredEmails?.trim()
    ? configuredEmails
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : defaultUnlimitedEmails;

  return (
    unlimitedEmails.includes(normalisedEmail) ||
    unlimitedDomains().some((domain) => normalisedEmail.endsWith(`@${domain}`))
  );
};

const costForRequest = (req: AuthenticatedRequest, cost: CostInput | undefined) => {
  const value = typeof cost === "function" ? cost(req) : cost;
  if (!Number.isFinite(value ?? 1)) return 1;
  return Math.max(1, Math.ceil(value ?? 1));
};

const counterForUser = (userId: string, today: string) => {
  const existing = userUsage.get(userId);
  if (existing?.date === today) return existing;

  const next = { date: today, used: 0 };
  userUsage.set(userId, next);
  return next;
};

const resetGlobalIfNeeded = (today: string) => {
  if (globalUsage.date !== today) {
    globalUsage = { date: today, used: 0 };
    for (const [userId, counter] of userUsage.entries()) {
      if (counter.date !== today) userUsage.delete(userId);
    }
  }
};

export const limitAiUsage =
  ({ cost }: LimitOptions = {}) =>
  ((req, res, next) => {
    const authReq = req as AuthenticatedRequest;
    if (hasUnlimitedAi(authReq.user.email)) {
      res.setHeader("X-AI-Remaining", "unlimited");
      next();
      return;
    }

    const today = todayMelbourne();
    resetGlobalIfNeeded(today);

    const requestCost = costForRequest(authReq, cost);
    const userLimit = perUserDailyLimit();
    const globalLimit = globalDailyLimit();
    const userCounter = counterForUser(authReq.user.id, today);

    if (userLimit > 0 && userCounter.used + requestCost > userLimit) {
      throw new HttpError(429, `Daily AI limit reached. Try again tomorrow. (${userCounter.used}/${userLimit} used)`);
    }

    if (globalLimit > 0 && globalUsage.used + requestCost > globalLimit) {
      throw new HttpError(429, "The shared AI budget is paused for today. Try again tomorrow.");
    }

    userCounter.used += requestCost;
    globalUsage.used += requestCost;

    if (userLimit > 0) {
      res.setHeader("X-AI-Remaining", Math.max(0, userLimit - userCounter.used).toString());
    }

    next();
  }) satisfies RequestHandler;
