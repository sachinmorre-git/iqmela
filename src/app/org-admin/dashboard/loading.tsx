export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8 w-full animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div className="h-8 w-48 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 dark:bg-zinc-800/60 rounded mt-2" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900">
            <div className="h-3 w-20 bg-gray-100 dark:bg-zinc-800 rounded mb-4" />
            <div className="h-10 w-16 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-zinc-800/60 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Chart area skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900 h-80">
          <div className="h-5 w-32 bg-gray-200 dark:bg-zinc-800 rounded mb-6" />
          <div className="flex items-end gap-3 h-52">
            {[60, 80, 45, 70, 90, 55, 75].map((h, i) => (
              <div key={i} className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-t-lg" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900 h-80">
          <div className="h-5 w-40 bg-gray-200 dark:bg-zinc-800 rounded mb-6" />
          <div className="space-y-4 mt-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800" />
                <div className="flex-1">
                  <div className="h-3 w-40 bg-gray-100 dark:bg-zinc-800 rounded" />
                  <div className="h-2.5 w-24 bg-gray-50 dark:bg-zinc-800/60 rounded mt-1.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
