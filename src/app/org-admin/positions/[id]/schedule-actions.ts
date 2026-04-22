"use server";

import { prisma } from "@/lib/prisma";
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
    const formattedDate = scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const formattedTime = scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Send Candidate Email
    await emailService.sendEmail({
      to: candidate.email,
      subject: `Interview Scheduled for ${position.title} at IQMela`,
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #0f766e;">Your Interview is Scheduled</h2>
          <p>Hi ${candidate.name || 'Candidate'},</p>
          <p>We are excited to schedule your interview for the <strong>${position.title}</strong> position.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Duration:</strong> ${interview.durationMinutes} minutes</p>
            ${mode === "HUMAN" ? `<p><strong>Meeting Link:</strong> <a href="${externalLink}">${externalLink}</a></p>` : `<p><strong>Format:</strong> AI Avatar Interview. <a href="${aiLink || 'https://iqmela.v2/candidate/dashboard'}">Start your interview here.</a></p>`}
          </div>
          <p>Please log in to your <a href="https://iqmela.v2/candidate/dashboard">Candidate Dashboard</a> to review your schedule.</p>
          <p>Best regards,<br/>The IQMela Hiring Team</p>
        </div>
      `
    });

    // Send Interviewer Emails concurrently (If Human panel)
    if (mode === "HUMAN" && interviewers.length > 0) {
      await Promise.all(interviewers.map(async (u) => {
        if (!u.email) return;
        return emailService.sendEmail({
          to: u.email,
          subject: `ACTION REQUIRED: Interview Scheduled with ${candidate.name || candidate.email}`,
          html: `
            <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #0f766e;">New Panel Interview Assignment</h2>
              <p>Hi ${u.name || 'Panelist'},</p>
              <p>You have been assigned to interview <strong>${candidate.name || candidate.email}</strong> for the <strong>${position.title}</strong> role alongside ${interviewers.length - 1} other panelist(s).</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time:</strong> ${formattedTime}</p>
                <p><strong>Duration:</strong> ${interview.durationMinutes} minutes</p>
                <p><strong>Meeting Link:</strong> ${externalLink}</p>
              </div>
              <p>You can manage this interview and collaborate on notes from your <a href="https://iqmela.v2/interviewer/interviews">Interviewer Portal</a>.</p>
            </div>
          `
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
