"use client";

import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * Client-side-only wrapper for Clerk's UserButton.
 * Prevents hydration mismatch by only rendering after mount.
 */
export function ClientUserButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder with the same dimensions to prevent layout shift
    return (
      <div className="w-7 h-7 rounded-full bg-zinc-800 animate-pulse" />
    );
  }

  return <UserButton />;
}
