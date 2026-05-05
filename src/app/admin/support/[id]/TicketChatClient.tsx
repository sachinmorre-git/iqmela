"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Send, EyeOff, CheckCircle, Clock, User, Building, AlertCircle } from "lucide-react";
import { addTicketMessage, updateTicketStatus } from "../actions";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  messageText: string;
  isInternalNote: boolean;
  createdAt: Date;
  sender: {
    id: string;
    name: string | null;
    email: string;
    roles: string[];
  };
}

interface TicketData {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: Date;
  resolvedAt: Date | null;
  organization: { name: string; domain: string | null; planTier: string | null };
  createdBy: { name: string | null; email: string };
  assignedTo: { name: string | null } | null;
  messages: Message[];
}

export function TicketChatClient({ ticket }: { ticket: TicketData }) {
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    if (!replyText.trim()) return;
    startTransition(async () => {
      await addTicketMessage(ticket.id, replyText, isInternal);
      setReplyText("");
    });
  };

  const handleStatusChange = (newStatus: "OPEN" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "RESOLVED" | "CLOSED") => {
    startTransition(async () => {
      await updateTicketStatus(ticket.id, newStatus);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[80vh]">
      {/* ── Left Pane: Communication Thread ── */}
      <div className="lg:col-span-2 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {ticket.ticketNumber}
            </h2>
            <p className="text-sm text-zinc-400">{ticket.subject}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value as any)}
              disabled={isPending}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border outline-none ${
                ticket.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                ticket.status === 'WAITING_ON_CLIENT' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_ON_CLIENT">Waiting on Client</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Initial Description */}
          <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-2 text-xs text-zinc-500 ml-1">
              <span className="font-semibold text-zinc-400">{ticket.createdBy.name || ticket.createdBy.email}</span>
              <span>reported this issue {formatDistanceToNow(new Date(ticket.createdAt))} ago</span>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl rounded-tl-sm px-5 py-3 text-sm text-zinc-300 max-w-[85%] whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>

          {ticket.messages.map((msg) => {
            const isAdmin = msg.sender.roles.includes("ADMIN") || msg.sender.roles.includes("INTERNAL_SUPPORT");
            
            if (msg.isInternalNote) {
              return (
                <div key={msg.id} className="flex flex-col gap-1 items-center my-4">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-xs text-amber-200/80 max-w-[70%] flex items-start gap-2">
                    <EyeOff className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <strong className="text-amber-500 block mb-0.5">{msg.sender.name || 'Admin'} (Internal Note)</strong>
                      <span className="whitespace-pre-wrap">{msg.messageText}</span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 text-xs text-zinc-500 ${isAdmin ? 'mr-1' : 'ml-1'}`}>
                  <span className="font-semibold text-zinc-400">{msg.sender.name || msg.sender.email}</span>
                  <span>{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
                </div>
                <div className={`px-5 py-3 text-sm max-w-[85%] whitespace-pre-wrap ${
                  isAdmin 
                    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                    : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 rounded-2xl rounded-tl-sm'
                }`}>
                  {msg.messageText}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply Box */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-4 mb-3">
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/30"
              />
              <EyeOff className="w-4 h-4" />
              Internal Note (Hidden from Client)
            </label>
          </div>
          <div className="relative">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={isInternal ? "Type a private note for the team..." : "Type your reply to the client..."}
              rows={3}
              className={`w-full p-4 pr-16 rounded-xl border bg-zinc-950 text-sm text-white resize-none outline-none focus:ring-2 transition-shadow ${
                isInternal 
                  ? 'border-amber-500/30 focus:ring-amber-500/20 placeholder:text-amber-500/30' 
                  : 'border-zinc-700 focus:ring-blue-500/30 placeholder:text-zinc-600'
              }`}
            />
            <Button
              onClick={handleSend}
              disabled={!replyText.trim() || isPending}
              size="icon"
              className={`absolute bottom-3 right-3 rounded-lg ${
                isInternal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Right Pane: Context ── */}
      <div className="space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Building className="w-4 h-4 text-zinc-400" /> Organization Details
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Name</p>
              <p className="text-sm font-medium text-white">{ticket.organization.name}</p>
            </div>
            {ticket.organization.domain && (
              <div>
                <p className="text-xs text-zinc-500">Domain</p>
                <p className="text-sm text-zinc-300">{ticket.organization.domain}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500">Plan Tier</p>
              <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                {ticket.organization.planTier || 'FREE'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-zinc-400" /> Ticket Metadata
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Priority</p>
              <span className="text-[10px] font-bold border tracking-wider px-2 py-0.5 rounded text-zinc-300 bg-zinc-800 border-zinc-700">
                {ticket.priority}
              </span>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Category</p>
              <span className="text-[10px] font-bold border tracking-wider px-2 py-0.5 rounded text-zinc-300 bg-zinc-800 border-zinc-700">
                {ticket.category}
              </span>
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500">Created</p>
              <p className="text-sm text-zinc-300">{format(new Date(ticket.createdAt), "PPp")}</p>
            </div>
            {ticket.resolvedAt && (
              <div>
                <p className="text-xs text-emerald-500">Resolved</p>
                <p className="text-sm text-zinc-300">{format(new Date(ticket.resolvedAt), "PPp")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
