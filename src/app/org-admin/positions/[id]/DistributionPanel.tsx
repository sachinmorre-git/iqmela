"use client";

import { useState, useTransition } from "react";
import {
  Globe, Radio, Pause, XCircle, ExternalLink,
  Eye, MousePointer, FileText, Loader2, Check
} from "lucide-react";
import {
  publishPositionAction,
  unpublishPositionAction,
} from "@/app/org-admin/distribution-actions";

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
    <div style={{
      background: "linear-gradient(135deg, rgba(15,15,25,0.95), rgba(20,20,35,0.95))",
      border: "1px solid rgba(99,102,241,0.15)",
      borderRadius: "16px",
      padding: "24px",
      marginBottom: "20px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Globe size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", margin: 0 }}>
              Job Distribution
            </h3>
            <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0 0" }}>
              Publish to Indeed & Google Jobs — free, automated
            </p>
          </div>
        </div>

        {/* Publish Toggle */}
        <button
          onClick={isPublished ? handleUnpublish : handlePublish}
          disabled={isPending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderRadius: "10px",
            border: "none",
            cursor: isPending ? "wait" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
            transition: "all 0.2s",
            background: isPublished
              ? "rgba(239,68,68,0.12)"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: isPublished ? "#ef4444" : "#fff",
          }}
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isPublished ? (
            <Pause size={14} />
          ) : (
            <Radio size={14} />
          )}
          {isPending
            ? "Processing..."
            : isPublished
            ? "Unpublish All"
            : "Publish to Boards"}
        </button>
      </div>

      {/* Status Badge */}
      {isPublished && (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: "8px",
          padding: "6px 12px",
          marginBottom: "16px",
          fontSize: "12px",
          color: "#22c55e",
        }}>
          <div style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#22c55e",
            animation: "pulse 2s infinite",
          }} />
          Live on {channels.filter((c) => c.status === "LIVE").length} channels
        </div>
      )}

      {/* Channel Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "12px",
      }}>
        {(isPublished ? channels : Object.keys(CHANNEL_META).map((key) => ({
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
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${isLive ? `${meta.color}30` : "rgba(255,255,255,0.06)"}`,
                borderRadius: "12px",
                padding: "16px",
                transition: "all 0.2s",
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>{meta.icon}</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>
                    {meta.label}
                  </span>
                </div>
                <StatusBadge status={channel.status} />
              </div>

              {/* Stats Row */}
              <div style={{
                display: "flex",
                gap: "16px",
                fontSize: "12px",
                color: "#888",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Eye size={12} />
                  <span>{channel.viewCount.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <MousePointer size={12} />
                  <span>{channel.clickCount.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <FileText size={12} />
                  <span>{channel.applicationCount.toLocaleString()}</span>
                </div>
              </div>

              {channel.publishedAt && (
                <p style={{ fontSize: "11px", color: "#555", marginTop: "8px" }}>
                  Published {new Date(channel.publishedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Feed URLs */}
      {isPublished && (
        <div style={{
          marginTop: "16px",
          padding: "12px 16px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: "10px",
          fontSize: "12px",
          color: "#666",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <ExternalLink size={12} />
            <span style={{ fontWeight: 600 }}>Feed URLs</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <code style={{ fontSize: "11px", color: "#818cf8" }}>
              Indeed XML: /api/public/jobs-feed
            </code>
            <code style={{ fontSize: "11px", color: "#818cf8" }}>
              Google Jobs: /api/public/jobs/{positionId}
            </code>
          </div>
        </div>
      )}

      {/* Pulse animation keyframe */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    LIVE: { bg: "rgba(34,197,94,0.12)", color: "#22c55e", label: "Live" },
    DRAFT: { bg: "rgba(255,255,255,0.05)", color: "#666", label: "Draft" },
    PUBLISHING: { bg: "rgba(234,179,8,0.12)", color: "#eab308", label: "Publishing" },
    CLOSED: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "Closed" },
    FAILED: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "Failed" },
    PAUSED: { bg: "rgba(234,179,8,0.12)", color: "#eab308", label: "Paused" },
  };

  const c = config[status] || config.DRAFT;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "3px 10px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 600,
      background: c.bg,
      color: c.color,
    }}>
      {status === "LIVE" && <Check size={10} />}
      {status === "FAILED" && <XCircle size={10} />}
      {c.label}
    </span>
  );
}
