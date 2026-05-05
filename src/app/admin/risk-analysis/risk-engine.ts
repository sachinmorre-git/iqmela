/**
 * Risk Analysis Engine — Pure Scoring Algorithms
 *
 * Computes a Platform Risk Index (PRI) from 7 dimensions.
 * Each dimension is scored 0-100 (0 = no risk, 100 = critical).
 * The composite PRI is a weighted average.
 *
 * Zero side effects — pure computation from raw metrics.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface DimensionScore {
  id: string;
  label: string;
  icon: string; // lucide icon name
  score: number; // 0-100
  level: RiskLevel;
  weight: number; // contribution to PRI
  signals: RiskSignal[];
  trend: number[]; // 7-day sparkline data (daily scores)
}

export interface RiskSignal {
  label: string;
  value: string;
  status: RiskLevel;
  detail?: string;
}

export interface PlatformRiskReport {
  pri: number; // 0-100 composite
  level: RiskLevel;
  dimensions: DimensionScore[];
  generatedAt: string;
}

// ── Raw Metrics (from server queries) ────────────────────────────────────────

export interface RawMetrics {
  // Database
  totalResumes: number;
  totalPositions: number;
  totalUsers: number;
  totalOrganizations: number;
  totalIntakeCandidates: number;
  resumesLast7d: number;
  resumesPrev7d: number;
  intakeLast24h: number;
  intakeLast7d: number;
  intakePrev7d: number;

  // AI
  aiTokensLast24h: number;
  aiTokensLast7d: number;
  aiTokensPrev7d: number;
  aiCostLast24h: number;
  aiCostLast7d: number;
  aiCostPrev7d: number;
  aiCallsLast24h: number;

  // Video / Sessions
  activeAiSessions: number;
  completedAiSessionsLast24h: number;
  completedAiSessionsLast7d: number;
  avgSessionDurationMs: number | null;

  // Health
  healthChecksLast24h: number;
  healthFailuresLast24h: number;
  activeIncidents: number;
  criticalIncidents: number;
  degradedServices: string[];

  // Compliance
  resumesPastPurge: number;
  intakePastPurge: number;

  // Application volume (open positions)
  publishedPositions: number;
  positionsAcceptingApps: number;

  // 7-day trend snapshots (daily counts for sparklines)
  dailyIntake7d: number[];
  dailyAiCost7d: number[];
  dailyAiSessions7d: number[];
  dailyHealthFailures7d: number[];
}

// ── Thresholds ──────────────────────────────────────────────────────────────

const THRESHOLDS = {
  db: {
    totalRows: { low: 10_000, mod: 50_000, high: 200_000, crit: 500_000 },
    growthRate: { low: 0.05, mod: 0.15, high: 0.30, crit: 0.50 }, // % weekly
  },
  ai: {
    dailyCost: { low: 2, mod: 10, high: 50, crit: 200 }, // USD
    spikeMultiplier: 3, // if today > 3x weekly avg = spike
    dailyCalls: { low: 50, mod: 200, high: 1000, crit: 5000 },
  },
  video: {
    concurrent: { low: 5, mod: 15, high: 50, crit: 100 },
    dailySessions: { low: 10, mod: 50, high: 200, crit: 500 },
  },
  intake: {
    daily: { low: 20, mod: 100, high: 500, crit: 2000 },
    growthRate: { low: 0.1, mod: 0.3, high: 0.5, crit: 1.0 },
  },
  scale: {
    orgs: { low: 10, mod: 50, high: 200, crit: 500 },
    users: { low: 50, mod: 200, high: 1000, crit: 5000 },
    positions: { low: 20, mod: 100, high: 500, crit: 2000 },
  },
  security: {
    failureRate: { low: 0.02, mod: 0.05, high: 0.10, crit: 0.25 },
    activeIncidents: { low: 0, mod: 1, high: 3, crit: 5 },
  },
  compliance: {
    pastPurge: { low: 0, mod: 10, high: 50, crit: 200 },
  },
};

// ── Dimension Weights ───────────────────────────────────────────────────────

const WEIGHTS = {
  database: 0.20,
  ai: 0.15,
  video: 0.15,
  intake: 0.10,
  scale: 0.10,
  security: 0.20,
  compliance: 0.10,
};

// ── Scoring Functions ───────────────────────────────────────────────────────

function toLevel(score: number): RiskLevel {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MODERATE";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

function thresholdScore(
  value: number,
  t: { low: number; mod: number; high: number; crit: number }
): number {
  if (value <= t.low) return Math.round((value / Math.max(t.low, 1)) * 30);
  if (value <= t.mod) return 30 + Math.round(((value - t.low) / (t.mod - t.low)) * 30);
  if (value <= t.high) return 60 + Math.round(((value - t.mod) / (t.high - t.mod)) * 20);
  if (value <= t.crit) return 80 + Math.round(((value - t.high) / (t.crit - t.high)) * 20);
  return 100;
}

function growthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 1.0 : 0;
  return (current - previous) / previous;
}

function signalLevel(score: number): RiskLevel {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MODERATE";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

// ── Dimension Scorers ───────────────────────────────────────────────────────

function scoreDatabasePressure(m: RawMetrics): DimensionScore {
  const totalRows = m.totalResumes + m.totalPositions + m.totalUsers + m.totalIntakeCandidates;
  const rowScore = thresholdScore(totalRows, THRESHOLDS.db.totalRows);

  const growth = growthRate(m.resumesLast7d, m.resumesPrev7d);
  const growthScore = thresholdScore(
    Math.abs(growth),
    THRESHOLDS.db.growthRate
  );

  const score = Math.min(100, Math.round(rowScore * 0.6 + growthScore * 0.4));

  return {
    id: "database",
    label: "Database Pressure",
    icon: "Database",
    score,
    level: toLevel(score),
    weight: WEIGHTS.database,
    signals: [
      {
        label: "Total Records",
        value: totalRows.toLocaleString(),
        status: signalLevel(rowScore),
      },
      {
        label: "Weekly Growth",
        value: `${growth >= 0 ? "+" : ""}${(growth * 100).toFixed(1)}%`,
        status: signalLevel(growthScore),
        detail: `${m.resumesLast7d} new resumes this week vs ${m.resumesPrev7d} last week`,
      },
      {
        label: "Organizations",
        value: m.totalOrganizations.toLocaleString(),
        status: signalLevel(thresholdScore(m.totalOrganizations, THRESHOLDS.scale.orgs)),
      },
    ],
    trend: m.dailyIntake7d.map((v) =>
      thresholdScore(v, THRESHOLDS.intake.daily)
    ),
  };
}

function scoreAiTokenBurn(m: RawMetrics): DimensionScore {
  const costScore = thresholdScore(m.aiCostLast24h, THRESHOLDS.ai.dailyCost);

  const weeklyAvgDaily = m.aiCostLast7d / 7;
  const isSpike = weeklyAvgDaily > 0 && m.aiCostLast24h > weeklyAvgDaily * THRESHOLDS.ai.spikeMultiplier;
  const spikeScore = isSpike ? 85 : 0;

  const callScore = thresholdScore(m.aiCallsLast24h, THRESHOLDS.ai.dailyCalls);

  const costGrowth = growthRate(m.aiCostLast7d, m.aiCostPrev7d);

  const score = Math.min(100, Math.round(
    costScore * 0.4 + spikeScore * 0.3 + callScore * 0.3
  ));

  return {
    id: "ai",
    label: "AI Token Burn Rate",
    icon: "Bot",
    score,
    level: toLevel(score),
    weight: WEIGHTS.ai,
    signals: [
      {
        label: "24h Cost",
        value: `$${m.aiCostLast24h.toFixed(2)}`,
        status: signalLevel(costScore),
      },
      {
        label: "7d Cost",
        value: `$${m.aiCostLast7d.toFixed(2)}`,
        status: signalLevel(thresholdScore(m.aiCostLast7d / 7, THRESHOLDS.ai.dailyCost)),
        detail: `${costGrowth >= 0 ? "+" : ""}${(costGrowth * 100).toFixed(0)}% vs prior week`,
      },
      {
        label: "API Calls (24h)",
        value: m.aiCallsLast24h.toLocaleString(),
        status: signalLevel(callScore),
      },
      ...(isSpike ? [{
        label: "⚠️ Spike Detected",
        value: `${(m.aiCostLast24h / Math.max(weeklyAvgDaily, 0.01)).toFixed(1)}x avg`,
        status: "CRITICAL" as RiskLevel,
        detail: "Today's cost exceeds 3x the weekly daily average",
      }] : []),
    ],
    trend: m.dailyAiCost7d.map((v) =>
      thresholdScore(v, THRESHOLDS.ai.dailyCost)
    ),
  };
}

function scoreVideoFootprint(m: RawMetrics): DimensionScore {
  const concurrentScore = thresholdScore(m.activeAiSessions, THRESHOLDS.video.concurrent);
  const dailyScore = thresholdScore(
    m.completedAiSessionsLast24h,
    THRESHOLDS.video.dailySessions
  );

  const avgDurationMin = m.avgSessionDurationMs
    ? Math.round(m.avgSessionDurationMs / 60000)
    : 0;

  const score = Math.min(100, Math.round(
    concurrentScore * 0.6 + dailyScore * 0.4
  ));

  return {
    id: "video",
    label: "Video / Media Load",
    icon: "Video",
    score,
    level: toLevel(score),
    weight: WEIGHTS.video,
    signals: [
      {
        label: "Active Sessions",
        value: m.activeAiSessions.toLocaleString(),
        status: signalLevel(concurrentScore),
        detail: "Concurrent AI interviews in progress",
      },
      {
        label: "Sessions (24h)",
        value: m.completedAiSessionsLast24h.toLocaleString(),
        status: signalLevel(dailyScore),
      },
      {
        label: "Avg Duration",
        value: avgDurationMin > 0 ? `${avgDurationMin} min` : "—",
        status: "LOW",
      },
      {
        label: "Sessions (7d)",
        value: m.completedAiSessionsLast7d.toLocaleString(),
        status: signalLevel(thresholdScore(m.completedAiSessionsLast7d / 7, THRESHOLDS.video.dailySessions)),
      },
    ],
    trend: m.dailyAiSessions7d.map((v) =>
      thresholdScore(v, THRESHOLDS.video.dailySessions)
    ),
  };
}

function scoreRequestVolume(m: RawMetrics): DimensionScore {
  const dailyScore = thresholdScore(m.intakeLast24h, THRESHOLDS.intake.daily);
  const growth = growthRate(m.intakeLast7d, m.intakePrev7d);
  const growthScore = thresholdScore(Math.abs(growth), THRESHOLDS.intake.growthRate);

  const score = Math.min(100, Math.round(
    dailyScore * 0.5 + growthScore * 0.3 + thresholdScore(m.positionsAcceptingApps, { low: 5, mod: 20, high: 50, crit: 100 }) * 0.2
  ));

  return {
    id: "intake",
    label: "Request Volume",
    icon: "TrendingUp",
    score,
    level: toLevel(score),
    weight: WEIGHTS.intake,
    signals: [
      {
        label: "Applications (24h)",
        value: m.intakeLast24h.toLocaleString(),
        status: signalLevel(dailyScore),
      },
      {
        label: "Weekly Growth",
        value: `${growth >= 0 ? "+" : ""}${(growth * 100).toFixed(1)}%`,
        status: signalLevel(growthScore),
        detail: `${m.intakeLast7d} this week vs ${m.intakePrev7d} last week`,
      },
      {
        label: "Open Positions",
        value: m.positionsAcceptingApps.toLocaleString(),
        status: signalLevel(thresholdScore(m.positionsAcceptingApps, { low: 5, mod: 20, high: 50, crit: 100 })),
        detail: `${m.publishedPositions} total published`,
      },
    ],
    trend: m.dailyIntake7d.map((v) =>
      thresholdScore(v, THRESHOLDS.intake.daily)
    ),
  };
}

function scorePlatformScale(m: RawMetrics): DimensionScore {
  const orgScore = thresholdScore(m.totalOrganizations, THRESHOLDS.scale.orgs);
  const userScore = thresholdScore(m.totalUsers, THRESHOLDS.scale.users);
  const posScore = thresholdScore(m.totalPositions, THRESHOLDS.scale.positions);

  const score = Math.min(100, Math.round(
    orgScore * 0.35 + userScore * 0.35 + posScore * 0.30
  ));

  return {
    id: "scale",
    label: "Platform Scale",
    icon: "Users",
    score,
    level: toLevel(score),
    weight: WEIGHTS.scale,
    signals: [
      {
        label: "Organizations",
        value: m.totalOrganizations.toLocaleString(),
        status: signalLevel(orgScore),
      },
      {
        label: "Total Users",
        value: m.totalUsers.toLocaleString(),
        status: signalLevel(userScore),
      },
      {
        label: "Total Positions",
        value: m.totalPositions.toLocaleString(),
        status: signalLevel(posScore),
      },
      {
        label: "Resumes Stored",
        value: m.totalResumes.toLocaleString(),
        status: "LOW",
      },
    ],
    trend: [], // Scale doesn't have daily variance
  };
}

function scoreSecuritySurface(m: RawMetrics): DimensionScore {
  const failureRate = m.healthChecksLast24h > 0
    ? m.healthFailuresLast24h / m.healthChecksLast24h
    : 0;
  const failureScore = thresholdScore(failureRate, THRESHOLDS.security.failureRate);

  const incidentScore = thresholdScore(m.activeIncidents, THRESHOLDS.security.activeIncidents);
  const criticalBoost = m.criticalIncidents > 0 ? 30 : 0;
  const degradedBoost = m.degradedServices.length * 10;

  const score = Math.min(100, Math.round(
    failureScore * 0.3 + incidentScore * 0.3 + criticalBoost + Math.min(degradedBoost, 20)
  ));

  return {
    id: "security",
    label: "Security Surface",
    icon: "Shield",
    score,
    level: toLevel(score),
    weight: WEIGHTS.security,
    signals: [
      {
        label: "Health Failure Rate",
        value: `${(failureRate * 100).toFixed(1)}%`,
        status: signalLevel(failureScore),
        detail: `${m.healthFailuresLast24h} failures / ${m.healthChecksLast24h} checks`,
      },
      {
        label: "Active Incidents",
        value: m.activeIncidents.toLocaleString(),
        status: signalLevel(incidentScore),
      },
      ...(m.criticalIncidents > 0 ? [{
        label: "🚨 Critical Incidents",
        value: m.criticalIncidents.toLocaleString(),
        status: "CRITICAL" as RiskLevel,
      }] : []),
      ...(m.degradedServices.length > 0 ? [{
        label: "Degraded Services",
        value: m.degradedServices.join(", "),
        status: "HIGH" as RiskLevel,
      }] : []),
    ],
    trend: m.dailyHealthFailures7d.map((v) =>
      Math.min(100, v * 15)
    ),
  };
}

function scoreCompliancePressure(m: RawMetrics): DimensionScore {
  const resumePurgeScore = thresholdScore(m.resumesPastPurge, THRESHOLDS.compliance.pastPurge);
  const intakePurgeScore = thresholdScore(m.intakePastPurge, THRESHOLDS.compliance.pastPurge);

  const score = Math.min(100, Math.round(
    resumePurgeScore * 0.6 + intakePurgeScore * 0.4
  ));

  return {
    id: "compliance",
    label: "Data Compliance",
    icon: "FileWarning",
    score,
    level: toLevel(score),
    weight: WEIGHTS.compliance,
    signals: [
      {
        label: "Resumes Past Purge",
        value: m.resumesPastPurge.toLocaleString(),
        status: signalLevel(resumePurgeScore),
        detail: "Files past retention deadline not yet purged",
      },
      {
        label: "Intake Past Purge",
        value: m.intakePastPurge.toLocaleString(),
        status: signalLevel(intakePurgeScore),
        detail: "Candidate records past purge schedule",
      },
    ],
    trend: [],
  };
}

// ── Composite PRI ───────────────────────────────────────────────────────────

export function computeRiskReport(metrics: RawMetrics): PlatformRiskReport {
  const dimensions = [
    scoreDatabasePressure(metrics),
    scoreAiTokenBurn(metrics),
    scoreVideoFootprint(metrics),
    scoreRequestVolume(metrics),
    scorePlatformScale(metrics),
    scoreSecuritySurface(metrics),
    scoreCompliancePressure(metrics),
  ];

  // Weighted average
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const pri = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight
  );

  return {
    pri: Math.min(100, pri),
    level: toLevel(pri),
    dimensions,
    generatedAt: new Date().toISOString(),
  };
}
