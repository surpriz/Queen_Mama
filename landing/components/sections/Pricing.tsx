"use client";

import { motion } from "framer-motion";
import { Container, GlassCard, GradientButton, Badge } from "@/components/ui";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try Queen Mama with basic features",
    features: [
      { text: "1 AI request per day", included: true },
      { text: "Live transcription", included: true },
      { text: "4 built-in AI modes", included: true },
      { text: "Standard AI models", included: true },
      { text: "Screenshot capture", included: false },
      { text: "Custom modes", included: false },
      { text: "Session cloud sync", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Download Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For professionals who want more",
    features: [
      { text: "Everything in Free", included: true },
      { text: "Unlimited AI requests", included: true },
      { text: "Custom AI modes", included: true },
      { text: "Session cloud sync", included: true },
      { text: "All export formats", included: true },
      { text: "Priority support", included: true },
      { text: "Smart Mode", included: false },
      { text: "Undetectable overlay", included: false },
    ],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$49",
    period: "/month",
    description: "For power users and teams",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Smart Mode (premium AI)", included: true },
      { text: "Undetectable overlay mode", included: true },
      { text: "Auto-Answer feature", included: true },
      { text: "Extended transcript storage", included: true },
      { text: "Dedicated support", included: true },
    ],
    cta: "Start Enterprise Trial",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 relative bg-[var(--qm-bg-secondary)]">
      <Container>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, <span className="gradient-text">Transparent</span> Pricing
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)] max-w-2xl mx-auto">
            Start free and upgrade when you&apos;re ready. Unlock premium features
            instantly with our paid plans.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <GlassCard
                hover={false}
                padding="none"
                className={`relative overflow-hidden ${
                  plan.popular
                    ? "border-[var(--qm-accent)] shadow-[0_0_30px_rgba(139,92,246,0.2)]"
                    : ""
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="gradient-bg text-white text-xs font-medium px-4 py-1 rounded-bl-lg">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Header */}
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-white mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-[var(--qm-text-tertiary)]">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-[var(--qm-text-tertiary)]">
                      {plan.period}
                    </span>
                  </div>

                  {/* CTA */}
                  {plan.popular ? (
                    <GradientButton className="w-full mb-8">
                      {plan.cta}
                    </GradientButton>
                  ) : (
                    <GradientButton variant="secondary" className="w-full mb-8">
                      {plan.cta}
                    </GradientButton>
                  )}

                  {/* Features */}
                  <div className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 ${
                          feature.included
                            ? "text-[var(--qm-text-secondary)]"
                            : "text-[var(--qm-text-disabled)]"
                        }`}
                      >
                        {feature.included ? (
                          <svg
                            className="w-4 h-4 text-[var(--qm-success)] flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                        <span className="text-sm">{feature.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-sm text-[var(--qm-text-tertiary)] mt-8"
        >
          Cancel anytime. No questions asked.
        </motion.p>
      </Container>
    </section>
  );
}
