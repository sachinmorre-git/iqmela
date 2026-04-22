import type { Metadata } from "next";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export const metadata: Metadata = {
  title: "Terms of Service — IQMela",
  description: "IQMela platform Terms of Service governed by RelyOnAI LLP, the registered legal entity.",
};

export default function TermsPage() {
  const { COMPANY_NAME, PRODUCT_NAME, TRADING_AS, EFFECTIVE_DATE, PLATFORM_TOS, LEGAL_EMAIL } = LEGAL_VERSIONS;
  return (
    <article className="prose prose-invert prose-zinc max-w-none">
      <div className="mb-10 pb-8 border-b border-zinc-800">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Terms of Service</p>
        <h1 className="text-4xl font-black tracking-tight text-white mb-4 mt-0">Platform Terms of Service</h1>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <span>Version {PLATFORM_TOS}</span>
          <span>·</span>
          <span>Effective {EFFECTIVE_DATE}</span>
          <span>·</span>
          <span>{TRADING_AS}</span>
        </div>
      </div>

      {/* Entity notice */}
      <div className="mb-10 p-5 border border-zinc-700/40 rounded-2xl bg-zinc-900/40">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Legal Entity Notice</p>
        <p className="text-sm text-zinc-300 leading-relaxed">
          <strong className="text-white">IQMela™</strong> is a product and intellectual property of{" "}
          <strong className="text-white">{COMPANY_NAME}</strong>, a registered limited liability partnership.
          All agreements, obligations, and liabilities under these Terms are between you and {COMPANY_NAME}.
          References to &ldquo;IQMela&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo; throughout
          this document refer to {COMPANY_NAME} operating the {PRODUCT_NAME}™ platform.
        </p>
      </div>

      <LegalSection title="1. Acceptance of Terms">
        <p>
          By accessing or using the IQMela™ platform (the &ldquo;Service&rdquo;), operated by {COMPANY_NAME}
          (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;), you agree to be bound by
          these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, you must not use the Service.
        </p>
        <p>
          These Terms apply to all users of the Service, including candidates, interviewers, hiring managers,
          organisation administrators, vendor representatives, and any other individuals accessing the platform.
        </p>
        <p>
          For organisations using IQMela™ as a business service, acceptance of these Terms by any authorised
          representative constitutes acceptance on behalf of the organisation.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of Service">
        <p>
          IQMela™ is an AI-powered hiring intelligence platform developed and operated by {COMPANY_NAME} that enables
          organisations to conduct, manage, analyse, and evaluate live and asynchronous interviews.
          The Service includes, but is not limited to:
        </p>
        <ul>
          <li>Live video interview rooms with real-time AI assistance</li>
          <li>Automated resume parsing, scoring, and pipeline management</li>
          <li>AI-generated interview question recommendations</li>
          <li>Behavioural signal analysis during live sessions (eye gaze, posture, speaking pace)</li>
          <li>Diarised interview transcription and structured post-session reports</li>
          <li>Role-based access control for multi-user organisations</li>
          <li>AI avatar-led asynchronous interview sessions</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Eligibility">
        <p>You may use the Service only if:</p>
        <ul>
          <li>You are at least 18 years of age</li>
          <li>You have the legal capacity to enter into these Terms</li>
          <li>You are not barred from receiving services under applicable law</li>
          <li>Where acting on behalf of an organisation, you are authorised to bind that organisation</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Account Registration">
        <p>
          Access to the Service requires authentication via Clerk, our identity provider. You are responsible for
          maintaining the confidentiality of your credentials and for all activities under your account. You must
          notify us immediately at {LEGAL_EMAIL} of any unauthorised use.
        </p>
        <p>
          {COMPANY_NAME} reserves the right to suspend or terminate accounts that violate these Terms, provide false
          information, or engage in conduct that harms other users or the platform.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable Use">
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of applicable employment or privacy law</li>
          <li>Discriminate against candidates on the basis of any protected characteristic (age, race, gender, religion, disability, national origin, sexual orientation, or any other characteristic protected by law)</li>
          <li>Attempt to circumvent or defeat any AI monitoring or anti-cheat systems during interviews</li>
          <li>Record, reproduce, or distribute any interview session outside of the platform&apos;s built-in recording tools</li>
          <li>Use AI assistance tools, coaching software, or other unauthorised aids during candidate interview assessments without disclosure</li>
          <li>Access any part of the Service you are not authorised to access</li>
          <li>Reverse-engineer, decompile, or create derivative works from the Service</li>
          <li>Use the Service to train competing AI models without express written consent from {COMPANY_NAME}</li>
          <li>Upload or transmit any malicious code, viruses, or harmful content</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. AI-Generated Content and Analysis">
        <p>
          The Service uses artificial intelligence, including Google Gemini models and MediaPipe computer vision,
          to generate interview insights, candidate analyses, question recommendations, and behavioural reports.
        </p>
        <p>
          <strong>You acknowledge and agree that:</strong>
        </p>
        <ul>
          <li>AI-generated outputs are informational only and do not constitute employment recommendations, psychological assessments, or hiring decisions</li>
          <li>{COMPANY_NAME} makes no warranty as to the accuracy, completeness, or fitness for purpose of any AI-generated analysis</li>
          <li>Hiring decisions must always be made by qualified human decision-makers using AI outputs as one input among many</li>
          <li>AI behavioural signals (gaze, posture, pace) are probabilistic estimates, not definitive behavioural assessments</li>
          <li>You must not use AI-generated outputs as the sole basis for any adverse employment action</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Interview Recordings and Transcriptions">
        <p>
          The Service can record live interview sessions. Recordings are stored on Cloudflare R2 infrastructure
          and are automatically deleted 90 days after creation. Transcriptions are stored on Vercel Blob storage.
        </p>
        <p>
          Recordings are accessible only to authorised members of the relevant organisation (Org Admins, Hiring
          Managers, assigned Interviewers). Sharing recordings outside the platform without candidate consent
          is strictly prohibited.
        </p>
        <p>
          Candidate consent to recording is obtained at the pre-interview stage and is required before any
          recording begins. Sessions will not be recorded without explicit consent.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual Property and Trademark">
        <p>
          <strong>Your content:</strong> You retain all ownership rights to content you upload (resumes, job
          descriptions, interview notes, feedback). By uploading content, you grant {COMPANY_NAME} a limited,
          non-exclusive licence to process that content solely to provide the Service.
        </p>
        <p>
          <strong>IQMela™ intellectual property:</strong> IQMela™ is a trademark of {COMPANY_NAME}.
          All software, algorithms, UI designs, documentation, branding, and proprietary AI models embodied in
          the IQMela™ platform are owned exclusively by {COMPANY_NAME}. Nothing in these Terms transfers
          any intellectual property ownership to you.
        </p>
        <p>
          <strong>Aggregate and anonymised data:</strong> {COMPANY_NAME} may use anonymised, non-identifiable
          aggregate data derived from platform usage (never linked to individuals or organisations) to improve
          the Service and train models. This data contains no personal information.
        </p>
      </LegalSection>

      <LegalSection title="9. Privacy">
        <p>
          Your use of the Service is also governed by our{" "}
          <a href="/legal/privacy" className="text-indigo-400 hover:underline">Privacy Policy</a>, which is
          incorporated into these Terms by reference. By using the Service, you consent to the data practices
          described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="10. Third-Party Services">
        <p>The Service integrates with the following third-party providers:</p>
        <ul>
          <li><strong>Clerk</strong> — Identity and authentication</li>
          <li><strong>LiveKit</strong> — Real-time video infrastructure</li>
          <li><strong>Vercel</strong> — Hosting, edge functions, and blob storage</li>
          <li><strong>Neon Technologies</strong> — PostgreSQL database hosting</li>
          <li><strong>Cloudflare R2</strong> — Recording storage</li>
          <li><strong>AssemblyAI</strong> — Speech recognition and diarised transcription</li>
          <li><strong>Google Gemini</strong> — AI language model inference</li>
          <li><strong>Resend</strong> — Transactional email delivery</li>
        </ul>
        <p>
          Each provider operates under its own terms and privacy policies. {COMPANY_NAME} maintains data processing
          agreements with all sub-processors handling personal data. See our{" "}
          <a href="/legal/dpa" className="text-indigo-400 hover:underline">Data Processing Agreement</a> for details.
        </p>
      </LegalSection>

      <LegalSection title="11. Payment and Subscription">
        <p>
          Certain features of the Service are available only under paid subscription plans (Plus, Ultra, Enterprise).
          Subscription terms, pricing, and billing cycles are set out at the time of plan selection. All fees are
          non-refundable except where required by applicable law or as expressly stated in your Master Service Agreement.
        </p>
        <p>
          {COMPANY_NAME} reserves the right to change pricing with 30 days&apos; notice. Continued use of the Service
          after a price change constitutes acceptance of the new pricing.
        </p>
      </LegalSection>

      <LegalSection title="12. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND.
          {COMPANY_NAME.toUpperCase()} EXPRESSLY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES
          OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>
          {COMPANY_NAME.toUpperCase()} DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
          OR FREE OF HARMFUL COMPONENTS.
        </p>
      </LegalSection>

      <LegalSection title="13. Limitation of Liability">
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, {COMPANY_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL,
          ARISING FROM OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE.
        </p>
        <p>
          {COMPANY_NAME.toUpperCase()}&apos;S AGGREGATE LIABILITY TO YOU FOR ANY CLAIMS ARISING UNDER THESE TERMS
          SHALL NOT EXCEED THE GREATER OF (A) THE FEES PAID BY YOU IN THE TWELVE MONTHS PRECEDING THE CLAIM,
          OR (B) ONE HUNDRED US DOLLARS (USD 100).
        </p>
      </LegalSection>

      <LegalSection title="14. Indemnification">
        <p>
          You agree to indemnify and hold harmless {COMPANY_NAME}, its partners, officers, employees, and agents
          from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees)
          arising out of or related to your use of the Service, your violation of these Terms, or your violation
          of any third-party rights.
        </p>
      </LegalSection>

      <LegalSection title="15. Termination">
        <p>
          Either party may terminate these Terms at any time. {COMPANY_NAME} may suspend or terminate access
          immediately for material breach. Upon termination, your right to use the Service ceases. We will retain
          your data for 30 days post-termination to allow data export, after which it will be permanently deleted.
        </p>
      </LegalSection>

      <LegalSection title="16. Governing Law and Dispute Resolution">
        <p>
          These Terms are governed by and construed in accordance with the laws of India, including the Indian
          Contract Act 1872, the Information Technology Act 2000 (as amended), and the Digital Personal Data
          Protection Act 2023. {COMPANY_NAME} is a registered limited liability partnership in India.
        </p>
        <p>
          Any dispute arising from or in connection with these Terms shall first be subject to good-faith
          negotiation for 30 days. If unresolved, disputes shall be submitted to the exclusive jurisdiction of
          the competent courts in India. The parties irrevocably submit to the personal jurisdiction of such courts.
          Nothing in this clause prevents either party from seeking urgent injunctive or interim relief.
        </p>
      </LegalSection>

      <LegalSection title="17. Changes to Terms">
        <p>
          {COMPANY_NAME} may update these Terms from time to time. Material changes will be communicated via email
          and an in-platform notification at least 14 days before taking effect. Continued use of the Service after
          the effective date constitutes acceptance of the updated Terms. Where re-consent is required, an
          agreement gate will be presented at next login.
        </p>
      </LegalSection>

      <LegalSection title="18. Contact">
        <p>
          For questions about these Terms, contact us at{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="text-indigo-400 hover:underline">
            {LEGAL_EMAIL}
          </a>
          .
        </p>
        <p className="text-sm text-zinc-500">
          {COMPANY_NAME} · IQMela™ Platform · {EFFECTIVE_DATE}
        </p>
      </LegalSection>
    </article>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 mt-0">{title}</h2>
      <div className="text-zinc-400 leading-relaxed space-y-3 text-[15px]">{children}</div>
    </section>
  );
}
