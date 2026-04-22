import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers | IQMela — Where AI Meets Opportunity",
  description:
    "Join the IQMela Talent Network. Our AI matches you to roles tailored to your skills. One profile, thousands of opportunities.",
};

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#fafafa",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(9,9,11,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 24px",
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/careers" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "-0.02em", color: "#fff" }}>
              IQ<span style={{ color: "#818cf8" }}>Mela</span>
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#52525b",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
                paddingLeft: "10px",
                marginLeft: "4px",
              }}
            >
              Careers
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              href="/sign-in"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "#71717a",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              For Employers →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1 }}>{children}</main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <span style={{ fontSize: "16px", fontWeight: 900, color: "#fff" }}>
            IQ<span style={{ color: "#818cf8" }}>Mela</span>
          </span>
          <p style={{ fontSize: "13px", color: "#52525b", maxWidth: "420px", lineHeight: 1.6 }}>
            The intelligent hiring platform. AI-powered interviews, structured scorecards,
            and data-driven decisions.
          </p>
          <div style={{ display: "flex", gap: "24px", fontSize: "12px" }}>
            <Link href="/careers/privacy" style={{ color: "#71717a", textDecoration: "none" }}>
              Privacy Policy
            </Link>
            <Link href="/legal/terms" style={{ color: "#71717a", textDecoration: "none" }}>
              Terms of Service
            </Link>
            <Link href="/legal/cookies" style={{ color: "#71717a", textDecoration: "none" }}>
              Cookies
            </Link>
          </div>
          <p style={{ fontSize: "11px", color: "#3f3f46" }}>
            © {new Date().getFullYear()} RelyOnAI LLP. IQMela™ is a product of RelyOnAI LLP. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
