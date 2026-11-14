"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { fetchPrivateVoice } from "@/lib/voice-api";

export function formatDuration(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export default function VoiceMessage({ src, mediaAssetId, preview = false, durationMs, waveform }: { src: string; mediaAssetId?: string | null; preview?: boolean; durationMs?: number | null; waveform?: number[] | null }) {
  const { getToken, userId } = useAuth();
  const ref = useRef<HTMLAudioElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const session = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState((durationMs || 0) / 1000);
  const [error, setError] = useState<string | null>(null);
  const progress = duration ? Math.min(1, position / duration) : 0;

  useEffect(() => {
    const audio = ref.current;
    session.current += 1;
    setPlaying(false); setLoading(false); setReady(false); setPosition(0); setError(null);
    setDuration((durationMs || 0) / 1000);
    return () => {
      session.current += 1;
      requestRef.current?.abort(); requestRef.current = null;
      audio?.pause();
      audio?.removeAttribute("src"); audio?.load();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    };
  }, [src, mediaAssetId, preview, userId, durationMs]);

  async function toggle() {
    const audio = ref.current;
    if (!audio || requestRef.current) return;
    setError(null);
    if (playing) { audio.pause(); return; }
    const currentSession = session.current;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      if (preview) {
        if (!src.startsWith("blob:")) throw new Error("The recording preview is unavailable.");
        if (audio.src !== src) audio.src = src;
      } else if (!objectUrl.current) {
        setLoading(true);
        const blob = await fetchPrivateVoice(src, mediaAssetId, getToken, controller.signal);
        if (session.current !== currentSession || controller.signal.aborted) return;
        objectUrl.current = URL.createObjectURL(blob);
        audio.src = objectUrl.current;
      }
      if (session.current !== currentSession || controller.signal.aborted) return;
      setReady(true);
      await audio.play();
    } catch (reason) {
      if (session.current !== currentSession) return;
      setError(reason instanceof Error && reason.name === "NotAllowedError" && (preview || objectUrl.current) ? "Audio is ready. Tap Play again to allow playback in this browser." : reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Audio could not load. Check your connection and retry.");
    } finally {
      clearTimeout(timeout);
      if (session.current === currentSession) { requestRef.current = null; setLoading(false); }
    }
  }

  return (
    <div className="w-full min-w-[200px] rounded-2xl border border-orange-200 bg-white/90 p-3 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
      <audio ref={ref} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError("Audio could not play. Check your connection or try another browser.")} onTimeUpdate={() => setPosition(ref.current?.currentTime || 0)} onLoadedMetadata={() => {
        const value = ref.current?.duration;
        if (value && Number.isFinite(value)) setDuration(value);
      }} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} disabled={loading} aria-label={loading ? "Loading voice message" : playing ? "Pause voice message" : "Play voice message"} className="rounded-full bg-orange-500 p-2 text-white disabled:opacity-50">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          {waveform && waveform.length > 0 && (
            <div className="flex h-7 items-center gap-[2px]" aria-hidden="true">
              {waveform.slice(0, 64).map((amplitude, index) => <span key={index} className={`min-w-0 flex-1 rounded-full ${index / waveform.length <= progress ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"}`} style={{ height: `${Math.max(8, Math.min(100, amplitude * 100))}%` }} />)}
            </div>
          )}
          <input aria-label="Seek voice message" type="range" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration || 1)} disabled={!duration || !ready} className="w-full accent-orange-500" onChange={(event) => {
            const value = Number(event.target.value);
            if (ref.current) ref.current.currentTime = value;
            setPosition(value);
          }} />
          <span className="text-xs tabular-nums">{formatDuration(position)} / {formatDuration(duration)}</span>
        </div>
      </div>
      {loading && <p role="status" className="mt-2 text-xs">Loading private voice message…</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
