"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Send, Clock, User, Building, AlertCircle } from "lucide-react";
import { addClientTicketMessage } from "../actions";
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
  createdAt: Date;
  resolvedAt: Date | null;
  createdBy: { name: string | null; email: string };
  messages: Message[];
}

export function ClientTicketChat({ ticket }: { ticket: TicketData }) {
  const [replyText, setReplyText] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    if (!replyText.trim()) return;
    startTransition(async () => {
      await addClientTicketMessage(ticket.id, replyText);
      setReplyText("");
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
          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getStatusColor(ticket.status)}`}>
            {ticket.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Initial Description */}
          <div className="flex flex-col gap-1 items-end">
            <div className="flex items-center gap-2 text-xs text-zinc-500 mr-1">
              <span className="font-semibold text-zinc-400">You</span>
              <span>reported this {formatDistanceToNow(new Date(ticket.createdAt))} ago</span>
            </div>
            <div className="bg-rose-600 border border-rose-500 rounded-2xl rounded-tr-sm px-5 py-3 text-sm text-white max-w-[85%] whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>

          {ticket.messages.filter(m => !m.isInternalNote).map((msg) => {
            const isMe = !msg.sender.roles.includes("ADMIN") && !msg.sender.roles.includes("INTERNAL_SUPPORT");

            return (
              <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-2 text-xs text-zinc-500 ${isMe ? 'mr-1' : 'ml-1'}`}>
                  <span className="font-semibold text-zinc-400">{isMe ? 'You' : 'IQMela Support'}</span>
                  <span>{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
                </div>
                <div className={`px-5 py-3 text-sm max-w-[85%] whitespace-pre-wrap ${
                  isMe 
                    ? 'bg-rose-600 border border-rose-500 text-white rounded-2xl rounded-tr-sm' 
                    : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 rounded-2xl rounded-tl-sm'
                }`}>
                  {msg.messageText}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply Box */}
        {(ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') ? (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/80">
            <div className="relative">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here..."
                rows={3}
                className="w-full p-4 pr-16 rounded-xl border border-zinc-700 bg-zinc-950 text-sm text-white resize-none outline-none focus:ring-2 focus:ring-rose-500/30 transition-shadow placeholder:text-zinc-600"
              />
              <Button
                onClick={handleSend}
                disabled={!replyText.trim() || isPending}
                size="icon"
                className="absolute bottom-3 right-3 rounded-lg bg-rose-600 hover:bg-rose-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 text-center">
            <p className="text-sm text-zinc-500">This ticket has been marked as resolved.</p>
          </div>
        )}
      </div>

      {/* ── Right Pane: Context ── */}
      <div className="space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-zinc-400" /> Ticket Details
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Priority</p>
              <span className="text-[10px] font-bold border tracking-wider px-2 py-0.5 rounded text-zinc-300 bg-zinc-800 border-zinc-700">
                {ticket.priority}
              </span>
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500">Opened On</p>
              <p className="text-sm text-zinc-300">{format(new Date(ticket.createdAt), "PPp")}</p>
            </div>
            {ticket.resolvedAt && (
              <div>
                <p className="text-xs text-emerald-500">Resolved On</p>
                <p className="text-sm text-zinc-300">{format(new Date(ticket.resolvedAt), "PPp")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
