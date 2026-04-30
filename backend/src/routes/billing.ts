import type { Request, Response } from "express";
import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../services/adminService.js";
import {
  billingPlanIds,
  billingProfile,
  cancelSubscriptionAccess,
  createCheckoutSession,
  createCustomerPortalSession,
  getBillingUser,
  isPaidPlan,
  normalizeBillingPlan,
  stripe,
  syncCheckoutSession,
  syncSubscription,
  updateUserBillingPlan,
  type BillingPlanId,
  type PaidBillingPlanId
} from "../services/billingService.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

const checkoutSchema = z.object({
  plan: z.enum(["plus", "max"]),
  returnUrl: z.string().url().optional()
});

const portalSchema = z.object({
  returnUrl: z.string().url().optional()
});

const adminPlanSchema = z.object({
  plan: z.enum(billingPlanIds),
  status: z.string().trim().min(1).max(40).optional()
});

const returnUrlFor = (req: Request, returnUrl?: string) =>
  returnUrl ?? process.env.FRONTEND_URL ?? req.get("origin") ?? "http://localhost:8081";

const adminUserDto = (user: Awaited<ReturnType<typeof updateUserBillingPlan>>) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt,
  billingPlan: user.billingPlan,
  billingStatus: user.billingStatus,
  billingRenewsAt: user.billingRenewsAt,
  stripeCustomerId: user.stripeCustomerId,
  stripeSubscriptionId: user.stripeSubscriptionId,
  level: user.gamification?.level ?? 1,
  totalXp: user.gamification?.totalXp ?? 0,
  leaderboardOptIn: user.gamification?.leaderboardOptIn ?? false,
  subjectCount: user._count.subjects,
  sessionCount: user._count.sessions,
  feedbackCount: user._count.feedbackItems,
  chatMessageCount: user._count.chatMessages
});

billingRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const [user, subjectCount, resourceCount] = await Promise.all([
      getBillingUser(authReq.user.id),
      prisma.userSubject.count({ where: { userId: authReq.user.id } }),
      prisma.studyResource.count({ where: { userId: authReq.user.id } })
    ]);

    res.json({
      billing: billingProfile(user),
      usage: {
        subjects: subjectCount,
        resources: resourceCount
      }
    });
  })
);

billingRouter.post(
  "/checkout",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = checkoutSchema.parse(req.body);
    const plan = normalizeBillingPlan(payload.plan);
    if (!isPaidPlan(plan)) {
      throw new HttpError(400, "Choose a paid plan.");
    }

    const user = await getBillingUser(authReq.user.id);
    const url = await createCheckoutSession({
      user,
      plan: plan as PaidBillingPlanId,
      returnUrl: returnUrlFor(req, payload.returnUrl)
    });

    res.json({ url });
  })
);

billingRouter.post(
  "/portal",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = portalSchema.parse(req.body);
    const user = await getBillingUser(authReq.user.id);
    const url = await createCustomerPortalSession({ user, returnUrl: returnUrlFor(req, payload.returnUrl) });
    res.json({ url });
  })
);

billingRouter.post(
  "/admin/users/:id/plan",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    requireAdmin(authReq.user);

    const userId = z.string().uuid().parse(req.params.id);
    const payload = adminPlanSchema.parse(req.body);
    const plan = normalizeBillingPlan(payload.plan);
    const user = await updateUserBillingPlan({
      userId,
      plan,
      status: payload.status ?? (plan === "free" ? "free" : "manual")
    });

    res.json({ user: adminUserDto(user) });
  })
);

export const stripeWebhookHandler = async (req: Request, res: Response) => {
  const client = stripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!client || !webhookSecret) {
    res.status(503).json({ message: "Stripe webhook is not configured." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ message: "Missing Stripe signature." });
    return;
  }

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid Stripe webhook." });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await syncCheckoutSession(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await cancelSubscriptionAccess(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling failed", error);
    res.status(500).json({ message: "Stripe webhook handling failed." });
  }
};
