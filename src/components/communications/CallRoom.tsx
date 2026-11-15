"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import "@livekit/components-styles";
import type { Call } from "./types";
import PeerCall from "./PeerCall";
import GroupCall from "./GroupCall";

export default function CallRoom(props: { call: Call; socket: Socket; userId: string; deviceId: string; onLeave: () => void }) {
  const { call, onLeave } = props;
  const container = useRef<HTMLElement>(null);
  const [viewNotice, setViewNotice] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.max(0, Math.floor((Date.now() - new Date(call.startedAt || call.createdAt).getTime()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [call.createdAt, call.startedAt]);

  useEffect(() => {
    const element = container.current;
    const update = () => setFullscreen(document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  async function toggleFullscreen() {
    setViewNotice("");
    try {
      if (document.fullscreenElement === container.current) await document.exitFullscreen();
      else {
        setMinimized(false); setExpanded(true);
        if (!container.current?.requestFullscreen || !document.fullscreenEnabled) {
          setViewNotice("Fullscreen is unavailable in this browser. The call is expanded to fit your screen.");
          return;
        }
        // Fullscreen the whole call so controls remain available and audio
        // continues through the same playback element.
        await container.current.requestFullscreen();
      }
    } catch { setViewNotice("Fullscreen could not open. The expanded call view remains available."); }
  }

  async function minimize() {
    if (document.fullscreenElement === container.current) await document.exitFullscreen().catch(() => {});
    setMinimized((value) => !value);
  }

  const large = expanded || fullscreen;
  const position = fullscreen ? "inset-0 h-dvh w-screen rounded-none" : minimized ? "bottom-3 right-3 w-[min(94vw,360px)] rounded-2xl" : expanded ? "inset-2 rounded-2xl sm:inset-4" : "bottom-3 right-3 w-[min(94vw,840px)] rounded-2xl";

  return <section ref={container} aria-label="Active call" className={`fixed z-[80] flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden border border-gray-700 bg-gray-950 text-white shadow-2xl ${position}`} style={fullscreen ? { maxHeight: "100dvh" } : undefined}>
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-800 p-3 text-sm">
      <span className="mr-auto whitespace-nowrap font-medium">{call.kind === "VIDEO" ? "Video" : "Voice"} call · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
      {!minimized && <>
        {!fullscreen && <button aria-label={expanded ? "Compact call window" : "Expand call window"} aria-pressed={expanded} onClick={() => setExpanded((value) => !value)} className="min-h-10 rounded-lg px-2 hover:bg-gray-800">{expanded ? "Compact" : "Expand"}</button>}
        <button onClick={() => void toggleFullscreen()} className="min-h-10 rounded-lg px-2 hover:bg-gray-800">{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
      </>}
      <button onClick={() => void minimize()} className="min-h-10 rounded-lg px-2 hover:bg-gray-800">{minimized ? "Restore" : "Minimize"}</button>
      <button onClick={onLeave} className="min-h-10 rounded-lg bg-red-700 px-3 py-2 hover:bg-red-600">Hang up</button>
    </header>
    {/* Minimize keeps media components mounted and active. */}
    <div className={`min-h-0 overflow-y-auto ${large ? "flex flex-1 flex-col" : ""}`} style={{ display: minimized ? "none" : undefined }}>
      {viewNotice && <p role="status" className="p-3 text-xs text-gray-300">{viewNotice}</p>}
      {call.transport === "p2p" ? <PeerCall {...props} expanded={large} /> : <GroupCall {...props} expanded={large} />}
    </div>
  </section>;
}
