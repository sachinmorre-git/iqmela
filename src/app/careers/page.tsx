import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";
import { ScrollReveal } from "./ScrollReveal";

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

  const activeCount = positions.length;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          textAlign: "center",
          padding: "100px 0 80px",
          position: "relative",
        }}
      >
        {/* Headline badge */}
        <div className="hero-enter-1">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 20px",
              borderRadius: "9999px",
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.12)",
              fontSize: "12px",
              fontWeight: 600,
              color: "#a5b4fc",
              marginBottom: "32px",
              letterSpacing: "0.02em",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#818cf8",
              }}
            />
            AI-Powered Talent Matching
          </div>
        </div>

        {/* Main headline */}
        <div className="hero-enter-2">
          <h1
            style={{
              fontSize: "clamp(40px, 5.5vw, 72px)",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: "#fff",
              margin: "0 0 24px",
            }}
          >
            Where AI meets
            <br />
            <span className="gradient-text-animated">opportunity</span>
          </h1>
        </div>

        {/* Subtitle */}
        <div className="hero-enter-3">
          <p
            style={{
              fontSize: "18px",
              color: "#71717a",
              maxWidth: "520px",
              margin: "0 auto 40px",
              lineHeight: 1.7,
              fontWeight: 400,
            }}
          >
            Join the IQMela Talent Network. Apply in 30 seconds.
            <br />
            Our AI matches you to roles you&apos;d never find on your own.
          </p>
        </div>

        {/* Stats strip */}
        <div className="hero-enter-4">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0",
              padding: "6px 8px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <StatsPill color="#22c55e" label={`${activeCount} Active Roles`} />
            <Divider />
            <StatsPill color="#818cf8" label="30s Apply" />
            <Divider />
            <StatsPill color="#f472b6" label="AI-Matched" />
          </div>
        </div>
      </div>

      {/* ══ POSITIONS GRID ════════════════════════════════════════════════════ */}
      <div style={{ paddingBottom: "100px" }}>
        <ScrollReveal>
          <h2
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#52525b",
              marginBottom: "24px",
            }}
          >
            Open Positions ({activeCount})
          </h2>
        </ScrollReveal>

        {positions.length === 0 ? (
          <ScrollReveal>
            <div
              className="glass"
              style={{
                textAlign: "center",
                padding: "80px 20px",
                borderRadius: "20px",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: "16px",
                  opacity: 0.4,
                }}
              >
                ✦
              </div>
              <p
                style={{
                  fontSize: "16px",
                  color: "#52525b",
                  fontWeight: 500,
                }}
              >
                No positions open right now. Check back soon!
              </p>
            </div>
          </ScrollReveal>
        ) : (
          <div
            className="reveal-stagger"
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
              const isNew = daysAgo <= 2;

              return (
                <ScrollReveal key={pos.id}>
                  <Link
                    href={`/careers/${pos.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="career-card">
                      {/* Title + Time */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "14px",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "17px",
                            fontWeight: 700,
                            color: "#fff",
                            margin: 0,
                            lineHeight: 1.3,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {pos.title}
                        </h3>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexShrink: 0,
                            marginLeft: "12px",
                          }}
                        >
                          {isNew && (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "#22c55e",
                                background: "rgba(34,197,94,0.1)",
                                border: "1px solid rgba(34,197,94,0.2)",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                animation: "pulse 2s infinite",
                              }}
                            >
                              New
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#3f3f46",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {daysAgo === 0
                              ? "Today"
                              : daysAgo === 1
                              ? "Yesterday"
                              : `${daysAgo}d ago`}
                          </span>
                        </div>
                      </div>

                      {/* Description snippet */}
                      {pos.description && (
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#71717a",
                            lineHeight: 1.6,
                            margin: "0 0 16px",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {pos.description}
                        </p>
                      )}

                      {/* Badges */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                          marginBottom: "16px",
                        }}
                      >
                        {pos.location && (
                          <Badge icon="📍" label={pos.location} />
                        )}
                        {pos.remotePolicy && (
                          <Badge
                            label={pos.remotePolicy}
                            accent={pos.remotePolicy === "REMOTE"}
                          />
                        )}
                        {pos.employmentType && (
                          <Badge
                            label={pos.employmentType.replace("_", " ")}
                          />
                        )}
                        {pos.salaryMin && (
                          <Badge
                            label={`${pos.salaryCurrency || "$"}${pos.salaryMin.toLocaleString()}${pos.salaryMax ? `–${pos.salaryMax.toLocaleString()}` : "+"}`}
                            accent
                          />
                        )}
                      </div>

                      {/* Skills */}
                      {skills.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "5px",
                          }}
                        >
                          {skills.map((s) => (
                            <span
                              key={s}
                              style={{
                                padding: "3px 10px",
                                borderRadius: "6px",
                                background: "rgba(99,102,241,0.06)",
                                border:
                                  "1px solid rgba(99,102,241,0.1)",
                                color: "#a5b4fc",
                                fontSize: "11px",
                                fontWeight: 500,
                              }}
                            >
                              {s}
                            </span>
                          ))}
                          {(pos.jdRequiredSkillsJson as string[])?.length >
                            4 && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#3f3f46",
                                padding: "3px 6px",
                              }}
                            >
                              +
                              {(pos.jdRequiredSkillsJson as string[])
                                .length - 4}{" "}
                              more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Apply hint on hover — handled by CSS .career-card */}
                    </div>
                  </Link>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-Components ──────────────────────────────────────────────────────── */

function StatsPill({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        fontSize: "13px",
        color: "#a1a1aa",
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
      {label}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: "1px",
        height: "16px",
        background: "rgba(255,255,255,0.08)",
      }}
    />
  );
}

function Badge({
  icon,
  label,
  accent,
}: {
  icon?: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 12px",
        borderRadius: "8px",
        fontSize: "11px",
        fontWeight: 500,
        background: accent
          ? "rgba(99,102,241,0.08)"
          : "rgba(255,255,255,0.03)",
        color: accent ? "#818cf8" : "#71717a",
        border: `1px solid ${accent ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}
