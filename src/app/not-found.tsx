import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] p-4 text-center w-full">
      <div className="w-24 h-24 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center mb-8 mx-auto shadow-inner">
        <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">404</span>
      </div>
      <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl mb-6">Page not found</h2>
      <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-10 leading-relaxed">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. The link may be broken or the page may have been removed.
      </p>
      <Button asChild size="lg" className="shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
        <Link href="/">Return to Homepage</Link>
      </Button>
    </div>
  )
}
