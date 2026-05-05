"use client";

import { useState, useTransition } from "react";
import {
  Globe, Radio, Pause, XCircle, ExternalLink,
  Eye, MousePointer, FileText, Loader2, Check,
  Copy, CheckCheck, Link2
} from "lucide-react";
import {
  publishPositionAction,
  unpublishPositionAction,
} from "@/app/org-admin/distribution-actions";
import { formatDate, formatNumber } from "@/lib/locale-utils";

interface ChannelInfo {
  id: string;
  boardName: string;
  status: string;
  publishedAt: string | null;
  viewCount: number;
  clickCount: number;
  applicationCount: number;
}

interface DistributionPanelProps {
  positionId: string;
  isPublished: boolean;
  channels: ChannelInfo[];
}

const CHANNEL_META: Record<string, { label: string; icon: string; color: string }> = {
  IQMELA: {
    label: "IQMela Careers",
    icon: "✦",
    color: "#818cf8",
  },
  INDEED: {
    label: "Indeed",
    icon: "🔵",
    color: "#2164f3",
  },
  GOOGLE_JOBS: {
    label: "Google Jobs",
    icon: "🔴",
    color: "#ea4335",
  },
  LINKEDIN: {
    label: "LinkedIn",
    icon: "🔷",
    color: "#0a66c2",
  },
};

export default function DistributionPanel({
  positionId,
  isPublished: initialPublished,
  channels: initialChannels,
}: DistributionPanelProps) {
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [channels, setChannels] = useState(initialChannels);
  const [isPending, startTransition] = useTransition();
  const [linkCopied, setLinkCopied] = useState(false);

  const careersUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/careers/${positionId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(careersUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = careersUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handlePublish = () => {
    startTransition(async () => {
      try {
        await publishPositionAction(positionId);
        setIsPublished(true);
        // Optimistic update for channel cards
        setChannels([
          {
            id: "indeed-temp",
            boardName: "INDEED",
            status: "LIVE",
            publishedAt: new Date().toISOString(),
            viewCount: 0,
            clickCount: 0,
            applicationCount: 0,
          },
          {
            id: "google-temp",
            boardName: "GOOGLE_JOBS",
            status: "LIVE",
            publishedAt: new Date().toISOString(),
            viewCount: 0,
            clickCount: 0,
            applicationCount: 0,
          },
        ]);
      } catch (err) {
        console.error("Publish failed:", err);
      }
    });
  };

  const handleUnpublish = () => {
    startTransition(async () => {
      try {
        await unpublishPositionAction(positionId);
        setIsPublished(false);
        setChannels((prev) =>
          prev.map((c) => ({ ...c, status: "CLOSED" }))
        );
      } catch (err) {
        console.error("Unpublish failed:", err);
      }
    });
  };

  return (
    <div className="bg-gradient-to-br from-[rgba(15,15,25,0.95)] to-[rgba(20,20,35,0.95)] border border-indigo-500/15 rounded-2xl p-4 sm:p-6 mb-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
            <Globe size={20} color="#fff" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white m-0">
              Job Distribution
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 m-0">
              Publish to Indeed &amp; Google Jobs — free, automated
            </p>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      {isPublished && (
        <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-1.5 mb-4 text-xs text-green-500">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live on {channels.filter((c) => c.status === "LIVE").length} channels
        </div>
      )}

      {/* Channel Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* IQMela Native Card — always first */}
        <div className={`rounded-xl p-4 transition-all border ${
          isPublished
            ? "bg-gradient-to-br from-indigo-500/[0.08] to-violet-500/[0.04] border-indigo-500/20"
            : "bg-white/[0.03] border-white/[0.06]"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-black text-sm">✦</span>
              <span className="text-sm font-semibold text-white">
                IQMela Careers
              </span>
            </div>
            <StatusBadge status={isPublished ? "LIVE" : "DRAFT"} />
          </div>

          {/* Copy Link Button */}
          {isPublished && (
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg w-full text-[11px] font-medium cursor-pointer transition-all border ${
                linkCopied
                  ? "bg-green-500/10 border-green-500/20 text-green-500"
                  : "bg-white/5 border-white/[0.08] text-zinc-400 hover:bg-white/[0.08]"
              }`}
            >
              {linkCopied ? <CheckCheck size={12} /> : <Copy size={12} />}
              {linkCopied ? "Link copied!" : "Copy application link"}
            </button>
          )}
        </div>

        {(isPublished ? channels : Object.keys(CHANNEL_META).filter(k => k !== 'IQMELA').map((key) => ({
          id: key,
          boardName: key,
          status: "DRAFT",
          publishedAt: null,
          viewCount: 0,
          clickCount: 0,
          applicationCount: 0,
        }))).map((channel) => {
          const meta = CHANNEL_META[channel.boardName] || {
            label: channel.boardName,
            icon: "📌",
            color: "#888",
          };
          const isLive = channel.status === "LIVE";

          return (
            <div
              key={channel.boardName}
              className={`bg-white/[0.03] rounded-xl p-4 transition-all border ${
                isLive ? "border-white/10" : "border-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="text-sm font-semibold text-white">
                    {meta.label}
                  </span>
                </div>
                <StatusBadge status={channel.status} />
              </div>

              {/* Stats Row */}
              <div className="flex gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Eye size={12} />
                  <span>{formatNumber(channel.viewCount)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MousePointer size={12} />
                  <span>{formatNumber(channel.clickCount)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText size={12} />
                  <span>{formatNumber(channel.applicationCount)}</span>
                </div>
              </div>

              {channel.publishedAt && (
                <p className="text-[11px] text-gray-600 mt-2">
                  Published {formatDate(new Date(channel.publishedAt))}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Feed URLs */}
      {isPublished && (
        <div className="mt-4 px-4 py-3 bg-white/[0.02] rounded-[10px] text-xs text-gray-600">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ExternalLink size={12} />
            <span className="font-semibold">Feed URLs</span>
          </div>
          <div className="flex flex-col gap-1">
            <code className="text-[11px] text-indigo-400 break-all">
              IQMela Careers: /careers/{positionId}
            </code>
            <code className="text-[11px] text-indigo-400 break-all">
              Indeed XML: /api/public/jobs-feed
            </code>
            <code className="text-[11px] text-indigo-400 break-all">
              Google Jobs: /api/public/jobs/{positionId}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    LIVE: { cls: "bg-green-500/[0.12] text-green-500", label: "Live" },
    DRAFT: { cls: "bg-white/5 text-gray-600", label: "Draft" },
    PUBLISHING: { cls: "bg-yellow-500/[0.12] text-yellow-500", label: "Publishing" },
    CLOSED: { cls: "bg-red-500/[0.12] text-red-500", label: "Closed" },
    FAILED: { cls: "bg-red-500/[0.12] text-red-500", label: "Failed" },
    PAUSED: { cls: "bg-yellow-500/[0.12] text-yellow-500", label: "Paused" },
  };

  const c = config[status] || config.DRAFT;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${c.cls}`}>
      {status === "LIVE" && <Check size={10} />}
      {status === "FAILED" && <XCircle size={10} />}
      {c.label}
    </span>
  );
}
