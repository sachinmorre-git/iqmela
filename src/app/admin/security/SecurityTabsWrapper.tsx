"use client";

import { useState } from "react";
import SecurityDashboardClient from "./SecurityDashboardClient";
import GeoBlockingClient from "./GeoBlockingClient";
import { Shield, Globe } from "lucide-react";

const TABS = [
  { id: "blocks", label: "IP & User Blocks", icon: Shield },
  { id: "geo", label: "Geo-Blocking", icon: Globe },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SecurityTabsWrapper() {
  const [activeTab, setActiveTab] = useState<TabId>("blocks");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-zinc-800 pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-t-xl transition-all border-b-2 ${
                isActive
                  ? "bg-zinc-800/50 text-white border-rose-500"
                  : "text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-900/40"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-rose-400" : ""}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "blocks" && <SecurityDashboardClient />}
      {activeTab === "geo" && <GeoBlockingClient />}
    </div>
  );
}
