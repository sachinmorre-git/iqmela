import {
  Button,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";
import Layout from "./components/Layout";

export interface AiInterviewInviteTemplateProps {
  candidateName: string;
  positionTitle: string;
  orgName: string;
  inviteLink: string;
}

export const AiInterviewInviteTemplate: React.FC<AiInterviewInviteTemplateProps> = ({
  candidateName,
  positionTitle,
  orgName,
  inviteLink,
}) => {
  const previewText = `You've been invited to complete an AI interview for ${positionTitle} at ${orgName}`;

  return (
    <Layout previewText={previewText}>
      <Section>
        <Text style={greeting}>Hi {candidateName},</Text>
        <Text style={paragraph}>
          Congratulations! You've been shortlisted for the{" "}
          <strong>{positionTitle}</strong> position at{" "}
          <strong>{orgName}</strong>.
        </Text>
        <Text style={paragraph}>
          As the next step, you're invited to complete a short AI-led interview
          through IQMela. This is an on-demand, asynchronous interview - there's
          no need to schedule a time with a human interviewer. You can complete
          it at your own convenience.
        </Text>

        {/* What to expect section */}
        <Section style={infoBox}>
          <Text style={infoHeading}>What to expect</Text>
          <Row>
            <Column style={infoItem}>
              <Text style={infoIcon}>🎤</Text>
              <Text style={infoText}>
                <strong>Speak your answers</strong> - The AI will ask questions
                and listen to your verbal responses.
              </Text>
            </Column>
          </Row>
          <Row>
            <Column style={infoItem}>
              <Text style={infoIcon}>⏱️</Text>
              <Text style={infoText}>
                <strong>~20-30 minutes</strong> - The interview is concise and
                focused on your experience and fit.
              </Text>
            </Column>
          </Row>
          <Row>
            <Column style={infoItem}>
              <Text style={infoIcon}>🖥️</Text>
              <Text style={infoText}>
                <strong>Use a quiet space</strong> - Ensure your microphone is
                connected and you're in a low-noise environment.
              </Text>
            </Column>
          </Row>
          <Row>
            <Column style={infoItem}>
              <Text style={infoIcon}>🔒</Text>
              <Text style={infoText}>
                <strong>Private & secure</strong> - Your responses are
                encrypted and reviewed only by the hiring team at {orgName}.
              </Text>
            </Column>
          </Row>
          <Row>
            <Column style={infoItem}>
              <Text style={infoIcon}>🌐</Text>
              <Text style={infoText}>
                <strong>Supported Browsers</strong> - Please use a recent version of Chrome, Edge, or Safari on a desktop/laptop. <strong>Do not use Incognito or Private mode</strong>, as they block camera/mic access automatically.
              </Text>
            </Column>
          </Row>
        </Section>

        <Section style={btnContainer}>
          <Button style={button} href={inviteLink}>
            Start Your AI Interview
          </Button>
        </Section>

        <Text style={note}>
          This link is unique to you and expires after use. If you encounter
          any technical issues, please contact {orgName} directly.
        </Text>

        <Hr style={divider} />

        <Text style={paragraph}>
          Best of luck,
          <br />
          The {orgName} Hiring Team · Powered by IQMela
        </Text>

        <Text style={fallbackText}>
          If the button above doesn't work, copy and paste this link into your browser:
          <br />
          <a href={inviteLink} style={fallbackLink}>{inviteLink}</a>
        </Text>
      </Section>
    </Layout>
  );
};

export default AiInterviewInviteTemplate;

// ── Styles ────────────────────────────────────────────────────────────────────

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

const infoBox = {
  backgroundColor: "#f5f3ff",
  border: "1px solid #ede9fe",
  borderRadius: "12px",
  padding: "20px 24px",
  margin: "24px 0",
};

const infoHeading = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#6d28d9",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginBottom: "16px",
};

const infoItem = {
  display: "flex",
  alignItems: "flex-start",
  marginBottom: "12px",
};

const infoIcon = {
  fontSize: "18px",
  margin: "0 12px 0 0",
  lineHeight: "24px",
};

const infoText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#475569",
  margin: "0",
};

const btnContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#7c3aed",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "700",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "16px 32px",
};

const note = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#94a3b8",
  textAlign: "center" as const,
};

const divider = {
  borderColor: "#e2e8f0",
  margin: "28px 0",
};

const fallbackText = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#64748b",
  marginTop: "24px",
};

const fallbackLink = {
  color: "##7c3aed",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};
