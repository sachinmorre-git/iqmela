import type { Metadata } from "next";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export const metadata: Metadata = {
  title: "Data Processing Agreement — IQMela",
  description: "Data Processing Agreement compliant with India's Digital Personal Data Protection Act 2023 (DPDP Act). IQMela™ is a product of RelyOnAI LLP, registered in India.",
};

export default function DpaPage() {
  const { COMPANY_NAME, PRODUCT_NAME, TRADING_AS, EFFECTIVE_DATE, ORG_MSA, LEGAL_EMAIL } = LEGAL_VERSIONS;
  return (
    <article className="prose prose-invert prose-zinc max-w-none">
      <div className="mb-10 pb-8 border-b border-zinc-800">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Data Processing Agreement</p>
        <h1 className="text-4xl font-black tracking-tight text-white mb-4 mt-0">Data Processing Agreement</h1>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <span>Version {ORG_MSA}</span>
          <span>·</span>
          <span>Effective {EFFECTIVE_DATE}</span>
          <span>·</span>
          <span>Applies to: Client Organisations</span>
        </div>
      </div>

      <div className="mb-10 p-5 border border-violet-500/20 rounded-2xl bg-violet-950/20">
        <p className="text-sm text-violet-300 leading-relaxed">
          This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of the Master Service Agreement between{" "}
          <strong className="text-white">{COMPANY_NAME}</strong> (“Processor”) — the registered legal entity operating
          the <strong className="text-white">{PRODUCT_NAME}™</strong> platform — and the client organisation
          (&ldquo;Controller&rdquo;). It governs the processing of personal data by {COMPANY_NAME} on behalf of
          the Controller in connection with the {PRODUCT_NAME}™ platform services.
        </p>
      </div>

      <LegalSection title="1. Definitions">
        <ul>
          <li><strong>&ldquo;Controller&rdquo;</strong> means the client organisation that determines the purposes and means of processing personal data.</li>
          <li><strong>&ldquo;Processor&rdquo;</strong> means <strong>{COMPANY_NAME}</strong>, the registered legal entity operating the {PRODUCT_NAME}™ platform, which processes personal data on behalf of the Controller.</li>
          <li><strong>&ldquo;{PRODUCT_NAME}™&rdquo;</strong> means the AI-powered hiring intelligence platform, a product and intellectual property of {COMPANY_NAME}.</li>
          <li><strong>&ldquo;Data Subject&rdquo;</strong> means the individual to whom personal data relates (primarily candidates).</li>
          <li><strong>&ldquo;Personal Data&rdquo;</strong> has the meaning given in Section 2(t) of the Digital Personal Data Protection Act 2023 (DPDP Act) and Section 2(1)(o) of the Information Technology Act 2000.</li>
          <li><strong>&ldquo;Processing&rdquo;</strong> has the meaning given in Section 2(x) of the DPDP Act 2023.</li>
          <li><strong>&ldquo;Sub-Processor&rdquo;</strong> means any third party engaged by {COMPANY_NAME} to process personal data.</li>
          <li><strong>&ldquo;Competent Authority&rdquo;</strong> means the Data Protection Board of India as constituted under the DPDP Act 2023.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Nature and Purpose of Processing">
        <p>IQMela processes personal data on behalf of the Controller for the purpose of:</p>
        <ul>
          <li>Conducting, managing, and analysing live and asynchronous interview sessions</li>
          <li>Parsing, storing, and scoring candidate resumes</li>
          <li>Generating AI-powered interview assistance, question recommendations, and candidate analysis</li>
          <li>Recording and transcribing interview sessions (with candidate consent)</li>
          <li>Computing behavioural signals during live sessions for integrity and quality review</li>
          <li>Managing hiring pipelines, feedback, and decisions</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Categories of Personal Data">
        <p>The Processor processes the following categories of personal data on behalf of the Controller:</p>
        <ul>
          <li>Candidate identity data (name, email, phone)</li>
          <li>Candidate professional data (resume content, work history, skills, education)</li>
          <li>Interview video and audio recordings</li>
          <li>Speech transcriptions</li>
          <li>Behavioural signal data (eye gaze patterns, posture indicators, speaking pace)</li>
          <li>AI-generated scoring and analysis</li>
          <li>Interviewer notes and evaluation scores</li>
          <li>Hiring decisions and their rationale</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Obligations of the Processor">
        <p>The Processor shall:</p>
        <ul>
          <li>Process personal data only on documented instructions from the Controller (these Terms and the Service configuration)</li>
          <li>Ensure that persons authorised to process personal data have committed to confidentiality</li>
          <li>Implement appropriate technical and organisational security measures consistent with the DPDP Act 2023 and information security standards under the IT Act 2000</li>
          <li>Not engage Sub-Processors without prior written authorisation from the Controller (general authorisation given at contract signing; Controller notified of specific additions)</li>
          <li>Assist the Controller in fulfilling its obligations to respond to Data Subject rights requests</li>
          <li>Delete or return all personal data upon termination of the agreement</li>
          <li>Make available all information necessary to demonstrate compliance with this DPA</li>
          <li>Notify the Controller without undue delay upon becoming aware of a personal data breach affecting Controller data</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Obligations of the Controller">
        <p>The Controller shall:</p>
        <ul>
          <li>Ensure there is a valid legal basis for all processing instructions it gives to the Processor</li>
          <li>Obtain all necessary consents from candidates prior to their data being submitted to the platform</li>
          <li>Ensure that any processing instructions comply with applicable law</li>
          <li>Notify IQMela promptly of any data subject requests the Controller receives relating to data processed by IQMela</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Security Measures">
        <p>{COMPANY_NAME} implements the following security measures in accordance with the DPDP Act 2023 and IT Act 2000:</p>
        <ul>
          <li><strong>Pseudonymisation:</strong> Candidate data accessed via cuid identifiers, not exposed PII</li>
          <li><strong>Encryption in transit:</strong> TLS 1.3 for all communications</li>
          <li><strong>Encryption at rest:</strong> Via sub-processor infrastructure</li>
          <li><strong>Access controls:</strong> RBAC enforced at application layer for all data access</li>
          <li><strong>Audit logging:</strong> All data access events logged with user, timestamp, and action</li>
          <li><strong>Automatic deletion:</strong> Recordings auto-deleted after 90 days</li>
          <li><strong>Availability:</strong> Multi-region failover via Vercel and Neon infrastructure</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Sub-Processors">
        <p>
          The Controller provides general authorisation for IQMela to engage the sub-processors listed in the
          Privacy Policy. IQMela will notify the Controller of any intended changes to the sub-processor list
          with at least 14 days&apos; notice, giving the Controller the opportunity to object.
        </p>
        <p>
          All sub-processors are bound by data processing agreements that impose obligations equivalent to
          those in this DPA.
        </p>
      </LegalSection>

      <LegalSection title="8. Cross-Border Data Transfers">
        <p>
          Some sub-processors are located outside India. All such transfers are carried out under appropriate
          contractual safeguards and data processing agreements consistent with the Digital Personal Data
          Protection Act 2023 (DPDP Act) and the Information Technology Act 2000. {COMPANY_NAME} ensures
          all sub-processors maintain equivalent data protection standards by contract.
        </p>
      </LegalSection>

      <LegalSection title="9. Data Breach Notification">
        <p>
          In the event of a personal data breach affecting Controller data, IQMela will:
        </p>
        <ul>
          <li>Notify the Controller without undue delay, and in any event within 72 hours (or as required by the DPDP Act 2023) of becoming aware</li>
          <li>Provide all information required by the DPDP Act 2023 and IT Act 2000 to the extent available</li>
          <li>Assist the Controller in meeting its own notification obligations to the Data Protection Board of India and Data Principals</li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Data Return and Deletion">
        <p>
          Upon termination or expiry of the Master Service Agreement, IQMela will:
        </p>
        <ul>
          <li>Make available a full data export in JSON format within 14 days of request</li>
          <li>Permanently delete all Controller personal data from active systems within 30 days of termination</li>
          <li>Confirm deletion in writing upon the Controller&apos;s request</li>
          <li>Backup copies will be overwritten within the normal backup rotation cycle (maximum 90 days)</li>
        </ul>
      </LegalSection>

      <LegalSection title="11. Audit Rights">
        <p>
          The Controller may, with 30 days&apos; written notice, conduct audits or inspections of IQMela&apos;s
          processing activities under this DPA, at the Controller&apos;s cost. IQMela may satisfy this obligation
          by providing third-party audit reports (SOC 2, ISO 27001 equivalent) where available.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          For DPA queries, contact {COMPANY_NAME}:{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="text-indigo-400 hover:underline">
            {LEGAL_EMAIL}
          </a>
        </p>
        <p className="text-sm text-zinc-500">
          {COMPANY_NAME} · {PRODUCT_NAME}™ Platform · {EFFECTIVE_DATE}
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
