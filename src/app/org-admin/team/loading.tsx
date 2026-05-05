export default function TeamLoading() {
  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto w-full p-4 md:p-8 animate-pulse">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div>
          <div className="h-8 w-40 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
          <div className="h-4 w-64 bg-gray-100 dark:bg-zinc-800/60 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-rose-100 dark:bg-rose-900/20 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800" />
              <div className="flex-1">
                <div className="h-4 w-28 bg-gray-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-40 bg-gray-100 dark:bg-zinc-800/60 rounded mt-1.5" />
              </div>
            </div>
            <div className="h-6 w-20 bg-gray-100 dark:bg-zinc-800 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
