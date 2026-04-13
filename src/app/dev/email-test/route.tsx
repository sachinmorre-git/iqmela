import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import InterviewInviteTemplate from "@/lib/email/templates/InterviewInvite";
import { emailService } from "@/lib/email";
import * as React from "react";

export async function GET(request: Request) {
  // STRICT PROTECTION: Disable this testing route entirely in production
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_DEV_ROUTES) {
    return new NextResponse("Not Found - Development Only", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to");

  // Require the developer to explicitly pass a target email address in the URL query
  if (!to) {
    return NextResponse.json(
      { 
        error: "Missing recipient parameter. Usage: /dev/email-test?to=your_actual_email@example.com" 
      }, 
      { status: 400 }
    );
  }

  try {
    // 1. Generate the raw HTML payload using our template
    const html = await render(
      <InterviewInviteTemplate
        candidateName="Test Developer"
        positionTitle="Lead Architect"
        orgName="IQMela Sandbox"
        inviteLink="https://iqmela.com/interview/test-interactive-link-xyz"
      />
    );

    // 2. Generate a reliable plain-text fallback standard
    const text = `Hi Test Developer, \n\nYou are invited to interview for Lead Architect at IQMela Sandbox.\nView Details: https://iqmela.com/interview/test-interactive-link-xyz`;

    // 3. Dispatch to the universal email generic provider
    const result = await emailService.sendEmail({
      to,
      subject: "Test Invite: IQMela Architectural Sandbox",
      html,
      text,
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          action: "send_test_email",
          status: "FAILED",
          error: result.error 
        }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      action: "send_test_email",
      status: "SUCCESS",
      providerUsed: process.env.EMAIL_PROVIDER || "mock",
      messageId: result.messageId,
      recipient: to
    });

  } catch (error) {
    console.error("Failed to execute test route:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : "Unknown" }, 
      { status: 500 }
    );
  }
}
