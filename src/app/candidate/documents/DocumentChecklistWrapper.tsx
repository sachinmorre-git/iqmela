"use client";

import { useState } from "react";
import { DocumentChecklist } from "./DocumentChecklist";
import { COUNTRY_CHECKLISTS } from "@/lib/document-checklist";

type UploadedDoc = {
  id: string;
  docType: string;
  label: string;
  originalFileName: string;
  aiStatus: string;
  aiConfidence: number | null;
  aiWarnings: string[] | null;
  verificationStatus: string;
  createdAt: string;
  countryCode: string;
};

export function DocumentChecklistWrapper({
  profileId,
  uploadedDocs,
}: {
  profileId: string;
  uploadedDocs: UploadedDoc[];
}) {
  const [countryCode, setCountryCode] = useState("US");
  const config = COUNTRY_CHECKLISTS[countryCode];

  if (!config) return null;

  // Filter uploaded docs for current country
  const countryDocs = uploadedDocs.filter((d) => d.countryCode === countryCode);

  return (
    <DocumentChecklist
      profileId={profileId}
      countryCode={config.code}
      countryName={config.name}
      countryFlag={config.flag}
      docs={config.docs}
      uploadedDocs={countryDocs}
      onCountryChange={setCountryCode}
    />
  );
}
