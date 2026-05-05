"use client";

import { useState } from "react";
import { Link as LinkIcon, Check, Copy } from "lucide-react";

/**
 * Client component for the "Generate My Link" referral bounty button.
 * Generates a unique referral URL with the user's encoded email or a random token,
 * and copies it to the clipboard.
 */
export function ReferralLinkButton({ positionId }: { positionId: string }) {
  const [copied, setCopied] = useState(false);
  const [referralUrl, setReferralUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    // Generate a simple referral token (client-side for now)
    const token = crypto.randomUUID().slice(0, 8);
    const appUrl = window.location.origin;
    const url = `${appUrl}/careers/${positionId}?ref=${token}`;
    
    setReferralUrl(url);
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback: prompt user to copy manually
    }
  };

  if (referralUrl) {
    return (
      <div className="flex flex-col gap-2 w-full md:w-auto">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-800/30 border border-teal-600/30 text-sm">
          <span className="text-teal-300 truncate max-w-[200px] text-xs font-mono">
            {referralUrl}
          </span>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(referralUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              } catch {}
            }}
            className="shrink-0 p-1.5 rounded-lg hover:bg-teal-700/30 transition-colors"
            title="Copy link"
          >
            {copied ? (
              <Check className="w-4 h-4 text-teal-400" />
            ) : (
              <Copy className="w-4 h-4 text-teal-400" />
            )}
          </button>
        </div>
        {copied && (
          <span className="text-xs text-teal-400 font-medium animate-in fade-in">
            ✓ Copied to clipboard!
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      className="shrink-0 rounded-xl shadow-lg shadow-teal-600/20 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all flex items-center gap-2 w-full md:w-auto justify-center"
    >
      <LinkIcon className="w-4 h-4" /> Generate My Link
    </button>
  );
}
