import Stripe from "stripe";
import { prisma } from "../db/prismaClient.js";
import { isAdminEmail } from "./adminService.js";
import { HttpError } from "../utils/http.js";
export const billingPlanIds = ["free", "plus", "max"];
const planDefinitions = [
    {
        id: "free",
        name: "Free",
        priceLabel: "A$0",
        summary: "Enough to try the tracker properly without touching payment.",
        limits: {
            maxSubjects: 4,
            aiActionsPerDay: 6,
            maxResources: 5,
            maxUploadsPerBatch: 3,
            maxScreenshotsPerAsk: 1,
            maxPlanHorizonDays: 14,
            classNotetaker: false
        },
        features: ["4 subjects", "6 AI actions/day", "5 study files", "14-day roadmap"]
    },
    {
        id: "plus",
        name: "Plus",
        priceLabel: "A$7/mo",
        summary: "The serious student tier for full VCE subject tracking.",
        stripePriceEnv: "STRIPE_PRICE_PLUS",
        limits: {
            maxSubjects: 8,
            aiActionsPerDay: 40,
            maxResources: 80,
            maxUploadsPerBatch: 8,
            maxScreenshotsPerAsk: 4,
            maxPlanHorizonDays: 45,
            classNotetaker: false
        },
        features: ["8 subjects", "40 AI actions/day", "80 study files", "45-day adaptive roadmap"]
    },
    {
        id: "max",
        name: "Max",
        priceLabel: "A$13/mo",
        summary: "Heavy AI usage, more uploads, and class notetaker access.",
        stripePriceEnv: "STRIPE_PRICE_MAX",
        limits: {
            maxSubjects: 8,
            aiActionsPerDay: 120,
            maxResources: 300,
            maxUploadsPerBatch: 12,
            maxScreenshotsPerAsk: 4,
            maxPlanHorizonDays: 90,
            classNotetaker: true
        },
        features: ["8 subjects", "120 AI actions/day", "300 study files", "Class notetaker", "90-day adaptive roadmap"]
    }
];
export const billingPlans = planDefinitions;
export const planLimits = Object.fromEntries(planDefinitions.map((plan) => [plan.id, plan.limits]));
const paidStatuses = new Set(["active", "trialing", "past_due"]);
let stripeClient;
export const normalizeBillingPlan = (value) => billingPlanIds.includes(value) ? value : "free";
export const isPaidPlan = (plan) => plan !== "free";
export const effectiveBillingPlan = (user) => {
    if (user.email && isAdminEmail(user.email))
        return "max";
    return normalizeBillingPlan(user.billingPlan);
};
export const getPlanDefinition = (plan) => planDefinitions.find((item) => item.id === plan) ?? planDefinitions[0];
export const billingProfile = (user) => {
    const plan = effectiveBillingPlan(user);
    return {
        plan,
        status: user.billingStatus,
        renewsAt: user.billingRenewsAt,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        isAdmin: isAdminEmail(user.email),
        checkoutConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        currentPlan: getPlanDefinition(plan),
        plans: planDefinitions,
        limits: planLimits[plan]
    };
};
export const getBillingUser = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            displayName: true,
            billingPlan: true,
            billingStatus: true,
            billingRenewsAt: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true
        }
    });
    if (!user)
        throw new HttpError(404, "User not found");
    return user;
};
export const getBillingAccessForUser = async (userId, fallbackEmail) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, billingPlan: true }
    });
    if (!user)
        throw new HttpError(404, "User not found");
    const plan = effectiveBillingPlan({ email: user.email ?? fallbackEmail, billingPlan: user.billingPlan });
    return { plan, limits: planLimits[plan] };
};
export const getPlanLimitsForUser = async (userId, fallbackEmail) => (await getBillingAccessForUser(userId, fallbackEmail)).limits;
export const stripe = () => {
    if (stripeClient !== undefined)
        return stripeClient;
    const secretKey = process.env.STRIPE_SECRET_KEY;
    stripeClient = secretKey ? new Stripe(secretKey) : null;
    return stripeClient;
};
const priceIdForPlan = (plan) => {
    const envName = getPlanDefinition(plan).stripePriceEnv;
    const priceId = envName ? process.env[envName] : undefined;
    if (!priceId)
        throw new HttpError(503, `Stripe price for ${plan} is not configured yet.`);
    return priceId;
};
const planForPriceId = (priceId) => {
    if (!priceId)
        return "free";
    const paidPlan = planDefinitions.find((plan) => plan.stripePriceEnv && process.env[plan.stripePriceEnv] === priceId)?.id;
    return normalizeBillingPlan(paidPlan);
};
const timestampDate = (value) => (value ? new Date(value * 1000) : null);
const customerId = (customer) => typeof customer === "string" ? customer : customer?.id ?? null;
const subscriptionId = (subscription) => typeof subscription === "string" ? subscription : subscription?.id ?? null;
const subscriptionPeriodEnd = (subscription) => timestampDate(subscription.items.data[0]?.current_period_end ?? null);
const accessPlanForSubscription = (plan, status) => (paidStatuses.has(status) ? plan : "free");
export const createCheckoutSession = async ({ user, plan, returnUrl }) => {
    const client = stripe();
    if (!client)
        throw new HttpError(503, "Stripe checkout is not configured yet.");
    const session = await client.checkout.sessions.create({
        mode: "subscription",
        customer: user.stripeCustomerId ?? undefined,
        customer_email: user.stripeCustomerId ? undefined : user.email,
        client_reference_id: user.id,
        line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
        success_url: `${returnUrl}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?billing=cancelled`,
        allow_promotion_codes: true,
        metadata: {
            userId: user.id,
            plan
        },
        subscription_data: {
            metadata: {
                userId: user.id,
                plan
            }
        }
    });
    if (!session.url)
        throw new HttpError(502, "Stripe did not return a checkout URL.");
    return session.url;
};
export const createCustomerPortalSession = async ({ user, returnUrl }) => {
    const client = stripe();
    if (!client)
        throw new HttpError(503, "Stripe billing portal is not configured yet.");
    if (!user.stripeCustomerId)
        throw new HttpError(400, "No Stripe customer is attached to this user yet.");
    const session = await client.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl
    });
    return session.url;
};
export const updateUserBillingPlan = async ({ userId, plan, status = plan === "free" ? "free" : "active" }) => prisma.user.update({
    where: { id: userId },
    data: {
        billingPlan: plan,
        billingStatus: status,
        billingRenewsAt: plan === "free" ? null : undefined
    },
    select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        billingPlan: true,
        billingStatus: true,
        billingRenewsAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        gamification: {
            select: {
                totalXp: true,
                level: true,
                leaderboardOptIn: true
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
    }
});
export const syncCheckoutSession = async (session) => {
    const client = stripe();
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const plan = normalizeBillingPlan(session.metadata?.plan);
    const stripeSubscriptionId = subscriptionId(session.subscription);
    if (!client || !userId || !isPaidPlan(plan) || !stripeSubscriptionId)
        return;
    const subscription = await client.subscriptions.retrieve(stripeSubscriptionId);
    await syncSubscription(subscription, userId);
};
export const syncSubscription = async (subscription, explicitUserId) => {
    const metadataPlan = normalizeBillingPlan(subscription.metadata?.plan);
    const itemPriceId = subscription.items.data[0]?.price?.id;
    const plan = isPaidPlan(metadataPlan) ? metadataPlan : planForPriceId(itemPriceId);
    const userId = explicitUserId ?? subscription.metadata?.userId;
    if (!isPaidPlan(plan))
        return;
    const data = {
        billingPlan: accessPlanForSubscription(plan, subscription.status),
        billingStatus: subscription.status,
        billingRenewsAt: subscriptionPeriodEnd(subscription),
        stripeCustomerId: customerId(subscription.customer),
        stripeSubscriptionId: subscription.id
    };
    if (userId) {
        await prisma.user.update({ where: { id: userId }, data });
        return;
    }
    await prisma.user.updateMany({ where: { stripeSubscriptionId: subscription.id }, data });
};
export const cancelSubscriptionAccess = async (subscription) => {
    await prisma.user.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
            billingPlan: "free",
            billingStatus: subscription.status,
            billingRenewsAt: subscriptionPeriodEnd(subscription)
        }
    });
};
