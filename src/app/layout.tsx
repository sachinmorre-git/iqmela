import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interview Platform",
  description: "A modern interview platform built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-50 font-sans">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                  <div className="flex-shrink-0">
                    <span className="text-xl font-bold tracking-tight">Interview Platform</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <Show when="signed-in">
                      <UserButton />
                    </Show>
                    <Show when="signed-out">
                      <div className="text-sm font-medium hover:text-indigo-600 transition-colors cursor-pointer">
                        <SignInButton mode="modal" signUpFallbackRedirectUrl="/sign-up" />
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </header>
          <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
            {children}
          </main>
          <footer className="w-full border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 py-12 mt-auto">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="col-span-2">
                  <span className="text-xl font-bold tracking-tight">Interview Platform</span>
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                    The new standard for technical interviews. Evaluate and hire top engineering talent faster and more effectively.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Product</h3>
                  <ul className="space-y-3">
                    <li><a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Features</a></li>
                    <li><a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Pricing</a></li>
                    <li><a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Case Studies</a></li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Company</h3>
                  <ul className="space-y-3">
                    <li><a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">About Us</a></li>
                    <li><a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Careers</a></li>
                    <li><a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Contact</a></li>
                  </ul>
                </div>
              </div>
              <div className="mt-12 pt-8 border-t border-gray-100 dark:border-zinc-800/60 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  © {new Date().getFullYear()} Interview Platform. All rights reserved.
                </p>
                <div className="flex gap-6">
                  <a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Policy</a>
                  <a href="#" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms of Service</a>
                </div>
              </div>
            </div>
          </footer>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
