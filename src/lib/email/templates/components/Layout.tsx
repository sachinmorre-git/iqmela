import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface LayoutProps {
  previewText: string;
  children: React.ReactNode;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iqmela.com";

export const Layout: React.FC<LayoutProps> = ({ previewText, children }) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={`${APP_URL}/brand/logo/iqmela-wordmark.png`}
              width="140"
              height="auto"
              alt="IQMela"
              style={{ margin: "0 auto" }}
            />
          </Section>
          
          <Section style={content}>
            {children}
          </Section>

          <Hr style={hr} />
          
          <Section style={footer}>
            <Text style={footerText}>
              &copy; {new Date().getFullYear()} IQMela. All rights reserved.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${APP_URL}`} style={link}>
                Visit IQMela
              </Link>
              {" • "}
              <Link href={`${APP_URL}/privacy`} style={link}>
                Privacy Policy
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default Layout;

// ── Styles ───────────────────────────────────────────────────────────────────

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  marginTop: "40px",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
};

const header = {
  padding: "0 48px",
  textAlign: "center" as const,
};

const logo = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "bold",
  letterSpacing: "-0.5px",
};

const content = {
  padding: "0 48px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  padding: "0 48px",
  textAlign: "center" as const,
};

const footerText = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "0 0 8px 0",
};

const footerLinks = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

const link = {
  color: "#6366f1", // Indigo 500
  textDecoration: "none",
};
