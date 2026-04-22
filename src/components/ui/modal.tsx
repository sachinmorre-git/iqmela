"use client";

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-24">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-900/40 dark:bg-zinc-950/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Content */}
      <div 
        className={cn(
          "relative w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl transition-all border border-gray-200 dark:border-zinc-800",
          "animate-in fade-in zoom-in-95 duration-200",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800/60 px-6 py-4 bg-gray-50/50 dark:bg-zinc-900/50">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        )}
        {!title && (
          <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        )}
        
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
