"use client";

import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export const SidebarContext = createContext({ isCollapsed: false });

export function useSidebar() {
  return useContext(SidebarContext);
}

interface ResizableSidebarLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsedWidth?: number;
  className?: string;
  sidebarClassName?: string;
  mainClassName?: string;
}

export function ResizableSidebarLayout({
  sidebar,
  children,
  defaultWidth = 240,
  minWidth = 200,
  maxWidth = 480,
  collapsedWidth = 72,
  className = "flex flex-col md:flex-row min-h-screen w-full border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden relative",
  sidebarClassName = "border-b md:border-b-0 md:border-r border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/40",
  mainClassName = "flex-1 flex flex-col bg-white dark:bg-zinc-950 overflow-y-auto relative min-w-0"
}: ResizableSidebarLayoutProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const sidebarRef = useRef<HTMLElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Rehydrate from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem("iqmela_sidebar_width");
    const savedCollapsed = localStorage.getItem("iqmela_sidebar_collapsed");
    if (savedWidth) setWidth(Number(savedWidth));
    if (savedCollapsed) setIsCollapsed(savedCollapsed === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("iqmela_sidebar_width", String(width));
    localStorage.setItem("iqmela_sidebar_collapsed", String(isCollapsed));
  }, [width, isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      
      let newWidth = e.clientX;
      
      // Auto-collapse if dragged too small
      if (newWidth < minWidth / 2) {
        setIsCollapsed(true);
        return;
      }
      
      // Snap open if dragged from collapsed
      if (isCollapsed && newWidth > collapsedWidth + 20) {
        setIsCollapsed(false);
        newWidth = minWidth;
      }
      
      if (!isCollapsed) {
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isCollapsed, minWidth, maxWidth, collapsedWidth]);

  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      <div className={className}>
        {/* Sidebar Container */}
        <aside
          ref={sidebarRef}
          style={{ width: isCollapsed ? collapsedWidth : width }}
          className={`relative flex flex-col transition-[width] ${isDragging ? "duration-0" : "duration-300"} ease-in-out shrink-0 group/sidebar ${sidebarClassName}`}
        >
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden h-full py-6 flex flex-col gap-6 hide-scrollbar relative">
            {sidebar}
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-6 z-50 p-1 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors opacity-0 group-hover/sidebar:opacity-100 hidden md:flex"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Drag Handle */}
          {!isCollapsed && (
            <div
              ref={dragHandleRef}
              onMouseDown={() => setIsDragging(true)}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-rose-500/50 active:bg-rose-500 transition-colors hidden md:block z-40"
            />
          )}
        </aside>

        {/* Main Content Area */}
        <main className={mainClassName}>
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
