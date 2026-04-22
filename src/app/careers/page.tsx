import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open Positions | IQMela Careers",
  description:
    "Browse open positions from top companies. Apply in 30 seconds. Join the IQMela Talent Network and let AI match you to your next role.",
};

export default async function CareersPage() {
  const positions = await prisma.position.findMany({
    where: {
      isPublished: true,
      isDeleted: false,
      status: "OPEN",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      location: true,
      employmentType: true,
      remotePolicy: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      description: true,
      jdRequiredSkillsJson: true,
      createdAt: true,
    },
  });

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "80px 0 60px" }}>
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "400px",
            background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

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
            marginBottom: "24px",
          }}
        >
          <span style={{ fontSize: "14px" }}>✦</span>
          AI-Powered Talent Matching
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: "#fff",
            margin: "0 0 16px",
          }}
        >
          Where AI meets
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            opportunity
          </span>
        </h1>

        <p
          style={{
            fontSize: "17px",
            color: "#71717a",
            maxWidth: "520px",
            margin: "0 auto 32px",
            lineHeight: 1.6,
          }}
        >
          Join the IQMela Talent Network. Apply in 30 seconds.
          Our AI matches you to roles you&apos;d never find on your own.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "32px",
            fontSize: "13px",
            color: "#52525b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#22c55e" }}>●</span>
            3 fields. 30 seconds.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#818cf8" }}>●</span>
            AI-matched roles
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#f472b6" }}>●</span>
            Companies come to you
          </div>
        </div>
      </div>

      {/* ── Positions Grid ─────────────────────────────────────────────────── */}
      <div style={{ paddingBottom: "80px" }}>
        <h2
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#52525b",
            marginBottom: "20px",
          }}
        >
          Open Positions ({positions.length})
        </h2>

        {positions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: "16px",
            }}
          >
            <p style={{ fontSize: "16px", color: "#52525b" }}>
              No positions open right now. Check back soon!
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "16px",
            }}
          >
            {positions.map((pos) => {
              const skills = Array.isArray(pos.jdRequiredSkillsJson)
                ? (pos.jdRequiredSkillsJson as string[]).slice(0, 4)
                : [];
              const daysAgo = Math.floor(
                (Date.now() - pos.createdAt.getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <Link
                  key={pos.id}
                  href={`/careers/${pos.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "16px",
                      padding: "24px",
                      transition: "all 0.25s ease",
                      cursor: "pointer",
                    }}
                    className="careers-card"
                  >
                    {/* Title + Time */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.3 }}>
                        {pos.title}
                      </h3>
                      <span style={{ fontSize: "11px", color: "#52525b", whiteSpace: "nowrap", marginLeft: "12px" }}>
                        {daysAgo === 0 ? "Today" : `${daysAgo}d ago`}
                      </span>
                    </div>

                    {/* Description snippet */}
                    {pos.description && (
                      <p style={{ fontSize: "13px", color: "#71717a", lineHeight: 1.5, margin: "0 0 14px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {pos.description}
                      </p>
                    )}

                    {/* Badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                      {pos.location && (
                        <span style={badgeStyle}>📍 {pos.location}</span>
                      )}
                      {pos.remotePolicy && (
                        <span style={{ ...badgeStyle, background: pos.remotePolicy === "REMOTE" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)", color: pos.remotePolicy === "REMOTE" ? "#22c55e" : "#71717a" }}>
                          {pos.remotePolicy}
                        </span>
                      )}
                      {pos.employmentType && (
                        <span style={badgeStyle}>{pos.employmentType.replace("_", " ")}</span>
                      )}
                      {pos.salaryMin && (
                        <span style={{ ...badgeStyle, color: "#818cf8" }}>
                          {pos.salaryCurrency || "$"}{pos.salaryMin.toLocaleString()}
                          {pos.salaryMax ? `–${pos.salaryMax.toLocaleString()}` : "+"}
                        </span>
                      )}
                    </div>

                    {/* Skills */}
                    {skills.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {skills.map((s) => (
                          <span key={s} style={{ padding: "2px 8px", borderRadius: "4px", background: "rgba(99,102,241,0.06)", color: "#a5b4fc", fontSize: "11px", fontWeight: 500 }}>
                            {s}
                          </span>
                        ))}
                        {(pos.jdRequiredSkillsJson as string[])?.length > 4 && (
                          <span style={{ fontSize: "11px", color: "#52525b", padding: "2px 4px" }}>
                            +{(pos.jdRequiredSkillsJson as string[]).length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .careers-card:hover {
          border-color: rgba(99,102,241,0.25) !important;
          background: rgba(99,102,241,0.04) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(99,102,241,0.08);
        }
      `}</style>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 10px",
  borderRadius: "6px",
  fontSize: "11px",
  fontWeight: 500,
  background: "rgba(255,255,255,0.04)",
  color: "#71717a",
  border: "1px solid rgba(255,255,255,0.06)",
};
