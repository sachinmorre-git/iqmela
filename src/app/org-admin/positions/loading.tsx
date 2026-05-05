export default function PositionsLoading() {
  return (
    <div className="flex flex-col gap-8 w-full animate-pulse">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <div className="h-8 w-36 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
          <div className="h-4 w-56 bg-gray-100 dark:bg-zinc-800/60 rounded mt-2" />
        </div>
        <div className="h-10 w-40 bg-rose-100 dark:bg-rose-900/20 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        <div className="bg-gray-50 dark:bg-zinc-800/50 px-4 py-3 flex gap-8">
          {[80, 120, 90, 70, 60].map((w, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-zinc-700 rounded" style={{ width: w }} />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="px-4 py-4 border-t border-gray-50 dark:border-zinc-800/60 flex items-center gap-6">
            <div className="h-4 w-48 bg-gray-100 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-24 bg-gray-50 dark:bg-zinc-800/60 rounded" />
            <div className="h-4 w-20 bg-gray-50 dark:bg-zinc-800/60 rounded" />
            <div className="h-6 w-16 bg-gray-100 dark:bg-zinc-800 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
