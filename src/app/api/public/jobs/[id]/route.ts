import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCompliantJdText,
} from "@/lib/compliance-constants";

/**
 * GET /api/public/jobs/[id]
 *
 * Returns a lightweight HTML page with Google Jobs JSON-LD structured data.
 * Google's crawler indexes the JobPosting schema automatically.
 * The "Apply" button redirects to Indeed (Option A — Indeed handles consent).
 *
 * Google JobPosting Schema:
 * https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const position = await prisma.position.findFirst({
      where: {
        id,
        isPublished: true,
        isDeleted: false,
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
      },
    });

    if (!position) {
      return new NextResponse(
        "<html><body><h1>Job not found</h1><p>This position is no longer available.</p></body></html>",
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com";
    const jdBody = position.jdText || position.description || "";
    const compliantJd = buildCompliantJdText(jdBody);

    // Map to schema.org employmentType
    const schemaEmploymentType = mapToSchemaOrgType(position.employmentType);

    // Build salary JSON-LD block
    let salaryBlock = "";
    if (position.salaryMin || position.salaryMax) {
      const currency = position.salaryCurrency || "USD";
      salaryBlock = `
    "baseSalary": {
      "@type": "MonetaryAmount",
      "currency": "${currency}",
      "value": {
        "@type": "QuantitativeValue",
        ${position.salaryMin ? `"minValue": ${position.salaryMin},` : ""}
        ${position.salaryMax ? `"maxValue": ${position.salaryMax},` : ""}
        "unitText": "YEAR"
      }
    },`;
    }

    // Build location block
    const isRemote = position.remotePolicy === "REMOTE";
    let locationBlock: string;
    if (isRemote) {
      locationBlock = `
    "jobLocationType": "TELECOMMUTE",
    "applicantLocationRequirements": {
      "@type": "Country",
      "name": "US"
    },`;
    } else {
      locationBlock = `
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "${escapeJson(position.location || "United States")}"
      }
    },`;
    }

    // Apply URL — redirect to IQMela Careers page
    const applyUrl = `${baseUrl}/careers/${position.id}#apply`;

    // Structured Data JSON-LD
    const jsonLd = `{
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  "title": "${escapeJson(position.title)}",
  "description": ${JSON.stringify(compliantJd)},
  "datePosted": "${position.createdAt.toISOString().split("T")[0]}",
  "validThrough": "${getValidThrough(position.createdAt)}",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "IQMela Partner Organization",
    "sameAs": "${baseUrl}"
  },${locationBlock}${salaryBlock}
  "employmentType": "${schemaEmploymentType}",
  "directApply": true
}`;

    // Build HTML page
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(position.title)} | IQMela Careers</title>
  <meta name="description" content="${escapeHtml((position.description || "").substring(0, 155))}">
  <script type="application/ld+json">
${jsonLd}
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #e0e0e0; padding: 2rem; }
    .container { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 1.8rem; color: #fff; margin-bottom: 0.5rem; }
    .meta { color: #888; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .badge { display: inline-block; background: rgba(99,102,241,0.15); color: #818cf8; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; margin-right: 0.5rem; }
    .jd { white-space: pre-wrap; line-height: 1.7; color: #ccc; margin: 1.5rem 0; }
    .apply-btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 0.9rem 2rem; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 1rem; transition: all 0.2s; }
    .apply-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(99,102,241,0.3); }
    .powered { margin-top: 3rem; text-align: center; color: #555; font-size: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(position.title)}</h1>
    <div class="meta">
      <span class="badge">${position.location || "Remote"}</span>
      <span class="badge">${position.employmentType?.replace("_", " ") || "Full Time"}</span>
      ${position.remotePolicy ? `<span class="badge">${position.remotePolicy}</span>` : ""}
      ${position.salaryMin ? `<span class="badge">$${position.salaryMin.toLocaleString()}+</span>` : ""}
    </div>
    <div class="jd">${escapeHtml(compliantJd)}</div>
    <a href="${applyUrl}" class="apply-btn">
      Apply Now →
    </a>
    <div class="powered">Powered by IQMela Hiring Intelligence</div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("[JOBS-PAGE] Error:", error);
    return new NextResponse("<html><body><h1>Server Error</h1></body></html>", {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJson(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mapToSchemaOrgType(type: string | null | undefined): string {
  switch (type?.toUpperCase()) {
    case "FULL_TIME":
      return "FULL_TIME";
    case "PART_TIME":
      return "PART_TIME";
    case "CONTRACT":
      return "CONTRACTOR";
    case "INTERNSHIP":
      return "INTERN";
    case "TEMPORARY":
      return "TEMPORARY";
    default:
      return "FULL_TIME";
  }
}

function getValidThrough(createdAt: Date): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + 60); // Jobs valid for 60 days
  return d.toISOString().split("T")[0];
}
