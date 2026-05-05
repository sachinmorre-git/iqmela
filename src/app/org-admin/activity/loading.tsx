export default function ActivityLoading() {
  return (
    <div className="flex-1 space-y-8 max-w-6xl mx-auto w-full p-4 md:p-8 animate-pulse">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-6 gap-4">
        <div>
          <div className="h-8 w-36 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-zinc-800/60 rounded mt-2" />
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/50">
        <div className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 py-4 flex gap-10">
          {[80, 70, 60, 90, 100].map((w, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-zinc-700 rounded" style={{ width: w }} />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-8">
            <div className="h-3 w-32 bg-gray-100 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-zinc-800 rounded" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-zinc-800 rounded-full" />
            <div className="h-3 w-28 bg-gray-100 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-40 bg-gray-50 dark:bg-zinc-800/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
