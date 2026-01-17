import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    features: [
      "50 AI requests per day",
      "Live transcription",
      "Screenshot capture",
      "4 built-in AI modes",
      "Standard AI models",
    ],
  },
  PRO: {
    name: "Pro",
    price: 1900, // $19/month
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      "Everything in Free",
      "Unlimited AI requests",
      "Custom AI modes",
      "Session cloud sync",
      "All export formats",
      "Priority support",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 4900, // $49/month
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: [
      "Everything in Pro",
      "Smart Mode (premium AI reasoning)",
      "Undetectable overlay mode",
      "Auto-Answer feature",
      "Extended transcript storage",
      "Dedicated support",
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;
