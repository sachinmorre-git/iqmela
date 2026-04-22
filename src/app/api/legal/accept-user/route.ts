import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? req.headers.get("x-real-ip")
          ?? "unknown";

  // 1. Update Prisma record
  await prisma.user.update({
    where:  { id: userId },
    data: {
      tosAcceptedAt: new Date(),
      tosVersion:    LEGAL_VERSIONS.PLATFORM_TOS,
    },
  });

  // 2. Sync to Clerk metadata — middleware reads this without a DB call
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      tosVersion: LEGAL_VERSIONS.PLATFORM_TOS,
    },
  });

  // 3. Immutable audit log
  console.log(JSON.stringify({
    event:     "AGREEMENT_ACCEPTED",
    type:      "PLATFORM_TOS",
    version:   LEGAL_VERSIONS.PLATFORM_TOS,
    userId,
    ip,
    userAgent: req.headers.get("user-agent") ?? "unknown",
    timestamp: new Date().toISOString(),
  }));

  return NextResponse.json({ ok: true });
}
