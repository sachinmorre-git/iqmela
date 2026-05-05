import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCompliantJdText,
} from "@/lib/compliance-constants";
import { isIntakeOpen, intakeClosesAt } from "@/lib/intake-window";

/**
 * GET /api/public/jobs-feed
 *
 * Generates an Indeed-compatible XML feed of all published positions.
 * Indeed crawls this endpoint automatically when registered.
 * Includes AI disclosure + EEOC statement in each job description.
 *
 * Indeed XML Feed Specification:
 * https://indeed.force.com/employerSupport1/s/article/115009901446
 */
export async function GET() {
  try {
    const positions = await prisma.position.findMany({
      where: {
        isPublished: true,
        isDeleted: false,
        status: "OPEN",
      },
      select: {
        id: true,
        title: true,
        description: true,
        jdText: true,
        location: true,
        employmentType: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        remotePolicy: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
        isPublished: true,
        intakeWindowDays: true,
      },
    });

    // Filter out positions where intake window has closed
    const activePositions = positions.filter((p) => isIntakeOpen(p));

    // Build XML feed
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com";

    const jobEntries = activePositions
      .map((pos) => {
        const jdBody = pos.jdText || pos.description || "";
        const compliantJd = buildCompliantJdText(jdBody);

        // Escape XML special characters
        const escXml = (s: string) =>
          s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");

        // Map employment type to Indeed's expected values
        const indeedJobType = mapEmploymentType(pos.employmentType);

        // Build salary string
        let salaryTag = "";
        if (pos.salaryMin || pos.salaryMax) {
          const currency = pos.salaryCurrency || "USD";
          if (pos.salaryMin && pos.salaryMax) {
            salaryTag = `<salary>${currency} ${pos.salaryMin.toLocaleString()}-${pos.salaryMax.toLocaleString()} per year</salary>`;
          } else if (pos.salaryMin) {
            salaryTag = `<salary>${currency} ${pos.salaryMin.toLocaleString()}+ per year</salary>`;
          }
        }

        // Expiration date from intake window
        const expirationDate = intakeClosesAt(pos).toISOString();

        return `  <job>
    <title><![CDATA[${pos.title}]]></title>
    <date><![CDATA[${pos.createdAt.toISOString()}]]></date>
    <referencenumber><![CDATA[${pos.id}]]></referencenumber>
    <url><![CDATA[${baseUrl}/careers/${pos.id}]]></url>
    <company><![CDATA[IQMela Staffing]]></company>
    <city><![CDATA[${pos.location || "Remote"}]]></city>
    <description><![CDATA[${compliantJd}]]></description>
    <jobtype><![CDATA[${indeedJobType}]]></jobtype>
    ${salaryTag}
    <expirationdate><![CDATA[${expirationDate}]]></expirationdate>
    ${pos.remotePolicy === "REMOTE" ? "<remotetype>COVID19</remotetype>" : ""}
  </job>`;
      })
      .join("\n");

    const xmlFeed = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>IQMela</publisher>
  <publisherurl>${baseUrl}</publisherurl>
  <lastBuildDate>${new Date().toISOString()}</lastBuildDate>
${jobEntries}
</source>`;

    return new NextResponse(xmlFeed, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("[JOBS-FEED] Error generating feed:", error);
    return NextResponse.json(
      { error: "Failed to generate jobs feed" },
      { status: 500 }
    );
  }
}

/**
 * Maps IQMela employment types to Indeed's expected values.
 */
function mapEmploymentType(type: string | null | undefined): string {
  switch (type?.toUpperCase()) {
    case "FULL_TIME":
      return "fulltime";
    case "PART_TIME":
      return "parttime";
    case "CONTRACT":
      return "contract";
    case "INTERNSHIP":
      return "internship";
    case "TEMPORARY":
      return "temporary";
    default:
      return "fulltime";
  }
}
