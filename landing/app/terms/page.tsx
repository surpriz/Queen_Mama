import { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service - Queen Mama",
  description: "Terms of Service for Queen Mama application.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="January 2026"
      description="Please read these terms carefully before using Queen Mama."
    >
      <div className="space-y-8 text-[var(--qm-text-secondary)]">
        {/* Agreement */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            1. Agreement to Terms
          </h2>
          <p>
            By downloading, installing, or using Queen Mama (&ldquo;the App&rdquo;),
            you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If
            you do not agree to these Terms, do not use the App.
          </p>
          <p>
            These Terms constitute a legally binding agreement between you and Queen
            Mama (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
          </p>
        </section>

        {/* Description */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            2. Description of Service
          </h2>
          <p>
            Queen Mama is a macOS application that provides real-time AI-powered
            assistance during conversations. The App:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Transcribes audio from your microphone in real-time</li>
            <li>Analyzes your screen content for context</li>
            <li>Generates AI suggestions using third-party AI providers</li>
            <li>
              Provides an &ldquo;undetectable&rdquo; mode that hides the App from screen
              sharing
            </li>
          </ul>
        </section>

        {/* API Keys */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            3. Third-Party API Keys
          </h2>
          <p>
            Queen Mama requires you to provide your own API keys for AI providers
            (OpenAI, Anthropic, Google) and transcription services (Deepgram,
            AssemblyAI).
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              You are responsible for obtaining and maintaining valid API keys from
              these providers
            </li>
            <li>
              You are responsible for all charges incurred through your API usage
            </li>
            <li>
              Your use of third-party services is subject to their respective terms of
              service
            </li>
            <li>We are not responsible for any issues with third-party services</li>
          </ul>
        </section>

        {/* User Responsibilities */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            4. User Responsibilities
          </h2>
          <p>You agree to use Queen Mama responsibly and lawfully. You must:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Comply with all applicable laws and regulations in your jurisdiction
            </li>
            <li>
              Obtain any necessary consent from other parties before recording or
              transcribing conversations
            </li>
            <li>
              Use the App only for legitimate purposes (such as personal productivity,
              interview preparation, or professional development)
            </li>
            <li>Not use the App for any illegal, fraudulent, or deceptive purposes</li>
            <li>Protect your API keys and not share them with others</li>
          </ul>
        </section>

        {/* Prohibited Uses */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">5. Prohibited Uses</h2>
          <p>You agree NOT to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Use the App to engage in academic dishonesty where explicitly prohibited
            </li>
            <li>
              Use the App for unauthorized recording of confidential or privileged
              communications
            </li>
            <li>
              Use the App in violation of any professional licensing requirements
            </li>
            <li>
              Reverse engineer, decompile, or disassemble the App except as permitted by
              law
            </li>
            <li>
              Attempt to circumvent any security measures or access controls
            </li>
            <li>
              Use the App to generate content that is harmful, discriminatory, or
              illegal
            </li>
            <li>Resell, redistribute, or sublicense the App</li>
          </ul>
        </section>

        {/* Consent & Recording Laws */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            6. Recording Consent Laws
          </h2>
          <p className="text-white font-medium">
            Important: Recording laws vary by jurisdiction.
          </p>
          <p>
            Some jurisdictions require all-party consent for recording conversations.
            You are solely responsible for understanding and complying with all
            applicable recording consent laws in your jurisdiction and the jurisdiction
            of other parties in your conversations.
          </p>
          <p>
            Queen Mama provides tools for your productivity. We do not provide legal
            advice. Consult with a legal professional if you have questions about
            recording consent requirements.
          </p>
        </section>

        {/* Intellectual Property */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            7. Intellectual Property
          </h2>
          <p>
            The App, including its code, design, graphics, and documentation, is owned
            by Queen Mama and protected by intellectual property laws. You receive a
            limited, non-exclusive, non-transferable license to use the App for personal
            or professional purposes.
          </p>
          <p>You retain ownership of:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your transcriptions and session data stored locally on your device</li>
            <li>Your custom modes and configurations</li>
            <li>Content you create using the App</li>
          </ul>
        </section>

        {/* Disclaimers */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">8. Disclaimers</h2>
          <p className="text-white font-medium">
            THE APP IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;
            WITHOUT WARRANTIES OF ANY KIND.
          </p>
          <p>We specifically disclaim:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Any warranty that the App will meet your requirements</li>
            <li>
              Any warranty that the App will be uninterrupted, timely, secure, or
              error-free
            </li>
            <li>Any warranty regarding the accuracy of AI-generated suggestions</li>
            <li>
              Any warranty regarding the accuracy of transcriptions or speech
              recognition
            </li>
            <li>Any warranty that the undetectable feature will work in all scenarios</li>
          </ul>
          <p>
            AI suggestions are generated by third-party services and may be inaccurate,
            incomplete, or inappropriate. You are responsible for reviewing and
            verifying any information before using it.
          </p>
        </section>

        {/* Limitation of Liability */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            9. Limitation of Liability
          </h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUEEN MAMA SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
            INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Loss of profits, data, or business opportunities</li>
            <li>Damages arising from your use of third-party API services</li>
            <li>
              Damages arising from reliance on AI-generated content or suggestions
            </li>
            <li>
              Damages arising from the undetectable feature not functioning as expected
            </li>
          </ul>
          <p>
            Our total liability for any claims arising from your use of the App shall
            not exceed the amount you paid for the App in the twelve (12) months
            preceding the claim, or $100 USD, whichever is greater.
          </p>
        </section>

        {/* Indemnification */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">10. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Queen Mama and its
            officers, directors, employees, and agents from any claims, damages, losses,
            liabilities, and expenses (including reasonable attorneys&apos; fees) arising
            from:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your use of the App</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights</li>
            <li>Your violation of any applicable laws or regulations</li>
          </ul>
        </section>

        {/* Termination */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">11. Termination</h2>
          <p>
            We may terminate or suspend your access to the App at any time, without
            prior notice or liability, for any reason, including if you breach these
            Terms.
          </p>
          <p>
            Upon termination, your right to use the App will immediately cease. All
            provisions of these Terms that by their nature should survive termination
            shall survive.
          </p>
        </section>

        {/* Governing Law */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws
            of France, without regard to its conflict of law provisions.
          </p>
          <p>
            Any disputes arising from these Terms or your use of the App shall be
            resolved through binding arbitration in accordance with the rules of the
            ICC International Court of Arbitration.
          </p>
        </section>

        {/* Changes */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            13. Changes to Terms
          </h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify you
            of any changes by posting the new Terms on this page and updating the
            &ldquo;Last updated&rdquo; date.
          </p>
          <p>
            Your continued use of the App after any changes constitutes acceptance of
            the new Terms.
          </p>
        </section>

        {/* Severability */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">14. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid,
            that provision shall be limited or eliminated to the minimum extent
            necessary, and the remaining provisions shall remain in full force and
            effect.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">15. Contact</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <p>
            <a
              href="mailto:legal@queenmama.app"
              className="text-[var(--qm-accent)] hover:underline"
            >
              legal@queenmama.app
            </a>
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
