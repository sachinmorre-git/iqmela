"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PositionStatus } from "@prisma/client";

const VALID_STATUSES = Object.values(PositionStatus);

export async function updatePosition(formData: FormData) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // ── Extract id from hidden input ─────────────────────────────
    const id = (formData.get("id") as string)?.trim();
    if (!id) throw new Error("Position ID is missing.");

    // ── Ownership check ──────────────────────────────────────────
    const existing = await prisma.position.findUnique({ where: { id } });
    if (!existing) throw new Error("Position not found.");
    if (existing.createdById !== userId) throw new Error("Forbidden.");

    // ── Extract fields ───────────────────────────────────────────
    const title          = (formData.get("title")          as string)?.trim();
    const department     = (formData.get("department")     as string)?.trim() || null;
    const location       = (formData.get("location")       as string)?.trim() || null;
    const employmentType = (formData.get("employmentType") as string)?.trim() || null;
    const rawStatus      = (formData.get("status")         as string)?.trim();
    const description    = (formData.get("description")    as string)?.trim() || null;
    const jdText         = (formData.get("jdText")         as string)?.trim() || null;

    if (!title) throw new Error("Position title is required.");

    const status: PositionStatus = VALID_STATUSES.includes(rawStatus as PositionStatus)
      ? (rawStatus as PositionStatus)
      : existing.status;

    // ── Persist ──────────────────────────────────────────────────
    await prisma.position.update({
      where: { id },
      data: { title, department, location, employmentType, description, jdText, status },
    });

    console.log(`[updatePosition] Updated position ${id} — "${title}"`);

  } catch (error) {
    console.error(">>> [updatePosition] Error:", error);
    throw error;
  }

  // redirect() must live outside try/catch
  const id = (formData.get("id") as string)?.trim();
  redirect(`/org-admin/positions/${id}`);
}
