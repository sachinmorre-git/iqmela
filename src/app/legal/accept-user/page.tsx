"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgreementGate } from "@/components/legal/AgreementGate";

export default function AcceptUserPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") ?? "/";

  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleAccept = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/accept-user", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Acceptance failed");
      }
      // Hard reload to flush Clerk session cache → middleware reads new tosVersion
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
          <a href="/legal/terms"   target="_blank" className="text-indigo-400 hover:underline">Terms of Service</a>,{" "}
          <a href="/legal/privacy" target="_blank" className="text-indigo-400 hover:underline">Privacy Policy</a>, and{" "}
          <a href="/legal/conduct" target="_blank" className="text-indigo-400 hover:underline">Interviewer Code of Conduct</a>.
        </>
      }
      onAccept={handleAccept}
      isLoading={isLoading}
      error={error}
    />
  );
}
