import * as React from "react"
import { Button } from "@/components/ui/button"

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  className?: string;
}

export function EmptyState({ icon, title, description, actionLabel, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 md:p-12 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl bg-gray-50/50 dark:bg-zinc-900/20 ${className || ''}`}>
      <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-center text-gray-400 dark:text-gray-500 mb-5">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-base text-gray-500 dark:text-gray-400 max-w-sm mb-8 leading-relaxed">{description}</p>
      
      {actionLabel && (
        <Button className="font-semibold shadow-sm px-6">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
