"use client";

/**
 * Thin client wrapper for adding CoachMark overlays to server-component pages.
 * Wraps its children in a relative container so the CoachMark absolute overlay
 * positions correctly over the content.
 */

import { CoachMark } from "@/components/ui/CoachMark";
import type { ReactNode } from "react";

type CoachMarkPreset = "grid-select" | "button-tap" | "form-fill";

interface CoachMarkZoneProps {
  /** Unique coach mark ID */
  id: string;
  /** Whether to show the coach mark */
  show: boolean;
  /** Animation preset */
  preset: CoachMarkPreset;
  /** Instructional message */
  message: string;
  /** Optional accent color */
  accentColor?: "rose" | "blue" | "emerald" | "amber" | "violet";
  /** Optional button label for button-tap preset */
  buttonLabel?: string;
  /** Optional placeholder for form-fill preset */
  placeholderText?: string;
  /** Content this zone wraps */
  children: ReactNode;
}

export function CoachMarkZone({
  id,
  show,
  preset,
  message,
  accentColor = "rose",
  buttonLabel,
  placeholderText,
  children,
}: CoachMarkZoneProps) {
  return (
    <div className="relative">
      {children}
      <CoachMark
        id={id}
        show={show}
        preset={preset}
        message={message}
        accentColor={accentColor}
        buttonLabel={buttonLabel}
        placeholderText={placeholderText}
      />
    </div>
  );
}
