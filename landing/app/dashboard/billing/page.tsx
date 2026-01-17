"use client";

import { useState, useEffect } from "react";
import { GlassCard, GradientButton, Badge } from "@/components/ui";
import Link from "next/link";

interface Subscription {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const plans = {
  FREE: {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "50 AI requests per day",
      "Live transcription",
      "Screenshot capture",
      "4 built-in AI modes",
      "Plain text export",
    ],
    highlighted: false,
  },
  PRO: {
    name: "Pro",
    price: "$19",
    period: "month",
    features: [
      "Everything in Free",
      "Unlimited AI requests",
      "Custom AI modes",
      "Session cloud sync",
      "All export formats",
      "Priority support",
    ],
    highlighted: true,
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: "$49",
    period: "month",
    features: [
      "Everything in Pro",
      "Smart Mode (premium AI)",
      "Undetectable overlay",
      "Auto-Answer feature",
      "Extended storage",
      "Dedicated support",
    ],
    highlighted: false,
  },
};

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isManaging, setIsManaging] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch("/api/billing/subscription");
        if (response.ok) {
          const data = await response.json();
          setSubscription(data);
        }
      } catch {
        console.error("Failed to fetch subscription");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const handleUpgrade = async (plan: "PRO" | "ENTERPRISE") => {
    setIsUpgrading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      console.error("Failed to create checkout session");
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleManage = async () => {
    setIsManaging(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      console.error("Failed to create portal session");
    } finally {
      setIsManaging(false);
    }
  };

  const currentPlanKey = subscription?.plan || "FREE";
  const currentPlan = plans[currentPlanKey];
  const isPaidPlan = currentPlanKey === "PRO" || currentPlanKey === "ENTERPRISE";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          Manage your subscription and billing
        </p>
      </div>

      <div className="max-w-4xl space-y-6">
        <GlassCard hover={false} padding="lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Current Plan</h2>
                <Badge variant={isPaidPlan ? "accent" : "default"}>
                  {currentPlan.name}
                </Badge>
              </div>
              <p className="mt-1 text-[var(--qm-text-secondary)]">
                {currentPlan.price}/{currentPlan.period}
              </p>
              {subscription?.currentPeriodEnd && isPaidPlan && (
                <p className="mt-2 text-sm text-[var(--qm-text-tertiary)]">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              )}
            </div>
            {isPaidPlan ? (
              <GradientButton variant="secondary" onClick={handleManage} disabled={isManaging}>
                {isManaging ? "Loading..." : "Manage Subscription"}
              </GradientButton>
            ) : (
              <GradientButton onClick={() => handleUpgrade("PRO")} disabled={isUpgrading}>
                {isUpgrading ? "Loading..." : "Upgrade to Pro"}
              </GradientButton>
            )}
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(plans).map(([key, plan]) => {
            const isCurrentPlan = subscription?.plan === key || (!subscription?.plan && key === "FREE");
            const planKey = key as "FREE" | "PRO" | "ENTERPRISE";
            const canUpgrade = !isCurrentPlan && planKey !== "FREE" &&
              (currentPlanKey === "FREE" || (currentPlanKey === "PRO" && planKey === "ENTERPRISE"));

            return (
              <GlassCard
                key={key}
                hover={false}
                padding="lg"
                className={`${isCurrentPlan ? "ring-2 ring-[var(--qm-accent)]" : ""} ${plan.highlighted ? "ring-1 ring-[var(--qm-accent)]/50" : ""}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                      {plan.highlighted && !isCurrentPlan && (
                        <Badge variant="accent" className="text-xs">Popular</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-white mt-1">
                      {plan.price}
                      <span className="text-sm font-normal text-[var(--qm-text-tertiary)]">
                        /{plan.period}
                      </span>
                    </p>
                  </div>
                  {isCurrentPlan && (
                    <Badge variant="success">Current</Badge>
                  )}
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-[var(--qm-success)] shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-[var(--qm-text-secondary)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                {canUpgrade && (
                  <GradientButton
                    onClick={() => handleUpgrade(planKey as "PRO" | "ENTERPRISE")}
                    disabled={isUpgrading}
                    className="w-full"
                    variant={plan.highlighted ? "primary" : "secondary"}
                  >
                    {isUpgrading ? "Loading..." : `Upgrade to ${plan.name}`}
                  </GradientButton>
                )}
                {isCurrentPlan && planKey !== "FREE" && (
                  <GradientButton
                    onClick={handleManage}
                    disabled={isManaging}
                    className="w-full"
                    variant="secondary"
                  >
                    {isManaging ? "Loading..." : "Manage"}
                  </GradientButton>
                )}
              </GlassCard>
            );
          })}
        </div>

        <GlassCard hover={false} padding="lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Invoice History</h2>
              <p className="mt-1 text-sm text-[var(--qm-text-secondary)]">
                View and download your past invoices
              </p>
            </div>
            <Link href="/dashboard/billing/invoices">
              <GradientButton variant="secondary" size="sm">
                View Invoices
              </GradientButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
