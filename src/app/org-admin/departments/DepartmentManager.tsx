"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { createDepartment, deleteDepartment } from "./actions";

type DepartmentWithCount = {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number };
};

export function DepartmentManager({ initialDepartments }: { initialDepartments: DepartmentWithCount[] }) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [newDeptName, setNewDeptName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    
    setCreating(true);
    setError(null);
    
    const formData = new FormData();
    formData.set("name", newDeptName);
    
    const result = await createDepartment(formData);
    
    if (result.success) {
      setNewDeptName("");
      // Real mutation is happening server side, we just revalidatePath, but doing optimistic UI here is overkill, we'll let nextjs revalidate and we'd ideally refresh. 
      // For a simple UX, window.location.reload() or router.refresh() works. 
      window.location.reload(); 
    } else {
      setError(result.error);
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the "${name}" department?`)) return;
    
    setError(null);
    const result = await deleteDepartment(id);
    
    if (result.success) {
      setDepartments(prev => prev.filter(d => d.id !== id));
    } else {
      alert(result.error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Create Form */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Create New Department</h3>
        <form onSubmit={handleCreate} className="flex gap-3">
          <Input 
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="e.g. Engineering, Sales, QA"
            className="max-w-md bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800"
            disabled={creating}
          />
          <Button type="submit" disabled={creating || !newDeptName.trim()}>
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create
          </Button>
        </form>
        {error && <p className="text-sm text-red-500 mt-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> {error}</p>}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" />
            Active Departments
          </h3>
        </div>
        
        {departments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No departments found. Create one above.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{dept.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    {dept._count.users} members assigned
                  </p>
                </div>
                
                <button
                  onClick={() => handleDelete(dept.id, dept.name)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="Delete department"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
