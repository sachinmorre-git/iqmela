"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PositionStatus } from "@prisma/client";

const VALID_STATUSES = Object.values(PositionStatus);

export async function createPosition(formData: FormData) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // ── Extract fields ───────────────────────────────────────────
    const title          = (formData.get("title")          as string)?.trim();
    const department     = (formData.get("department")     as string)?.trim() || null;
    const location       = (formData.get("location")       as string)?.trim() || null;
    const employmentType = (formData.get("employmentType") as string)?.trim() || null;
    const rawStatus      = (formData.get("status")         as string)?.trim();
    const description    = (formData.get("description")    as string)?.trim() || null;
    const jdText         = (formData.get("jdText")         as string)?.trim() || null;

    // ── Validate required ────────────────────────────────────────
    if (!title) throw new Error("Position title is required.");

    // ── Validate status enum ─────────────────────────────────────
    const status: PositionStatus = VALID_STATUSES.includes(rawStatus as PositionStatus)
      ? (rawStatus as PositionStatus)
      : "DRAFT";

    // ── Persist ──────────────────────────────────────────────────
    const position = await prisma.position.create({
      data: {
        title,
        department,
        location,
        employmentType,
        description,
        jdText,
        status,
        createdById: userId,
      },
    });

    console.log(`[createPosition] Created position ${position.id} — "${position.title}"`);

  } catch (error) {
    console.error(">>> [createPosition] Error:", error);
    throw error;
  }

  // redirect() must be outside try/catch — it throws internally (Next.js behaviour)
  redirect("/org-admin/positions");
}
