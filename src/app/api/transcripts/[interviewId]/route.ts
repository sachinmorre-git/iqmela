import { NextRequest, NextResponse } from "next/server";
import { getCallerPermissions } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { head } from "@vercel/blob";
import type { TranscriptUtterance } from "../../livekit/webhook/route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  try {
    const { interviewId } = await params;

    // ── Auth ──────────────────────────────────────────────────────────────────
    const perms = await getCallerPermissions();
    if (!perms) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const interview = await prisma.interview.findUnique({
      where:  { id: interviewId },
      select: {
        transcriptionUrl: true,
        organizationId:   true,
        interviewerId:    true,
        panelists:        { select: { interviewerId: true } },
      },
    });

    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    // Org scope
    if (perms.orgId && interview.organizationId !== perms.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Role check: interviewers, panelists, HMs, org admins only — not candidates
    const isAssigned =
      interview.interviewerId === perms.userId ||
      interview.panelists.some((p) => p.interviewerId === perms.userId);
    const isHiringStaff = perms.roles?.some((r: string) =>
      ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"].includes(r)
    );
    if (!isAssigned && !isHiringStaff && !perms.canManageInvites) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── No transcript yet ─────────────────────────────────────────────────────
    if (!interview.transcriptionUrl) {
      return NextResponse.json(
        { status: "pending", message: "Transcript is being processed or not yet available." },
        { status: 202 }
      );
    }

    // ── Fetch from Vercel Blob (public URL, non-guessable path — RBAC is above) ──
    const blobRes = await fetch(interview.transcriptionUrl);

    if (!blobRes.ok) {
      return NextResponse.json({ error: "Transcript file not accessible" }, { status: 502 });
    }

    const data = await blobRes.json() as {
      interviewId: string;
      generatedAt: string;
      language:    string;
      utterances:  TranscriptUtterance[];
    };

    return NextResponse.json(data);

  } catch (err: any) {
    console.error("[Transcripts API] error:", err);
    return NextResponse.json({ error: err.message ?? "Internal Server Error" }, { status: 500 });
  }
}
