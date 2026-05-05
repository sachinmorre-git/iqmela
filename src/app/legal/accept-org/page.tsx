"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgreementGate } from "@/components/legal/AgreementGate";
import { useOrganization, useSession } from "@clerk/nextjs";

export default function AcceptOrgPage() {
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const next           = searchParams.get("next") ?? "/org-admin/dashboard";
  const { organization } = useOrganization();
  const { session }      = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleAccept = async ({ name, title, viewedDocuments }: { name?: string; title?: string; viewedDocuments: string[] }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/accept-org", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, title, viewedDocuments }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Acceptance failed");
      }
      // Force Clerk to refresh the session JWT so proxy reads the new msaVersion
      if (session) await session.reload();
      window.location.href = next;
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <AgreementGate
      title="Organisation Agreements"
      subtitle={`As an administrator of ${organization?.name ?? "your organisation"}, you must accept IQMela's enterprise agreements before activating the platform for your team.`}
      documents={[
        {
          label:       "Master Service Agreement",
          href:        "/legal/terms",
          description: "The primary contract governing IQMela's B2B service to your organisation.",
        },
        {
          label:       "Data Processing Agreement",
          href:        "/legal/dpa",
          description: "India DPDP Act 2023 compliant DPA governing how IQMela™ processes personal data on your behalf.",
        },
        {
          label:       "Privacy Policy",
          href:        "/legal/privacy",
          description: "How candidate and user data is handled across the platform.",
        },
      ]}
      checkboxLabel={
        <>
          I confirm I am an authorised signatory of{" "}
          <strong className="text-white">{organization?.name ?? "my organisation"}</strong> and have authority
          to accept the{" "}
          <a href="/legal/terms" target="_blank" className="text-rose-400 hover:underline">Master Service Agreement</a>{" "}
          and{" "}
          <a href="/legal/dpa"   target="_blank" className="text-rose-400 hover:underline">Data Processing Agreement</a>{" "}
          on its behalf.
        </>
      }
      requiresName
      nameLabel="Your full legal name"
      titleLabel="Your title / role at the organisation"
      orgName={organization?.name}
      onAccept={handleAccept}
      isLoading={isLoading}
      error={error}
    />
  );
}
