import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";
import { getCallerPermissions } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const perms = await getCallerPermissions();
  if (!perms || !perms.isOrgAdmin) {
    return NextResponse.json({ error: "Org Admin role required to accept MSA" }, { status: 403 });
  }

  const body = await req.json() as { name?: string; title?: string; viewedDocuments?: string[] };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Signatory name is required" }, { status: 400 });
  }
  if (!body.viewedDocuments?.length) {
    return NextResponse.json({ error: "All documents must be reviewed before acceptance" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? req.headers.get("x-real-ip")
          ?? "unknown";

  const signatoryName = `${body.name.trim()}${body.title?.trim() ? ` (${body.title.trim()})` : ""}`;

  // 1. Update Org record
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      msaAcceptedAt: new Date(),
      msaVersion:    LEGAL_VERSIONS.ORG_MSA,
      msaAcceptedBy: signatoryName,
    },
  });

  // 2. Sync to Clerk org metadata — middleware reads this without a DB call
  const clerk = await clerkClient();
  await clerk.organizations.updateOrganizationMetadata(orgId, {
    publicMetadata: {
      msaVersion: LEGAL_VERSIONS.ORG_MSA,
    },
  });

  // 3. Immutable audit log
  console.log(JSON.stringify({
    event:          "AGREEMENT_ACCEPTED",
    type:           "ORG_MSA",
    version:        LEGAL_VERSIONS.ORG_MSA,
    orgId,
    acceptedBy:     userId,
    signatoryName,
    viewedDocuments: body.viewedDocuments,
    ip,
    userAgent:      req.headers.get("user-agent") ?? "unknown",
    timestamp:      new Date().toISOString(),
  }));

  const response = NextResponse.json({ ok: true });
  // Long-lived cookie as fallback to Clerk's JWT propagation
  response.cookies.set("msa_accepted", LEGAL_VERSIONS.ORG_MSA, { path: "/", maxAge: 30 * 24 * 60 * 60, httpOnly: true });
  return response;
}
