"use client";

import { useState } from "react";
import { IntelligenceHubClient } from "../../candidates/[resumeId]/intelligence/IntelligenceHubClient";

export function UnifiedProfileClient({
  resume,
  aiSession,
  rawResumeNode,
  userRoles,
}: {
  resume: any;
  aiSession: any;
  rawResumeNode: React.ReactNode;
  userRoles: string[];
}) {
  const [activeTab, setActiveTab] = useState<"intel" | "resume">("intel");

  const isHiringManager = userRoles.some((r) => ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"].includes(r));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Segmented Control Tabs ── */}
      <div className="flex items-center justify-center -mt-2">
        <div className="flex p-1 bg-gray-100 dark:bg-zinc-800/50 rounded-2xl shadow-inner border border-gray-200 dark:border-zinc-800 backdrop-blur-sm relative">
          <button
            onClick={() => setActiveTab("intel")}
            className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold transition-colors ${
              activeTab === "intel" ? "text-rose-700 dark:text-rose-300" : "text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            🧠 Intelligence Hub
          </button>
          <button
            onClick={() => setActiveTab("resume")}
            className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold transition-colors ${
              activeTab === "resume" ? "text-blue-700 dark:text-blue-300" : "text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            📄 Raw Resume
          </button>
          
          {/* Animated Background Pill */}
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-zinc-900 shadow-sm border border-gray-200/50 dark:border-zinc-700/50 rounded-xl transition-all duration-300 ease-in-out"
            style={{ left: activeTab === "intel" ? "4px" : "calc(50%)" }}
          />
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "intel" ? (
          <div className="-mt-2">
            <IntelligenceHubClient
              resume={resume}
              canReject={isHiringManager}
              canOffer={isHiringManager}
              userRoles={userRoles}
              embeddedMode={true}
            />
          </div>
        ) : (
          rawResumeNode
        )}
      </div>
    </div>
  );
}
