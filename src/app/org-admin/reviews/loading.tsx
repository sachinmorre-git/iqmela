export default function ReviewsLoading() {
  return (
    <div className="flex-1 space-y-10 max-w-5xl mx-auto w-full p-4 md:p-8 animate-pulse">
      <div className="border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div className="h-8 w-52 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-4 w-80 bg-gray-100 dark:bg-zinc-800/60 rounded mt-2" />
      </div>
      <div className="space-y-4">
        <div className="h-3 w-56 bg-gray-200 dark:bg-zinc-800 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 space-y-3">
              <div className="flex justify-between">
                <div>
                  <div className="h-2.5 w-28 bg-gray-100 dark:bg-zinc-800 rounded" />
                  <div className="h-4 w-36 bg-gray-200 dark:bg-zinc-800 rounded mt-1.5" />
                </div>
                <div className="h-5 w-20 bg-amber-100 dark:bg-amber-900/20 rounded-full" />
              </div>
              <div className="h-3 w-full bg-gray-50 dark:bg-zinc-800/60 rounded" />
              <div className="h-9 w-full bg-gray-100 dark:bg-zinc-800 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
