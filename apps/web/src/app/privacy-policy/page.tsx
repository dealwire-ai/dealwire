import Link from "next/link";
import { SignalMark } from "@/components/signal-mark";

export const metadata = {
  title: "Privacy Policy · Dealwire",
  description: "How Dealwire collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans">
      <nav className="relative z-50 px-6 lg:px-16 py-6 border-b border-white/[0.04]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <SignalMark />
            <span className="text-base font-medium tracking-tight text-white/90">
              Dealwire
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            ← Back home
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 lg:px-16 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            Dealwire Privacy Policy
          </h1>
          <p className="text-sm text-white/50 font-mono tracking-wide">
            Last updated: April 11, 2026
          </p>
        </div>

        <div className="space-y-8 text-white/75 leading-relaxed">
          <p>
            Frontstep AI, LLC, doing business as Dealwire (the
            &quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or
            &quot;our&quot;), is committed to maintaining robust privacy
            protections for its users. This Privacy Policy (&quot;Privacy
            Policy&quot;) is designed to help you understand how we collect,
            use, and safeguard the information you provide to us and to assist
            you in making informed decisions when using our Service.
          </p>

          <div className="border-l-2 border-[#C8A96E] bg-white/[0.02] p-5 rounded space-y-3">
            <p>
              For purposes of this Policy, &quot;Site&quot; refers to the
              Company&apos;s website, accessible at{" "}
              <a
                href="https://www.dealwire.ai"
                className="text-[#C8A96E] hover:underline"
              >
                https://www.dealwire.ai
              </a>
              .
            </p>
            <p>
              &quot;Service&quot; refers to the Company&apos;s AI-powered
              platform for analyzing private market assets — including
              commercial real estate deals, businesses, and other investments —
              accessed via the Site and through connected integrations such as
              email inboxes and data provider APIs.
            </p>
            <p>
              The terms &quot;we,&quot; &quot;us,&quot; and &quot;our&quot;
              refer to Frontstep AI, LLC. &quot;You&quot; refers to the user of
              our Site or Service.
            </p>
          </div>

          <p>
            By accessing our Site or Service, you accept this Privacy Policy and
            our{" "}
            <Link
              href="/terms-of-use"
              className="text-[#C8A96E] hover:underline"
            >
              Terms of Use
            </Link>{" "}
            and consent to our collection, storage, use, and disclosure of your
            Personal Information as described below.
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              I. Information We Collect
            </h2>
            <p className="mb-3">
              We collect both Non-Personal Information and Personal Information.
            </p>
            <p className="mb-3">
              <strong className="text-white">Non-Personal Information</strong>{" "}
              includes anonymous usage data, general demographic information,
              referring and exit URLs, device and platform types, user
              preferences, and aggregate click data.
            </p>
            <p>
              <strong className="text-white">Personal Information</strong>{" "}
              includes data you voluntarily provide when registering or using
              the Service — such as your name, email address, phone number,
              company, and any other contact information — as well as data
              ingested from integrations you connect (for example, emails and
              attachments from a linked Microsoft Outlook account).
            </p>

            <div className="space-y-5 mt-5">
              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  1. Information Collected via Technology
                </h3>
                <p>
                  We collect browser and device data (such as referring URL,
                  browser type, device type, and access times) via cookies and
                  similar tracking technologies to improve the Service. We use
                  both session and persistent cookies. For example, persistent
                  cookies may be used to maintain login status or preferences.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  2. Information You Provide by Registering
                </h3>
                <p>
                  When you create an account, you provide Personal Information
                  including your email address, name, organization, and
                  authentication credentials. You authorize us to collect,
                  store, and use this information as described in this Policy.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  3. Information from Connected Integrations
                </h3>
                <p>
                  When you connect an email account (such as Microsoft Outlook)
                  or other third-party integration, we access the data necessary
                  to provide the Service — including messages, attachments,
                  metadata, and authentication tokens. We describe how we handle
                  Microsoft 365 / Outlook data in Section IV below.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  4. Children&apos;s Privacy
                </h3>
                <p>
                  Our Service is not directed at children under 13, and we do
                  not knowingly collect information from children under 13. If
                  we learn that we have, we will delete such data promptly.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              II. How We Use and Share Information
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  Personal Information.
                </h3>
                <p>
                  We do not sell or rent your Personal Information. We share it
                  only with trusted service providers who help us operate the
                  Service — including cloud hosting, database, AI model,
                  authentication, and analytics providers — under strict
                  confidentiality. We may disclose your Personal Information
                  when required by law or to protect rights and safety.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  AI Processing.
                </h3>
                <p>
                  Deal materials and other User Content you submit or that are
                  ingested from connected integrations may be processed by
                  third-party large language model providers (such as OpenAI and
                  Anthropic) to generate summaries, underwriting outputs, and
                  drafted communications. These providers act as our service
                  providers and are contractually prohibited from using your
                  content to train their models unless you separately consent.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  Non-Personal Information.
                </h3>
                <p>
                  We use Non-Personal Information to analyze trends, improve the
                  Service, and customize user experience. We may share
                  aggregated Non-Personal Information with partners.
                </p>
              </div>

              <div>
                <p>
                  In the case of business transactions (such as a merger or
                  acquisition), your information may be transferred but will
                  remain protected under this Privacy Policy.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              III. How We Protect Information
            </h2>
            <p>
              We implement industry-standard security measures (encryption in
              transit and at rest, access controls, and audited cloud
              infrastructure) to protect your data but cannot guarantee absolute
              security. Your account is protected by authentication credentials
              — keep them confidential.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              IV. Microsoft 365 / Outlook Data — Retention and Deletion
            </h2>
            <div className="border-l-2 border-emerald-500/60 bg-emerald-500/[0.03] p-5 rounded">
              <h3 className="text-lg font-medium text-emerald-200 mb-2">
                Microsoft Graph API Data Handling
              </h3>
              <p>
                When you connect your Microsoft Outlook account to our Service,
                we access your mailbox data solely to provide deal-flow
                monitoring, analysis, and automated reply features. Here&apos;s
                how we handle your Microsoft data:
              </p>
            </div>

            <div className="space-y-5 mt-5">
              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  Data We Access
                </h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    Email messages and metadata (subject, sender, recipients,
                    date, body content)
                  </li>
                  <li>Attachments included in deal-related emails</li>
                  <li>Account information necessary for API authentication</li>
                  <li>
                    OAuth tokens required for accessing your Microsoft account
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  Data Retention
                </h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <strong className="text-white">OAuth Tokens:</strong> Stored
                    securely until you disconnect your account or delete your
                    Dealwire account.
                  </li>
                  <li>
                    <strong className="text-white">Deal Data:</strong> We retain
                    deal-related emails, extracted data, and generated analyses
                    for as long as your account is active, so you can review
                    historical deal flow.
                  </li>
                  <li>
                    <strong className="text-white">Non-Deal Emails:</strong>{" "}
                    Emails that our system determines are unrelated to deal flow
                    are not persistently stored.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  Data Deletion
                </h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <strong className="text-white">Immediate Deletion:</strong>{" "}
                    You can disconnect your Microsoft account at any time
                    through your account settings, which immediately revokes our
                    access and deletes stored OAuth tokens.
                  </li>
                  <li>
                    <strong className="text-white">Account Deletion:</strong>{" "}
                    When you delete your Dealwire account, all connected
                    Microsoft data, including OAuth tokens and ingested deal
                    content, is permanently deleted within 30 days.
                  </li>
                  <li>
                    <strong className="text-white">Upon Request:</strong> You
                    may request immediate deletion of your Microsoft data by
                    contacting us at{" "}
                    <a
                      href="mailto:isaac@dealwire.ai"
                      className="text-[#C8A96E] hover:underline"
                    >
                      isaac@dealwire.ai
                    </a>
                    .
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white/90 mb-2">
                  Limited Use
                </h3>
                <p>
                  Dealwire&apos;s use of information received from the Microsoft
                  Graph API is limited to providing the Service to you. We do
                  not sell this data, do not use it for advertising, and do not
                  use it to train generalized AI models.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              V. Your Rights Regarding Personal Information
            </h2>
            <p>
              You may opt out of marketing communications at any time by
              following the unsubscribe instructions in our emails or by
              adjusting settings in the Service. We will continue to send
              important administrative emails regardless of your marketing
              preferences. You may also request access to, correction of, or
              deletion of your Personal Information by contacting us at{" "}
              <a
                href="mailto:isaac@dealwire.ai"
                className="text-[#C8A96E] hover:underline"
              >
                isaac@dealwire.ai
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              VI. Links to Other Websites
            </h2>
            <p>
              We are not responsible for the privacy practices of third-party
              sites linked to or integrated with our Service. Please review
              their policies before use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              VII. AI Output Disclaimer
            </h2>
            <div className="border-l-2 border-amber-500/60 bg-amber-500/[0.03] p-5 rounded space-y-3">
              <h3 className="text-lg font-medium text-amber-200">
                Important Notice About AI Use
              </h3>
              <p>
                Our Service uses AI to ingest, summarize, enrich, and analyze
                private market deal materials. While we design our AI to be as
                accurate and useful as possible, AI-generated outputs —
                including deal summaries, underwriting figures, distress scores,
                and recommendations — may contain errors, omissions, or biases,
                and may reflect inaccuracies in underlying third-party data
                sources.
              </p>
              <p className="font-medium text-white/90">
                We explicitly disclaim liability for any investment,
                underwriting, or business decision made in reliance on AI
                output. You are solely responsible for verifying material facts
                and for complying with all applicable laws — including
                securities, fair housing, and anti-discrimination laws — when
                using the Service.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              VIII. Changes to Our Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically. Significant
              changes will be communicated via email or a prominent notice on
              the Site before taking effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              IX. Contact Us
            </h2>
            <p className="mb-4">
              For questions about this Privacy Policy, please contact:
            </p>
            <div className="bg-white/[0.02] border border-white/5 p-5 rounded space-y-1 text-white/80">
              <p className="font-semibold text-white">
                Frontstep AI, LLC (d/b/a Dealwire)
              </p>
              <p>
                <span className="text-white/60">Email:</span>{" "}
                <a
                  href="mailto:isaac@dealwire.ai"
                  className="text-[#C8A96E] hover:underline"
                >
                  isaac@dealwire.ai
                </a>
              </p>
              <p>
                <span className="text-white/60">Address:</span> 23 Avondale
                Road, West Hartford, Connecticut 06117
              </p>
            </div>
          </section>

          <div className="border-t border-white/[0.06] pt-6 mt-12">
            <p className="text-xs font-mono text-white/30 tracking-wider">
              © {new Date().getFullYear()} · Frontstep AI, LLC. All rights
              reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
