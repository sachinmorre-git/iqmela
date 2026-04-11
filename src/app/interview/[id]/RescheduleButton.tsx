"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { rescheduleInterview } from "./actions";

export function RescheduleButton({ interviewId }: { interviewId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [errorString, setErrorString] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsRescheduling(true);
    setErrorString("");
    
    try {
      const formData = new FormData(e.currentTarget);
      await rescheduleInterview(interviewId, formData);
      setIsOpen(false);
    } catch (error: any) {
      console.error(error);
      setErrorString(error.message || "Failed to reschedule interview. Try again.");
    } finally {
      setIsRescheduling(false);
    }
  }

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto h-12 shadow-sm font-semibold rounded-xl text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
      >
        Reschedule
      </Button>

      {/* Reschedule Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4">
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-6 sm:p-8">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16"/><line x1="16" y1="12" x2="16.01" y2="12"/></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reschedule Session</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                Pick a new date and time. This will automatically update the staging room and dashboard for both you and the candidate.
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">New Date</label>
                    <input 
                      required
                      id="date"
                      name="date" 
                      type="date" 
                      className="w-full rounded-xl border-gray-300 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div>
                    <label htmlFor="time" className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">New Time</label>
                    <input 
                      required
                      id="time"
                      name="time" 
                      type="time" 
                      className="w-full rounded-xl border-gray-300 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>

                {errorString && (
                  <p className="text-red-500 text-xs font-bold mt-2">{errorString}</p>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3 w-full pt-4 mt-8 border-t border-gray-100 dark:border-zinc-800">
                  <Button 
                    type="button"
                    onClick={() => setIsOpen(false)} 
                    variant="outline" 
                    className="flex-1 rounded-xl h-12 font-bold"
                    disabled={isRescheduling}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 rounded-xl h-12 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20"
                    disabled={isRescheduling}
                  >
                    {isRescheduling ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
