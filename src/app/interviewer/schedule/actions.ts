"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function createInterview(formData: FormData) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const title = formData.get("title") as string;
    const date = formData.get("date") as string; 
    const time = formData.get("time") as string;
    const rawDuration = formData.get("duration") as string;
    const candidateId = formData.get("candidateId") as string;
    const notes = formData.get("notes") as string;

    if (!title || !date || !time || !candidateId) {
      throw new Error("Missing required fields");
    }

    // Safely parse timezone-aware datetime string
    // If time is "14:30", this yields a standard JS Date.
    const scheduledAt = new Date(`${date}T${time}`);
    if (isNaN(scheduledAt.getTime())) {
      throw new Error("Date/Time combined format is invalid.");
    }

    const durationMinutes = parseInt(rawDuration, 10);
    const safeDuration = isNaN(durationMinutes) ? 60 : durationMinutes;

    // Prisma payload
    const payload: any = {
      title,
      scheduledAt,
      durationMinutes: safeDuration,
      candidateId,
      interviewerId: userId,
    };
    
    // Selectively attach notes only if present, to dodge stale Prisma client caches
    if (notes && notes.trim() !== '') {
      payload.notes = notes.trim();
    }

    await prisma.interview.create({
      data: payload
    });

  } catch (error) {
    console.error(">>> PRECISE PRISMA ERROR:", error);
    throw error;
  }

  // Soft redirect via Next router mechanism
  redirect("/interviewer/dashboard");
}
