import { Button } from "@/components/ui/button"

export interface InterviewCardProps {
  topBadge: string;
  bottomBadge: string;
  title: string;
  subtitle: string;
  duration?: string;
  actionText?: string;
  href?: string;
  theme?: 'indigo' | 'purple' | 'gray';
}

export function InterviewCard({
  topBadge,
  bottomBadge,
  title,
  subtitle,
  duration,
  actionText,
  href,
  theme = 'gray'
}: InterviewCardProps) {
  
  // Theme dictionaries
  const themes = {
    indigo: {
      wrapper: "border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 hover:border-indigo-200 dark:hover:border-indigo-800",
      badge: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
      subtitle: "text-indigo-600 dark:text-indigo-400",
      btn: "bg-indigo-600 hover:bg-indigo-700 text-white"
    },
    purple: {
      wrapper: "border-purple-100 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-900/10 hover:border-purple-200 dark:hover:border-purple-800",
      badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
      subtitle: "text-purple-600 dark:text-purple-400",
      btn: "bg-purple-600 hover:bg-purple-700 text-white"
    },
    gray: {
      wrapper: "border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50 bg-white dark:bg-zinc-950",
      badge: "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-400",
      subtitle: "text-gray-500 dark:text-gray-400",
      btn: ""
    }
  }

  const t = themes[theme];

  return (
    <div className={`flex gap-4 items-start border p-4 rounded-2xl shadow-sm transition-colors ${t.wrapper}`}>
      <div className={`flex flex-col items-center justify-center p-3 rounded-xl min-w-[70px] ${t.badge}`}>
        <span className="font-semibold text-xs tracking-wider uppercase">{topBadge}</span>
        <span className="text-2xl font-black tracking-tighter">{bottomBadge}</span>
      </div>
      <div className="pt-1 flex-1">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{title}</h4>
        <p className={`text-sm font-medium mt-1 ${t.subtitle}`}>{subtitle}</p>
        
        {duration && (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {duration}
          </p>
        )}
        
        {actionText && (
          <div className="mt-4">
            {href ? (
              <a href={href}>
                <Button size="sm" className={`h-8 shadow-sm text-xs rounded-lg px-4 border-transparent ${t.btn}`}>{actionText}</Button>
              </a>
            ) : (
              <Button size="sm" className={`h-8 shadow-sm text-xs rounded-lg px-4 border-transparent ${t.btn}`}>{actionText}</Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
