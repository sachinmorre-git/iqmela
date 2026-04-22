"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type OrgMembership = {
  id: string;
  orgId: string;
  orgName: string;
  orgImageUrl: string | null;
  role: string;
};

export function OrgSelector({ memberships }: { memberships: OrgMembership[] }) {
  const { setActive } = useClerk();
  const router = useRouter();
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleSelect = async (membership: OrgMembership) => {
    setActivatingId(membership.orgId);
    try {
      await setActive({ organization: membership.orgId });
      router.push("/org-admin/dashboard");
    } catch (err) {
      console.error("Failed to set active org:", err);
      setActivatingId(null);
    }
  };

  return (
    <div className="space-y-3 w-full">
      {memberships.map((m) => (
        <button
          key={m.orgId}
          onClick={() => handleSelect(m)}
          disabled={!!activatingId}
          className="
            group w-full flex items-center gap-4 p-4 rounded-xl
            bg-zinc-900/80 border border-zinc-800
            hover:border-zinc-700 hover:bg-zinc-900
            transition-all duration-200
            disabled:opacity-60 disabled:cursor-not-allowed
            text-left
          "
        >
          {/* Org avatar */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0 overflow-hidden">
            {m.orgImageUrl ? (
              <img src={m.orgImageUrl} alt={m.orgName} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Building2 className="w-5 h-5 text-indigo-400" />
            )}
          </div>

          {/* Org info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{m.orgName}</p>
            <p className="text-xs text-zinc-500 mt-0.5 capitalize">
              {m.role.replace("org:", "")}
            </p>
          </div>

          {/* Arrow / Spinner */}
          {activatingId === m.orgId ? (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}
