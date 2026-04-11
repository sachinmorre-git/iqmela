'use client'
 
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error)
  }, [error])
 
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] p-4 text-center w-full">
      <div className="w-24 h-24 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 flex items-center justify-center mb-8 mx-auto shadow-inner">
        <span className="text-4xl font-bold text-red-600 dark:text-red-400">!</span>
      </div>
      <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl mb-6">Something went wrong</h2>
      <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-10 leading-relaxed">
        An unexpected error has occurred. We have been notified and are working to resolve the issue as quickly as possible.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button 
          onClick={reset} 
          size="lg" 
          className="shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all bg-red-600 hover:bg-red-700 text-white"
        >
          Try Again
        </Button>
        <Button 
          asChild 
          variant="outline" 
          size="lg" 
          className="hover:bg-gray-50 dark:hover:bg-zinc-900 transition-all hover:-translate-y-0.5"
        >
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  )
}
