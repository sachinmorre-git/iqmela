"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PositionStatus } from "@prisma/client";
import { getCallerPermissions } from "@/lib/rbac";

const VALID_STATUSES = Object.values(PositionStatus);

export async function createPosition(formData: FormData) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) throw new Error("Unauthorized");
    if (!perms.canManagePositions) throw new Error("Insufficient permissions");

    // ── Extract fields ───────────────────────────────────────────
    const title          = (formData.get("title")          as string)?.trim();
    const departmentId   = (formData.get("department")     as string)?.trim() || null;
    const location       = (formData.get("location")       as string)?.trim() || null;
    const employmentType = (formData.get("employmentType") as string)?.trim() || null;
    const rawStatus      = (formData.get("status")         as string)?.trim();
    const description    = (formData.get("description")    as string)?.trim() || null;
    const jdText         = (formData.get("jdText")         as string)?.trim() || null;

    // AI Pipeline Configuration
    const intakeWindowDays   = parseInt((formData.get("intakeWindowDays") as string) || "10", 10);
    const atsPreScreenSize   = parseInt((formData.get("atsPreScreenSize") as string) || "100", 10);
    const aiShortlistSize    = parseInt((formData.get("aiShortlistSize")  as string) || "10", 10);
    const autoProcessOnClose = formData.get("autoProcessOnClose") === "true";
    const autoInviteAiScreen  = formData.get("autoInviteAiScreen") === "true";
    const resumePurgeDays    = parseInt((formData.get("resumePurgeDays")  as string) || "90", 10);

    // ── Validate required ────────────────────────────────────────
    if (!title) throw new Error("Position title is required.");

    // Resolve department name from ID
    let department: string | null = null;
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
      department = dept?.name ?? null;
    }

    // ── Validate status enum ─────────────────────────────────────
    const status: PositionStatus = VALID_STATUSES.includes(rawStatus as PositionStatus)
      ? (rawStatus as PositionStatus)
      : "DRAFT";

    // ── Persist ──────────────────────────────────────────────────
    const position = await prisma.position.create({
      data: {
        title,
        department,
        departmentId,
        location,
        employmentType,
        description,
        jdText,
        status,
        intakeWindowDays,
        atsPreScreenSize,
        aiShortlistSize,
        autoProcessOnClose,
        autoInviteAiScreen,
        resumePurgeDays,
        createdById: perms.userId,
        organizationId: perms.orgId,
      },
    });

    console.log(`[createPosition] Created position ${position.id} — "${position.title}"`);

    // ── Create interview pipeline plan if stages provided ─────
    const pipelineRaw = (formData.get("pipelineStages") as string)?.trim();
    if (pipelineRaw) {
      try {
        const stages = JSON.parse(pipelineRaw) as {
          roundLabel: string;
          roundType: string;
          durationMinutes: number;
          isRequired?: boolean;
          description?: string | null;
          assignedPanelJson?: any;
        }[];
        if (Array.isArray(stages) && stages.length > 0) {
          await prisma.interviewPlan.create({
            data: {
              positionId: position.id,
              stages: {
                create: stages.map((s, i) => ({
                  stageIndex: i,
                  roundLabel: s.roundLabel,
                  roundType: s.roundType as any,
                  durationMinutes: s.durationMinutes,

                  isRequired: s.isRequired ?? true,
                  description: s.description || null,
                  assignedPanelJson: s.assignedPanelJson || null,
                })),
              },
            },
          });
          console.log(`[createPosition] Created interview plan with ${stages.length} stages`);
        }
      } catch (planErr) {
        console.error("[createPosition] Pipeline creation failed (non-blocking):", planErr);
      }
    }

  } catch (error) {
    console.error(">>> [createPosition] Error:", error);
    throw error;
  }

  // redirect() must be outside try/catch — it throws internally (Next.js behaviour)
  redirect("/org-admin/positions");
}
