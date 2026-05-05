/**
 * Cron: BGV Upload Link Expiry Cleanup
 *
 * GET /api/cron/bgv-expiry
 *
 * Transitions BgvCheck records from INITIATED → EXPIRED when their
 * upload link token has passed the uploadLinkExpiresAt deadline.
 *
 * Schedule: Daily at midnight UTC (Vercel Cron)
 * Config: Add to vercel.json → crons
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Validate cron secret (Vercel sends this automatically)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all INITIATED BGV checks with expired upload links
    const expired = await prisma.bgvCheck.updateMany({
      where: {
        status: "INITIATED",
        uploadLinkExpiresAt: {
          lt: new Date(),
        },
        uploadLinkToken: { not: null },
      },
      data: {
        status: "EXPIRED",
      },
    });

    // Log for monitoring
    if (expired.count > 0) {
      console.log(`[BGV Cron] Expired ${expired.count} BGV upload links`);

      // Create audit logs for each expired check
      const expiredChecks = await prisma.bgvCheck.findMany({
        where: {
          status: "EXPIRED",
          updatedAt: { gte: new Date(Date.now() - 60_000) }, // Updated in the last minute
        },
        select: { id: true },
      });

      if (expiredChecks.length > 0) {
        await prisma.bgvAuditLog.createMany({
          data: expiredChecks.map((c) => ({
            bgvCheckId: c.id,
            action: "UPLOAD_LINK_EXPIRED",
            details: { expiredBy: "cron", expiredAt: new Date().toISOString() },
          })),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      expiredCount: expired.count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[BGV Cron] Expiry cleanup failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
