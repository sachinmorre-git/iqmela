"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, VideoIcon, VideoOff, PhoneOff, MonitorUp,
  MessageSquare, Maximize, GripHorizontal, Wifi, WifiOff, Send, X, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useTrackToggle,
  ParticipantTile,
  useRoomContext,
  useConnectionQualityIndicator,
} from "@livekit/components-react";
import { Track, RoomEvent, AudioPresets, VideoPreset, ConnectionQuality } from "livekit-client";
import { startRecordingAction, stopRecordingAction } from "./recordingActions";
import { VisionProctor } from "./VisionProctor";
import { ProctorGuard } from "./ProctorGuard";
import { IntelligenceSidebar } from "./IntelligenceSidebar";
import { SignalBuffer } from "./signalBuffer";
import { saveSessionSignalsAction } from "./proctorActions";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  from: string;
  text: string;
  ts: number;
  isLocal: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Quality Badge
// ─────────────────────────────────────────────────────────────────────────────
function NetworkQualityBadge() {
  const { quality } = useConnectionQualityIndicator();

  const qualityConfig: Record<ConnectionQuality, { bars: number; color: string; label: string }> = {
    [ConnectionQuality.Excellent]: { bars: 3, color: "text-emerald-400", label: "Excellent" },
    [ConnectionQuality.Good]:      { bars: 2, color: "text-amber-400",   label: "Good" },
    [ConnectionQuality.Poor]:      { bars: 1, color: "text-red-400",     label: "Poor" },
    [ConnectionQuality.Lost]:      { bars: 0, color: "text-zinc-600",    label: "Lost" },
    [ConnectionQuality.Unknown]:   { bars: 2, color: "text-zinc-400",    label: "Unknown" },
  };

  const { bars, color, label } = qualityConfig[quality] ?? qualityConfig[ConnectionQuality.Unknown];

  return (
    <div className="group relative flex items-end gap-0.5 h-5 cursor-default" title={`Connection: ${label}`}>
      {[1, 2, 3].map((b) => (
        <div
          key={b}
          className={`w-1 rounded-sm transition-all duration-300 ${b <= bars ? color : "bg-zinc-700"}`}
          style={{ height: `${b * 5 + 4}px` }}
        />
      ))}
      {/* Tooltip */}
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-zinc-300 text-[9px] font-semibold px-2 py-0.5 rounded-lg border border-zinc-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Panel
// ─────────────────────────────────────────────────────────────────────────────
function ChatPanel({
  messages,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="absolute right-4 bottom-24 w-72 bg-zinc-950/95 backdrop-blur-xl rounded-3xl border border-zinc-700/60 shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
      style={{ height: "380px" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-bold text-white">Room Chat</span>
          {messages.length > 0 && (
            <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full font-semibold">{messages.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageSquare className="w-8 h-8 text-zinc-700" />
            <p className="text-xs text-zinc-600 font-semibold">No messages yet</p>
            <p className="text-[10px] text-zinc-700">Chat is only visible during this session</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isLocal ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                msg.isLocal
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
              }`}>
                {!msg.isLocal && (
                  <p className="text-[9px] font-bold text-indigo-400 mb-0.5">{msg.from}</p>
                )}
                <p className="text-xs leading-relaxed">{msg.text}</p>
                <p className={`text-[8px] mt-0.5 ${msg.isLocal ? "text-indigo-200" : "text-zinc-500"}`}>
                  {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-zinc-800/60">
        <div className="flex items-center gap-2 bg-zinc-900 rounded-2xl border border-zinc-700/60 px-3 py-2 focus-within:border-indigo-500/50 transition-colors">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message…"
            maxLength={500}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="w-7 h-7 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveRoomShell — top-level wrapper with LiveKit context
// ─────────────────────────────────────────────────────────────────────────────
export function LiveRoomShell({
  onLeave,
  roomTitle,
  token,
  serverUrl,
  initialAudio,
  initialVideo,
  interviewId,
  isInterviewer,
  initialNotes,
}: {
  onLeave: () => void;
  roomTitle: string;
  token: string;
  serverUrl: string;
  initialAudio: boolean;
  initialVideo: boolean;
  interviewId: string;
  isInterviewer: boolean;
  initialNotes: string;
}) {
  // Stable SignalBuffer instance for the lifetime of the session (candidate only)
  const signalBuffer = useRef(new SignalBuffer()).current;

  return (
    <LiveKitRoom
      video={initialVideo}
      audio={initialAudio}
      token={token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
      className="w-full h-screen bg-black flex flex-row overflow-hidden text-white relative"
      options={{
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
        publishDefaults: {
          videoEncoding: { maxBitrate: 1_200_000, maxFramerate: 30 },
          videoSimulcastLayers: [new VideoPreset(640, 360, 400_000, 15)],
          dtx: true,
          red: true,
          audioPreset: AudioPresets.music,
          screenShareEncoding: { maxBitrate: 1_500_000, maxFramerate: 15 },
        },
      }}
    >
      <RoomAudioRenderer />
      <div className="flex-1 relative h-full">
        <RoomLayout
          onLeave={onLeave}
          roomTitle={roomTitle}
          interviewId={interviewId}
          isInterviewer={isInterviewer}
          signalBuffer={signalBuffer}
        />
        <VisionProctor
          interviewId={interviewId}
          isCandidate={!isInterviewer}
          signalBuffer={signalBuffer}
        />
        <ProctorGuard interviewId={interviewId} isCandidate={!isInterviewer}>
          <></>
        </ProctorGuard>
      </div>
      {isInterviewer && (
        <IntelligenceSidebar interviewId={interviewId} initialNotes={initialNotes} />
      )}
    </LiveKitRoom>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoomLayout — video grid + controls + chat + keyboard shortcuts
// ─────────────────────────────────────────────────────────────────────────────
function RoomLayout({
  onLeave,
  roomTitle,
  interviewId,
  isInterviewer,
  signalBuffer,
}: {
  onLeave: () => void;
  roomTitle: string;
  interviewId: string;
  isInterviewer: boolean;
  signalBuffer: SignalBuffer;
}) {
  const [viewMode, setViewMode]               = useState<"split" | "spotlight">("split");
  const [elapsed, setElapsed]                  = useState(0);
  const [isProcessingRecord, setIsProcessingRecord] = useState(false);
  const [screenShareRequestPending, setScreenShareRequestPending] = useState(false);
  const [isRecordingLocal, setIsRecordingLocal] = useState(false);
  const [isChatOpen, setIsChatOpen]            = useState(false);
  const [unreadCount, setUnreadCount]          = useState(0);
  const [chatMessages, setChatMessages]        = useState<ChatMessage[]>([]);
  const [isLowBandwidth, setIsLowBandwidth]    = useState(false);
  // Push-to-talk: mic was muted before spacebar hold
  const pttWasMuted = useRef(false);

  // ── LiveKit hooks ─────────────────────────────────────────────────────────
  const room                = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const cameraTracks         = useTracks([Track.Source.Camera]);
  const screenShareTracks    = useTracks([Track.Source.ScreenShare]);
  const { toggle: toggleMic,         enabled: isMicEnabled }         = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: toggleCam,         enabled: isCamEnabled }         = useTrackToggle({ source: Track.Source.Camera });
  const { toggle: toggleScreenShare, enabled: isScreenShareEnabled } = useTrackToggle({ source: Track.Source.ScreenShare });

  // Connection quality displayed in top bar
  const activeEgresses = (room as any).activeEgresses ?? [];
  const isRecording = isInterviewer ? activeEgresses.length > 0 : isRecordingLocal;

  // ── Session timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const startTime = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Signal batch emit to interviewer (candidate only, every 10s) ────────────
  useEffect(() => {
    if (isInterviewer) return;
    const interval = setInterval(() => {
      const snapshot = signalBuffer.snapshot();
      const payload  = new TextEncoder().encode(
        JSON.stringify({ type: "LIVE_SIGNALS", ...snapshot })
      );
      localParticipant.publishData(payload, { reliable: false }).catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, [isInterviewer, localParticipant, signalBuffer]);

  // ── Flush signal buffer on disconnect (candidate only) ───────────────────────
  useEffect(() => {
    if (isInterviewer) return;
    const flush = () => {
      const data = signalBuffer.flush();
      if (data.signals.length > 0) {
        saveSessionSignalsAction(interviewId, data).catch(() => {});
      }
    };
    room.on(RoomEvent.Disconnected, flush);
    return () => { room.off(RoomEvent.Disconnected, flush); };
  }, [isInterviewer, room, interviewId, signalBuffer]);

  // ── Data Channel — receive all events ────────────────────────────────────
  useEffect(() => {
    const handleData = (payload: Uint8Array, participant: any) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === "SCREEN_SHARE_REQUEST" && !isInterviewer) setScreenShareRequestPending(true);
        if (data.type === "RECORDING_STARTED")  setIsRecordingLocal(true);
        if (data.type === "RECORDING_STOPPED")  setIsRecordingLocal(false);
        if (data.type === "CHAT") {
          const msg: ChatMessage = {
            id: `${participant?.identity ?? "remote"}-${data.ts}`,
            from: participant?.name || participant?.identity || "Participant",
            text: data.text,
            ts: data.ts,
            isLocal: false,
          };
          setChatMessages((prev) => [...prev, msg]);
          if (!isChatOpen) setUnreadCount((n) => n + 1);
        }
      } catch (_) {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, isInterviewer, isChatOpen]);

  // ── Chat open → clear unread ──────────────────────────────────────────────
  useEffect(() => {
    if (isChatOpen) setUnreadCount(0);
  }, [isChatOpen]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Never fire when user is typing in an input/textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "m":
          e.preventDefault();
          toggleMic();
          break;
        case "v":
          e.preventDefault();
          toggleCam();
          break;
        case "s":
          e.preventDefault();
          toggleScreenShare();
          break;
        case " ":
          // Push-to-talk: unmute on hold (only when mic is OFF)
          if (!isMicEnabled && !pttWasMuted.current) {
            e.preventDefault();
            pttWasMuted.current = true;
            toggleMic(); // unmute
          }
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " && pttWasMuted.current) {
        pttWasMuted.current = false;
        if (isMicEnabled) toggleMic(); // re-mute
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [toggleMic, toggleCam, toggleScreenShare, isMicEnabled]);

  // ── Broadcast helper ──────────────────────────────────────────────────────
  const broadcast = useCallback((payload: object) => {
    localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(payload)),
      { reliable: true }
    );
  }, [localParticipant]);

  // ── Chat send ─────────────────────────────────────────────────────────────
  const handleSendChat = (text: string) => {
    const ts = Date.now();
    const msg: ChatMessage = {
      id: `local-${ts}`,
      from: localParticipant.name || localParticipant.identity,
      text,
      ts,
      isLocal: true,
    };
    setChatMessages((prev) => [...prev, msg]);
    broadcast({ type: "CHAT", text, from: localParticipant.name || localParticipant.identity, ts });
  };

  // ── Low-bandwidth mode toggle ─────────────────────────────────────────────
  const toggleLowBandwidth = async () => {
    const next = !isLowBandwidth;
    setIsLowBandwidth(next);
    try {
      if (next) {
        // Drop to 360p
        await localParticipant.setCameraEnabled(true, {
          resolution: { width: 640, height: 360, frameRate: 15 },
        });
      } else {
        // Restore 720p
        await localParticipant.setCameraEnabled(true, {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        });
      }
    } catch (_) {}
  };

  // ── Recording toggle ──────────────────────────────────────────────────────
  const handleRecordToggle = async () => {
    setIsProcessingRecord(true);
    try {
      if (isRecording) {
        await stopRecordingAction(activeEgresses[0]?.egressId ?? "");
        broadcast({ type: "RECORDING_STOPPED" });
      } else {
        await startRecordingAction(interviewId);
        broadcast({ type: "RECORDING_STARTED" });
      }
    } finally {
      setIsProcessingRecord(false);
    }
  };

  const requestCandidateScreenShare = () => broadcast({ type: "SCREEN_SHARE_REQUEST" });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  const getGridClasses = (count: number) => {
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count <= 4)  return "grid-cols-2";
    return "grid-cols-2 md:grid-cols-3";
  };

  const spotlightTrack = viewMode === "spotlight"
    ? (cameraTracks.find(t => t.participant.identity !== localParticipant.identity) ?? cameraTracks[0])
    : null;
  const filmstripTracks = viewMode === "spotlight"
    ? cameraTracks.filter(t => t !== spotlightTrack)
    : [];

  return (
    <div className="w-full h-full flex flex-col relative bg-black">

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/80 to-transparent z-20">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isRecording ? "bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.7)]" : "bg-zinc-600"}`} />
          <span className="font-semibold tracking-wide flex items-center gap-2">
            {roomTitle || "Live Session"}
            {isRecording && <span className="text-red-500 text-xs font-bold uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">REC</span>}
          </span>
          <span className="text-zinc-400 font-mono text-sm ml-4 border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 rounded-md min-w-[60px] text-center tabular-nums">
            {formatTime(elapsed)}
          </span>
          {/* Network quality — always visible */}
          <div className="ml-2">
            <NetworkQualityBadge />
          </div>
          {/* Low-bandwidth indicator */}
          {isLowBandwidth && (
            <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20 animate-pulse">
              Low BW
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isInterviewer && (
            <Button
              onClick={handleRecordToggle}
              disabled={isProcessingRecord}
              variant="outline"
              size="sm"
              className={`font-semibold border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white transition-colors ${isRecording ? "text-red-400 border-red-500/30" : "text-zinc-300"}`}
            >
              {isProcessingRecord && <span className="w-3 h-3 rounded-full border-2 border-zinc-400 animate-spin mr-2" />}
              {isRecording ? "Stop Recording" : "Record"}
            </Button>
          )}
          <button
            onClick={() => setViewMode(v => v === "split" ? "spotlight" : "split")}
            title={viewMode === "split" ? "Spotlight mode" : "Grid mode"}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg transition-colors backdrop-blur-sm hidden md:block"
          >
            <GripHorizontal className="w-5 h-5" />
          </button>
          <Button onClick={onLeave} variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700 font-bold px-6 shadow-lg shadow-red-600/20">
            End Session
          </Button>
        </div>
      </div>

      {/* ── Main Video Arena ─────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 md:p-6 pb-28 pt-20 flex justify-center items-center overflow-hidden relative">

        {/* Screen share request modal */}
        {screenShareRequestPending && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-zinc-950/90 backdrop-blur-xl border border-zinc-700 p-8 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-center max-w-sm animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <MonitorUp className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">Screen Share Requested</h3>
            <p className="text-sm font-medium text-zinc-400 mb-6">The interviewer has requested you share your screen for proctoring or technical pairing purposes.</p>
            <div className="flex gap-4 w-full">
              <Button onClick={() => setScreenShareRequestPending(false)} variant="outline" className="flex-1 border-zinc-700 text-zinc-300 hover:text-white bg-zinc-800">Decline</Button>
              <Button onClick={() => { setScreenShareRequestPending(false); toggleScreenShare(); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-600/20">Accept & Share</Button>
            </div>
          </div>
        )}

        {/* ── Screen share layout ────────────────────────────────────────── */}
        {screenShareTracks.length > 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2">
            <div className="w-full flex-1 max-w-7xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative group">
              <ParticipantTile trackRef={screenShareTracks[0]} className="absolute inset-0 object-contain w-full h-full" />
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                Screen Share: {screenShareTracks[0].participant.name || screenShareTracks[0].participant.identity}
              </div>
            </div>
            <div className="flex gap-2 h-28 mt-3 w-full justify-center overflow-x-auto shrink-0 pb-2">
              {cameraTracks.map((t) => (
                <div key={t.participant.identity} className="h-full aspect-video bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800 shrink-0">
                  <ParticipantTile trackRef={t} disableSpeakingIndicator className="absolute inset-0 object-cover w-full h-full" />
                </div>
              ))}
            </div>
          </div>

        ) : viewMode === "spotlight" && spotlightTrack ? (
          // ── Spotlight layout ───────────────────────────────────────────────
          <div className="w-full h-full flex flex-col gap-2">
            <div className="flex-1 relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
              <ParticipantTile trackRef={spotlightTrack} disableSpeakingIndicator className="absolute inset-0 object-cover w-full h-full" />
              <div className="absolute bottom-4 left-4">
                <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 flex items-center gap-2">
                  {spotlightTrack.participant.name || spotlightTrack.participant.identity}
                  {!spotlightTrack.participant.isMicrophoneEnabled
                    ? <MicOff className="w-3 h-3 text-red-400" />
                    : <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                </span>
              </div>
            </div>
            {filmstripTracks.length > 0 && (
              <div className="flex gap-2 h-28 shrink-0 justify-center">
                {filmstripTracks.map((t) => (
                  <div key={t.participant.identity} className="h-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shrink-0 relative">
                    <ParticipantTile trackRef={t} disableSpeakingIndicator className="absolute inset-0 object-cover w-full h-full" />
                    <span className="absolute bottom-1.5 left-2 bg-black/60 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md">
                      {t.participant.name || t.participant.identity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : cameraTracks.length > 0 ? (
          // ── Split grid ─────────────────────────────────────────────────────
          <div className={`w-full max-w-7xl h-full grid gap-4 md:gap-6 mx-auto ${getGridClasses(cameraTracks.length)} content-center`}>
            {cameraTracks.map((trackRef) => {
              const p = trackRef.participant;
              const isLocal = p.identity === localParticipant.identity;
              return (
                <div key={p.identity} className="relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl w-full h-full min-h-[250px] group">
                  <ParticipantTile trackRef={trackRef} disableSpeakingIndicator className="absolute inset-0 object-cover w-full h-full" />
                  <div className="absolute bottom-4 left-4 z-10">
                    <span className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 flex items-center gap-2 shadow-lg select-none">
                      {isLocal ? "You" : (p.name || p.identity)}
                      {!p.isMicrophoneEnabled
                        ? <MicOff className="w-3.5 h-3.5 text-red-400" />
                        : <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />}
                    </span>
                  </div>
                  {!isLocal && (
                    <button
                      onClick={() => setViewMode("spotlight")}
                      title="Spotlight this participant"
                      className="absolute top-4 right-4 z-10 p-2 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-black/80 transition-colors border border-white/10 opacity-0 group-hover:opacity-100"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

        ) : (
          // ── Waiting ────────────────────────────────────────────────────────
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" />
              <div className="absolute inset-2 bg-purple-500/30 rounded-full animate-pulse" />
              <div className="absolute inset-4 bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-700 shadow-2xl">
                <VideoOff className="w-10 h-10 text-zinc-500" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Waiting for participants…</h3>
            <p className="text-zinc-400 max-w-sm">Enable your camera to join the live session.</p>
          </div>
        )}

        {/* Chat panel — anchored to bottom-right inside arena */}
        {isChatOpen && (
          <ChatPanel
            messages={chatMessages}
            onSend={handleSendChat}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>

      {/* ── Floating Bottom Controls ─────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-900/90 backdrop-blur-xl px-8 py-4 rounded-3xl border border-zinc-700/50 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-40">

        {/* Mic + Cam */}
        <div className="flex items-center gap-3 pr-6 border-r border-zinc-700">
          {/* Push-to-talk hint when mic is muted */}
          <div className="relative group">
            <button
              onClick={() => toggleMic()}
              title={isMicEnabled ? "Mute [M]" : "Unmute [M] · Hold Space to talk"}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMicEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30"}`}
            >
              {isMicEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
            {/* Keyboard hint tooltip */}
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-zinc-400 text-[9px] font-semibold px-2 py-1 rounded-lg border border-zinc-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {isMicEnabled ? "M" : "M · Space"}
            </span>
          </div>
          <div className="relative group">
            <button
              onClick={() => toggleCam()}
              title="Toggle camera [V]"
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isCamEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30"}`}
            >
              {isCamEnabled ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-zinc-400 text-[9px] font-semibold px-2 py-1 rounded-lg border border-zinc-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">V</span>
          </div>
        </div>

        {/* Screen share + Chat + Low-BW */}
        <div className="flex items-center gap-3 px-2">
          {isInterviewer && (
            <button
              onClick={requestCandidateScreenShare}
              title="Request candidate's screen"
              className="h-14 px-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-2 transition-all font-semibold border border-zinc-700 shadow-md"
            >
              <MonitorUp className="w-5 h-5" /> Ask to Share
            </button>
          )}
          <div className="relative group">
            <button
              onClick={() => toggleScreenShare()}
              title="Share screen [S]"
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group ${isScreenShareEnabled ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"}`}
            >
              <MonitorUp className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform" />
            </button>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-zinc-400 text-[9px] font-semibold px-2 py-1 rounded-lg border border-zinc-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">S</span>
          </div>

          {/* Chat — now fully wired */}
          <div className="relative group">
            <button
              onClick={() => setIsChatOpen(v => !v)}
              title="Toggle chat"
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all relative border ${
                isChatOpen
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20"
                  : "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
              }`}
            >
              <MessageSquare className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-zinc-900 shadow-lg animate-bounce">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-zinc-400 text-[9px] font-semibold px-2 py-1 rounded-lg border border-zinc-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Chat</span>
          </div>

          {/* Low-bandwidth mode toggle */}
          <div className="relative group">
            <button
              onClick={toggleLowBandwidth}
              title={isLowBandwidth ? "Restore quality" : "Low bandwidth mode (360p)"}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${
                isLowBandwidth
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-700"
              }`}
            >
              {isLowBandwidth ? <WifiOff className="w-6 h-6" /> : <Gauge className="w-6 h-6" />}
            </button>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-zinc-400 text-[9px] font-semibold px-2 py-1 rounded-lg border border-zinc-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {isLowBandwidth ? "Restore" : "Save BW"}
            </span>
          </div>
        </div>

        {/* Leave */}
        <div className="flex items-center pl-6 border-l border-zinc-700">
          <Button onClick={onLeave} className="h-14 px-8 rounded-2xl bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 text-white font-bold tracking-wide">
            <PhoneOff className="w-5 h-5 mr-2" /> Leave
          </Button>
        </div>
      </div>

      {/* Keyboard shortcut hint — shown once on mount for 4s */}
      <KeyboardHints />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard hints toast — shown once on join
// ─────────────────────────────────────────────────────────────────────────────
function KeyboardHints() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;
  return (
    <div className="absolute bottom-28 left-6 z-30 bg-zinc-950/90 backdrop-blur-xl border border-zinc-700/60 rounded-2xl px-4 py-3 shadow-xl animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: "1s" }}>
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Keyboard Shortcuts</p>
      <div className="flex flex-col gap-1">
        {[
          ["M", "Toggle mic"],
          ["V", "Toggle camera"],
          ["S", "Screen share"],
          ["Space", "Push to talk"],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-center gap-2">
            <kbd className="bg-zinc-800 text-zinc-300 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border border-zinc-700 min-w-[28px] text-center">
              {key}
            </kbd>
            <span className="text-[10px] text-zinc-500">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
