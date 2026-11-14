"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import VoiceMessage, { formatDuration } from "./VoiceMessage";

export type VoiceAttachment = { mediaAssetId: string; mediaUrl: string; mediaType: "voice"; durationMs: number; waveform?: number[] };
type Recording = { blob: Blob; url: string; durationMs: number; waveform: number[] };
const MAX_SECONDS = 120;
// MediaRecorder stop/data events are queued, and codec tails add a little time.
// Leave headroom without weakening the server's decoded 120-second maximum.
const AUTO_STOP_MS = MAX_SECONDS * 1000 - 1000;
const MAX_BYTES = 4 * 1024 * 1024;

async function inspectAudio(blob: Blob): Promise<{ durationMs: number; waveform: number[] }> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const samples = buffer.getChannelData(0);
    const waveform = Array.from({ length: 48 }, (_, index) => {
      const start = Math.floor(index * samples.length / 48);
      const end = Math.floor((index + 1) * samples.length / 48);
      let peak = 0;
      for (let offset = start; offset < end; offset += 1) peak = Math.max(peak, Math.abs(samples[offset]));
      return Math.round(peak * 1000) / 1000;
    });
    return { durationMs: Math.ceil(buffer.duration * 1000), waveform };
  } finally { await context.close(); }
}

export default function VoiceRecorder({ receiverId, conversationId, disabled, onSend }: {
  receiverId?: string;
  conversationId?: number;
  disabled?: boolean;
  onSend: (attachment: VoiceAttachment) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "permission" | "recording" | "processing" | "preview" | "uploading">("idle");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const cancelled = useRef(false);
  const urlRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const session = useRef(0);

  function releaseTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (deadlineRef.current) clearTimeout(deadlineRef.current);
    deadlineRef.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    setSupported(Boolean(window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function" && typeof window.MediaRecorder === "function"));
    return () => {
      mounted.current = false;
      session.current += 1;
      cancelled.current = true;
      stopRef.current?.();
      releaseTracks();
      requestRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function cancel() {
    session.current += 1;
    cancelled.current = true;
    requestRef.current?.abort();
    stopRef.current?.();
    releaseTracks();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setRecording(null);
    setState("idle");
  }

  async function start() {
    if (disabled || !supported || state !== "idle") return;
    const currentSession = ++session.current;
    cancelled.current = false;
    setError(null);
    setState("permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (!mounted.current || cancelled.current || session.current !== currentSession) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("This browser does not support a compatible voice recording format.");
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      const chunks: Blob[] = [];
      let bytes = 0;
      const started = performance.now();
      let stoppedAt: number | undefined;
      const stop = () => {
        if (recorder.state !== "recording") return;
        stoppedAt = performance.now();
        recorder.stop();
        // Release capture immediately instead of waiting for the queued stop event.
        releaseTracks();
        if (mounted.current && !cancelled.current && session.current === currentSession) setState("processing");
      };
      stopRef.current = stop;
      recorder.ondataavailable = (event) => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes > MAX_BYTES) stop();
      };
      recorder.onerror = () => {
        if (session.current !== currentSession) return;
        cancelled.current = true;
        releaseTracks();
        if (mounted.current) { setError("Recording was interrupted. Please try again."); setState("idle"); }
      };
      recorder.onstop = async () => {
        if (session.current !== currentSession) { stream.getTracks().forEach((track) => track.stop()); return; }
        const elapsedMs = Math.ceil((stoppedAt ?? performance.now()) - started);
        releaseTracks();
        if (!mounted.current || cancelled.current || session.current !== currentSession) return;
        if (bytes > MAX_BYTES || !bytes) { setError("Recording is empty or too large. Please record a shorter message."); setState("idle"); return; }
        if (elapsedMs > MAX_SECONDS * 1000) { setError("Recording exceeded two minutes while the browser was paused. Please record a shorter message."); setState("idle"); return; }
        setState("processing");
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const { durationMs, waveform } = await inspectAudio(blob).catch(() => ({ durationMs: elapsedMs, waveform: [] }));
        if (!mounted.current || cancelled.current || session.current !== currentSession) return;
        if (!Number.isFinite(durationMs) || durationMs < 100 || durationMs > MAX_SECONDS * 1000) { setError("Recording is too short or exceeds two minutes. Please record it again."); setState("idle"); return; }
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setRecording({ blob, url, durationMs, waveform });
        setState("preview");
      };
      recorder.start(250);
      setSeconds(0);
      setState("recording");
      deadlineRef.current = setTimeout(stop, AUTO_STOP_MS);
      timerRef.current = setInterval(() => {
        const elapsedMs = performance.now() - started;
        setSeconds(Math.min(MAX_SECONDS, Math.floor(elapsedMs / 1000)));
        if (elapsedMs >= AUTO_STOP_MS) stop();
      }, 250);
    } catch (reason) {
      if (session.current !== currentSession) return;
      releaseTracks();
      if (!mounted.current || cancelled.current) return;
      setError(reason instanceof DOMException && reason.name === "NotAllowedError" ? "Microphone permission was denied. Allow access in your browser to record." : reason instanceof Error ? reason.message : "The microphone is unavailable.");
      setState("idle");
    }
  }

  async function upload() {
    if (!recording || disabled || state !== "preview") return;
    const uploadSession = session.current;
    setState("uploading");
    setError(null);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const form = new FormData();
      const extension = recording.blob.type.includes("mp4") ? "m4a" : recording.blob.type.includes("ogg") ? "ogg" : "webm";
      form.set("audio", recording.blob, `voice.${extension}`);
      form.set("durationMs", String(recording.durationMs));
      form.set("waveform", JSON.stringify(recording.waveform));
      if (conversationId) form.set("conversationId", String(conversationId));
      else if (receiverId) form.set("receiverId", receiverId);
      const response = await fetch("/api/chat/voice", { method: "POST", body: form, signal: controller.signal });
      const attachment = await response.json();
      if (!response.ok) throw new Error(typeof attachment.error === "string" ? attachment.error : "Voice upload failed. Please retry.");
      if (!mounted.current || cancelled.current || session.current !== uploadSession) return;
      onSend({ ...attachment, waveform: attachment.waveform || recording.waveform });
      cancel();
    } catch (reason) {
      if (!mounted.current || cancelled.current || session.current !== uploadSession) return;
      setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Upload timed out. Please retry.");
      setState("preview");
    } finally { clearTimeout(timeout); }
  }

  return (
    <div className="w-full">
      {state === "idle" ? <button type="button" onClick={start} disabled={disabled || !supported} className="flex items-center gap-2 text-xs text-orange-700 disabled:opacity-50 dark:text-orange-300" title={supported ? "Record a voice message (up to 2 minutes)" : "Voice recording requires HTTPS and a supported browser"}><Mic size={17} /> Voice message</button> : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-orange-50 p-3 dark:bg-gray-700">
          {state === "recording" && <><span role="status" className="text-sm text-red-600">Recording {formatDuration(seconds)} / 2:00</span><button aria-label="Stop recording" type="button" onClick={() => stopRef.current?.()} className="rounded-full bg-red-600 p-2 text-white"><Square size={16} /></button></>}
          {state === "permission" && <span role="status" className="text-sm">Waiting for microphone permission…</span>}
          {state === "processing" && <span role="status" className="text-sm">Preparing recording…</span>}
          {recording && <div className="flex-1"><VoiceMessage src={recording.url} durationMs={recording.durationMs} waveform={recording.waveform} /></div>}
          {recording && <button type="button" onClick={upload} disabled={disabled || state !== "preview"} className="rounded-full bg-orange-500 px-4 py-2 text-sm text-white disabled:opacity-50">{state === "uploading" ? "Uploading…" : "Send voice"}</button>}
          <button type="button" onClick={cancel} aria-label="Cancel voice message" className="p-2"><X size={18} /></button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
