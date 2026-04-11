"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function cancelInterview(interviewId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    select: { interviewerId: true, status: true },
  });

  if (!interview) throw new Error("Interview not found");

  // Only the assigned interviewer is authorized to cancel
  if (interview.interviewerId !== userId) {
    throw new Error("Forbidden: Only the assigned interviewer can cancel this room.");
  }

  if (interview.status !== "SCHEDULED") {
    throw new Error("Only scheduled interviews can be canceled.");
  }

  // Update status to canceled
  await prisma.interview.update({
    where: { id: interviewId },
    data: { status: "CANCELED" },
  });

  // Bounce them safely out of the room back to the dashboard, which will dynamically refresh
  redirect("/interviewer/dashboard");
}

export async function rescheduleInterview(interviewId: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    select: { interviewerId: true, status: true },
  });

  if (!interview) throw new Error("Interview not found");
  if (interview.interviewerId !== userId) {
    throw new Error("Forbidden: Only the assigned interviewer can reschedule this room.");
  }

  const date = formData.get("date") as string;
  const time = formData.get("time") as string;

  if (!date || !time) {
    throw new Error("Missing required fields");
  }

  const newScheduledAt = new Date(`${date}T${time}`);
  if (isNaN(newScheduledAt.getTime())) {
    throw new Error("Date/Time combined format is invalid.");
  }

  // Update schedule in the DB
  await prisma.interview.update({
    where: { id: interviewId },
    data: { 
      scheduledAt: newScheduledAt,
      // If it was canceled, resurrect it!
      status: interview.status === "CANCELED" ? "SCHEDULED" : undefined 
    },
  });

  // Refresh the specific page they are on so the UI updates natively!
  import("next/cache").then(mod => mod.revalidatePath(`/interview/${interviewId}`));
  
  return { success: true };
}
