"use client";

import { useState, useTransition } from "react";
import { acceptInviteById } from "./actions";
import { Building2, CheckCircle2, Loader2, Shield, ArrowRight } from "lucide-react";

type PendingInvite = {
  id: string;
  organizationId: string;
  orgName: string;
  roles: string[];
  createdAt: string;
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ORG_ADMIN: { label: "Org Admin", color: "text-amber-400 bg-amber-400/10 border-amber-500/20" },
  DEPT_ADMIN: { label: "Dept Admin", color: "text-amber-400 bg-amber-400/10 border-amber-500/20" },
  RECRUITER: { label: "Recruiter", color: "text-rose-400 bg-rose-400/10 border-rose-500/20" },
  B2B_INTERVIEWER: { label: "Interviewer", color: "text-purple-400 bg-purple-400/10 border-purple-500/20" },
  HIRING_MANAGER: { label: "Hiring Mgr", color: "text-rose-400 bg-rose-400/10 border-rose-500/20" },
};

export function PendingInviteCard({ invite }: { invite: PendingInvite }) {
  const [isPending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    startTransition(async () => {
      try {
        await acceptInviteById(invite.id);
        setAccepted(true);
      } catch (err) {
        console.error("Failed to accept invite:", err);
      }
    });
  };

  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border transition-all duration-300
        ${accepted
          ? "border-emerald-500/30 bg-emerald-950/20"
          : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:bg-zinc-900"
        }
      `}
    >
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative p-6">
        {/* Org Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 border border-rose-500/20 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">{invite.orgName}</h3>
            <p className="text-sm text-zinc-500 mt-0.5">Pending invitation</p>
          </div>
        </div>

        {/* Roles */}
        <div className="flex flex-wrap gap-2 mt-4">
          {invite.roles.map((role) => {
            const meta = ROLE_LABELS[role] || { label: role, color: "text-zinc-400 bg-zinc-800 border-zinc-700" };
            return (
              <span
                key={role}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${meta.color}`}
              >
                <Shield className="w-3 h-3" />
                {meta.label}
              </span>
            );
          })}
        </div>

        {/* Accept Button */}
        <div className="mt-5">
          {accepted ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Accepted — redirecting...
            </div>
          ) : (
            <button
              onClick={handleAccept}
              disabled={isPending}
              className="
                w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500
                text-white text-sm font-semibold
                transition-all duration-200
                disabled:opacity-60 disabled:cursor-not-allowed
                shadow-lg shadow-rose-500/20
              "
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  Accept Invite
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
