"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { deletePositionAction, archivePositionAction, closePositionAction } from "./[id]/actions"
import { formatDate } from "@/lib/locale-utils"

type Position = {
  id: string
  title: string
  department: string | null
  location: string | null
  employmentType: string | null
  status: "DRAFT" | "OPEN" | "PAUSED" | "CLOSED" | "ARCHIVED"
  createdAt: Date
}

const STATUS_STYLES: Record<Position["status"], string> = {
  DRAFT:    "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
  OPEN:     "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  PAUSED:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  CLOSED:   "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-500",
  ARCHIVED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
}

function PositionRow({ position, onDeleted, onArchived, onClosed }: {
  position: Position
  onDeleted: (id: string) => void
  onArchived: (id: string) => void
  onClosed: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    startTransition(async () => {
      const res = await closePositionAction(position.id)
      if (res.success) onClosed(position.id)
      else setError(res.error ?? "Failed to close")
    })
  }

  function handleArchive() {
    startTransition(async () => {
      const res = await archivePositionAction(position.id)
      if (res.success) onArchived(position.id)
      else setError(res.error ?? "Failed to archive")
    })
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const res = await deletePositionAction(position.id)
      if (res.success) onDeleted(position.id)
      else setError(res.error ?? "Failed to delete")
    })
    setConfirmDelete(false)
  }

  const canClose = position.status === "OPEN" || position.status === "PAUSED" || position.status === "DRAFT"
  const canArchive = position.status !== "ARCHIVED"

  return (
    <tr className="hover:bg-gray-50/70 dark:hover:bg-zinc-900/40 transition-colors group relative cursor-pointer">
      {/* Clickable title */}
      <td className="px-6 py-4 whitespace-nowrap">
        <Link
          href={`/org-admin/positions/${position.id}`}
          className="font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors underline-offset-4 hover:underline after:absolute after:inset-0"
        >
          {position.title}
        </Link>
      </td>
      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
        {position.department ?? "—"}
      </td>
      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">
        {position.location ?? "—"}
      </td>
      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">
        {position.employmentType ? position.employmentType.replace("_", " ") : "—"}
      </td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[position.status]}`}>
          {position.status}
        </span>
      </td>
      <td className="px-6 py-4 text-gray-400 dark:text-gray-500 text-xs hidden lg:table-cell whitespace-nowrap">
        {formatDate(position.createdAt)}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2 relative z-10">
          {error && <span className="text-xs text-rose-500">{error}</span>}
          {canClose && (
            <button
              onClick={handleClose}
              disabled={isPending}
              title="Close position & unpublish from all job boards"
              className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 hover:underline disabled:opacity-50"
            >
              Close
            </button>
          )}
          {canArchive && (
            <button
              onClick={handleArchive}
              disabled={isPending}
              title="Archive position"
              className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:underline disabled:opacity-50"
            >
              Archive
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className={`text-xs font-medium hover:underline disabled:opacity-50 transition-colors ${
              confirmDelete
                ? "text-white bg-rose-600 px-2 py-0.5 rounded-lg"
                : "text-rose-500 dark:text-rose-400 hover:text-rose-700"
            }`}
          >
            {confirmDelete ? "Confirm?" : "Delete"}
          </button>
          {confirmDelete && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export function PositionsTable({ initialPositions }: { initialPositions: Position[] }) {
  const [positions, setPositions] = useState(initialPositions)

  const active = positions.filter(p => p.status !== "ARCHIVED")
  const archived = positions.filter(p => p.status === "ARCHIVED")

  function handleDeleted(id: string) {
    setPositions(prev => prev.filter(p => p.id !== id))
  }

  function handleArchived(id: string) {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, status: "ARCHIVED" as const } : p))
  }

  function handleClosed(id: string) {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, status: "CLOSED" as const } : p))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Active Positions */}
      <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/30 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Positions</h2>
          <span className="text-xs text-gray-400 font-medium">{active.length} position{active.length !== 1 ? "s" : ""}</span>
        </div>
        {active.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">No active positions. Post a new one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {active.map(position => (
                  <PositionRow
                    key={position.id}
                    position={position}
                    onDeleted={handleDeleted}
                    onArchived={handleArchived}
                    onClosed={handleClosed}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived Bucket — always visible but collapsed when empty */}
      {archived.length > 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-zinc-700 overflow-hidden bg-gray-50/30 dark:bg-zinc-950/30">
          <div className="px-6 py-4 border-b border-dashed border-gray-200 dark:border-zinc-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              Archived
            </h2>
            <span className="text-xs text-gray-400">{archived.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm opacity-70">
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                {archived.map(position => (
                  <PositionRow
                    key={position.id}
                    position={position}
                    onDeleted={handleDeleted}
                    onArchived={handleArchived}
                    onClosed={handleClosed}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
