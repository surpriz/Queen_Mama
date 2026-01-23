import Stripe from "stripe";

// Lazy initialization to avoid build-time errors when STRIPE_SECRET_KEY is not set
let _stripe: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return _stripe;
};

// For backward compatibility - will throw at runtime if key is missing
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    })
  : (null as unknown as Stripe);

export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    features: [
      "1 AI request per day",
      "Live transcription",
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
