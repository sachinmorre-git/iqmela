"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cancelInterview } from "./actions";

export function CancelButton({ interviewId }: { interviewId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  async function handleConfirmCancel() {
    setIsCanceling(true);
    try {
      await cancelInterview(interviewId);
      // Wait for redirect to happen via server action
    } catch (error) {
      console.error(error);
      setIsCanceling(false); // In case it fails, let them try again
    }
  }

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto h-12 shadow-sm font-semibold rounded-xl text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        Cancel Interview
      </Button>

      {/* Confirmation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4">
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-6 sm:p-8">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-6">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Cancel this interview?</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8">
                This action cannot be undone. The candidate will no longer be able to access the staging room, and the session will be permanently marked as canceled in the database.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button 
                  onClick={() => setIsOpen(false)} 
                  variant="outline" 
                  className="flex-1 rounded-xl h-12 font-bold"
                  disabled={isCanceling}
                >
                  Keep Scheduled
                </Button>
                <Button 
                  onClick={handleConfirmCancel} 
                  variant="destructive" 
                  className="flex-1 rounded-xl h-12 font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20"
                  disabled={isCanceling}
                >
                  {isCanceling ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Yes, Cancel It"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
