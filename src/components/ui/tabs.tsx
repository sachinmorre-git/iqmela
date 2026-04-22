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
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
        isActive
          ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-white"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50",
        className
      )}
    >
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
        "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:ring-offset-zinc-950",
        className
      )}
    >
      {children}
    </div>
  );
}
