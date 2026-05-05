"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getAvailablePanelistsAction } from "./pipeline-actions";
import { Loader2, Search, X, Check, Users, BadgeCheck, ShieldCheck } from "lucide-react";

export interface Panelist {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  source: "INTERNAL" | "MARKETPLACE";
  title?: string;
  expertise?: string;
  hourlyRate?: number;
}

interface PanelSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPanelists: Panelist[];
  onSave: (panelists: Panelist[]) => void;
  roundLabel: string;
}

export function PanelSelectionDialog({
  isOpen,
  onClose,
  selectedPanelists,
  onSave,
  roundLabel,
}: PanelSelectionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [internal, setInternal] = useState<Panelist[]>([]);
  const [marketplace, setMarketplace] = useState<Panelist[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"INTERNAL" | "MARKETPLACE">("INTERNAL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Init selection
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(selectedPanelists.map((p) => p.id)));
    }
  }, [isOpen, selectedPanelists]);

  // Fetch data
  useEffect(() => {
    if (isOpen && internal.length === 0 && marketplace.length === 0) {
      setLoading(true);
      getAvailablePanelistsAction().then((res) => {
        if (res.success) {
          setInternal(res.internal || []);
          setMarketplace(res.marketplace || []);
        }
        setLoading(false);
      });
    }
  }, [isOpen, internal.length, marketplace.length]);

  if (!isOpen) return null;

  const currentList = activeTab === "INTERNAL" ? internal : marketplace;
  const filteredList = currentList.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
    (p.expertise && p.expertise.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelection = (panelist: Panelist) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(panelist.id)) {
      newIds.delete(panelist.id);
    } else {
      newIds.add(panelist.id);
    }
    setSelectedIds(newIds);
  };

  const handleSave = () => {
    const all = [...internal, ...marketplace];
    const finalSelection = all.filter((p) => selectedIds.has(p.id));
    onSave(finalSelection);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-[600px] bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Assign Interview Panel
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
              Select interviewers for the <span className="font-bold text-gray-700 dark:text-gray-300">{roundLabel}</span> round.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-sm transition-all hover:scale-105"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-4 border-b border-gray-100 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("INTERNAL")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === "INTERNAL" 
                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-sm"
                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Internal Team
          </button>
          <button
            onClick={() => setActiveTab("MARKETPLACE")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === "MARKETPLACE" 
                ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 shadow-sm"
                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-900"
            }`}
          >
            <BadgeCheck className="w-4 h-4" />
            IQMela Experts
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === "INTERNAL" ? "team members" : "verified experts"}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px] max-h-[400px]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p className="text-sm font-medium">Loading panel directory...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <p className="text-sm font-medium">No results found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredList.map((panelist) => {
                const isSelected = selectedIds.has(panelist.id);
                return (
                  <button
                    key={panelist.id}
                    onClick={() => toggleSelection(panelist)}
                    className={`flex items-center gap-4 w-full p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/50"
                        : "bg-white dark:bg-zinc-950 border-gray-100 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="relative shrink-0">
                      {panelist.avatarUrl ? (
                        <img src={panelist.avatarUrl} alt={panelist.name} className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-zinc-950 shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 border-2 border-white dark:border-zinc-950 shadow-sm flex items-center justify-center font-bold text-gray-500 dark:text-zinc-400 text-lg">
                          {panelist.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-950 flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900 dark:text-white truncate text-sm">
                          {panelist.name}
                        </h4>
                        {panelist.source === "MARKETPLACE" && (
                          <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">Expert</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 truncate mt-0.5">
                        {panelist.source === "MARKETPLACE" ? panelist.expertise || panelist.title : panelist.email}
                      </p>
                    </div>

                    {panelist.source === "MARKETPLACE" && panelist.hourlyRate && (
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-black text-gray-900 dark:text-white">${panelist.hourlyRate}</span>
                        <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">/ hr</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
          <div className="text-sm font-semibold text-gray-500 dark:text-zinc-400">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedIds.size}</span> panelist{selectedIds.size !== 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md transition-all hover:scale-105 active:scale-95"
            >
              Save Panel
            </button>
          </div>
        </div>

      </div>
    </div>
  , document.body);
}
