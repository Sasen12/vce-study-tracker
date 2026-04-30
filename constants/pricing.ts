import type { BillingPlan, BillingPlanId } from "@/types";

export const pricingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "A$0",
    summary: "A real trial plan for students who are just getting started.",
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
    summary: "Full VCE tracking for students using the app every week.",
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
    summary: "For heavy AI help, bigger file banks, and class notetaker access.",
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

export const planById = (planId?: BillingPlanId | string | null) =>
  pricingPlans.find((plan) => plan.id === planId) ?? pricingPlans[0];

export const freePlan = pricingPlans[0];
