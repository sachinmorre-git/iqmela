import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { FileCode2 } from 'lucide-react'

export const metadata = {
  title: 'Assessments | Interview Platform'
}

export default function CandidateAssessments() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Assessments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">View your assigned coding assessments and challenges.</p>
        </div>
      </div>

      <Card className="shadow-sm border-gray-100 dark:border-zinc-800">
        <CardContent className="p-8 md:p-16">
           <EmptyState 
             icon={<FileCode2 className="w-8 h-8 text-indigo-400" />}
             title="No Assessments Yet"
             description="You haven't been assigned any coding assessments yet. When an interviewer sends one, it will appear right here alongside your due dates."
             actionLabel="Browse Practice Tests"
           />
        </CardContent>
      </Card>
    </div>
  )
}
