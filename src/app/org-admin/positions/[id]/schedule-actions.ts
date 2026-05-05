"use server";

import { prisma } from "@/lib/prisma";
import { formatDate, formatTime, formatDateTime } from "@/lib/locale-utils";
import { revalidatePath } from "next/cache";
import { getCallerPermissions } from "@/lib/rbac";
import { InterviewMode } from "@prisma/client";
import { emailService } from "@/lib/email";
import { createAiInterviewSessionAction } from "./ai-interview-actions";

export async function scheduleInterviewAction(formData: FormData) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManageInvites) {
      throw new Error("Unauthorized: You do not have permission to schedule interviews.");
    }

    const positionId = formData.get("positionId") as string;
    const resumeId = formData.get("resumeId") as string;
    const interviewerIdsStr = formData.get("interviewerIds") as string;
    const dateStr = formData.get("scheduledAt") as string;
    const duration = parseInt(formData.get("duration") as string, 10);
    const mode = formData.get("mode") as string;
    const title = formData.get("title") as string;
    const externalLink = formData.get("externalLink") as string;

    const interviewerIds = interviewerIdsStr ? interviewerIdsStr.split(",").filter(Boolean) : [];

    if (!positionId || !resumeId || (mode === "HUMAN" && interviewerIds.length === 0) || !dateStr || !title) {
      throw new Error("Missing required fields.");
    }

    // Verify position belongs to organization
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position || position.organizationId !== perms.orgId) {
      throw new Error("Position not found or access denied.");
    }

    // Verify candidate via resume
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId }
    });
    if (!resume) throw new Error("Resume not found.");
    
    const candidateEmail = resume.overrideEmail || resume.candidateEmail;
    if (!candidateEmail) throw new Error("Candidate has no email address extracted.");

    const candidate = await prisma.user.findUnique({
      where: { email: candidateEmail },
    });
    if (!candidate) throw new Error(`No account found for ${candidateEmail}. The candidate must sign in via the portal before an interview can be scheduled.`);

    // Fetch interviewers to verify they belong to Org and to send emails later
    const interviewers = interviewerIds.length > 0 ? await prisma.user.findMany({
      where: {
        id: { in: interviewerIds },
        organizationId: perms.orgId
      }
    }) : [];

    if (mode === "HUMAN" && interviewers.length !== interviewerIds.length) {
      throw new Error("One or more panelists not found or do not belong to your organization.");
    }

    const scheduledAt = new Date(dateStr);
    
    // Create Interview and relational mappings
    const interview = await prisma.interview.create({
      data: {
        title,
        scheduledAt,
        durationMinutes: isNaN(duration) ? 60 : duration,
        status: "SCHEDULED",
        interviewMode: mode === "AI_AVATAR" ? "AI_AVATAR" : "HUMAN",
        roomName: externalLink || null, // Storing external link here for now
        candidateId: candidate.id,
        interviewerId: mode === "AI_AVATAR" ? perms.userId : interviewerIds[0], // fallback for legacy views temporarily
        panelists: mode === "HUMAN" ? {
          create: interviewers.map(u => ({ interviewerId: u.id }))
        } : undefined,
        positionId,
        organizationId: perms.orgId,
        scheduledById: perms.userId,
      }
    });

    let aiLink = null;
    if (mode === "AI_AVATAR") {
      // Provision the AI session and tie it seamlessly
      const aiResult = await createAiInterviewSessionAction(resumeId, positionId);
      if (aiResult.success && aiResult.sessionId) {
        const session = await prisma.aiInterviewSession.findUnique({
          where: { id: aiResult.sessionId }
        });
        if (session && session.magicLinkToken) {
           aiLink = `https://iqmela.v2/ai-interview/${session.magicLinkToken}`;
        }
      }
    }

    // Formatting date helper
    const formattedDate = formatDate(scheduledAt, { style: "long" });
    const formattedTime = formatTime(scheduledAt);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const interviewUrl = `${baseUrl}/interview/${interview.id}/live`;

    // Build meeting info block
    const meetingInfo = mode === "HUMAN" && externalLink
      ? `\n\n🔗 <strong>Meeting Link:</strong> <a href="${externalLink}">${externalLink}</a>`
      : mode === "AI_AVATAR"
      ? `\n\n🤖 <strong>Format:</strong> AI Avatar Interview`
      : "";

    // Send Candidate Email (branded template)
    await emailService.sendGenericEmail({
      to: candidate.email,
      subject: `📅 Interview Scheduled — ${position.title}`,
      previewText: `Your ${title} interview is scheduled for ${formattedDate} at ${formattedTime}`,
      heading: "🎉 Your Interview is Scheduled!",
      body: `Hi <strong>${candidate.name || "Candidate"}</strong>,\n\nWe are excited to confirm your interview for the <strong>${position.title}</strong> position.\n\n📅 <strong>Date:</strong> ${formattedDate}\n⏰ <strong>Time:</strong> ${formattedTime}\n⏱ <strong>Duration:</strong> ${interview.durationMinutes} minutes${meetingInfo}\n\n🌐 <strong>Browser:</strong> Please use Chrome, Edge, or Safari (latest version) on a desktop/laptop for the best experience.\n\nPlease join on time. Good luck!`,
      ctaLabel: mode === "AI_AVATAR" ? "Start AI Interview →" : "Join Interview Room →",
      ctaUrl: mode === "AI_AVATAR" ? (aiLink || `${baseUrl}/candidate/dashboard`) : interviewUrl,
    });

    // Send Interviewer Emails concurrently (If Human panel)
    if (mode === "HUMAN" && interviewers.length > 0) {
      await Promise.all(interviewers.map(async (u) => {
        if (!u.email) return;
        return emailService.sendGenericEmail({
          to: u.email,
          subject: `📋 Panel Interview — ${candidate.name || candidate.email} for ${position.title}`,
          previewText: `You've been assigned to interview ${candidate.name || candidate.email} on ${formattedDate}`,
          heading: "📋 New Panel Interview Assignment",
          body: `Hi <strong>${u.name || "Panelist"}</strong>,\n\nYou have been assigned to interview <strong>${candidate.name || candidate.email}</strong> for the <strong>${position.title}</strong> role alongside ${interviewers.length - 1} other panelist(s).\n\n📅 <strong>Date:</strong> ${formattedDate}\n⏰ <strong>Time:</strong> ${formattedTime}\n⏱ <strong>Duration:</strong> ${interview.durationMinutes} minutes${externalLink ? `\n🔗 <strong>Meeting Link:</strong> <a href="${externalLink}">${externalLink}</a>` : ""}\n\n🌐 <strong>Browser:</strong> Please use Chrome, Edge, or Safari.\n\nYou can manage this interview and collaborate on notes from your Interviewer Portal.`,
          ctaLabel: "Join Interview Room →",
          ctaUrl: interviewUrl,
        });
      }));
    }

    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true, interviewId: interview.id };

  } catch (err: any) {
    console.error("[scheduleInterviewAction] Error:", err);
    return { success: false, error: err.message || "Failed to schedule interview." };
  }
}

export async function cancelInterviewAction(interviewId: string, positionId: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManageInvites) {
      throw new Error("Unauthorized: You do not have permission to cancel interviews.");
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview || interview.organizationId !== perms.orgId) {
      throw new Error("Interview not found or access denied.");
    }

    await prisma.interview.update({
      where: { id: interviewId },
      data: { status: "CANCELED" }
    });

    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true };
  } catch (err: any) {
    console.error("[cancelInterviewAction] Error:", err);
    return { success: false, error: err.message || "Failed to cancel interview." };
  }
}
