import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Talent Network | IQMela Careers",
  description:
    "Join the IQMela Talent Network. Get AI-matched to roles tailored to your skills.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ intake?: string }>;
}) {
  const params = await searchParams;
  const intakeId = params.intake || "";

  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "400px",
          background:
            "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 16px",
            borderRadius: "9999px",
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.15)",
            fontSize: "12px",
            fontWeight: 600,
            color: "#818cf8",
            marginBottom: "20px",
          }}
        >
          ✦ Talent Network
        </div>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-0.02em",
            margin: "0 0 8px",
          }}
        >
          Join the IQMela Talent Network
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#71717a",
            margin: "0 0 32px",
            lineHeight: 1.6,
          }}
        >
          Sign in with Google or LinkedIn. Your profile will be linked to your
          application and our AI will match you to future roles.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <SignUp
            forceRedirectUrl={`/careers/welcome${intakeId ? `?intake=${intakeId}` : ""}`}
            appearance={{
              elements: {
                rootBox: { width: "100%" },
                card: {
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "16px",
                  boxShadow: "none",
                },
              },
            }}
          />
        </div>

        <p
          style={{
            fontSize: "11px",
            color: "#3f3f46",
            marginTop: "16px",
            lineHeight: 1.6,
          }}
        >
          By joining, you agree to our{" "}
          <a href="/legal/terms" style={{ color: "#52525b" }}>Terms</a>
          {" "}and{" "}
          <a href="/careers/privacy" style={{ color: "#52525b" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
