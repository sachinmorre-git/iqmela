import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CardSkeleton, SectionSkeleton } from "@/components/ui/skeleton";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col relative w-full pt-16 pb-8 overflow-x-hidden">
      {/* Background ambient gradient decoration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[-1] overflow-hidden opacity-50 dark:opacity-30">
        <div className="w-[600px] h-[500px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 blur-[100px] rounded-full opacity-30 -translate-y-[20%]"></div>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-sm font-medium mb-8 ring-1 ring-inset ring-indigo-600/10 dark:ring-indigo-500/20 backdrop-blur-sm shadow-sm transition-all hover:ring-indigo-600/30">
          <span className="flex h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
          Intelligent Hiring Platform 2.0
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-7xl mb-6 leading-[1.1]">
          The new standard for <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            technical interviews
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mt-4 text-lg sm:text-xl leading-relaxed text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Scale your engineering teams with AI-powered insights, real-time coding environments, and automated technical evaluations that feel natural.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/select-role">Get Started</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/select-role">Book Demo</Link>
          </Button>
        </div>
      </div>

      {/* --- NEW SECTIONS --- */}
      
      {/* 1. Features Section */}
      <div className="mt-32 w-full max-w-6xl mx-auto py-16 px-4 border-t border-gray-200 dark:border-zinc-800">
        <div className="text-center mb-16 flex flex-col items-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Platform Features</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl">Placeholder subheadline for features describing core value.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="text-center sm:text-left transition-transform hover:-translate-y-1 hover:shadow-lg duration-300 border-gray-100 dark:border-zinc-800 overflow-hidden">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4 mx-auto sm:mx-0">
                  <div className="w-6 h-6 bg-indigo-500 rounded-md opacity-80"></div>
                </div>
                <CardTitle>Feature {i} Title</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Placeholder description explaining the benefit of this particular feature to the user. Fast, modern, and perfectly reliable.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 2. How It Works Section */}
      <div className="w-full max-w-6xl mx-auto py-16 px-4">
        <div className="text-center mb-16 flex flex-col items-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">How It Works</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Three simple steps to streamline your hiring.</p>
        </div>
        <div className="space-y-16 lg:space-y-24">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col md:flex-row gap-8 lg:gap-16 items-center">
              <div className={`w-full md:w-1/2 flex justify-center ${i % 2 === 0 ? 'md:order-2' : ''}`}>
                <div className="w-full aspect-video bg-gray-100 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700 flex items-center justify-center shadow-inner">
                  <span className="text-gray-400 dark:text-gray-500 font-mono text-sm max-w-[200px] text-center">Image Placeholder {i}</span>
                </div>
              </div>
              <div className={`w-full md:w-1/2 text-center md:text-left ${i % 2 === 0 ? 'md:order-1' : ''}`}>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold mb-6 text-lg border border-indigo-200 dark:border-indigo-800/50">
                  {i}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Step {i} Overview</h3>
                <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">Detailed placeholder text describing exactly what the user does in this step and why it adds value to the interview process over existing solutions.</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton Demo Section */}
      <div className="w-full max-w-6xl mx-auto py-16 px-4 border-t border-gray-200 dark:border-zinc-800">
        <div className="text-center mb-16 flex flex-col items-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Loading States</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Reusable skeleton components for async suspense boundaries.</p>
        </div>
        
        <div className="space-y-16">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center sm:text-left">Card Skeleton Grid</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-100 dark:border-zinc-800/50">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center sm:text-left">Section Skeleton</h3>
            <div className="border border-gray-100 dark:border-zinc-800 rounded-3xl bg-gray-50/50 dark:bg-zinc-900/20 p-8">
              <SectionSkeleton />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Final CTA Section */}
      <div className="w-full max-w-5xl mx-auto py-24 mb-16 px-4">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-indigo-600 border border-indigo-500 px-6 py-16 sm:px-16 sm:py-24 text-center shadow-2xl">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 2px, transparent 0)', backgroundSize: '32px 32px' }}></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl mb-6">Ready to transform your hiring?</h2>
            <p className="text-lg text-indigo-100 max-w-2xl mx-auto mb-10 leading-relaxed">Join leading companies using our dashboard to source, accurately evaluate, and hire top engineering talent faster.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="w-full sm:w-auto bg-white text-indigo-600 hover:bg-gray-50 shadow-lg hover:shadow-xl dark:bg-white dark:text-indigo-600 dark:hover:bg-gray-100">
                <Link href="/select-role">Get Started for Free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto bg-indigo-700/50 text-white border-indigo-400/50 hover:bg-indigo-700/80 hover:text-white hover:border-indigo-300 dark:hover:text-white backdrop-blur-sm">
                <Link href="/select-role">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
