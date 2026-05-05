import type { ReactNode } from "react";

/**
 * Minimal layout for the public BGV upload page.
 * No app navbar, sidebar, or auth required.
 */
export default function BgvUploadLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-pink-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-pink-950">
        <div className="min-h-screen flex flex-col">
          {children}
          {/* Footer */}
          <footer className="mt-auto py-6 text-center border-t border-gray-100 dark:border-zinc-800">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Powered by <span className="font-bold text-pink-500">IQMela</span> · <a href="/privacy" className="underline hover:text-pink-500">Privacy Policy</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
