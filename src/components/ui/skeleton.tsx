import { cn } from "@/lib/utils"
import * as React from "react"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200 dark:bg-zinc-800", className)}
      {...props}
    />
  )
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6", className)}>
      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-zinc-800 animate-pulse mb-4 mx-auto sm:mx-0" />
      <Skeleton className="h-6 w-3/4 mb-4 mx-auto sm:mx-0" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6 mx-auto sm:mx-0" />
        <Skeleton className="h-4 w-4/6 mx-auto sm:mx-0" />
      </div>
    </div>
  )
}

function SectionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center space-y-6 py-12", className)}>
      <Skeleton className="h-10 w-3/4 sm:w-1/2 max-w-lg rounded-xl" />
      <div className="w-full flex flex-col items-center space-y-2">
        <Skeleton className="h-5 w-4/5 sm:w-2/3 max-w-2xl" />
        <Skeleton className="h-5 w-3/5 sm:w-1/2 max-w-xl" />
      </div>
      <div className="flex flex-col sm:flex-row gap-4 pt-6 w-full items-center justify-center">
        <Skeleton className="h-12 w-full sm:w-40 rounded-full" />
        <Skeleton className="h-12 w-full sm:w-40 rounded-full" />
      </div>
    </div>
  )
}

export { Skeleton, CardSkeleton, SectionSkeleton }
