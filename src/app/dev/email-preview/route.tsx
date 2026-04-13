import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import InterviewInviteTemplate from "@/lib/email/templates/InterviewInvite";
import * as React from "react";

export async function GET() {
  // STRICT PROTECTION: Disable this route entirely in production 
  // to prevent accidental public access to internal styles/data
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found - Development Only", { status: 404 });
  }

  try {
    const html = await render(
      <InterviewInviteTemplate
        candidateName="Jane Doe"
        positionTitle="Senior Data Engineer"
        orgName="IQMela Corp"
        inviteLink="https://iqmela.com/interview/test-preview-123"
      />
    );

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    console.error("Failed to render email preview:", error);
    return new NextResponse("Failed to render preview", { status: 500 });
  }
}
