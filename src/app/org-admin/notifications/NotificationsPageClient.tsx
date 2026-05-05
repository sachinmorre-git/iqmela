"use client";

import { useState } from "react";
import { Bell, Check, CheckCheck, Archive, ExternalLink, Filter } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_LABELS: Record<string, string> = {
  OFFER_APPROVED: "Offers",
  OFFER_DECLINED: "Offers",
  OFFER_ACCEPTED: "Offers",
  AI_INTERVIEW_COMPLETED: "Interviews",
  PANEL_FEEDBACK_SUBMITTED: "Interviews",
  INTERVIEW_REMINDER: "Interviews",
  RESUME_UPLOADED: "Candidates",
  CANDIDATE_ADVANCED: "Candidates",
  CANDIDATE_REJECTED: "Candidates",
  BGV_COMPLETED: "Background Check",
  BGV_DISPUTE: "Background Check",
  TEAM_MEMBER_JOINED: "Team",
  POSITION_DISPATCHED: "Positions",
  POLL_COMPLETED: "Scheduling",
  PROCTOR_ALERT: "Proctoring",
  BILLING_THRESHOLD: "Billing",
};

export function NotificationsPageClient({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", notificationId: id }),
    });
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markAllRead" }),
    });
  };

  const handleArchive = async (id: string) => {
    const n = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (n && !n.isRead) setUnreadCount((c) => Math.max(0, c - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", notificationId: id }),
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === "all"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === "unread"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800/60">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">
              We&apos;ll let you know when something happens
            </p>
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`group relative flex gap-4 px-6 py-4 hover:bg-gray-50/80 dark:hover:bg-zinc-900/50 transition-all cursor-pointer ${
                !n.isRead ? "bg-rose-50/30 dark:bg-rose-900/5" : ""
              }`}
              onClick={() => {
                if (!n.isRead) handleMarkRead(n.id);
                if (n.link) window.location.href = n.link;
              }}
            >
              {/* Unread indicator */}
              {!n.isRead && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/30" />
              )}

              {/* Icon */}
              <div className="shrink-0 w-11 h-11 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-lg">
                {n.icon || "🔔"}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-sm leading-snug ${!n.isRead ? "font-bold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-zinc-300"}`}>
                    {n.title}
                  </p>
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    {TYPE_LABELS[n.type] || n.type}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">
                  {n.body}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1.5">
                  {timeAgo(n.createdAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!n.isRead && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleArchive(n.id); }}
                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  title="Archive"
                >
                  <Archive className="w-4 h-4 text-gray-400" />
                </button>
                {n.link && (
                  <button
                    onClick={(e) => { e.stopPropagation(); window.location.href = n.link!; }}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                    title="Open"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
