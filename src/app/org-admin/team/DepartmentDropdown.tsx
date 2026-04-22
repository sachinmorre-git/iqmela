"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check, Plus, Loader2, Search } from "lucide-react";
import { createDepartment } from "@/app/org-admin/departments/actions";

type Department = {
  id: string;
  name: string;
};

export function DepartmentDropdown({
  departments,
  selectedIds,
  onChange,
  disabled,
  scopedDeptIds,
  canCreateDept,
}: {
  departments: Department[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  scopedDeptIds: string[] | null;
  canCreateDept: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableDepts = !scopedDeptIds
    ? departments
    : departments.filter((d) => scopedDeptIds.includes(d.id));

  const filteredDepts = search.trim()
    ? availableDepts.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : availableDepts;

  const exactMatchExists = availableDepts.some(
    (d) => d.name.toLowerCase() === search.trim().toLowerCase()
  );

  const showCreateBtn = canCreateDept && search.trim().length > 0 && !exactMatchExists;

  const toggleDept = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((v) => v !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleCreate = async () => {
    if (!search.trim() || isCreating) return;
    setIsCreating(true);

    try {
      const formData = new FormData();
      formData.set("name", search.trim());
      const res = await createDepartment(formData);
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error);
      }
    } catch (e) {
      alert("Failed to create department");
    } finally {
      setIsCreating(false);
    }
  };

  // DEPT_ADMINs with no departments assigned: hide the button entirely
  if (availableDepts.length === 0 && !canCreateDept) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setSearch("");
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          isOpen || selectedIds.length > 0
            ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
            : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[80px] truncate">
          {selectedIds.length === 0
            ? "Departments"
            : selectedIds.length === 1
            ? departments.find((d) => d.id === selectedIds[0])?.name || "1 Selected"
            : `${selectedIds.length} Selected`}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xl z-50">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search or create..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showCreateBtn) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Department List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredDepts.length > 0 ? (
              <div className="p-1">
                {filteredDepts.map((dept) => {
                  const isSelected = selectedIds.includes(dept.id);
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => toggleDept(dept.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-lg transition-colors ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                          : "text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/70"
                      }`}
                    >
                      <span className="truncate">{dept.name}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="px-3 py-4 text-xs text-center text-gray-400 dark:text-zinc-500">
                {search.trim() ? "No matching departments" : "No departments yet"}
              </p>
            )}
          </div>

          {/* Create New Department */}
          {showCreateBtn && (
            <div className="border-t border-gray-100 dark:border-zinc-800 p-1.5 bg-gray-50/80 dark:bg-zinc-950/80 rounded-b-xl">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Create &ldquo;{search.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
