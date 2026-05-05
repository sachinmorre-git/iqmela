"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgreementGate } from "@/components/legal/AgreementGate";
import { useSession } from "@clerk/nextjs";

export default function AcceptUserPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") ?? "/";
  const { session }  = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleAccept = async ({ viewedDocuments }: { viewedDocuments: string[] } = { viewedDocuments: [] }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/accept-user", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ viewedDocuments }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Acceptance failed");
      }
      // Force Clerk to refresh the session JWT so proxy reads the new tosVersion
      if (session) await session.reload();
      window.location.href = next;
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <AgreementGate
      title="Before you continue"
      subtitle="IQMela requires all users to accept our platform agreements before accessing the service. This takes less than a minute."
      documents={[
        {
          label:       "Platform Terms of Service",
          href:        "/legal/terms",
          description: "Rules governing your use of the IQMela platform.",
        },
        {
          label:       "Privacy Policy",
          href:        "/legal/privacy",
          description: "How we collect, use, and protect your personal data.",
        },
        {
          label:       "Interviewer Code of Conduct",
          href:        "/legal/conduct",
          description: "Standards for fair, unbiased interviewing on IQMela.",
        },
      ]}
      checkboxLabel={
        <>
          I have read and agree to the{" "}
          <a href="/legal/terms"   target="_blank" className="text-rose-400 hover:underline">Terms of Service</a>,{" "}
          <a href="/legal/privacy" target="_blank" className="text-rose-400 hover:underline">Privacy Policy</a>, and{" "}
          <a href="/legal/conduct" target="_blank" className="text-rose-400 hover:underline">Interviewer Code of Conduct</a>.
        </>
      }
      onAccept={handleAccept}
      isLoading={isLoading}
      error={error}
    />
  );
}
