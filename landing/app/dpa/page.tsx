import { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Data Processing Agreement - Queen Mama",
  description: "Data Processing Agreement (DPA) for Queen Mama application.",
};

export default function DPAPage() {
  return (
    <LegalPageLayout
      title="Data Processing Agreement"
      lastUpdated="January 2026"
      description="This Data Processing Agreement forms part of our Terms of Service and governs our processing of personal data on your behalf."
    >
      <div className="space-y-8 text-[var(--qm-text-secondary)]">
        {/* Introduction */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">1. Introduction</h2>
          <p>
            This Data Processing Agreement (&ldquo;DPA&rdquo;) is entered into between
            you (&ldquo;Customer&rdquo;, &ldquo;Controller&rdquo;) and Queen Mama
            (&ldquo;Processor&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) and
            supplements our Terms of Service.
          </p>
          <p>
            This DPA reflects the parties&apos; agreement regarding the processing of
            Personal Data in accordance with applicable Data Protection Laws, including
            but not limited to the General Data Protection Regulation (GDPR), the
            California Consumer Privacy Act (CCPA), and other applicable privacy
            regulations.
          </p>
        </section>

        {/* Definitions */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">2. Definitions</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">&ldquo;Personal Data&rdquo;</strong> means
              any information relating to an identified or identifiable natural person.
            </li>
            <li>
              <strong className="text-white">&ldquo;Processing&rdquo;</strong> means any
              operation performed on Personal Data, including collection, storage, use,
              disclosure, or deletion.
            </li>
            <li>
              <strong className="text-white">&ldquo;Data Protection Laws&rdquo;</strong>{" "}
              means all applicable laws relating to data protection and privacy,
              including GDPR, CCPA, and other relevant regulations.
            </li>
            <li>
              <strong className="text-white">&ldquo;Subprocessor&rdquo;</strong> means
              any third party engaged by us to process Personal Data on behalf of the
              Customer.
            </li>
            <li>
              <strong className="text-white">&ldquo;Customer Data&rdquo;</strong> means
              any Personal Data processed by Queen Mama on behalf of the Customer in
              connection with the Services.
            </li>
          </ul>
        </section>

        {/* Scope */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            3. Scope of Processing
          </h2>
          <p className="text-white font-medium">
            Important Note on Queen Mama&apos;s Architecture:
          </p>
          <p>
            Queen Mama is designed with privacy at its core. Unlike many SaaS
            applications, we do not process your conversation data through our servers.
            Instead:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Audio and transcription data flows directly between your device and your
              chosen transcription provider (Deepgram, AssemblyAI) using your API keys
            </li>
            <li>
              AI prompts and responses flow directly between your device and your chosen
              AI provider (OpenAI, Anthropic, Google) using your API keys
            </li>
            <li>
              Session data, modes, and configurations are stored locally on your device
            </li>
          </ul>
          <p>
            As a result, for most use cases, Queen Mama acts as a software tool rather
            than a data processor, as we do not have access to your Personal Data.
          </p>
        </section>

        {/* Our Obligations */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            4. Processor Obligations
          </h2>
          <p>To the extent we process any Personal Data on your behalf, we agree to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Process Personal Data only on your documented instructions and in
              accordance with this DPA
            </li>
            <li>
              Implement appropriate technical and organizational measures to ensure
              security of Personal Data
            </li>
            <li>
              Ensure that persons authorized to process Personal Data have committed to
              confidentiality
            </li>
            <li>
              Assist you in responding to data subject requests regarding their Personal
              Data
            </li>
            <li>
              Notify you without undue delay upon becoming aware of a Personal Data
              breach
            </li>
            <li>
              Delete or return all Personal Data upon termination of services, at your
              choice
            </li>
            <li>
              Make available information necessary to demonstrate compliance with this
              DPA
            </li>
          </ul>
        </section>

        {/* Subprocessors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">5. Subprocessors</h2>
          <p>
            You acknowledge and agree that we may engage Subprocessors to process
            Personal Data. Our current list of Subprocessors is available at{" "}
            <a
              href="/subprocessors"
              className="text-[var(--qm-accent)] hover:underline"
            >
              queenmama.app/subprocessors
            </a>
            .
          </p>
          <p>
            However, due to Queen Mama&apos;s architecture where you provide your own
            API keys, the primary data processors for your conversation data are the
            third-party AI and transcription providers you choose to use. Your data
            processing relationship with these providers is governed by their respective
            DPAs and privacy policies:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">OpenAI:</strong> Subject to OpenAI&apos;s
              Data Processing Addendum
            </li>
            <li>
              <strong className="text-white">Anthropic:</strong> Subject to
              Anthropic&apos;s Terms of Service
            </li>
            <li>
              <strong className="text-white">Google:</strong> Subject to Google Cloud
              Data Processing Terms
            </li>
            <li>
              <strong className="text-white">Deepgram:</strong> Subject to
              Deepgram&apos;s Data Processing Agreement
            </li>
            <li>
              <strong className="text-white">AssemblyAI:</strong> Subject to
              AssemblyAI&apos;s Terms of Service
            </li>
          </ul>
        </section>

        {/* Security Measures */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">6. Security Measures</h2>
          <p>
            We implement and maintain appropriate technical and organizational security
            measures, including:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">Encryption:</strong> All network
              communications use TLS 1.2 or higher. Local data is protected using
              standard macOS security features.
            </li>
            <li>
              <strong className="text-white">Secure Credential Storage:</strong> API
              keys are stored in your macOS Keychain, Apple&apos;s secure credential
              management system.
            </li>
            <li>
              <strong className="text-white">Access Controls:</strong> The application
              requests only necessary system permissions (microphone, screen recording).
            </li>
            <li>
              <strong className="text-white">Privacy by Design:</strong> The
              undetectable feature ensures the app is not captured in screen recordings.
            </li>
          </ul>
        </section>

        {/* Data Subject Rights */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            7. Data Subject Rights
          </h2>
          <p>
            We will assist you in responding to requests from data subjects exercising
            their rights under Data Protection Laws, including:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Right of access to Personal Data</li>
            <li>Right to rectification of inaccurate data</li>
            <li>Right to erasure (&ldquo;right to be forgotten&rdquo;)</li>
            <li>Right to restriction of processing</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
          </ul>
          <p>
            Since most data is stored locally on your device, you have direct control
            over your data and can exercise these rights directly by accessing,
            modifying, or deleting data within the application or by uninstalling the
            application.
          </p>
        </section>

        {/* Data Breach */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            8. Personal Data Breach
          </h2>
          <p>
            In the event of a Personal Data breach affecting Customer Data, we will:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Notify you without undue delay and in any event within 72 hours of
              becoming aware of the breach
            </li>
            <li>
              Provide information about the nature of the breach, categories and
              approximate number of affected data subjects and records
            </li>
            <li>Describe the likely consequences of the breach</li>
            <li>
              Describe the measures taken or proposed to address the breach and mitigate
              its effects
            </li>
            <li>
              Cooperate with you in investigating and responding to the breach
            </li>
          </ul>
        </section>

        {/* Audits */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">9. Audit Rights</h2>
          <p>
            We will make available to you information necessary to demonstrate
            compliance with this DPA and allow for audits, including inspections, by you
            or an auditor mandated by you.
          </p>
          <p>
            You may request an audit no more than once per year, with reasonable advance
            notice, during normal business hours, and subject to confidentiality
            obligations.
          </p>
        </section>

        {/* International Transfers */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            10. International Data Transfers
          </h2>
          <p>
            To the extent Personal Data is transferred outside of the European Economic
            Area (EEA), we ensure appropriate safeguards are in place, including:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
            <li>
              Transfers to countries with an adequacy decision from the European
              Commission
            </li>
            <li>Other legally recognized transfer mechanisms</li>
          </ul>
          <p>
            Note that when using your own API keys, data transfers to AI and
            transcription providers are governed by your direct relationship with those
            providers.
          </p>
        </section>

        {/* Data Retention */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            11. Data Retention & Deletion
          </h2>
          <p>
            We retain Personal Data only for as long as necessary to provide our
            services or as required by law.
          </p>
          <p>
            Upon termination of our services or upon your request, we will delete or
            return all Personal Data within 30 days, except where retention is required
            by applicable law.
          </p>
          <p>
            For locally stored data, you can delete your data at any time by:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Clearing session history within the application</li>
            <li>Deleting custom modes and configurations</li>
            <li>Removing API keys from your Keychain</li>
            <li>Uninstalling the application</li>
          </ul>
        </section>

        {/* Liability */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            12. Liability & Indemnification
          </h2>
          <p>
            Each party&apos;s liability under this DPA is subject to the limitations of
            liability set forth in our Terms of Service.
          </p>
          <p>
            We shall be liable for damages caused by processing that does not comply
            with this DPA or applicable Data Protection Laws. We shall not be liable for
            damages caused by processing that complies with your documented
            instructions.
          </p>
        </section>

        {/* Term */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            13. Term & Termination
          </h2>
          <p>
            This DPA shall remain in effect for as long as we process Personal Data on
            your behalf. Upon termination:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              We will cease processing Personal Data except as necessary to comply with
              legal obligations
            </li>
            <li>
              We will delete or return all Personal Data within 30 days, at your choice
            </li>
            <li>
              Provisions that by their nature should survive termination shall remain in
              effect
            </li>
          </ul>
        </section>

        {/* Governing Law */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">14. Governing Law</h2>
          <p>
            This DPA shall be governed by and construed in accordance with the same laws
            that govern our Terms of Service, unless otherwise required by applicable
            Data Protection Laws.
          </p>
          <p>
            For data subjects in the EEA, this DPA shall be governed by the laws of the
            EU member state where the data subject resides, to the extent required by
            GDPR.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">15. Contact</h2>
          <p>
            For questions regarding this DPA or data protection matters, please contact
            us:
          </p>
          <p>
            <strong className="text-white">Data Protection Contact:</strong>
            <br />
            <a
              href="mailto:dpo@queenmama.app"
              className="text-[var(--qm-accent)] hover:underline"
            >
              dpo@queenmama.app
            </a>
          </p>
        </section>

        {/* SCCs Notice */}
        <section className="space-y-4 pt-8 border-t border-[var(--qm-border-subtle)]">
          <h2 className="text-2xl font-semibold text-white">
            Annex: Standard Contractual Clauses
          </h2>
          <p>
            Where required for international data transfers, this DPA incorporates by
            reference the Standard Contractual Clauses (SCCs) adopted by the European
            Commission Decision 2021/914 (Module Two: Controller to Processor), as may
            be amended or replaced.
          </p>
          <p>
            A copy of the SCCs is available upon request by contacting{" "}
            <a
              href="mailto:legal@queenmama.app"
              className="text-[var(--qm-accent)] hover:underline"
            >
              legal@queenmama.app
            </a>
            .
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
