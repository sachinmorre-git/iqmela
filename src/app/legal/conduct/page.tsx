import type { Metadata } from "next";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export const metadata: Metadata = {
  title: "Interviewer Code of Conduct — IQMela",
  description: "IQMela Interviewer Code of Conduct — standards for fair, unbiased, and professional interviewing on the platform.",
};

export default function ConductPage() {
  const { COMPANY_NAME, PRODUCT_NAME, EFFECTIVE_DATE, INTERVIEWER_COC, LEGAL_EMAIL } = LEGAL_VERSIONS;
  return (
    <article className="prose prose-invert prose-zinc max-w-none">
      <div className="mb-10 pb-8 border-b border-zinc-800">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Interviewer Code of Conduct</p>
        <h1 className="text-4xl font-black tracking-tight text-white mb-4 mt-0">Interviewer Code of Conduct</h1>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <span>Version {INTERVIEWER_COC}</span>
          <span>·</span>
          <span>Effective {EFFECTIVE_DATE}</span>
          <span>·</span>
          <span>Applies to: All Interviewers and Organisation Members</span>
        </div>
      </div>

      <LegalSection title="1. Purpose">
        <p>
          This Code of Conduct sets the standards expected of all interviewers and organisation members
          conducting interviews through the {PRODUCT_NAME}™ platform, operated by {COMPANY_NAME}.
          Adherence to these standards protects candidates, your organisation, and the integrity of the hiring process.
        </p>
      </LegalSection>

      <LegalSection title="2. Fair and Unbiased Interviewing">
        <p>All interviewers must:</p>
        <ul>
          <li>Evaluate candidates solely on job-relevant skills, experience, and demonstrated competencies</li>
          <li>Use consistent evaluation criteria across all candidates for the same role</li>
          <li>Base hiring recommendations on structured feedback and objective scoring</li>
          <li>Be aware of and actively work to mitigate unconscious biases</li>
        </ul>
        <p>Interviewers must not ask questions about or make any employment decision based on:</p>
        <ul>
          <li>Age, race, ethnicity, or national origin</li>
          <li>Gender, gender identity, or gender expression</li>
          <li>Sexual orientation or marital status</li>
          <li>Pregnancy, plans to have children, or family status</li>
          <li>Religion or religious observance</li>
          <li>Disability or health conditions</li>
          <li>Political views or affiliations</li>
          <li>Any other characteristic protected by applicable employment law</li>
        </ul>
        <p>
          Questions about any of the above characteristics are strictly prohibited and may constitute unlawful
          discrimination. If you are uncertain whether a question is appropriate, do not ask it.
        </p>
      </LegalSection>

      <LegalSection title="3. Candidate Privacy and Data Handling">
        <ul>
          <li>All candidate information accessed through IQMela is strictly confidential</li>
          <li>Resume data, interview recordings, transcriptions, and AI analysis may only be used for the specific hiring process for which they were collected</li>
          <li>Do not share candidate data with unauthorised individuals inside or outside your organisation</li>
          <li>Do not save, screenshot, download, or reproduce any candidate recordings or reports outside the platform</li>
          <li>Do not discuss candidate personal information in public or semi-public settings</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Interview Integrity">
        <ul>
          <li><strong>Conduct interviews yourself.</strong> You may not delegate, outsource, or allow another person to conduct an interview on your behalf without the candidate&apos;s knowledge</li>
          <li><strong>Be present and attentive.</strong> Multitasking, leaving the session, or failing to engage professionally with the candidate is prohibited</li>
          <li><strong>Do not coach around the AI.</strong> Attempting to manipulate AI analysis or candidate scoring systems is a violation of these terms</li>
          <li><strong>Record only through the platform.</strong> Do not use external recording software during platform-hosted interviews</li>
          <li><strong>Report misconduct.</strong> If you observe another interviewer behaving inappropriately, report it to your organisation administrator</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. AI Assistance Disclosure">
        <p>
          IQMela&apos;s AI Copilot features provide real-time assistance to interviewers. Candidates are informed
          that AI tools are used to assist interviewers and analyse sessions at the pre-interview consent stage.
        </p>
        <p>You must not:</p>
        <ul>
          <li>Falsely represent AI-generated suggestions as your own independent assessment to candidates</li>
          <li>Use AI-generated analysis as the sole basis for adverse employment decisions without human review</li>
          <li>Share raw AI scoring data with candidates without appropriate context and review</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Professional Standards">
        <ul>
          <li>Begin and end interviews on time</li>
          <li>Set clear expectations at the start of each session</li>
          <li>Give candidates reasonable time to answer questions without interruption</li>
          <li>Provide a clear timeline for next steps at the end of the interview</li>
          <li>Submit structured feedback within 48 hours of each interview</li>
          <li>Ensure your audio and video quality enables a professional interview experience</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Consequences of Violations">
        <p>
          Violations of this Code of Conduct may result in:
        </p>
        <ul>
          <li>Removal from the interview panel for the affected role</li>
          <li>Suspension of interviewer access pending investigation</li>
          <li>Permanent revocation of platform access</li>
          <li>Notification to your organisation administrator</li>
          <li>Legal action where violations constitute unlawful discrimination or data protection breaches</li>
        </ul>
        <p>
          {COMPANY_NAME} reserves the right to audit interview sessions, AI analysis logs, and feedback records for
          compliance with this Code.
        </p>
      </LegalSection>

      <LegalSection title="8. Questions and Reporting">
        <p>
          For questions about what is appropriate conduct, or wish to report a violation, contact
          {" "}{COMPANY_NAME} (operating {PRODUCT_NAME}™):{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="text-rose-400 hover:underline">
            {LEGAL_EMAIL}
          </a>
        </p>
        <p>
          Reports are handled confidentially. We take all reports seriously and will investigate promptly.
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
