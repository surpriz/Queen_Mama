"use client";

import { motion } from "framer-motion";
import { Container, GlassCard, GradientButton, Badge } from "@/components/ui";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to get started",
    features: [
      { text: "Real-time AI suggestions", included: true },
      { text: "Live transcription", included: true },
      { text: "Undetectable mode", included: true },
      { text: "4 built-in AI modes", included: true },
      { text: "Bring your own API keys", included: true },
      { text: "Smart Mode (limited)", included: true },
      { text: "Custom modes", included: false },
      { text: "Session history export", included: false },
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
      { text: "Unlimited Smart Mode", included: true },
      { text: "Custom AI modes", included: true },
      { text: "Session history export", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Priority support", included: true },
      { text: "Early access to features", included: true },
      { text: "Attach documents to modes", included: true },
      { text: "Team features (coming soon)", included: true },
    ],
    cta: "Start Pro Trial",
    popular: true,
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
            Start free and upgrade when you&apos;re ready. Bring your own API keys -
            you only pay for what you use with your AI provider.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
          All plans require your own API keys (OpenAI, Anthropic, or Google).
          You&apos;ll be billed directly by your AI provider based on usage.
        </motion.p>
      </Container>
    </section>
  );
}
