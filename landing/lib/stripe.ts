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
      "Real-time AI suggestions",
      "Live transcription",
      "Undetectable mode",
      "4 built-in AI modes",
      "Bring your own API keys",
    ],
  },
  PRO: {
    name: "Pro",
    price: 1900,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      "Everything in Free",
      "Unlimited Smart Mode",
      "Custom AI modes",
      "Session history export",
      "Advanced analytics",
      "Priority support",
    ],
  },
} as const;

export type PlanType = keyof typeof PLANS;
