import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/locale-utils"

export const metadata: Metadata = {
  title: "Candidate Privacy Notice | IQMela Careers",
  description:
    "How IQMela processes your personal data when you apply for a role through our Careers page.",
};

export default function CandidatePrivacyPage() {
  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "60px 24px 80px" }}>
      <a href="/careers" style={{ fontSize: "13px", color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>
        ← Back to Careers
      </a>

      <h1
        style={{
          fontSize: "28px",
          fontWeight: 900,
          color: "#fff",
          letterSpacing: "-0.02em",
          margin: "24px 0 8px",
        }}
      >
        Candidate Privacy Notice
      </h1>
      <p style={{ fontSize: "13px", color: "#52525b", marginBottom: "40px" }}>
        Last updated: {formatDate(new Date(), { style: "long" })}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        <Section title="1. Who We Are">
          IQMela is a product of RelyOnAI LLP (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
          We operate the IQMela Talent Network platform at iqmela.com.
          When you apply for a role through our Careers page, we act as a
          <strong style={{ color: "#fff" }}> Data Controller</strong> for the personal data you provide.
        </Section>

        <Section title="2. What Data We Collect">
          <ul style={{ paddingLeft: "20px", lineHeight: 2 }}>
            <li><strong style={{ color: "#d4d4d8" }}>Name</strong> — to identify your application</li>
            <li><strong style={{ color: "#d4d4d8" }}>Email address</strong> — to communicate about your application</li>
            <li><strong style={{ color: "#d4d4d8" }}>Resume / CV</strong> — to assess your qualifications</li>
            <li><strong style={{ color: "#d4d4d8" }}>Application metadata</strong> — timestamp, source, IP address (for rate limiting)</li>
          </ul>
          <p style={{ marginTop: "8px" }}>
            We do <strong style={{ color: "#fff" }}>not</strong> collect: date of birth, social security numbers,
            government IDs, ethnicity, gender, disability status, religion, or any other protected-class information.
          </p>
        </Section>

        <Section title="3. Why We Process Your Data">
          <ul style={{ paddingLeft: "20px", lineHeight: 2 }}>
            <li><strong style={{ color: "#d4d4d8" }}>Lawful Basis: Consent</strong> (GDPR Article 6(1)(a)) — You explicitly consent when you check the consent checkbox on the application form.</li>
            <li><strong style={{ color: "#d4d4d8" }}>Purpose:</strong> To evaluate your suitability for the role you applied to, and to match you to future roles if you join our Talent Network.</li>
          </ul>
        </Section>

        <Section title="4. AI-Assisted Screening">
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.12)",
              marginBottom: "8px",
            }}
          >
            <p>
              Your application may be reviewed using <strong style={{ color: "#a5b4fc" }}>AI-assisted screening technology</strong>.
              Our system uses artificial intelligence to analyze your resume against the job requirements.
              This includes skills matching, experience evaluation, and qualification scoring.
            </p>
            <p style={{ marginTop: "8px" }}>
              <strong style={{ color: "#d4d4d8" }}>Important:</strong> AI screening produces recommendations only.
              All hiring decisions are made by human recruiters. You have the right to request a fully human review
              of your application by contacting us at the address below.
            </p>
          </div>
        </Section>

        <Section title="5. How Long We Keep Your Data">
          <ul style={{ paddingLeft: "20px", lineHeight: 2 }}>
            <li><strong style={{ color: "#d4d4d8" }}>Standard applications:</strong> 24 months from the date of submission, after which your data is automatically anonymized.</li>
            <li><strong style={{ color: "#d4d4d8" }}>Talent Network members:</strong> Indefinitely, until you request deletion or close your account.</li>
            <li><strong style={{ color: "#d4d4d8" }}>Promoted candidates:</strong> Data is retained in the hiring organization&apos;s pipeline according to their own retention policies.</li>
          </ul>
        </Section>

        <Section title="6. Your Rights">
          <p>Under GDPR, CCPA, and applicable data protection laws, you have the right to:</p>
          <ul style={{ paddingLeft: "20px", lineHeight: 2, marginTop: "8px" }}>
            <li><strong style={{ color: "#d4d4d8" }}>Access</strong> — Request a copy of the data we hold about you</li>
            <li><strong style={{ color: "#d4d4d8" }}>Rectification</strong> — Request correction of inaccurate data</li>
            <li><strong style={{ color: "#d4d4d8" }}>Erasure</strong> — Request deletion of your data (&quot;right to be forgotten&quot;)</li>
            <li><strong style={{ color: "#d4d4d8" }}>Portability</strong> — Receive your data in a machine-readable format</li>
            <li><strong style={{ color: "#d4d4d8" }}>Withdraw consent</strong> — At any time, without affecting the lawfulness of processing before withdrawal</li>
            <li><strong style={{ color: "#d4d4d8" }}>Human review</strong> — Request that a human reviewer evaluates any automated decision made about your application</li>
          </ul>
        </Section>

        <Section title="7. How to Exercise Your Rights">
          <p>
            To request deletion of your data or exercise any of your rights, you can:
          </p>
          <ul style={{ paddingLeft: "20px", lineHeight: 2, marginTop: "8px" }}>
            <li>Email us at: <strong style={{ color: "#818cf8" }}>privacy@iqmela.com</strong></li>
            <li>
              Use our automated deletion tool:{" "}
              <Link href="/api/candidate/delete-my-data" style={{ color: "#818cf8" }}>
                DELETE endpoint
              </Link>
            </li>
          </ul>
          <p style={{ marginTop: "8px" }}>
            We will respond to your request within 30 days (as required by GDPR Article 12(3)).
          </p>
        </Section>

        <Section title="8. Data Sharing">
          <p>
            Your data is shared only with:
          </p>
          <ul style={{ paddingLeft: "20px", lineHeight: 2, marginTop: "8px" }}>
            <li>The <strong style={{ color: "#d4d4d8" }}>hiring organization</strong> for the role you applied to (only if your application is promoted to their pipeline)</li>
            <li>Our <strong style={{ color: "#d4d4d8" }}>infrastructure providers</strong> (Vercel, Neon, Cloudflare) for hosting and processing</li>
            <li><strong style={{ color: "#d4d4d8" }}>Google Gemini</strong> for AI-assisted resume analysis (anonymized where possible)</li>
          </ul>
          <p style={{ marginTop: "8px" }}>
            We do <strong style={{ color: "#fff" }}>not</strong> sell your personal data.
            We do <strong style={{ color: "#fff" }}>not</strong> share it with advertisers or third-party data brokers.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            For any privacy-related questions or concerns:
          </p>
          <p style={{ marginTop: "8px" }}>
            <strong style={{ color: "#d4d4d8" }}>Data Protection Officer</strong>
            <br />
            RelyOnAI LLP
            <br />
            Email: privacy@iqmela.com
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "#fff",
          marginBottom: "10px",
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: "13px", color: "#a1a1aa", lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}
