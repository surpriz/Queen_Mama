"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Container, GlassCard, GradientButton } from "@/components/ui";

export function Pricing() {
  const t = useTranslations("Pricing");

  const plans = [
    {
      name: t("free.name"),
      price: t("free.price"),
      period: t("free.period"),
      description: t("free.description"),
      features: [
        { text: t("free.feature1"), included: true },
        { text: t("free.feature2"), included: true },
        { text: t("free.feature3"), included: true },
        { text: t("free.feature4"), included: true },
        { text: t("free.feature5"), included: false },
        { text: t("free.feature6"), included: false },
        { text: t("free.feature7"), included: false },
        { text: t("free.feature8"), included: false },
      ],
      cta: t("free.cta"),
      popular: false,
    },
    {
      name: t("pro.name"),
      price: t("pro.price"),
      period: t("pro.period"),
      description: t("pro.description"),
      features: [
        { text: t("pro.feature1"), included: true },
        { text: t("pro.feature2"), included: true },
        { text: t("pro.featureScreenshot"), included: true },
        { text: t("pro.feature3"), included: true },
        { text: t("pro.feature4"), included: true },
        { text: t("pro.feature5"), included: true },
        { text: t("pro.feature6"), included: true },
        { text: t("pro.feature7"), included: false },
        { text: t("pro.feature8"), included: false },
      ],
      cta: t("pro.cta"),
      popular: true,
    },
    {
      name: t("enterprise.name"),
      price: t("enterprise.price"),
      period: t("enterprise.period"),
      description: t("enterprise.description"),
      features: [
        { text: t("enterprise.feature1"), included: true },
        { text: t("enterprise.feature2"), included: true },
        { text: t("enterprise.feature3"), included: true },
        { text: t("enterprise.feature4"), included: true },
        { text: t("enterprise.feature5"), included: true },
        { text: t("enterprise.feature6"), included: true },
        { text: t("enterprise.feature7"), included: true },
        { text: t("enterprise.feature8"), included: true },
        { text: t("enterprise.feature9"), included: true },
      ],
      cta: t("enterprise.cta"),
      popular: false,
    },
  ];

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
            {t.rich("title", {
              highlight: (chunks) => <span className="gradient-text">{chunks}</span>,
            })}
          </h2>
          <p className="text-lg text-[var(--qm-text-secondary)] max-w-2xl mx-auto">
            {t("subtitle")}
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
                      {t("mostPopular")}
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

        {/* European Data & Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mt-8 space-y-4"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--qm-text-secondary)]">
            <span className="text-xl">🇪🇺</span>
            <span>{t("gdpr")}</span>
          </div>
          <p className="text-sm text-[var(--qm-text-tertiary)]">
            {t("cancelAnytime")}
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
