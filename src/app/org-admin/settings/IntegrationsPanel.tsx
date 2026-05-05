"use client"

import { useState, useTransition } from "react"
import { ExternalLink, Check, X, Loader2, Zap } from "lucide-react"

interface Integration {
  platform: string
  status: string
  externalOrgName: string | null
  connectedBy: string | null
  createdAt: string
}

interface IntegrationsPanelProps {
  integrations: Integration[]
}

const PLATFORMS = [
  {
    key: "LINKEDIN",
    name: "LinkedIn",
    icon: "🔷",
    color: "#0a66c2",
    gradient: "linear-gradient(135deg, #0a66c2, #0077b5)",
    description: "Post jobs directly to your LinkedIn Company Page and receive Easy Apply candidates.",
  },
  {
    key: "INDEED",
    name: "Indeed",
    icon: "🔵",
    color: "#2164f3",
    gradient: "linear-gradient(135deg, #2164f3, #003a9b)",
    description: "Sponsor listings on Indeed and receive applicant resumes automatically.",
  },
]

export default function IntegrationsPanel({ integrations }: IntegrationsPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [localIntegrations, setLocalIntegrations] = useState(integrations)

  const getIntegration = (platform: string) =>
    localIntegrations.find((i) => i.platform === platform && i.status === "ACTIVE")

  const handleConnect = (platform: string) => {
    window.location.href = `/api/integrations/${platform.toLowerCase()}/authorize`
  }

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform)
    try {
      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/disconnect`, {
        method: "POST",
      })
      if (res.ok) {
        setLocalIntegrations((prev) =>
          prev.map((i) =>
            i.platform === platform ? { ...i, status: "REVOKED" } : i
          )
        )
      }
    } catch (err) {
      console.error("Disconnect failed:", err)
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
            <Zap size={20} color="#fff" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white m-0 tracking-tight">
              Job Board Integrations
            </h2>
            <p className="text-[13px] text-gray-500 mt-0.5 m-0">
              Connect your accounts to post jobs and receive applicants automatically
            </p>
          </div>
        </div>
      </div>

      {/* Distribution Tiers Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          {
            emoji: "🌍",
            label: "Organic Reach",
            desc: "Google Jobs + Indeed Crawler",
            status: "Always On",
            color: "#22c55e",
          },
          {
            emoji: "🔗",
            label: "Direct Connect",
            desc: "Your LinkedIn & Indeed accounts",
            status: localIntegrations.some((i) => i.status === "ACTIVE")
              ? "Connected"
              : "Not Connected",
            color: localIntegrations.some((i) => i.status === "ACTIVE")
              ? "#22c55e"
              : "#666",
          },
          {
            emoji: "✦",
            label: "IQMela Network",
            desc: "Posted by IQMela on your behalf",
            status: "Available",
            color: "#818cf8",
          },
        ].map((tier) => (
          <div
            key={tier.label}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center"
          >
            <div className="text-2xl mb-1.5">{tier.emoji}</div>
            <div className="text-[13px] font-semibold text-white mb-0.5">
              {tier.label}
            </div>
            <div className="text-[11px] text-gray-600 mb-2">
              {tier.desc}
            </div>
            <span
              className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold"
              style={{ color: tier.color, background: `${tier.color}15` }}
            >
              {tier.status}
            </span>
          </div>
        ))}
      </div>

      {/* Integration Cards */}
      <div className="flex flex-col gap-4">
        {PLATFORMS.map((platform) => {
          const integration = getIntegration(platform.key)
          const isConnected = !!integration

          return (
            <div
              key={platform.key}
              className={`rounded-2xl p-4 sm:p-6 transition-all border ${
                isConnected ? "border-white/10" : "border-white/[0.06] bg-white/[0.02]"
              }`}
              style={{
                background: isConnected
                  ? `linear-gradient(135deg, ${platform.color}08, ${platform.color}03)`
                  : undefined,
              }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Platform Info */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-[14px] flex items-center justify-center text-2xl shrink-0 transition-shadow"
                    style={{
                      background: platform.gradient,
                      boxShadow: isConnected ? `0 4px 20px ${platform.color}30` : "none",
                    }}
                  >
                    {platform.icon}
                  </div>
                  <div>
                    <div className="text-base font-bold text-white mb-1 tracking-tight">
                      {platform.name}
                    </div>
                    <div className="text-xs text-gray-500 max-w-[400px]">
                      {platform.description}
                    </div>
                    {isConnected && integration.externalOrgName && (
                      <div
                        className="flex items-center gap-1.5 mt-2 text-xs font-medium"
                        style={{ color: platform.color }}
                      >
                        <Check size={12} />
                        Connected as {integration.externalOrgName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex items-center gap-2 shrink-0">
                  {isConnected ? (
                    <>
                      <span className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Active
                      </span>
                      <button
                        onClick={() => handleDisconnect(platform.key)}
                        disabled={disconnecting === platform.key}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/[0.08] text-red-500 border border-red-500/15 cursor-pointer transition-all hover:bg-red-500/15"
                      >
                        {disconnecting === platform.key ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <X size={12} />
                        )}
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(platform.key)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-[10px] text-[13px] font-semibold text-white border-none cursor-pointer transition-all hover:brightness-110"
                      style={{
                        background: platform.gradient,
                        boxShadow: `0 2px 12px ${platform.color}40`,
                      }}
                    >
                      <ExternalLink size={14} />
                      Connect {platform.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* IQMela Network Section */}
      <div className="mt-6 bg-gradient-to-br from-indigo-500/[0.06] to-violet-500/[0.03] border border-indigo-500/[0.12] rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-lg text-white font-black shrink-0">
            ✦
          </div>
          <div>
            <div className="text-[15px] font-bold text-white">
              IQMela Network
            </div>
            <div className="text-xs text-gray-500">
              Don&apos;t have LinkedIn Recruiter or Indeed accounts? We&apos;ll post on your behalf.
            </div>
          </div>
        </div>
        <p className="text-[13px] text-gray-400 leading-relaxed m-0">
          When enabled, IQMela will post your jobs through our recruiting network accounts. Jobs
          appear as <strong className="text-indigo-300">&quot;IQMela • Hiring for [Your Company]&quot;</strong>. 
          All candidates are automatically funneled into your IQMela dashboard.
          Toggle this option when publishing a position.
        </p>
      </div>
    </div>
  )
}
