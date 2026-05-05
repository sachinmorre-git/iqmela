"use client";

import React from "react";
import { useSidebar } from "./layout/ResizableSidebarLayout";

export function SidebarHeader({ 
  children,
  roleLabel,
  isFreeTier,
  isVendorFreeOrg 
}: { 
  children: React.ReactNode;
  roleLabel: string;
  isFreeTier: boolean;
  isVendorFreeOrg: boolean;
}) {
  const { isCollapsed } = useSidebar();

  if (isCollapsed) {
    return (
      <div className="px-4 flex justify-center">
        <div className="w-8 h-8 rounded overflow-hidden flex items-center justify-center">
          {/* We scale the organization switcher down to only show the avatar */}
          <div className="scale-75 origin-center">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      {children}
      <div className="mt-2 px-1 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-zinc-500">
          {roleLabel} Dashboard
        </span>
        {isFreeTier && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30`}>
            {isVendorFreeOrg ? 'Vendor' : 'Starter'}
          </span>
        )}
      </div>
    </div>
  );
}
