import { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";

// Force static generation for this page
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy - Queen Mama",
  description: "Privacy Policy for Queen Mama - Learn how we handle your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="January 2026"
      description="Your privacy matters. This policy explains how Queen Mama collects, uses, and protects your information."
    >
      <div className="space-y-8 text-[var(--qm-text-secondary)]">
        {/* Introduction */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Introduction</h2>
          <p>
            Queen Mama (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is
            committed to protecting your privacy. This Privacy Policy explains how we
            collect, use, disclose, and safeguard your information when you use our
            macOS application and website.
          </p>
          <p className="text-white font-medium">
            Important: Queen Mama does not sell your data. We do not train AI models on
            your data. Your conversations and transcriptions are never stored on our
            servers.
          </p>
        </section>

        {/* Information Collection */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            Information We Collect
          </h2>

          <h3 className="text-lg font-medium text-white">
            Information You Provide Directly
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">Account Information:</strong> If you
              create an account, we may collect your name and email address.
            </li>
            <li>
              <strong className="text-white">API Keys:</strong> You provide your own
              API keys for AI providers (OpenAI, Anthropic, Google) and transcription
              services (Deepgram, AssemblyAI). These are stored locally in your macOS
              Keychain and are never transmitted to our servers.
            </li>
            <li>
              <strong className="text-white">Support Communications:</strong> If you
              contact us for support, we collect the information you provide.
            </li>
          </ul>

          <h3 className="text-lg font-medium text-white">
            Information Collected Automatically
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">Usage Data:</strong> We may collect
              anonymous usage statistics to improve our application, such as feature
              usage patterns and error reports.
            </li>
            <li>
              <strong className="text-white">Device Information:</strong> Basic device
              information like macOS version for compatibility purposes.
            </li>
          </ul>

          <h3 className="text-lg font-medium text-white">
            Information We Do NOT Collect
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your audio recordings or transcriptions</li>
            <li>Your screen content or screenshots</li>
            <li>Your AI conversation history</li>
            <li>Your session data or mode configurations</li>
          </ul>
        </section>

        {/* Data Processing */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            How Your Data is Processed
          </h2>
          <p>
            Queen Mama operates primarily on your local device. Here&apos;s how data
            flows:
          </p>

          <h3 className="text-lg font-medium text-white">Audio & Transcription</h3>
          <p>
            When you start a session, audio from your microphone is streamed directly
            to your chosen transcription provider (Deepgram or AssemblyAI) using your
            API key. The audio is processed in real-time and is not stored by Queen
            Mama.
          </p>

          <h3 className="text-lg font-medium text-white">AI Processing</h3>
          <p>
            When you request AI assistance, your transcribed text and screen context
            are sent directly to your chosen AI provider (OpenAI, Anthropic, or Google)
            using your API key. We do not route this data through our servers.
          </p>

          <h3 className="text-lg font-medium text-white">Local Storage</h3>
          <p>
            Session history, preferences, and custom modes are stored locally on your
            Mac using SwiftData. This data never leaves your device unless you
            explicitly export it.
          </p>
        </section>

        {/* Third-Party Services */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            Third-Party Services
          </h2>
          <p>
            Queen Mama integrates with third-party services that have their own privacy
            policies. When you use these services through Queen Mama, your data is
            subject to their privacy policies:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">OpenAI:</strong>{" "}
              <a
                href="https://openai.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--qm-accent)] hover:underline"
              >
                openai.com/privacy
              </a>
            </li>
            <li>
              <strong className="text-white">Anthropic:</strong>{" "}
              <a
                href="https://www.anthropic.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--qm-accent)] hover:underline"
              >
                anthropic.com/privacy
              </a>
            </li>
            <li>
              <strong className="text-white">Google:</strong>{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--qm-accent)] hover:underline"
              >
                policies.google.com/privacy
              </a>
            </li>
            <li>
              <strong className="text-white">Deepgram:</strong>{" "}
              <a
                href="https://deepgram.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--qm-accent)] hover:underline"
              >
                deepgram.com/privacy
              </a>
            </li>
            <li>
              <strong className="text-white">AssemblyAI:</strong>{" "}
              <a
                href="https://www.assemblyai.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--qm-accent)] hover:underline"
              >
                assemblyai.com/privacy-policy
              </a>
            </li>
          </ul>
          <p>
            For a complete list of our subprocessors, please visit our{" "}
            <a
              href="/subprocessors"
              className="text-[var(--qm-accent)] hover:underline"
            >
              Subprocessors page
            </a>
            .
          </p>
        </section>

        {/* Data Security */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Data Security</h2>
          <p>We implement appropriate security measures to protect your information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              API keys are stored in your macOS Keychain, Apple&apos;s secure credential
              storage system
            </li>
            <li>All network communications use TLS encryption</li>
            <li>
              Local data is stored using SwiftData with standard macOS security
              protections
            </li>
            <li>
              The Undetectability feature ensures the app is not captured in screen
              recordings or shares
            </li>
          </ul>
        </section>

        {/* Your Rights */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Your Rights</h2>
          <p>Depending on your location, you may have the following rights:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Object to or restrict processing of your information</li>
            <li>Data portability</li>
          </ul>
          <p>
            Since Queen Mama stores most data locally on your device, you have direct
            control over your data. You can delete the app and all associated data at
            any time.
          </p>
        </section>

        {/* GDPR */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            For European Users (GDPR)
          </h2>
          <p>
            If you are located in the European Economic Area (EEA), you have additional
            rights under the General Data Protection Regulation (GDPR). Our legal basis
            for processing your information includes:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your consent</li>
            <li>Performance of a contract with you</li>
            <li>Our legitimate business interests</li>
            <li>Compliance with legal obligations</li>
          </ul>
        </section>

        {/* CCPA */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            For California Users (CCPA)
          </h2>
          <p>
            If you are a California resident, you have specific rights under the
            California Consumer Privacy Act (CCPA):
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Right to know what personal information we collect and how it&apos;s used
            </li>
            <li>Right to delete your personal information</li>
            <li>Right to opt-out of the sale of personal information</li>
            <li>Right to non-discrimination for exercising your rights</li>
          </ul>
          <p className="text-white font-medium">
            We do not sell personal information.
          </p>
        </section>

        {/* Children */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Children&apos;s Privacy</h2>
          <p>
            Queen Mama is not intended for use by children under 13 years of age. We do
            not knowingly collect personal information from children under 13.
          </p>
        </section>

        {/* Changes */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of
            any changes by posting the new Privacy Policy on this page and updating the
            &ldquo;Last updated&rdquo; date.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <p>
            <a
              href="mailto:privacy@queenmama.app"
              className="text-[var(--qm-accent)] hover:underline"
            >
              privacy@queenmama.app
            </a>
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
