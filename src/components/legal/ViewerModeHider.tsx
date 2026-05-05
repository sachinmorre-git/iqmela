"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * When ?viewer=1 is in the URL (legal document popup),
 * this component hides the root layout's header and footer
 * so only the clean document content shows.
 */
export function ViewerModeHider() {
  const searchParams = useSearchParams();
  const isViewer = searchParams.get("viewer") === "1";

  useEffect(() => {
    if (!isViewer) return;

    // Hide root chrome — the root layout header/footer have these data attributes
    document.body.classList.add("viewer-mode");
    return () => document.body.classList.remove("viewer-mode");
  }, [isViewer]);

  return null;
}
