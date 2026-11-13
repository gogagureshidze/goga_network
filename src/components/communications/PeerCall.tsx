"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { emitWithAck } from "@/hooks/useRealtimeSocket";
import { captureForSession, initializePeerMedia, peerVideoSender, prepareAnswerVideo, replaceCapturedTrack } from "@/lib/peer-media";
import type { Call } from "./types";

type Signal = { callId: string; fromUserId: string; toDeviceId?: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; ready?: boolean };

export default function PeerCall({ call, socket, userId, deviceId, onLeave }: { call: Call; socket: Socket; userId: string; deviceId: string; onLeave: () => void }) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const screen = useRef<MediaStream | null>(null);
  const epoch = useRef(0);
  const actionInFlight = useRef(false);
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Preparing microphone…");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(call.kind === "VIDEO");
  const [sharing, setSharing] = useState(false);
  const [available, setAvailable] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [changingDevice, setChangingDevice] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [meterTrack, setMeterTrack] = useState<MediaStreamTrack | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [relayAvailable, setRelayAvailable] = useState<boolean | null>(null);
  const other = call.participants.find((participant) => participant.userId !== userId)?.userId;

  useEffect(() => {
    if (!meterTrack || meterTrack.readyState === "ended") return;
    let context: AudioContext | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      const source = context.createMediaStreamSource(new MediaStream([meterTrack]));
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      timer = setInterval(() => { analyser.getByteTimeDomainData(samples); setSpeaking(samples.some((value) => Math.abs(value - 128) > 12)); }, 250);
    } catch { /* Call audio remains available without a local volume meter. */ }
    return () => { if (timer) clearInterval(timer); void context?.close().catch(() => {}); };
  }, [meterTrack]);

  useEffect(() => {
    if (!other) return;
    const currentEpoch = ++epoch.current;
    const isCurrent = () => epoch.current === currentEpoch;
    const localElement = localVideo.current;
    const remoteElement = remoteVideo.current;
    let pc: RTCPeerConnection | null = null;
    let remote: MediaStream | null = null;
    let queue = Promise.resolve();
    const candidates: RTCIceCandidateInit[] = [];
    const pending: Signal[] = [];
    let ready = false;
    let offering = false;
    let lastOfferAt = 0;
    let restartAttempts = 0;
    let lastRestartAt = 0;
    let disconnectedTimer: ReturnType<typeof setTimeout> | undefined;
    let renewalTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    setAvailable(false); setVideoReady(false); setError(""); setMuted(false); setCamera(call.kind === "VIDEO"); setSharing(false); setChangingDevice(false);
    async function readIce() {
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 15000);
      try {
        const response = await fetch(`/api/calls/${call.id}/ice?deviceId=${encodeURIComponent(deviceId)}`, { signal: request.signal, cache: "no-store" });
        if (!response.ok) {
          if ((response.status === 401 || response.status === 403) && ready && isCurrent()) leaveRef.current();
          throw new Error("Call access expired. Please hang up and retry.");
        }
        return await response.json() as { iceServers: RTCIceServer[]; expiresAt: number; relayAvailable: boolean };
      } finally { clearTimeout(timeout); controller.signal.removeEventListener("abort", abort); }
    }
    const send = (payload: Partial<Signal>) => emitWithAck(socket, "call:signal", { callId: call.id, toUserId: other, deviceId, ...payload });
    // The server permits only the initiating participant to offer. Its reserved
    // video m-line allows device changes without offer collisions.
    const offer = async (restart = false) => {
      if (!pc || offering || !isCurrent() || !socket.connected || call.initiatorId !== userId) return;
      if (pc.signalingState !== "stable") {
        if (!restart || pc.signalingState !== "have-local-offer") return;
        await pc.setLocalDescription({ type: "rollback" });
      }
      offering = true;
      try {
        await pc.setLocalDescription(await pc.createOffer({ iceRestart: restart }));
        if (!isCurrent()) return;
        lastOfferAt = Date.now();
        await send({ description: pc.localDescription!.toJSON() });
      } finally { offering = false; }
    };
    const retryConnection = async () => {
      if (!pc || !ready || !isCurrent() || !socket.connected || pc.connectionState === "connected") return;
      if (restartAttempts >= 2 || Date.now() - lastRestartAt < 10000) return;
      lastRestartAt = Date.now(); restartAttempts += 1;
      setStatus("Reconnecting media…");
      if (call.initiatorId === userId) await offer(true);
      else await send({ ready: true });
    };
    function scheduleRenewal(expiresAt: number) {
      if (!isCurrent()) return;
      if (renewalTimer) clearTimeout(renewalTimer);
      renewalTimer = setTimeout(() => {
        void readIce().then(async (credentials) => {
          if (!isCurrent() || !pc) return;
          pc.setConfiguration({ ...pc.getConfiguration(), iceServers: credentials.iceServers });
          setRelayAvailable(credentials.relayAvailable);
          scheduleRenewal(credentials.expiresAt);
          if (credentials.relayAvailable && ready && socket.connected) {
            if (call.initiatorId === userId) await offer(true);
            else await send({ ready: true });
          }
        }).catch(() => {
          if (!isCurrent()) return;
          setError("Relay credentials could not refresh. Check your connection; retrying shortly.");
          scheduleRenewal(Date.now() + 90000);
        });
      }, Math.max(15000, Math.min(240000, expiresAt - Date.now() - 60000)));
    }
    const process = async (signal: Signal) => {
      if (!pc || !isCurrent()) return;
      if (signal.ready) {
        if (call.initiatorId === userId && Date.now() - lastOfferAt > 2000) await offer(Boolean(pc.localDescription && (pc.connectionState === "connected" || Date.now() - lastOfferAt > 10000)));
        return;
      }
      if (signal.description) {
        if (signal.description.type === "answer" && pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(signal.description);
        for (const candidate of candidates.splice(0)) await pc.addIceCandidate(candidate);
        if (signal.description.type === "offer") {
          if (!isCurrent() || !local.current) return;
          const videoTrack = screen.current?.getVideoTracks().find((track) => track.readyState === "live") || local.current.getVideoTracks().find((track) => track.readyState === "live") || null;
          const negotiatedVideo = await prepareAnswerVideo(pc, local.current, videoTrack, isCurrent);
          if (!isCurrent()) return;
          setVideoReady(negotiatedVideo);
          await pc.setLocalDescription(await pc.createAnswer());
          if (!isCurrent()) return;
          await send({ description: pc.localDescription!.toJSON() });
        }
      } else if (signal.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
        else if (candidates.length < 100) candidates.push(signal.candidate);
      }
    };
    const failedSignal = () => { if (isCurrent()) setError("Call signaling was interrupted. Reconnection will retry; hang up if it does not recover."); };
    const listener = (signal: Signal) => {
      if (signal.callId !== call.id || signal.fromUserId !== other || (signal.toDeviceId && signal.toDeviceId !== deviceId)) return;
      if (!ready) { if (pending.length < 100) pending.push(signal); return; }
      queue = queue.then(() => process(signal)).catch(failedSignal);
    };
    const announceReady = () => {
      if (!ready || !isCurrent() || !socket.connected) return;
      if (call.initiatorId !== userId) void send({ ready: true }).catch(failedSignal);
      else if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") void retryConnection().catch(failedSignal);
    };
    const joined = ({ call: updated }: { call: Call }) => {
      if (updated.id === call.id && updated.participants.some((participant) => participant.userId === other && participant.status === "JOINED")) announceReady();
    };
    socket.on("callSignal", listener);
    socket.on("callUpdated", joined);
    socket.on("connect", announceReady);
    const handshakeTimer = setInterval(() => {
      if (ready && pc?.connectionState !== "connected") {
        if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") void retryConnection().catch(failedSignal);
        else announceReady();
      }
    }, 5000);
    void (async () => {
      if (typeof window.RTCPeerConnection !== "function" || typeof navigator.mediaDevices?.getUserMedia !== "function") throw new Error("Calls require a supported browser and HTTPS.");
      const credentials = await readIce();
      if (!isCurrent()) return;
      setRelayAvailable(credentials.relayAvailable);
      const stream = await captureForSession(() => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: call.kind === "VIDEO" }), isCurrent);
      if (!stream) return;
      local.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      pc = new RTCPeerConnection({ iceServers: credentials.iceServers });
      scheduleRenewal(credentials.expiresAt);
      peer.current = pc;
      remote = new MediaStream();
      if (remoteVideo.current) remoteVideo.current.srcObject = remote;
      initializePeerMedia(pc, stream, call.initiatorId === userId);
      setVideoReady(call.initiatorId === userId);
      pc.onicecandidate = (event) => { if (event.candidate && isCurrent()) void send({ candidate: event.candidate.toJSON() }).catch(failedSignal); };
      pc.ontrack = (event) => {
        if (!isCurrent() || !remote) return;
        if (!remote.getTracks().some((track) => track.id === event.track.id)) remote.addTrack(event.track);
        if (remoteVideo.current) void remoteVideo.current.play().catch(() => { if (isCurrent()) setError("Tap the remote video to enable call audio."); });
      };
      pc.onconnectionstatechange = () => {
        if (!pc || !isCurrent()) return;
        setStatus(pc.connectionState === "connected" ? "Connected" : pc.connectionState);
        if (pc.connectionState === "connected") { restartAttempts = 0; setError(""); if (disconnectedTimer) clearTimeout(disconnectedTimer); }
        if (pc.connectionState === "failed") {
          setError("Connection interrupted. Some networks require a configured TURN relay.");
          void retryConnection().catch(failedSignal);
        }
        if (pc.connectionState === "disconnected") { if (disconnectedTimer) clearTimeout(disconnectedTimer); disconnectedTimer = setTimeout(() => void retryConnection().catch(failedSignal), 8000); }
      };
      for (const track of stream.getTracks()) track.onended = () => { if (isCurrent()) setError("A camera or microphone disconnected. Select a device or rejoin."); };
      setMeterTrack(stream.getAudioTracks()[0] || null);
      const deviceList = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (!isCurrent()) return;
      setDevices(deviceList); setAvailable(true);
      ready = true;
      setStatus("Waiting for the other participant…");
      // Queue initial events through the same promise chain as subsequent ones.
      for (const signal of pending.splice(0)) queue = queue.then(() => process(signal));
      await queue.catch(failedSignal);
      if (call.initiatorId !== userId) await send({ ready: true }).catch(failedSignal);
    })().catch((reason) => {
      if (!isCurrent()) return;
      ready = false;
      if (renewalTimer) clearTimeout(renewalTimer);
      pc?.close();
      peer.current = null;
      local.current?.getTracks().forEach((track) => track.stop());
      setAvailable(false); setMeterTrack(null);
      setError(reason.name === "NotAllowedError" ? "Camera or microphone access was denied. Allow access in your browser, then rejoin." : reason.name === "AbortError" ? "Call setup timed out. Please rejoin." : reason.message);
      setStatus("Unable to connect");
    });
    const changeDevices = () => { void navigator.mediaDevices.enumerateDevices().then((list) => { if (isCurrent()) setDevices(list); }).catch(() => {}); };
    navigator.mediaDevices?.addEventListener("devicechange", changeDevices);
    return () => {
      epoch.current += 1;
      controller.abort(); clearInterval(handshakeTimer);
      if (renewalTimer) clearTimeout(renewalTimer);
      if (disconnectedTimer) clearTimeout(disconnectedTimer);
      socket.off("callSignal", listener); socket.off("callUpdated", joined); socket.off("connect", announceReady);
      navigator.mediaDevices?.removeEventListener("devicechange", changeDevices);
      local.current?.getTracks().forEach((track) => track.stop());
      screen.current?.getTracks().forEach((track) => track.stop());
      remote?.getTracks().forEach((track) => track.stop());
      pc?.close(); peer.current = null; local.current = null; screen.current = null;
      actionInFlight.current = false;
      if (localElement) localElement.srcObject = null;
      if (remoteElement) remoteElement.srcObject = null;
    };
  }, [call.id, call.kind, call.initiatorId, other, socket, userId, deviceId]);

  const videoSender = () => peer.current ? peerVideoSender(peer.current, call.initiatorId === userId) : undefined;
  async function changeDevice(action: (isCurrent: () => boolean) => Promise<void>) {
    if (actionInFlight.current || !peer.current || !available) return;
    const currentEpoch = epoch.current;
    const isCurrent = () => currentEpoch === epoch.current && Boolean(peer.current && peer.current.connectionState !== "closed");
    actionInFlight.current = true; setChangingDevice(true); setError("");
    try { await action(isCurrent); }
    catch (reason) { if (isCurrent()) setError(reason instanceof DOMException && reason.name === "NotAllowedError" ? "Permission was cancelled or denied. Check browser access and try again." : reason instanceof Error ? reason.message : "The device is unavailable."); }
    finally { if (isCurrent()) { actionInFlight.current = false; setChangingDevice(false); } }
  }
  function toggleCamera() {
    void changeDevice(async (isCurrent) => {
      const sender = videoSender();
      if (!sender || sharing) return;
      if (camera) {
        await sender.replaceTrack(null);
        local.current?.getVideoTracks().forEach((track) => { track.stop(); local.current?.removeTrack(track); });
        if (isCurrent()) setCamera(false);
      } else {
        const stream = await captureForSession(() => navigator.mediaDevices.getUserMedia({ video: true }), isCurrent);
        if (!stream) return;
        const track = await replaceCapturedTrack(sender, stream, "video", isCurrent);
        local.current?.getVideoTracks().forEach((old) => { old.stop(); local.current?.removeTrack(old); });
        local.current?.addTrack(track); setCamera(true);
      }
    });
  }
  function shareScreen() {
    void changeDevice(async (isCurrent) => {
      const sender = videoSender();
      if (!sender) return;
      if (sharing) {
        await sender.replaceTrack(local.current?.getVideoTracks().find((track) => track.readyState === "live") || null);
        screen.current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
        screen.current = null; if (isCurrent()) setSharing(false); return;
      }
      if (typeof navigator.mediaDevices.getDisplayMedia !== "function") throw new Error("Screen sharing is not supported in this browser.");
      const stream = await captureForSession(() => navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }), isCurrent);
      if (!stream) return;
      const track = await replaceCapturedTrack(sender, stream, "video", isCurrent);
      screen.current = stream; setSharing(true);
      track.onended = () => {
        stream.getTracks().forEach((value) => value.stop());
        if (!isCurrent()) return;
        screen.current = null; setSharing(false);
        void sender.replaceTrack(local.current?.getVideoTracks().find((value) => value.readyState === "live") || null).catch(() => setError("Camera could not resume. Toggle the camera to retry."));
      };
    });
  }
  function selectMic(id: string) {
    if (!id) return;
    void changeDevice(async (isCurrent) => {
      const sender = peer.current?.getSenders().find((value) => value.track?.kind === "audio");
      if (!sender) throw new Error("The microphone is unavailable. Rejoin the call.");
      const stream = await captureForSession(() => navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id }, echoCancellation: true, noiseSuppression: true } }), isCurrent);
      if (!stream) return;
      stream.getAudioTracks().forEach((track) => { track.enabled = !muted; });
      const track = await replaceCapturedTrack(sender, stream, "audio", isCurrent);
      local.current?.getAudioTracks().forEach((old) => { old.stop(); local.current?.removeTrack(old); });
      local.current?.addTrack(track); setMeterTrack(track);
    });
  }

  return <div className="space-y-3 p-3">
    <p role="status" className="text-sm text-gray-300">{status} · {speaking && !muted ? "Your microphone is active" : "Microphone quiet"}</p>
    {error && <p role="alert" className="rounded-lg bg-red-950 p-2 text-sm text-red-200">{error}</p>}
    {relayAvailable === false && <p className="text-xs text-amber-200">This server has no TURN relay configured. Calls may fail across restrictive networks.</p>}
    <div className="relative"><video ref={remoteVideo} aria-label="Remote participant video and audio" autoPlay playsInline onClick={(event) => void event.currentTarget.play().catch(() => setError("Audio playback was blocked. Try again."))} className="h-56 w-full rounded-xl bg-black object-contain" /><video ref={localVideo} aria-label="Your camera preview" autoPlay muted playsInline className="absolute bottom-2 right-2 h-20 w-28 rounded bg-gray-800 object-cover" /></div>
    <div className="flex flex-wrap gap-2">
      <button disabled={!available || changingDevice} className="rounded bg-gray-700 px-3 py-2 disabled:opacity-50" onClick={() => { local.current?.getAudioTracks().forEach((track) => { track.enabled = muted; }); setMuted(!muted); }}>{muted ? "Unmute" : "Mute"}</button>
      <button className="rounded bg-gray-700 px-3 py-2 disabled:opacity-50" disabled={!available || !videoReady || sharing || changingDevice} onClick={toggleCamera}>{camera ? "Camera off" : "Camera on"}</button>
      <button className="rounded bg-gray-700 px-3 py-2 disabled:opacity-50" disabled={!available || !videoReady || changingDevice} onClick={shareScreen}>{sharing ? "Stop sharing" : "Share screen"}</button>
      <select aria-label="Microphone" disabled={!available || changingDevice} className="max-w-48 rounded bg-gray-700 p-2 disabled:opacity-50" onChange={(event) => selectMic(event.target.value)}><option value="">Microphone</option>{devices.filter((device) => device.kind === "audioinput").map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Microphone"}</option>)}</select>
      <button onClick={onLeave} className="rounded bg-red-800 px-3 py-2">Leave</button>
    </div>
    <p className="text-xs text-gray-400">Screen sharing broadcasts your selected screen. Synchronized playback is available separately in Watch together. Protected content may appear black.</p>
  </div>;
}
