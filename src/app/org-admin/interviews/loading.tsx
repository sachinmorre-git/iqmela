export default function InterviewsLoading() {
  return (
    <div className="flex-1 space-y-8 max-w-6xl mx-auto w-full p-4 md:p-8 animate-pulse">
      <div className="border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div className="h-8 w-44 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 dark:bg-zinc-800/60 rounded mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900">
            <div className="h-3 w-20 bg-gray-100 dark:bg-zinc-800 rounded mb-3" />
            <div className="h-8 w-10 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 flex items-center gap-6">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 bg-gray-200 dark:bg-zinc-800 rounded" />
              <div className="h-3 w-56 bg-gray-100 dark:bg-zinc-800/60 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-100 dark:bg-zinc-800 rounded-full" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-zinc-800/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
