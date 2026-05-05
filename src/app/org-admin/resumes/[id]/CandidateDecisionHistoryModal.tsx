"use client"

import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/locale-utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { History } from "lucide-react"

export function CandidateDecisionHistoryModal({ decisions }: { decisions: any[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full justify-center bg-white/10 hover:bg-white/20 border-white/20 text-white hover:text-white rounded-lg transition-all shadow-sm whitespace-nowrap">
          <History className="mr-2 h-4 w-4" />
          Decision History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decision History</DialogTitle>
        </DialogHeader>
        
        {decisions && decisions.length > 0 ? (
          <div className="space-y-4 mt-4">
            {decisions.map((d: any) => (
              <div key={d.id} className="flex items-start gap-3 text-sm">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                  d.action === "ADVANCE" ? "bg-rose-500" :
                  d.action === "REJECT" ? "bg-red-500" :
                  d.action === "HOLD" ? "bg-amber-500" :
                  d.action === "OFFER" ? "bg-pink-500" :
                  d.action === "HIRE" ? "bg-emerald-500" :
                  "bg-gray-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-900 dark:text-white">{d.action}</span>
                  {d.note && <p className="text-gray-500 dark:text-zinc-400 mt-0.5">{d.note}</p>}
                </div>
                <div className="text-gray-400 dark:text-zinc-500 shrink-0 text-[10px] text-right">
                  <div className="font-medium">{d.decidedBy?.name || "System"}</div>
                  <div>{formatDate(new Date(d.createdAt))}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
            No decisions have been recorded for this candidate yet.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
