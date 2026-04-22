"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { scheduleInterviewAction } from "./schedule-actions";
import { useRouter } from "next/navigation";

type ResumeOption = {
  id: string;
  name: string;
  email: string;
};

type InterviewerOption = {
  id: string;
  name: string;
  email: string;
};

export function InterviewScheduler({
  positionId,
  resumes,
  interviewers,
}: {
  positionId: string;
  resumes: ResumeOption[];
  interviewers: InterviewerOption[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([]);
  const [mode, setMode] = useState("HUMAN");

  const toggleInterviewer = (id: string) => {
    setSelectedInterviewerIds(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 6) return prev; // Limit to 6 panelists
      return [...prev, id];
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("positionId", positionId);
    
    // Pass the panelist array as comma separated IDs for the backend to parse
    formData.append("interviewerIds", selectedInterviewerIds.join(","));

    const res = await scheduleInterviewAction(formData);
    
    setIsSubmitting(false);
    
    if (res.success) {
      setIsOpen(false);
      router.refresh(); // Refresh the data in the tabs
    } else {
      setError(res.error || "Failed to schedule interview");
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="rounded-xl shadow-md shadow-teal-600/20 bg-teal-600 hover:bg-teal-700 text-white border-transparent hover:-translate-y-0.5 transition-transform"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
        Schedule Interview
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Schedule New Interview">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 text-sm bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:border-red-900/30 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5">Candidate (Resume)</label>
            <select
              required
              name="resumeId"
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            >
              <option value="" disabled className="dark:bg-zinc-800">Select candidate...</option>
              {resumes.map(r => (
                <option key={r.id} value={r.id} className="dark:bg-zinc-800">
                  {r.name} {r.email ? `(${r.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5">Interview Mode</label>
            <div className="flex gap-4 p-1 bg-gray-100/50 dark:bg-zinc-900/50 rounded-xl border border-gray-200/60 dark:border-zinc-800/60">
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="mode" value="HUMAN" checked={mode === "HUMAN"} onChange={() => setMode("HUMAN")} className="sr-only" />
                <div className={`text-center py-2 text-sm font-semibold rounded-lg transition-colors ${mode === "HUMAN" ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                  Human
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="mode" value="AI_AVATAR" checked={mode === "AI_AVATAR"} onChange={() => setMode("AI_AVATAR")} className="sr-only" />
                <div className={`text-center py-2 text-sm font-semibold rounded-lg transition-colors ${mode === "AI_AVATAR" ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                  AI Avatar
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5 flex items-center justify-between">
              <span>Panel Members</span>
              <span className="text-[10px] text-gray-500 font-normal border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-0.5 shadow-sm">
                Max 6
              </span>
            </label>
            
            {mode === "AI_AVATAR" ? (
              <div className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-gray-500 dark:text-zinc-400">
                System (AI Host)
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      toggleInterviewer(val);
                      e.target.value = ""; // reset
                    }
                  }}
                  defaultValue=""
                  className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition disabled:opacity-50"
                  disabled={selectedInterviewerIds.length >= 6}
                >
                  <option value="" disabled className="dark:bg-zinc-800">
                    {selectedInterviewerIds.length >= 6 ? "Panel Full (Max 6 reached)" : "Add interviewer..."}
                  </option>
                  {interviewers.filter(u => !selectedInterviewerIds.includes(u.id)).map(u => (
                     <option key={u.id} value={u.id} className="dark:bg-zinc-800">{u.name || u.email}</option>
                  ))}
                </select>

                {/* Selected Chips */}
                {selectedInterviewerIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedInterviewerIds.map(id => {
                      const u = interviewers.find(x => x.id === id);
                      if (!u) return null;
                      return (
                        <div key={id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full text-xs font-semibold text-gray-800 dark:text-gray-200 shadow-sm animate-in zoom-in-50 duration-150">
                          <span className="w-4 h-4 rounded-full bg-teal-500 text-white flex items-center justify-center text-[8px] shrink-0">
                            {u.name?.charAt(0) || u.email.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[120px]">{u.name || u.email}</span>
                          <button 
                            type="button" 
                            onClick={() => toggleInterviewer(id)}
                            className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5">Title</label>
            <input
              required
              type="text"
              name="title"
              placeholder="e.g. Technical Screen with John"
              className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5">Date & Time</label>
                <input
                  required
                  type="datetime-local"
                  name="scheduledAt"
                  className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
             </div>
             <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5">Duration (mins)</label>
                <input
                  required
                  type="number"
                  name="duration"
                  defaultValue="60"
                  min="15"
                  step="15"
                  className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
             </div>
          </div>

          {mode === "HUMAN" && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1.5">Meeting Link</label>
              <input
                type="url"
                name="externalLink"
                placeholder="https://zoom.us/j/123456789"
                className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
              <p className="mt-1.5 text-[10px] text-gray-500 dark:text-zinc-500">Provide an external link (Zoom, Google Meet) for the interview.</p>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl shadow-md bg-teal-600 hover:bg-teal-700 text-white">
              {isSubmitting ? "Scheduling..." : "Schedule Interview"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
