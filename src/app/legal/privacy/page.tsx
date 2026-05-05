import type { Metadata } from "next";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export const metadata: Metadata = {
  title: "Privacy Policy — IQMela",
  description: "IQMela platform Privacy Policy. IQMela™ is a product of RelyOnAI LLP, registered in India. Compliant with India's Digital Personal Data Protection Act 2023 (DPDP Act).",
};

export default function PrivacyPage() {
  const { COMPANY_NAME, PRODUCT_NAME, TRADING_AS, EFFECTIVE_DATE, PRIVACY_POLICY, PRIVACY_EMAIL, LEGAL_EMAIL } = LEGAL_VERSIONS;
  return (
    <article className="prose prose-invert prose-zinc max-w-none">
      <div className="mb-10 pb-8 border-b border-zinc-800">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Privacy Policy</p>
        <h1 className="text-4xl font-black tracking-tight text-white mb-4 mt-0">Privacy Policy</h1>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <span>Version {PRIVACY_POLICY}</span>
          <span>·</span>
          <span>Effective {EFFECTIVE_DATE}</span>
          <span>·</span>
          <span>{TRADING_AS}</span>
        </div>
      </div>

      {/* Entity notice */}
      <div className="mb-6 p-4 border border-zinc-700/40 rounded-xl bg-zinc-900/40">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Legal Entity</p>
        <p className="text-sm text-zinc-300">
          <strong className="text-white">{PRODUCT_NAME}™</strong> is a product of{" "}
          <strong className="text-white">{COMPANY_NAME}</strong>, the registered data controller for this platform.
        </p>
      </div>

      {/* Plain-language Summary */}
      <div className="mb-10 p-5 border border-rose-500/20 rounded-2xl bg-rose-950/20">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-3">Summary (plain language)</p>
        <ul className="text-sm text-zinc-300 space-y-2 list-none pl-0 m-0">
          <li>📹 <strong>We record interviews</strong> only with your explicit consent. Recordings are deleted after 90 days.</li>
          <li>🤖 <strong>AI Avatars & Analysis</strong> — We use AI (including conversational avatars) to conduct interviews and analyse your session (gaze, posture, speaking pace). This is disclosed before every session.</li>
          <li>⚖️ <strong>Automated processing transparency</strong> — We provide AI-generated insights, but final hiring decisions are always made by humans.</li>
          <li>🔒 <strong>Your data is never sold</strong> to third parties or used for advertising.</li>
          <li>🗑️ <strong>You can request deletion</strong> of your data at any time by emailing {LEGAL_VERSIONS.PRIVACY_EMAIL}.</li>
          <li>🇮🇳 <strong>DPDP Act 2023 compliant</strong> — governed by India&apos;s Digital Personal Data Protection Act 2023 and the IT Act 2000. You have rights to access, correct, and erase your data.</li>
        </ul>
      </div>

      <LegalSection title="1. Who We Are">
        <p>
          <strong>{COMPANY_NAME}</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is a registered
          limited liability partnership and the data controller for personal data processed through the{" "}
          {PRODUCT_NAME}™ platform. We are also a data processor on behalf of client organisations
          (&ldquo;Controllers&rdquo;) that use {PRODUCT_NAME}™ to manage their hiring workflows.
        </p>
        <p>
          <strong>{PRODUCT_NAME}™</strong> is a product and intellectual property of {COMPANY_NAME}.
          All data processing activities described in this policy are carried out by {COMPANY_NAME}
          operating the {PRODUCT_NAME}™ platform.
        </p>
        <p>
          Data protection contact:{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className="text-rose-400 hover:underline">
            {PRIVACY_EMAIL}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="2. Data We Collect">
        <p>We collect different data depending on your role:</p>

        <h3 className="text-white font-bold mt-6 mb-3">Candidates</h3>
        <ul>
          <li><strong>Identity data:</strong> Name, email address (from resume or interview invitation)</li>
          <li><strong>Resume data:</strong> Work history, education, skills, contact information, and any other content in uploaded CV files</li>
          <li><strong>Video and audio:</strong> Live interview recordings, including asynchronous sessions with AI avatars (only with explicit consent)</li>
          <li><strong>Transcription data:</strong> Diarised text transcripts of interview sessions, processed by AI models</li>
          <li><strong>Behavioural signals:</strong> Eye gaze zone, head posture, speaking pace, silence gaps — computed locally or via our AI sub-processors</li>
          <li><strong>Engagement scores:</strong> Confidence and engagement estimates derived from facial expression blendshapes (approximate probabilistic metrics, not psychological assessments)</li>
          <li><strong>Browser signals:</strong> Tab visibility changes, fullscreen status, keyboard event patterns — used for interview integrity and proctoring</li>
          <li><strong>Consent records:</strong> Timestamp, version of consent given (including specific consent for AI processing), and IP address</li>
        </ul>

        <h3 className="text-white font-bold mt-6 mb-3">Interviewers & Organisation Users</h3>
        <ul>
          <li><strong>Identity data:</strong> Name, email, organisation membership</li>
          <li><strong>Interview notes:</strong> Private notes taken during sessions</li>
          <li><strong>Feedback and scores:</strong> Submitted candidate evaluations and hiring decisions</li>
          <li><strong>Usage data:</strong> Platform actions, timestamps, feature usage patterns</li>
        </ul>

        <h3 className="text-white font-bold mt-6 mb-3">All Users</h3>
        <ul>
          <li><strong>Technical data:</strong> IP address, browser type, operating system, session identifiers</li>
          <li><strong>Cookie data:</strong> Essential session cookies only (see our <a href="/legal/cookies" className="text-rose-400 hover:underline">Cookie Policy</a>)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Why We Process Your Data (Lawful Basis)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="text-left py-2 pr-4 text-zinc-300 font-bold">Purpose</th>
              <th className="text-left py-2 pr-4 text-zinc-300 font-bold">Lawful Basis (DPDP Act 2023)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {[
              ["Providing interview and hiring services", "Consent / Contractual necessity"],
              ["Recording interviews", "Your explicit consent (required before recording begins)"],
              ["AI behavioural analysis", "Your explicit consent (disclosed at pre-join)"],
              ["Resume parsing and AI scoring", "Legitimate use for the hiring organisation"],
              ["Platform security and integrity", "Legitimate use"],
              ["Legal compliance and dispute resolution", "Legal obligation"],
              ["Platform improvement (anonymised only)", "Legitimate use"],
            ].map(([purpose, basis]) => (
              <tr key={purpose}>
                <td className="py-2 pr-4 text-zinc-400">{purpose}</td>
                <td className="py-2 text-zinc-400">{basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LegalSection>

      <LegalSection title="4. How Long We Keep Your Data">
        <ul>
          <li><strong>Interview recordings:</strong> Automatically deleted 90 days after session end</li>
          <li><strong>Transcriptions & signal reports:</strong> 12 months, then permanently deleted from Vercel Blob</li>
          <li><strong>Resume data:</strong> Retained while the hiring process is active; deleted upon written request or account closure + 30 days</li>
          <li><strong>Behavioural signal buffers (raw):</strong> Not retained — raw signals are summarised to aggregate scores only</li>
          <li><strong>Consent records:</strong> Retained for 7 years (legal compliance requirement)</li>
          <li><strong>Account data:</strong> Retained for 30 days after account closure, then permanently deleted</li>
          <li><strong>Aggregated, anonymised platform metrics:</strong> Retained indefinitely (contains no personal data)</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Sub-Processors">
        <p>
          We share personal data with the following trusted sub-processors under binding data processing agreements.
          All sub-processors are contractually prohibited from using your data for any purpose other than delivering
          their services to {COMPANY_NAME} (operating the {PRODUCT_NAME}™ platform).
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="text-left py-2 pr-4 text-zinc-300 font-bold">Provider</th>
              <th className="text-left py-2 pr-4 text-zinc-300 font-bold">Service</th>
              <th className="text-left py-2 text-zinc-300 font-bold">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {[
              ["Clerk", "User identity & authentication", "USA (contractual safeguards)"],
              ["LiveKit", "Real-time video infrastructure", "USA (contractual safeguards)"],
              ["Vercel", "Platform hosting & blob storage", "USA (contractual safeguards)"],
              ["Neon Technologies", "PostgreSQL database", "USA (contractual safeguards)"],
              ["Cloudflare R2", "Interview recording storage", "USA (contractual safeguards)"],
              ["AssemblyAI", "Speech-to-text transcription", "USA (contractual safeguards)"],
              ["Google (Gemini)", "AI language model inference (scoring, questions)", "USA (contractual safeguards)"],
              ["DeepSeek / OpenAI", "Fallback AI language model inference", "USA/Global (contractual safeguards)"],
              ["Tavus", "Conversational AI video avatars", "USA (contractual safeguards)"],
              ["Resend", "Transactional email delivery", "USA (contractual safeguards)"],
            ].map(([provider, service, location]) => (
              <tr key={provider}>
                <td className="py-2 pr-4 text-zinc-400 font-medium">{provider}</td>
                <td className="py-2 pr-4 text-zinc-400">{service}</td>
                <td className="py-2 text-zinc-500 text-xs">{location}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          We transfer personal data to third-party sub-processors located primarily in the United States.
          All such transfers are carried out under appropriate contractual safeguards and data processing
          agreements consistent with India&apos;s Digital Personal Data Protection Act 2023 (DPDP Act) and
          the Information Technology Act 2000. We ensure sub-processors provide an equivalent level of
          protection by contract.
        </p>
      </LegalSection>

      <LegalSection title="6. Your Rights">
        <p>
          Under India&apos;s Digital Personal Data Protection Act 2023 (DPDP Act) and the Information Technology
          Act 2000 (as amended), you have the following rights regarding your personal data:
        </p>
        <ul>
          <li><strong>Right of Access:</strong> Request a copy of all personal data we hold about you</li>
          <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data</li>
          <li><strong>Right to Erasure:</strong> Request deletion of your personal data (&ldquo;right to be forgotten&rdquo;)</li>
          <li><strong>Right to Restriction:</strong> Request limitation of processing in certain circumstances</li>
          <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
          <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
          <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time (this does not affect the lawfulness of processing before withdrawal)</li>
          <li><strong>Right to Lodge a Complaint:</strong> With your national data protection authority</li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href={`mailto:${LEGAL_VERSIONS.PRIVACY_EMAIL}`} className="text-rose-400 hover:underline">
            {LEGAL_VERSIONS.PRIVACY_EMAIL}
          </a>
          . We will respond within 30 days. We may need to verify your identity before processing requests.
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          We implement industry-standard security measures including:
        </p>
        <ul>
          <li>TLS 1.3 encryption for all data in transit</li>
          <li>AES-256 encryption for data at rest (via sub-processor infrastructure)</li>
          <li>Role-based access control (RBAC) limiting data access to authorised users only</li>
          <li>Non-guessable UUID-based paths for blob storage (recordings, transcripts, reports)</li>
          <li>Automatic recording deletion after 90 days</li>
          <li>Audit logging of all access to sensitive interview data</li>
        </ul>
        <p>
          In the event of a personal data breach that is likely to result in harm to data principals, we will
          notify the Data Protection Board of India and affected individuals within the timeframes required by
          the Digital Personal Data Protection Act 2023 and the Information Technology Act 2000.
        </p>
      </LegalSection>

      <LegalSection title="8. Children's Privacy">
        <p>
          The Service is not directed at individuals under the age of 18. We do not knowingly collect personal
          data from minors. If you believe a minor has provided us with personal data, contact us immediately
          at {LEGAL_VERSIONS.PRIVACY_EMAIL} and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to This Policy">
        <p>
          We may update this Privacy Policy periodically. Material changes will be notified via email and
          in-platform notification. Continued use after the effective date constitutes acceptance of the updated
          policy. The current version and effective date are always displayed at the top of this document.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          For privacy questions, data subject requests, or complaints:
        </p>
        <ul>
          <li>Email: <a href={`mailto:${LEGAL_VERSIONS.PRIVACY_EMAIL}`} className="text-rose-400 hover:underline">{LEGAL_VERSIONS.PRIVACY_EMAIL}</a></li>
          <li>Legal: <a href={`mailto:${LEGAL_VERSIONS.LEGAL_EMAIL}`} className="text-rose-400 hover:underline">{LEGAL_VERSIONS.LEGAL_EMAIL}</a></li>
        </ul>
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
