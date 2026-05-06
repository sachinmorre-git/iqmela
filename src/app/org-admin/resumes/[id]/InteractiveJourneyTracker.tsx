"use client";

import React, { useState } from "react";
import { CandidateJourneyTracker, JourneyStage } from "@/components/ui/CandidateJourneyTracker";
import { DeepAiDrawer } from "./DeepAiDrawer";

export function InteractiveJourneyTracker({
  stages,
  resume,
  userRoles,
}: {
  stages: JourneyStage[];
  resume: any;
  userRoles: string[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusedRoundId, setFocusedRoundId] = useState<string | undefined>();

  const handleNodeClick = (stage: JourneyStage) => {
    if (stage.reportLink) {
      if (stage.reportLink.startsWith("/org-admin/candidates/") && stage.reportLink.includes("focus=")) {
        const url = new URL(stage.reportLink, window.location.origin);
        const focus = url.searchParams.get("focus") || undefined;
        setFocusedRoundId(focus);
        setDrawerOpen(true);
      } else {
        // External links or fallback
        window.open(stage.reportLink, "_blank");
      }
    }
  };

  return (
    <>
      <CandidateJourneyTracker stages={stages} onNodeClick={handleNodeClick} />
      
      {drawerOpen && (
        <DeepAiDrawer 
          resume={resume} 
          userRoles={userRoles} 
          focusedRoundId={focusedRoundId}
          openProp={drawerOpen}
          onOpenChangeProp={setDrawerOpen}
        />
      )}
    </>
  );
}
