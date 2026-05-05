"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Clock, Search, MessageCircle, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
  targetResolutionAt: Date | null;
  organization: { name: string; domain: string | null };
  createdBy: { name: string | null; email: string };
  _count: { messages: number };
}

export function SupportDashboardClient({ initialTickets }: { initialTickets: Ticket[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const filteredTickets = initialTickets.filter(t => {
    if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
    if (search && !t.ticketNumber.toLowerCase().includes(search.toLowerCase()) && 
        !t.subject.toLowerCase().includes(search.toLowerCase()) && 
        !t.organization.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'HIGH': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'MEDIUM': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'text-blue-400';
      case 'IN_PROGRESS': return 'text-amber-400';
      case 'WAITING_ON_CLIENT': return 'text-violet-400';
      case 'RESOLVED': return 'text-emerald-400';
      case 'CLOSED': return 'text-zinc-500';
      default: return 'text-zinc-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search tickets by number, subject, or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_ON_CLIENT">Waiting on Client</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No tickets found matching your criteria.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Ticket</th>
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Priority</th>
                <th className="px-6 py-4 font-semibold">Age / SLA</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-white group-hover:text-blue-400 transition-colors">{ticket.ticketNumber}</span>
                      <span className="text-xs text-zinc-400 max-w-[200px] truncate">{ticket.subject}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-200">{ticket.organization.name}</span>
                      <span className="text-[10px] text-zinc-500">{ticket.createdBy.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-semibold text-xs ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
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
                      href={`/admin/support/${ticket.id}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-blue-600 text-zinc-300 hover:text-white transition-colors text-xs font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {ticket._count.messages > 0 ? `${ticket._count.messages} replies` : 'View'}
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
