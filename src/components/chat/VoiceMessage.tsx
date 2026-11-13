"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export function formatDuration(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export default function VoiceMessage({ src, durationMs, waveform }: { src: string; durationMs?: number | null; waveform?: number[] | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState((durationMs || 0) / 1000);
  const [error, setError] = useState(false);
  const progress = duration ? Math.min(1, position / duration) : 0;

  async function toggle() {
    if (!ref.current) return;
    setError(false);
    if (playing) ref.current.pause();
    else try { await ref.current.play(); } catch { setError(true); }
  }

  return (
    <div className="w-full min-w-[200px] rounded-2xl border border-orange-200 bg-white/90 p-3 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
      <audio ref={ref} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError(true)} onTimeUpdate={() => setPosition(ref.current?.currentTime || 0)} onLoadedMetadata={() => {
        const value = ref.current?.duration;
        if (value && Number.isFinite(value)) setDuration(value);
      }} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} aria-label={playing ? "Pause voice message" : "Play voice message"} className="rounded-full bg-orange-500 p-2 text-white">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          {waveform && waveform.length > 0 && (
            <div className="flex h-7 items-center gap-[2px]" aria-hidden="true">
              {waveform.slice(0, 64).map((amplitude, index) => <span key={index} className={`min-w-0 flex-1 rounded-full ${index / waveform.length <= progress ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"}`} style={{ height: `${Math.max(8, Math.min(100, amplitude * 100))}%` }} />)}
            </div>
          )}
          <input aria-label="Seek voice message" type="range" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration || 1)} disabled={!duration} className="w-full accent-orange-500" onChange={(event) => {
            const value = Number(event.target.value);
            if (ref.current) ref.current.currentTime = value;
            setPosition(value);
          }} />
          <span className="text-xs tabular-nums">{formatDuration(position)} / {formatDuration(duration)}</span>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">Audio could not play. Check your connection or try another browser.</p>}
    </div>
  );
}
