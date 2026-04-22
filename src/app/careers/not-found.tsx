import Link from "next/link";

export default function CareersNotFound() {
  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        padding: "120px 24px",
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
        <div style={{ fontSize: "64px", marginBottom: "20px", opacity: 0.4 }}>
          ✦
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
          Position Not Found
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#71717a",
            margin: "0 0 32px",
            lineHeight: 1.6,
          }}
        >
          This position may have been filled or is no longer accepting
          applications. Check out our other open roles.
        </p>
        <Link
          href="/careers"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 24px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
            transition: "all 0.2s",
          }}
        >
          Browse Open Positions →
        </Link>
      </div>
    </div>
  );
}
