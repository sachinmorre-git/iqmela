"use client";

import { useTransition, useState } from "react";
import { sendTeamInvite } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Target,
  Mic,
  Briefcase,
  Shield,
  Truck,
  Plus,
  Send,
  X,
  Loader2,
} from "lucide-react";
import { DepartmentDropdown } from "./DepartmentDropdown";

type Department = {
  id: string;
  name: string;
};

const ROLES = [
  { value: "RECRUITER", label: "Recruiter", icon: Target, color: "indigo" },
  { value: "B2B_INTERVIEWER", label: "Interviewer", icon: Mic, color: "purple" },
  { value: "HIRING_MANAGER", label: "Hiring Mgr", icon: Briefcase, color: "teal" },
  { value: "DEPT_ADMIN", label: "Dept Admin", icon: Shield, color: "amber" },
  { value: "ORG_ADMIN", label: "Org Admin", icon: Shield, color: "amber" },
  { value: "VENDOR", label: "Vendor", icon: Truck, color: "orange" },
] as const;


const PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  indigo: {
    active: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
    inactive: "bg-transparent text-gray-500 dark:text-zinc-500 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300",
  },
  purple: {
    active: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    inactive: "bg-transparent text-gray-500 dark:text-zinc-500 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300",
  },
  teal: {
    active: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700",
    inactive: "bg-transparent text-gray-500 dark:text-zinc-500 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300",
  },
  amber: {
    active: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    inactive: "bg-transparent text-gray-500 dark:text-zinc-500 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300",
  },
  orange: {
    active: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    inactive: "bg-transparent text-gray-500 dark:text-zinc-500 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300",
  },
};

type InviteRow = {
  id: string;
  email: string;
  roles: string[];
  deptIds: string[];
  status: "idle" | "sending" | "sent" | "error";
  message: string;
};

function createRow(): InviteRow {
  return {
    id: crypto.randomUUID(),
    email: "",
    roles: [],
    deptIds: [],
    status: "idle",
    message: "",
  };
}

export function InviteMemberForm({ 
  departments,
  assignableRoles,
  scopedDeptIds,
  canCreateDept
}: { 
  departments: Department[];
  assignableRoles: string[];
  scopedDeptIds: string[] | null;
  canCreateDept: boolean;
}) {
  const [rows, setRows] = useState<InviteRow[]>([createRow()]);

  function updateRow(id: string, patch: Partial<InviteRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function toggleRole(id: string, role: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const roles = r.roles.includes(role)
          ? r.roles.filter((v) => v !== role)
          : [...r.roles, role];
        return { ...r, roles };
      })
    );
  }

  function setDepts(id: string, deptIds: string[]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, deptIds } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, createRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }

  /**
   * Vercel-style bulk paste handler.
   * If the user pastes text containing commas, semicolons, newlines, or spaces
   * separating multiple emails, auto-expand into individual invite rows.
   * Single email paste works normally (falls through to default behavior).
   */
  function handlePaste(rowId: string, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text/plain").trim();
    if (!pasted) return;

    // Split by comma, semicolon, newline, or whitespace
    const emails = pasted
      .split(/[,;\n\r\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && isValidEmail(s));

    // Only intercept if multiple valid emails detected
    if (emails.length <= 1) return;

    e.preventDefault(); // Block default paste

    // De-duplicate against existing rows
    const existingEmails = new Set(rows.map((r) => r.email.toLowerCase()));
    const newEmails = emails.filter((em) => !existingEmails.has(em));

    if (newEmails.length === 0) return;

    setRows((prev) => {
      // Find the current row — if empty, use it for the first email
      const currentRow = prev.find((r) => r.id === rowId);
      const isCurrentEmpty = !currentRow?.email;

      let updated = [...prev];

      if (isCurrentEmpty && currentRow) {
        // Use the current empty row for the first email
        updated = updated.map((r) =>
          r.id === rowId ? { ...r, email: newEmails[0] } : r
        );
        // Add new rows for the rest
        const additionalRows = newEmails.slice(1).map((email) => ({
          ...createRow(),
          email,
        }));
        updated = [...updated, ...additionalRows];
      } else {
        // Current row has text — add ALL as new rows
        const additionalRows = newEmails.map((email) => ({
          ...createRow(),
          email,
        }));
        updated = [...updated, ...additionalRows];
      }

      return updated;
    });
  }

  async function sendInvite(row: InviteRow) {
    if (!row.email || row.roles.length === 0) return;

    updateRow(row.id, { status: "sending", message: "" });

    const formData = new FormData();
    formData.set("email", row.email);
    row.roles.forEach((role) => formData.set(`role_${role}`, "on"));
    row.deptIds.forEach((id) => formData.set(`dept_${id}`, "on"));

    const result = await sendTeamInvite(formData);

    if (result.success) {
      updateRow(row.id, { status: "sent", message: result.message! });
    } else {
      updateRow(row.id, { status: "error", message: result.error! });
    }
  }

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm mb-8">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <UserPlus className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Invite Team Members</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Add people to your organization — assign roles and departments inline</p>
          </div>
        </div>
      </div>

      {/* Invite Rows */}
      <div className="divide-y divide-gray-100 dark:divide-zinc-800">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className={`px-6 py-5 transition-colors duration-300 ${
              row.status === "sent"
                ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                : row.status === "error"
                ? "bg-rose-50/50 dark:bg-rose-950/20"
                : ""
            }`}
          >
            {/* Main Row: Email + Roles + Send */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              {/* Email */}
              <div className="flex items-center gap-3 w-full lg:w-auto lg:min-w-[280px]">
                <div
                  className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                    row.status === "sent"
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                      : isValidEmail(row.email)
                      ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-600"
                  }`}
                >
                  {row.status === "sent" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    row.email ? row.email.charAt(0).toUpperCase() : "?"
                  )}
                </div>
                <Input
                  type="email"
                  placeholder="colleague@company.com — or paste multiple"
                  value={row.email}
                  onChange={(e) => updateRow(row.id, { email: e.target.value, status: "idle", message: "" })}
                  onPaste={(e) => handlePaste(row.id, e as React.ClipboardEvent<HTMLInputElement>)}
                  disabled={row.status === "sent" || row.status === "sending"}
                  className="flex-1 bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-sm py-2"
                />
              </div>

              {/* Role Pills */}
              <div className="flex flex-wrap gap-1.5 flex-1">
                {ROLES.filter((r) => assignableRoles.includes(r.value)).map((role) => {
                  const selected = row.roles.includes(role.value);
                  const colors = PILL_COLORS[role.color];
                  const Icon = role.icon;
                  const disabled = row.status === "sent" || row.status === "sending";

                  return (
                    <button
                      key={role.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleRole(row.id, role.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                        selected ? colors.active : colors.inactive
                      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <Icon className="w-3 h-3" />
                      {role.label}
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <DepartmentDropdown 
                  departments={departments}
                  selectedIds={row.deptIds}
                  onChange={(ids) => setDepts(row.id, ids)}
                  scopedDeptIds={scopedDeptIds}
                  canCreateDept={canCreateDept}
                  disabled={row.status === "sent" || row.status === "sending"}
                />

                {/* Send Button */}
                {row.status === "sent" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-3 py-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!isValidEmail(row.email) || row.roles.length === 0 || row.status === "sending"}
                    onClick={() => sendInvite(row)}
                    className="gap-1.5 px-4 py-1.5 text-xs h-auto"
                  >
                    {row.status === "sending" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {row.status === "sending" ? "Sending" : "Send"}
                  </Button>
                )}

                {/* Remove Row */}
                {rows.length > 1 && row.status !== "sending" && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {row.status === "error" && (
              <div className="mt-3 ml-12 flex items-center gap-2 text-xs text-red-600 dark:text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {row.message}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer: Add Row + Bulk Send */}
      <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add another member
        </button>

        {rows.filter((r) => r.status === "idle" && isValidEmail(r.email) && r.roles.length > 0).length > 1 && (
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              const ready = rows.filter(
                (r) => r.status === "idle" && isValidEmail(r.email) && r.roles.length > 0
              );
              for (const row of ready) {
                await sendInvite(row);
              }
            }}
            className="gap-2 px-5 py-1.5 text-xs h-auto"
          >
            <Send className="w-3.5 h-3.5" />
            Send All Invites ({rows.filter((r) => r.status === "idle" && isValidEmail(r.email) && r.roles.length > 0).length})
          </Button>
        )}
      </div>
    </div>
  );
}
