"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Target,
  Mic,
  Briefcase,
  Shield,
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Check,
  UserCircle,
  Truck,
} from "lucide-react";
import { getRank } from "@/lib/rbac-shared";

type Member = {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  departments: { id: string; name: string }[];
  createdAt: string;
};

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
  { value: "PUBLIC_CANDIDATE", label: "Candidate", icon: UserCircle, color: "gray" },
] as const;


const PILL_COLORS: Record<string, string> = {
  indigo: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  purple: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  teal: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  amber: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  orange: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  gray: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700",
};

const EDIT_PILL: Record<string, { active: string; inactive: string }> = {
  indigo: {
    active: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
    inactive: "bg-transparent text-gray-400 dark:text-zinc-600 border-gray-200 dark:border-zinc-700 hover:text-gray-600 dark:hover:text-zinc-400",
  },
  purple: {
    active: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    inactive: "bg-transparent text-gray-400 dark:text-zinc-600 border-gray-200 dark:border-zinc-700 hover:text-gray-600 dark:hover:text-zinc-400",
  },
  teal: {
    active: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700",
    inactive: "bg-transparent text-gray-400 dark:text-zinc-600 border-gray-200 dark:border-zinc-700 hover:text-gray-600 dark:hover:text-zinc-400",
  },
  amber: {
    active: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    inactive: "bg-transparent text-gray-400 dark:text-zinc-600 border-gray-200 dark:border-zinc-700 hover:text-gray-600 dark:hover:text-zinc-400",
  },
  orange: {
    active: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    inactive: "bg-transparent text-gray-400 dark:text-zinc-600 border-gray-200 dark:border-zinc-700 hover:text-gray-600 dark:hover:text-zinc-400",
  },
  gray: {
    active: "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-300 dark:border-zinc-600",
    inactive: "bg-transparent text-gray-400 dark:text-zinc-600 border-gray-200 dark:border-zinc-700 hover:text-gray-600 dark:hover:text-zinc-400",
  },
};

function getRoleInfo(value: string) {
  return ROLES.find((r) => r.value === value) || { value, label: value, icon: UserCircle, color: "gray" };
}

export function TeamMembersTable({
  members: initialMembers,
  departments,
  assignableRoles,
  scopedDeptIds,
  callerUserId,
  callerRoles,
  updateMemberAction,
  removeMemberAction,
}: {
  members: Member[];
  departments: Department[];
  assignableRoles: string[];
  scopedDeptIds: string[] | null;
  callerUserId: string;
  callerRoles: string[];
  updateMemberAction: (userId: string, roles: string[], deptIds: string[]) => Promise<{ success: boolean; error?: string }>;
  removeMemberAction: (userId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editDepts, setEditDepts] = useState<string[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(member: Member) {
    setEditingId(member.id);
    setEditRoles([...member.roles]);
    setEditDepts(member.departments.map((d) => d.id));
    setMenuOpenId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditRoles([]);
    setEditDepts([]);
  }

  async function saveEdit(memberId: string) {
    setSaving(true);
    const result = await updateMemberAction(memberId, editRoles, editDepts);
    setSaving(false);

    if (result.success) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                roles: editRoles,
                departments: departments.filter((d) => editDepts.includes(d.id)),
              }
            : m
        )
      );
      setEditingId(null);
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("Are you sure you want to remove this member from the organization?")) return;
    setMenuOpenId(null);

    const result = await removeMemberAction(memberId);
    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  if (members.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm p-8 text-center">
        <p className="text-sm text-gray-500 dark:text-zinc-500">No team members yet. Send invites above to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Team Members</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-500">{members.length} member{members.length !== 1 ? "s" : ""} in your organization</p>
        </div>
      </div>

      {/* Member Rows */}
      <div className="divide-y divide-gray-100 dark:divide-zinc-800">
        {members.map((member) => {
          const isEditing = editingId === member.id;
          const isOutOfScope = scopedDeptIds !== null && member.departments.length > 0 && !member.departments.some(d => scopedDeptIds.includes(d.id));
          const isSelf = member.id === callerUserId;
          const callerOutranked = getRank(member.roles) >= getRank(callerRoles);
          const canModify = !isSelf && !callerOutranked && !isOutOfScope;

          return (
            <div key={member.id} className={`px-6 py-4 transition-colors ${isEditing ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""} ${isOutOfScope || callerOutranked ? "opacity-50" : ""}`}>
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                {/* Avatar + Info */}
                <div className="flex items-center gap-3 min-w-[240px]">
                  <div className="w-9 h-9 shrink-0 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-gray-500 dark:text-zinc-400">
                    {(member.name || member.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {member.name || member.email}
                    </p>
                    {member.name && (
                      <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{member.email}</p>
                    )}
                  </div>
                </div>

                {/* Roles */}
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {isEditing
                    ? ROLES.filter(r => assignableRoles.includes(r.value) || member.roles.includes(r.value)).map((role) => {
                        const selected = editRoles.includes(role.value);
                        const colors = EDIT_PILL[role.color];
                        const Icon = role.icon;
                        return (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() =>
                              setEditRoles((prev) =>
                                prev.includes(role.value)
                                  ? prev.filter((r) => r !== role.value)
                                  : [...prev, role.value]
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                              selected ? colors.active : colors.inactive
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {role.label}
                          </button>
                        );
                      })
                    : member.roles.map((roleValue) => {
                        const role = getRoleInfo(roleValue);
                        const Icon = role.icon;
                        return (
                          <span
                            key={roleValue}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${PILL_COLORS[role.color]}`}
                          >
                            <Icon className="w-3 h-3" />
                            {role.label}
                          </span>
                        );
                      })}
                </div>

                {/* Departments */}
                {!isEditing && member.departments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {member.departments.map((dept) => (
                      <span
                        key={dept.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                      >
                        <Building2 className="w-2.5 h-2.5" />
                        {dept.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Edit mode: Department toggles */}
                {isEditing && (scopedDeptIds === null ? departments : departments.filter(d => scopedDeptIds.includes(d.id))).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const availableDepts = scopedDeptIds === null 
                        ? departments 
                        : departments.filter(d => scopedDeptIds.includes(d.id) || editDepts.includes(d.id));
                      
                      const allSelected = availableDepts.length > 0 && availableDepts.every(d => editDepts.includes(d.id));

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (allSelected) {
                                // Deselect all available
                                setEditDepts(prev => prev.filter(id => !availableDepts.find(d => d.id === id)));
                              } else {
                                // Select all available
                                const newIds = new Set([...editDepts, ...availableDepts.map(d => d.id)]);
                                setEditDepts(Array.from(newIds));
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${
                              allSelected
                                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                                : "bg-transparent text-gray-400 dark:text-zinc-600 border-gray-200 dark:border-zinc-700"
                            }`}
                          >
                            All
                          </button>
                          
                          {availableDepts.map((dept) => {
                            const selected = editDepts.includes(dept.id);
                            return (
                              <button
                                key={dept.id}
                                type="button"
                                onClick={() =>
                                  setEditDepts((prev) =>
                                    prev.includes(dept.id) ? prev.filter((d) => d !== dept.id) : [...prev, dept.id]
                                  )
                                }
                                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
                                  selected
                                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                                    : "bg-transparent text-gray-400 dark:text-zinc-600 border-gray-200 dark:border-zinc-700"
                                }`}
                              >
                                {dept.name}
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveEdit(member.id)}
                        disabled={saving || editRoles.length === 0}
                        className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : canModify ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === member.id ? null : member.id)}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {menuOpenId === member.id && (
                        <div className="absolute right-0 top-8 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg py-1 w-40">
                          <button
                            type="button"
                            onClick={() => startEdit(member)}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit Roles
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMember(member.id)}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
