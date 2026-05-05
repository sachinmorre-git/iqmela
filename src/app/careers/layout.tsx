import Link from "next/link";
import type { Metadata } from "next";
import "./careers-animations.css";

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
        background: "#050507",
        color: "#fafafa",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Ambient Gradient Mesh ──────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* ── Glassmorphic Header ────────────────────────────────────────────── */}
      <header
        className="glass-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
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
          <Link
            href="/careers"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                fontSize: "22px",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: "#fff",
              }}
            >
              IQ
              <span
                style={{
                  background: "linear-gradient(135deg, #818cf8, #c084fc)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Mela
              </span>
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#52525b",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
                paddingLeft: "10px",
              }}
            >
              Careers
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <Link
              href="/careers"
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "#a1a1aa",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              Open Roles
            </Link>
            <Link
              href="/sign-in"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                textDecoration: "none",
                padding: "8px 18px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "all 0.2s",
              }}
            >
              For Employers →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, position: "relative", zIndex: 1 }}>
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        className="dot-pattern"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.04)",
          padding: "60px 24px",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          {/* Brand */}
          <span
            style={{
              fontSize: "18px",
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            IQ
            <span
              style={{
                background: "linear-gradient(135deg, #818cf8, #c084fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Mela
            </span>
          </span>

          <p
            style={{
              fontSize: "13px",
              color: "#3f3f46",
              maxWidth: "420px",
              lineHeight: 1.7,
            }}
          >
            The intelligent hiring platform. AI-powered interviews, structured
            scorecards, and data-driven decisions.
          </p>

          {/* Links */}
          <div
            style={{
              display: "flex",
              gap: "28px",
              fontSize: "12px",
            }}
          >
            <Link
              href="/careers/privacy"
              style={{
                color: "#52525b",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/terms"
              style={{
                color: "#52525b",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/cookies"
              style={{
                color: "#52525b",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              Cookies
            </Link>
          </div>

          <p style={{ fontSize: "11px", color: "#27272a" }}>
            © {new Date().getFullYear()} RelyOnAI LLP. IQMela™ is a product of
            RelyOnAI LLP. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
