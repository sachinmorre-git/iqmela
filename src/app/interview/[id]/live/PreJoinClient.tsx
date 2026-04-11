"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Settings, AlertCircle, MonitorSpeaker, CheckCircle } from "lucide-react";
import Link from "next/link";
import { LiveRoomShell } from "./LiveRoomShell";
import { FeedbackForm } from "./FeedbackForm";

export function PreJoinClient({ 
  interviewId, 
  roomTitle, 
  isInterviewer = false, 
  initialNotes = "" 
}: { 
  interviewId: string, 
  roomTitle: string, 
  isInterviewer?: boolean, 
  initialNotes?: string 
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Hardware Device Enumeration States
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string>("");
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string>("");

  // Initialize Raw Hardware WebRTC Call & Listen for selection changes
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    
    async function setupMedia() {
      try {
        const constraints: MediaStreamConstraints = { 
          video: selectedVideoId ? { deviceId: { exact: selectedVideoId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : true 
        };
        
        const _stream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(_stream);
        activeStream = _stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = _stream;
        }
        setPermissionError(null);

        // Fetch securely un-redacted device lists post-permission
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'));

      } catch (err) {
        console.error("Media permission denied", err);
        setPermissionError("Browser denied hardware access. Please explicitly permit Camera and Microphone in your URL bar.");
        setCamOn(false);
        setMicOn(false);
      }
    }
    setupMedia();

    // Cleanly dump old tracks when hot-swapping hardware
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedVideoId, selectedAudioInputId]);

  // Execute setSinkId exclusively for output device routing
  useEffect(() => {
    if (selectedAudioOutputId && videoRef.current && 'setSinkId' in HTMLMediaElement.prototype) {
      (videoRef.current as any).setSinkId(selectedAudioOutputId).catch((err: any) => console.error('Error setting audio output device', err));
    }
  }, [selectedAudioOutputId]);

  // Hot-swap physical hardware tracks purely via state
  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(t => t.enabled = micOn);
      stream.getVideoTracks().forEach(t => t.enabled = camOn);
    }
  }, [micOn, camOn, stream]);


  const [token, setToken] = useState<string>("");
  const [sessionEnded, setSessionEnded] = useState(false);

  // -- (Keep existing handleJoin logic intact below) --
  const handleJoin = async () => {
    setIsJoining(true);
    setPermissionError(null);
    try {
      const res = await fetch(`/api/livekit/token?room=${interviewId}`);
      if (!res.ok) {
        const dict = await res.json();
        throw new Error(dict.error || "Server failed to generate secure WebRTC token");
      }
      
      const payload = await res.json();
      setToken(payload.token);
      setJoined(true);
      
    } catch (err: any) {
      console.error(err);
      setPermissionError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  if (joined && token) {
    return <LiveRoomShell 
      onLeave={() => { setJoined(false); setToken(""); setSessionEnded(true); }} 
      roomTitle={roomTitle} 
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || ""} 
      initialAudio={micOn}
      initialVideo={camOn}
      interviewId={interviewId}
      isInterviewer={isInterviewer}
      initialNotes={initialNotes}
    />;
  }

  // Intercept the End-of-Session drop to funnel Interviewers to the Feedback module 
  if (sessionEnded) {
    if (isInterviewer) {
       return <FeedbackForm interviewId={interviewId} />;
    } else {
       return (
         <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-8 text-center min-h-[60vh] gap-6 animate-in fade-in zoom-in duration-500">
           <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-full flex items-center justify-center mb-2">
             <CheckCircle className="w-10 h-10" />
           </div>
           <h1 className="text-3xl font-black text-gray-900 dark:text-white">Interview Concluded</h1>
           <p className="text-gray-500 dark:text-gray-400 font-medium">
             Thank you for your time. The session has ended. You may now securely close this window or return to your dashboard.
           </p>
           <Link href="/candidate/dashboard" className="mt-4">
              <Button size="lg" className="rounded-2xl font-bold px-8 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">Return to Dashboard</Button>
           </Link>
         </div>
       );
    }
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto py-10 px-4 flex flex-col lg:flex-row gap-8 items-center justify-center min-h-[80vh]">
      
      {/* Left: Video Preview Shell */}
      <div className="w-full lg:w-[60%] flex flex-col gap-4">
        
        {permissionError && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-800 dark:text-red-400">{permissionError}</p>
          </div>
        )}

        {/* Placeholder Video Container */}
        <div className="relative aspect-video bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 flex items-center justify-center group transition-all">
          
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className={`absolute inset-0 object-cover w-full h-full transition-opacity duration-300 transform scale-x-[-1] ${camOn && stream ? 'opacity-100' : 'opacity-0'}`} 
          />

          {!camOn || !stream ? (
            <div className="text-zinc-700 flex flex-col items-center gap-4 z-10">
               <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center shadow-inner">
                 <VideoOff className="w-10 h-10 opacity-50" />
               </div>
               <p className="font-semibold text-sm tracking-widest uppercase text-zinc-600">Camera is off</p>
            </div>
          ) : null}

          {/* Floating Device Controls inside Video area */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-950/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 z-20">
            <button 
              onClick={() => setMicOn(!micOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                micOn ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setCamOn(!camOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                camOn ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <div className="w-px h-6 bg-white/10 mx-2"></div>
            <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-transparent hover:bg-white/10 text-white/70 hover:text-white">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Join Form & Status */}
      <div className="w-full lg:w-[40%] max-w-md bg-white dark:bg-zinc-950 p-8 rounded-3xl shadow-xl shadow-zinc-200/50 dark:shadow-none border border-gray-100 dark:border-zinc-800">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-green-200 dark:border-green-900/50">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Room Ready
        </div>
        
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 leading-tight">
          Ready to join?
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium line-clamp-2">
          {roomTitle}
        </p>

        {/* Hardware Selectors */}
        <div className="space-y-4 mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
              <Video className="w-4 h-4" />
            </div>
            <select 
              value={selectedVideoId || (videoDevices[0]?.deviceId || "")}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              {videoDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${device.deviceId.slice(0, 5)}`}</option>
              ))}
              {videoDevices.length === 0 && <option value="">No Camera Found</option>}
            </select>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
              <Mic className="w-4 h-4" />
            </div>
            <select 
              value={selectedAudioInputId || (audioInputs[0]?.deviceId || "")}
              onChange={(e) => setSelectedAudioInputId(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              {audioInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${device.deviceId.slice(0, 5)}`}</option>
              ))}
              {audioInputs.length === 0 && <option value="">No Microphone Found</option>}
            </select>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
              <MonitorSpeaker className="w-4 h-4" />
            </div>
            <select 
              value={selectedAudioOutputId || (audioOutputs[0]?.deviceId || "")}
              onChange={(e) => setSelectedAudioOutputId(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              {audioOutputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>{device.label || `Speaker ${device.deviceId.slice(0, 5)}`}</option>
              ))}
              {audioOutputs.length === 0 && <option value="">No Speaker Found</option>}
            </select>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
           <Button 
             size="lg" 
             onClick={handleJoin}
             disabled={isJoining || !!permissionError}
             className="w-full h-14 text-lg font-bold rounded-xl shadow-lg border-transparent shadow-indigo-600/20 bg-indigo-600 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
           >
             {isJoining ? (
               <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
             ) : (
               "Join Now"
             )}
           </Button>
           
           <Link href={`/interview/${interviewId}`}>
             <Button 
               variant="ghost" 
               className="w-full h-12 text-sm font-semibold rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
             >
               Return to Staging Room
             </Button>
           </Link>
        </div>
        
      </div>

    </div>
  );
}
