import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  const [totalInterviews, totalOrgs, totalPositions, avgResult] = await Promise.all([
    prisma.interview.count({ where: { status: "COMPLETED" } }),
    prisma.organization.count(),
    prisma.position.count(),
    prisma.panelistFeedback.aggregate({ _avg: { overallScore: true } }),
  ]);

  return NextResponse.json({
    totalInterviews,
    totalOrgs,
    totalPositions,
    avgScore: avgResult._avg.overallScore,
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
