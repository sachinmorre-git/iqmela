"use client";

import { useState, useEffect } from "react";
import { Mic, MicOff, VideoIcon, VideoOff, PhoneOff, MonitorUp, MessageSquare, Maximize, GripHorizontal, PenLine, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useTracks, useLocalParticipant, useRemoteParticipants, useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { saveInterviewNotes } from "./actions";

export function LiveRoomShell({ 
  onLeave, 
  roomTitle, 
  token, 
  serverUrl, 
  initialAudio, 
  initialVideo,
  interviewId,
  isInterviewer,
  initialNotes 
}: { 
  onLeave: () => void, 
  roomTitle: string, 
  token: string, 
  serverUrl: string, 
  initialAudio: boolean, 
  initialVideo: boolean,
  interviewId: string,
  isInterviewer: boolean,
  initialNotes: string
}) {
  return (
    <LiveKitRoom
      video={initialVideo}
      audio={initialAudio}
      token={token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
      className="w-full h-screen bg-black flex flex-row overflow-hidden text-white relative"
    >
       <RoomAudioRenderer />
       
       <div className="flex-1 relative h-full">
         <RoomLayout onLeave={onLeave} roomTitle={roomTitle} />
       </div>

       {isInterviewer && (
         <NotesSidebar interviewId={interviewId} initialNotes={initialNotes} />
       )}
       
    </LiveKitRoom>
  );
}

function RoomLayout({ onLeave, roomTitle }: { onLeave: () => void, roomTitle: string }) {
  const [viewMode, setViewMode] = useState<'split' | 'spotlight'>('split');
  const [elapsed, setElapsed] = useState(0);

  // Initialize precise interview timer
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // Next-Gen LiveKit Hooks parsing global room state
  const cameraTracks = useTracks([Track.Source.Camera]);
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  
  // Isolate our Local physical tracks
  const localVideoTrack = cameraTracks.find(t => t.participant.identity === localParticipant.identity);
  
  // Upgrade: Extract foolproof track toggle states directly from the Hardware context
  const { toggle: toggleMic, enabled: isMicEnabled } = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: toggleCam, enabled: isCamEnabled } = useTrackToggle({ source: Track.Source.Camera });

  // Extract our Opponent (Since it's a 1-on-1 interview)
  const opponent = remoteParticipants[0];
  const opponentVideoTrack = opponent ? cameraTracks.find(t => t.participant.identity === opponent.identity) : null;

  return (
    <div className="w-full h-full flex flex-col relative bg-black">
      
      {/* Top Bar Navigation */}
      <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/80 to-transparent z-20">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.7)]"></div>
          <span className="font-semibold tracking-wide">{roomTitle || "Live Session"}</span>
          <span className="text-zinc-400 font-mono text-sm ml-4 border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 rounded-md min-w-[60px] text-center tabular-nums">
            {formatTime(elapsed)}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
           <button onClick={() => setViewMode(viewMode === 'split' ? 'spotlight' : 'split')} className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg transition-colors backdrop-blur-sm">
             <GripHorizontal className="w-5 h-5" />
           </button>
           <Button onClick={onLeave} variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700 font-bold px-6 shadow-lg shadow-red-600/20">
             End Session
           </Button>
        </div>
      </div>

      {/* Main Video Arena */}
      <div className="flex-1 p-4 md:p-6 pb-28 pt-20 flex gap-4 md:gap-6 justify-center items-stretch overflow-hidden">
        
        {/* Local Video Tile securely piped via WebRTC context */}
        <div className={`relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl transition-all duration-500 ease-in-out ${viewMode === 'split' ? 'w-1/2' : 'w-64 h-40 absolute bottom-32 right-8 z-30 shadow-black/50'}`}>
          
          {localVideoTrack ? (
            <VideoTrack trackRef={localVideoTrack} className="absolute inset-0 object-cover w-full h-full transform scale-x-[-1]" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 bg-zinc-950">
               <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center shadow-inner mb-4 border border-zinc-800">
                 <VideoOff className="w-10 h-10 opacity-40 text-red-500/50" />
               </div>
               <p className="font-semibold text-sm tracking-widest uppercase text-zinc-600">Camera Off</p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex gap-2 z-10">
            <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-xs font-semibold select-none border border-white/10 flex items-center gap-2">
              You
              {!isMicEnabled && <MicOff className="w-3 h-3 text-red-400" />}
            </span>
          </div>
        </div>

        {/* Remote Video Tile safely piped via dynamic state array mapping */}
        <div className={`relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl transition-all duration-500 ease-in-out ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
          
          {opponent ? (
            // OPPONENT NETWORK FEED ESTABLISHED
            opponentVideoTrack ? (
              <VideoTrack trackRef={opponentVideoTrack} className="absolute inset-0 object-cover w-full h-full" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 overflow-hidden">
                <div className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl mb-6 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                   <div className="text-4xl font-black text-white">{opponent.name?.substring(0, 2).toUpperCase() || 'OP'}</div>
                   {!opponent.isMicrophoneEnabled && (
                     <div className="absolute -bottom-2 -right-2 bg-zinc-900 p-2 rounded-full border border-zinc-800 shadow-xl">
                       <MicOff className="w-4 h-4 text-red-500" />
                     </div>
                   )}
                </div>
                <p className="font-bold text-lg text-zinc-300">Remote Camera is Off</p>
              </div>
            )
          ) : (
            // WAITING ROOM SHELL (Before Opponent Network Handshake)
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 overflow-hidden">
               <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]"></div>
               <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]"></div>
               
               <div className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl mb-6 bg-gradient-to-br from-zinc-800 to-zinc-900 relative border border-zinc-800">
                  <div className="text-4xl font-black text-zinc-600">?</div>
               </div>
               <p className="font-bold text-lg text-white">Waiting for other participant...</p>
               <p className="text-sm font-medium text-zinc-500 mt-2 text-center max-w-sm">The secure WebRTC tunnel is open. They will dynamically appear here when they connect.</p>
            </div>
          )}

          {opponent && (
             <div className="absolute bottom-4 left-4 z-10">
                <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-md text-xs font-semibold select-none border border-white/10 flex items-center gap-2">
                 {opponent.name || "Remote"}
                 {!opponent.isMicrophoneEnabled && <MicOff className="w-3 h-3 text-red-500" />}
                </span>
             </div>
          )}

          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button className="p-2 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-black/80 transition-colors border border-white/10">
               <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Floating Bottom Controls wired to LiveKit Room SDK */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-900/90 backdrop-blur-xl px-8 py-4 rounded-3xl border border-zinc-700/50 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-40">
        
        <div className="flex items-center gap-3 pr-6 border-r border-zinc-700">
          <button 
            onClick={toggleMic}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${isMicEnabled ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30'}`}
          >
            {isMicEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          <button 
            onClick={toggleCam}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${isCamEnabled ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30'}`}
          >
            {isCamEnabled ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
        </div>

        <div className="flex items-center gap-3 px-2">
          <button className="w-14 h-14 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white flex flex-col items-center justify-center gap-1 transition-all group">
            <MonitorUp className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform" />
          </button>
          <button className="w-14 h-14 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition-all relative">
            <MessageSquare className="w-6 h-6" />
            <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-zinc-800"></span>
          </button>
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-zinc-700">
          <Button onClick={onLeave} className="h-14 px-8 rounded-2xl bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 text-white font-bold tracking-wide">
             <PhoneOff className="w-5 h-5 mr-2" />
             Leave
          </Button>
        </div>

      </div>

    </div>
  );
}

// Seamless Database-Backed Interviewer Note Sync Pipeline
function NotesSidebar({ interviewId, initialNotes }: { interviewId: string, initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Debounce hook precisely configured to slam Prisma via Server Action on typing pauses
  useEffect(() => {
    if (notes === initialNotes) return; // Avoid redundant saves on mount
    
    const handler = setTimeout(async () => {
      setIsSaving(true);
      try {
         await saveInterviewNotes(interviewId, notes);
         setLastSaved(new Date());
      } catch (err) {
         console.error("Failed to save notes remotely", err);
      } finally {
         setIsSaving(false);
      }
    }, 1500);

    return () => clearTimeout(handler);
  }, [notes, interviewId, initialNotes]);

  return (
    <div className="w-[340px] h-full bg-zinc-950 border-l border-zinc-800 flex flex-col z-50 shrink-0 shadow-2xl">
      <div className="h-16 border-b border-zinc-800 flex items-center px-6 gap-3 shrink-0 bg-black/40">
        <PenLine className="w-4 h-4 text-zinc-400" />
        <h2 className="font-bold text-zinc-200 tracking-wide">Private Notes</h2>
      </div>
      <textarea 
        className="flex-1 w-full p-6 bg-transparent text-sm text-zinc-300 resize-none focus:outline-none placeholder:text-zinc-700 leading-relaxed custom-scrollbar"
        placeholder="Start typing your evaluation context here...&#10;&#10;These notes are totally invisible to the candidate and are violently persistent to your Postgres database in the background."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="h-12 border-t border-zinc-800 flex items-center justify-between px-6 bg-black/40 shrink-0">
        {isSaving ? (
          <span className="text-xs font-semibold text-zinc-400 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin"></span> Syncing to Cloud...
          </span>
        ) : lastSaved ? (
           <span className="text-xs font-semibold text-green-500/80 flex items-center gap-2">
            <Save className="w-3 h-3" /> Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-xs font-medium text-zinc-600 flex items-center gap-2">
            <Save className="w-3 h-3" /> Waiting to sync...
          </span>
        )}
      </div>
    </div>
  );
}
