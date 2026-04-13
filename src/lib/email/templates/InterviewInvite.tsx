import {
  Button,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import Layout from "./components/Layout";

export interface InterviewInviteTemplateProps {
  candidateName: string;
  positionTitle: string;
  orgName: string;
  inviteLink: string;
}

export const InterviewInviteTemplate: React.FC<InterviewInviteTemplateProps> = ({
  candidateName,
  positionTitle,
  orgName,
  inviteLink,
}) => {
  const previewText = `You're invited to interview for ${positionTitle} at ${orgName}`;

  return (
    <Layout previewText={previewText}>
      <Section>
        <Text style={greeting}>Hi {candidateName},</Text>
        <Text style={paragraph}>
          We are pleased to invite you to an interview for the{" "}
          <strong>{positionTitle}</strong> position at <strong>{orgName}</strong>.
        </Text>
        <Text style={paragraph}>
          Our team was impressed by your background and would love to learn more about
          your experience. Please click the button below to review your invitation and 
          schedule your interview session.
        </Text>
        
        <Section style={btnContainer}>
          <Button style={button} href={inviteLink}>
            View Interview Details
          </Button>
        </Section>
        
        <Text style={paragraph}>
          If you have any questions or need to make accommodations, please reach
          out to us directly.
        </Text>
        
        <Text style={paragraph}>
          Best regards,<br />
          The {orgName} Team
        </Text>
        
        <Text style={fallbackText}>
          If the button above doesn't work, please copy and paste this link into your browser:
          <br />
          <a href={inviteLink} style={fallbackLink}>{inviteLink}</a>
        </Text>
      </Section>
    </Layout>
  );
};

export default InterviewInviteTemplate;

// ── Styles ───────────────────────────────────────────────────────────────────

const greeting = {
  fontSize: "20px",
  lineHeight: "28px",
  fontWeight: "600",
  color: "#334155",
  marginBottom: "16px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#475569",
  marginBottom: "20px",
};

const btnContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#4f46e5", // Indigo 600
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 24px",
};

const fallbackText = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#64748b",
  marginTop: "32px",
  paddingTop: "24px",
  borderTop: "1px solid #e2e8f0",
};

const fallbackLink = {
  color: "#4f46e5",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};
