import Link from "next/link";
import { Scale } from "lucide-react";
import { Suspense } from "react";
import { LegalViewerFooter } from "@/components/legal/LegalViewerFooter";
import { LegalLayoutSwitch } from "@/components/legal/LegalLayoutSwitch";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <LegalLayoutSwitch>{children}</LegalLayoutSwitch>
    </Suspense>
  );
}
