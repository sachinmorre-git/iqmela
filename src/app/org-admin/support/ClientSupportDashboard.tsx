"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Clock, MessageCircle, AlertCircle, Plus, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createSupportTicket } from "./actions";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
  _count: { messages: number };
}

export function ClientSupportDashboard({ initialTickets }: { initialTickets: Ticket[] }) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    priority: "MEDIUM" as const,
    category: "OTHER" as const
  });

  const handleSubmit = () => {
    if (!newTicket.subject || !newTicket.description) return;
    startTransition(async () => {
      await createSupportTicket(newTicket);
      setShowForm(false);
      setNewTicket({ subject: "", description: "", priority: "MEDIUM", category: "OTHER" });
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'text-blue-400 bg-blue-400/10';
      case 'IN_PROGRESS': return 'text-amber-400 bg-amber-400/10';
      case 'WAITING_ON_CLIENT': return 'text-violet-400 bg-violet-400/10';
      case 'RESOLVED': return 'text-emerald-400 bg-emerald-400/10';
      case 'CLOSED': return 'text-zinc-400 bg-zinc-800';
      default: return 'text-zinc-400 bg-zinc-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">Your Support Cases</h2>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Open New Case"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-zinc-900/50 border border-rose-500/30 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white mb-4">Open a New Support Case</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Subject</label>
              <input 
                type="text"
                value={newTicket.subject}
                onChange={e => setNewTicket(p => ({ ...p, subject: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-rose-500/30"
                placeholder="Brief summary of the issue..."
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Category</label>
              <select 
                value={newTicket.category}
                onChange={e => setNewTicket(p => ({ ...p, category: e.target.value as any }))}
                className="w-full px-4 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                <option value="OTHER">General Inquiry</option>
                <option value="BILLING">Billing & Plans</option>
                <option value="TECHNICAL">Technical Issue / Bug</option>
                <option value="INTEGRATION">Vendor Integrations</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea 
              value={newTicket.description}
              onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))}
              rows={4}
              className="w-full px-4 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
              placeholder="Please provide as much detail as possible..."
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleSubmit} 
              disabled={isPending || !newTicket.subject || !newTicket.description}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Submit Case
            </Button>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        {initialTickets.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">You haven't opened any support cases yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Ticket ID</th>
                <th className="px-6 py-4 font-semibold">Subject</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {initialTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-bold text-white">{ticket.ticketNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-zinc-300 max-w-[300px] truncate block">{ticket.subject}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDistanceToNow(new Date(ticket.createdAt))} ago
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/org-admin/support/${ticket.id}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-300 hover:text-white transition-colors text-xs font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
