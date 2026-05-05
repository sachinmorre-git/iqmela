"use client";

import { useEffect, useState } from "react";

/**
 * A frosted-glass bar that slides up from the bottom of the screen
 * once the user scrolls past the initial apply section.
 * Provides a persistent "Apply Now" CTA.
 */
export function StickyApplyBar({
  positionTitle,
}: {
  positionTitle: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 600px or past the #apply section
      const applyEl = document.getElementById("apply");
      if (applyEl) {
        const rect = applyEl.getBoundingClientRect();
        // Show when apply form is below the viewport
        setVisible(rect.top > window.innerHeight + 100 || rect.bottom < 0);
      } else {
        setVisible(window.scrollY > 600);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check on mount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="sticky-apply-bar glass-header"
      style={{
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
      }}
    >
      <span
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#a1a1aa",
          display: "none",
        }}
        className="sticky-title"
      >
        {positionTitle}
      </span>
      <a
        href="#apply"
        className="btn-shimmer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 28px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff",
          fontSize: "14px",
          fontWeight: 700,
          textDecoration: "none",
          transition: "all 0.2s",
          letterSpacing: "-0.01em",
        }}
      >
        Apply for {positionTitle} →
      </a>
    </div>
  );
}
