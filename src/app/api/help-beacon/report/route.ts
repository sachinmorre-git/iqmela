/**
 * POST /api/help-beacon/report
 *
 * Creates a support ticket from the in-app Help Beacon.
 * Works for both org-admin users (creates SupportTicket) and
 * unauthenticated/candidate users (stores in a lightweight table or logs).
 *
 * Body: { subject, description, category, page, detectedIssues, browserInfo }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    const body = await req.json();

    const {
      subject,
      description,
      category = "OTHER",
      page,
      detectedIssues,
      browserInfo,
    } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { error: "Subject and description are required" },
        { status: 400 }
      );
    }

    // Build enriched description with auto-captured context
    const enrichedParts: string[] = [description];

    if (page) {
      enrichedParts.push(`\n\n── Page ──\n${page}`);
    }

    if (detectedIssues?.length > 0) {
      enrichedParts.push(
        `\n\n── Auto-Detected Issues (${detectedIssues.length}) ──\n${detectedIssues
          .map((i: { type: string; message: string }) => `• [${i.type}] ${i.message}`)
          .join("\n")}`
      );
    }

    if (browserInfo) {
      enrichedParts.push(
        `\n\n── Browser ──\nUA: ${browserInfo.userAgent || "—"}\nScreen: ${browserInfo.screen || "—"}\nURL: ${browserInfo.url || "—"}`
      );
    }

    const enrichedDescription = enrichedParts.join("");

    // If user belongs to an org, create a full SupportTicket
    if (userId && orgId) {
      const ticketNumber = `HLP-${Date.now().toString(36).toUpperCase()}`;

      const validCategories = ["BILLING", "TECHNICAL", "INTEGRATION", "ONBOARDING", "OTHER"];
      const safeCategory = validCategories.includes(category) ? category : "OTHER";

      const ticket = await prisma.supportTicket.create({
        data: {
          ticketNumber,
          organizationId: orgId,
          createdById: userId,
          subject: `[Help Beacon] ${subject}`,
          description: enrichedDescription,
          priority: detectedIssues?.length > 2 ? "HIGH" : "MEDIUM",
          category: safeCategory,
          status: "OPEN",
        },
      });

      return NextResponse.json({
        success: true,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
      });
    }

    // For non-org users (candidates, public) — log to audit trail
    // In production, this could also create a HelpBeaconReport model
    // For now, we log it server-side so nothing is lost
    if (userId) {
      // Authenticated but no org — try to find any org membership
      console.log(
        `[HelpBeacon] Report from user ${userId} (no org): ${subject}`,
        { page, detectedIssues: detectedIssues?.length }
      );

      // Create audit log entry if the user has any org
      try {
        await prisma.auditLog.create({
          data: {
            organizationId: "system",
            userId,
            action: "HELP_BEACON_REPORT",
            resourceType: "SUPPORT",
            resourceId: "help-beacon",
            metadata: {
              subject,
              description: enrichedDescription.substring(0, 1000),
              category,
              page,
              issueCount: detectedIssues?.length || 0,
            },
          },
        });
      } catch {
        // Non-critical — just log
        console.warn("[HelpBeacon] Could not create audit log entry");
      }

      return NextResponse.json({ success: true, ticketNumber: "LOGGED" });
    }

    // Completely unauthenticated user — just log
    console.log(`[HelpBeacon] Anonymous report: ${subject}`, {
      page,
      browser: browserInfo?.userAgent?.substring(0, 80),
    });

    return NextResponse.json({ success: true, ticketNumber: "ANONYMOUS" });
  } catch (error) {
    console.error("[HelpBeacon] Error creating report:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
