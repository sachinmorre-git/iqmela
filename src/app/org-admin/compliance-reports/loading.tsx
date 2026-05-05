export default function ComplianceLoading() {
  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto w-full p-4 md:p-8 animate-pulse">
      <div className="border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div className="h-8 w-56 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-4 w-80 bg-gray-100 dark:bg-zinc-800/60 rounded mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900">
            <div className="h-3 w-24 bg-gray-100 dark:bg-zinc-800 rounded mb-3" />
            <div className="h-8 w-12 bg-gray-200 dark:bg-zinc-800 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900 h-64" />
    </div>
  );
}
