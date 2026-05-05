"use client";

import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type TabsContextType = {
  activeTab: string;
  setActiveTab: (value: string) => void;
};

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function Tabs({
  defaultValue,
  className,
  children,
  onValueChange
}: {
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}) {
  const [activeTab, setInternalTab] = useState(defaultValue);

  const setActiveTab = (value: string) => {
    setInternalTab(value);
    onValueChange?.(value);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex h-12 w-full items-center justify-start rounded-xl bg-gray-100/50 p-1 text-gray-500 dark:bg-zinc-900/50 dark:text-zinc-400 border border-gray-200/60 dark:border-zinc-800/60 mb-6 overflow-x-auto hide-scrollbar",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = context.activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => context.setActiveTab(value)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 relative",
        isActive
          ? "bg-rose-50 text-rose-700 shadow-sm border border-rose-200/60 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50",
        className
      )}
    >
      {/* Active bottom indicator bar */}
      {isActive && (
        <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full bg-rose-500 dark:bg-rose-400 shadow-sm shadow-rose-500/40" />
      )}
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  if (context.activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn(
        "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:ring-offset-zinc-950 animate-in fade-in-0 duration-200",
        className
      )}
      style={{ animation: "fadeSlideIn 200ms ease-out" }}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>
  );
}
