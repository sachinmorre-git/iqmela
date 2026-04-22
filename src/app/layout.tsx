import { ClerkProvider, Show, UserButton } from "@clerk/nextjs";
import Link from 'next/link';
import { auth } from "@clerk/nextjs/server";
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
  title: "IQMela — Hire with Intelligence",
  description: "AI-powered interview intelligence. Structured scorecards, behavioral signals, and real-time insights for confident hiring decisions.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId, orgId, sessionClaims } = await auth();
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  const isSystemStaff = !!sysRole?.startsWith("sys:");
  // Only marketplace users (no org, not internal staff) should see the Switch Role button
  const isMarketplaceUser = !!userId && !isSystemStaff && !orgId;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-50 font-sans">
       <ClerkProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <header className="sticky top-0 z-50 w-full border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur">
              <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                  <Link href="/" className="flex items-center gap-2">
                    <span className="text-xl font-black tracking-tight text-white">IQ<span className="text-indigo-400">Mela</span></span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Show when="signed-in">
                      {isMarketplaceUser && (
                        <Link href="/select-role?force=true" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.17-2.8l-7-7"/><path d="M15 11l7-7"/></svg>
                          Switch Role
                        </Link>
                      )}
                      <UserButton />
                    </Show>
                    <Show when="signed-out">
                      <Link href="/sign-in" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800">
                        Sign in
                      </Link>
                      <Link href="/sign-up" className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-xl">
                        Get started
                      </Link>
                    </Show>
                  </div>
                </div>
              </div>
            </header>
          <main className="flex-1 w-full flex flex-col">
            {children}
          </main>
          <footer className="w-full border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 py-12 mt-auto">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="col-span-2">
                  <span className="text-xl font-black tracking-tight text-white">IQ<span className="text-indigo-400">Mela</span></span>
                  <p className="mt-4 text-sm text-zinc-500 max-w-xs leading-relaxed">
                    The intelligent hiring platform. AI-powered interviews, structured scorecards, and data-driven decisions.
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
                  © {new Date().getFullYear()} RelyOnAI LLP. IQMela™ is a product of RelyOnAI LLP. All rights reserved.
                </p>
                <div className="flex gap-6">
                  <Link href="/legal/privacy" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Policy</Link>
                  <Link href="/legal/terms"   className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms of Service</Link>
                  <Link href="/legal/dpa"     className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">DPA</Link>
                  <Link href="/legal/cookies" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Cookies</Link>
                </div>
              </div>
            </div>
          </footer>
          </ThemeProvider>
         </ClerkProvider>
        </body>
      </html>
  );
}
