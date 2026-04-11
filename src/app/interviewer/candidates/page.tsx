import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { UsersRound } from 'lucide-react'

export const metadata = {
  title: 'Candidates | Interviewer Portal'
}

export default function InterviewerCandidates() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Assigned Candidates</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">Manage candidates assigned to your evaluation pipeline.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-100 dark:border-zinc-800">
        <CardContent className="p-8 md:p-16">
           <EmptyState 
             icon={<UsersRound className="w-8 h-8 text-purple-400" />}
             title="No Candidates Found"
             description="You currently have no active candidates assigned to your evaluation pipeline. Check back later or request a new batch directly from HR."
             actionLabel="View Sourcing Pool"
           />
        </CardContent>
      </Card>
    </div>
  )
}
