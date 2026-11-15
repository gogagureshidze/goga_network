"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Room, RoomEvent, Track, ConnectionState, type TrackPublishOptions } from "livekit-client";
import { RoomAudioRenderer, VideoTrack, useAudioPlayback, useConnectionState, useLocalParticipant, useParticipants, useSpeakingParticipants, useTracks } from "@livekit/components-react";
import type { Socket } from "socket.io-client";
import { emitWithAck } from "@/hooks/useRealtimeSocket";
import { captureForSession, safeScreenAudio, screenCaptureOptions } from "@/lib/peer-media";
import { acceptScreenLease, captureGroupDevices, createScreenCaptureGuard, groupCameraVisible, ownsScreenLease, publishGroupCapture, screenLeaseView } from "@/lib/group-call-state";
import type { Call, ScreenShareLease } from "./types";

type Props = { call: Call; socket: Socket; userId: string; deviceId: string; expanded?: boolean };
type Choices = { microphone: boolean; camera: boolean; microphoneId: string };
type Credentials = { token: string; serverUrl: string; mediaVersion: number; screenVersion?: number; leaseId?: string };
const cameraConstraints: MediaTrackConstraints = { width: { ideal: 640, max: 1280 }, height: { ideal: 360, max: 720 }, frameRate: { ideal: 20, max: 24 } };
const publishDefaults: TrackPublishOptions = { simulcast: false, videoEncoding: { maxBitrate: 350_000, maxFramerate: 24 }, screenShareEncoding: { maxBitrate: 1_000_000, maxFramerate: 15 } };
const microphoneConstraints = (id: string): MediaTrackConstraints => ({ echoCancellation: true, noiseSuppression: true, channelCount: 1, ...(id ? { deviceId: { exact: id } } : {}) });
const newRoom = () => new Room({ adaptiveStream: true, dynacast: true, publishDefaults });
const stopStream = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());
const mediaError = (reason: unknown) => reason instanceof Error && reason.name === "NotAllowedError"
  ? "Media permission was denied. Allow access in your browser and try again."
  : reason instanceof Error ? reason.message : "Media could not connect. Please retry.";

async function credentials(callId: string, deviceId: string, media: "main" | "screen", signal: AbortSignal, leaseId?: string): Promise<Credentials> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, 12_000);
  try {
    const response = await fetch(`/api/calls/${callId}/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, media, ...(leaseId ? { leaseId } : {}) }), cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 403 ? "Your call or screen-sharing permission changed." : "Group media is unavailable. Check the configured self-hosted media service.");
    return await response.json() as Credentials;
  } finally { clearTimeout(timeout); signal.removeEventListener("abort", abort); }
}

export default function GroupCall(props: Props) {
  const choices = useRef<Choices>({ microphone: true, camera: props.call.kind === "VIDEO", microphoneId: "" });
  const [retry, setRetry] = useState(0);
  // Membership changes retire the old media room. Do not interpret the old
  // room's disconnection as application hangup; reconnect with current intent.
  return <GroupSession key={`${props.call.id}:${props.call.mediaVersion || 0}:${retry}`} {...props} choices={choices} retry={() => setRetry((value) => value + 1)} />;
}

function GroupSession({ call, socket, userId, deviceId, expanded, choices, retry }: Props & { choices: MutableRefObject<Choices>; retry: () => void }) {
  const [room] = useState(newRoom);
  const epoch = useRef(0);
  const ownedTracks = useRef(new Set<MediaStreamTrack>());
  const busy = useRef(true);
  const [changing, setChanging] = useState(true);
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [screenVisible, setScreenVisible] = useState(false);
  const connection = useConnectionState(room);
  const { isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant({ room });
  const participants = useParticipants({ room });
  const speakers = useSpeakingParticipants({ room });
  const cameras = useTracks([Track.Source.Camera], { room, onlySubscribed: false });
  const { canPlayAudio, startAudio } = useAudioPlayback(room);

  useEffect(() => {
    const generation = ++epoch.current;
    const current = () => epoch.current === generation;
    const controller = new AbortController();
    const tracks = ownedTracks.current;
    const disconnected = () => { if (current()) { setReady(false); setError("Group media disconnected. Retry media, or wait for the room to refresh after a membership change."); } };
    const deviceChanged = () => { void navigator.mediaDevices.enumerateDevices().then((list) => { if (current()) setDevices(list); }).catch(() => {}); };
    room.on(RoomEvent.Disconnected, disconnected);
    navigator.mediaDevices?.addEventListener("devicechange", deviceChanged);
    void (async () => {
      const token = await credentials(call.id, deviceId, "main", controller.signal);
      if (!current()) return;
      if (token.mediaVersion !== (call.mediaVersion || 0)) throw new Error("Call membership changed. Waiting for the updated room; retry if necessary.");
      await room.connect(token.serverUrl, token.token, { autoSubscribe: true, peerConnectionTimeout: 15_000 });
      if (!current()) { await room.disconnect(); return; }
      setReady(true);
      const selected = choices.current;
      if (selected.microphone || selected.camera) {
        const { stream, cameraUnavailable } = await captureGroupDevices((constraints) => navigator.mediaDevices.getUserMedia(constraints), { audio: selected.microphone ? microphoneConstraints(selected.microphoneId) : false, video: selected.camera ? cameraConstraints : false }, current);
        if (!stream) return;
        if (cameraUnavailable) choices.current.camera = false;
        stream.getTracks().forEach((track) => {
          tracks.add(track);
          track.addEventListener("ended", () => { if (current()) setError("A media device disconnected. Select a microphone or enable your camera again."); }, { once: true });
        });
        await publishGroupCapture(stream,
          (track) => room.localParticipant.publishTrack(track, { ...publishDefaults, source: track.kind === "audio" ? Track.Source.Microphone : Track.Source.Camera }),
          (track) => room.localParticipant.unpublishTrack(track), current);
        if (cameraUnavailable && current()) setError("Camera could not start. Your microphone is connected; enable your camera when ready.");
      }
      deviceChanged();
    })().catch((reason) => { if (current()) setError(mediaError(reason)); })
      .finally(() => { if (current()) { busy.current = false; setChanging(false); } });
    return () => {
      epoch.current += 1; controller.abort(); room.off(RoomEvent.Disconnected, disconnected);
      navigator.mediaDevices?.removeEventListener("devicechange", deviceChanged);
      tracks.forEach((track) => track.stop()); tracks.clear();
      void room.disconnect(true).catch(() => {});
    };
  }, [room, call.id, call.mediaVersion, deviceId, choices]);

  async function change(action: (current: () => boolean) => Promise<void>) {
    if (busy.current || !ready || room.state !== ConnectionState.Connected) return;
    busy.current = true; setChanging(true); setError("");
    const generation = epoch.current;
    const current = () => generation === epoch.current;
    try { await action(current); }
    catch (reason) { if (current()) setError(mediaError(reason)); }
    finally { if (current()) { busy.current = false; setChanging(false); } }
  }

  async function capture(constraints: MediaStreamConstraints, current: () => boolean) {
    const stream = await captureForSession(() => navigator.mediaDevices.getUserMedia(constraints), current);
    stream?.getTracks().forEach((track) => {
      ownedTracks.current.add(track);
      track.addEventListener("ended", () => { if (current()) setError("A media device disconnected. Choose another device or re-enable it."); }, { once: true });
    });
    return stream;
  }

  function microphone() {
    void change(async (current) => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (publication?.track && !publication.track.isStopped) {
        choices.current.microphone = publication.isMuted;
        if (publication.isMuted) await publication.unmute(); else await publication.mute();
        if (current()) choices.current.microphone = !publication.isMuted;
      } else {
        const stream = await capture({ audio: microphoneConstraints(choices.current.microphoneId) }, current);
        if (!stream) return;
        await publishGroupCapture(stream, (track) => room.localParticipant.publishTrack(track, { source: Track.Source.Microphone }), (track) => room.localParticipant.unpublishTrack(track), current);
        if (current()) choices.current.microphone = true;
      }
    });
  }

  function camera() {
    void change(async (current) => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (publication?.track && !publication.isMuted && !publication.track.isStopped) {
        choices.current.camera = false;
        await room.localParticipant.unpublishTrack(publication.track, true);
        if (current()) choices.current.camera = false;
      } else {
        if (publication?.track) await room.localParticipant.unpublishTrack(publication.track, true);
        if (!current()) return;
        const stream = await capture({ video: cameraConstraints }, current);
        if (!stream) return;
        await publishGroupCapture(stream, (track) => room.localParticipant.publishTrack(track, { ...publishDefaults, source: Track.Source.Camera }), (track) => room.localParticipant.unpublishTrack(track), current);
        if (current()) choices.current.camera = true;
      }
    });
  }

  function microphoneDevice(id: string) {
    if (!id) return;
    void change(async (current) => {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (!publication?.audioTrack) { choices.current.microphoneId = id; return; }
      const wasMuted = publication.isMuted;
      const stream = await capture({ audio: microphoneConstraints(id) }, current);
      if (!stream) return;
      const track = stream.getAudioTracks()[0]; track.enabled = !wasMuted;
      const old = publication.audioTrack.mediaStreamTrack;
      try {
        await publication.audioTrack.replaceTrack(track, { userProvidedTrack: true });
        if (!current()) { stopStream(stream); return; }
        old.stop(); ownedTracks.current.delete(old);
        if (wasMuted) await publication.mute();
        choices.current.microphoneId = id;
      } catch (reason) { stopStream(stream); throw reason; }
    });
  }

  const joined = call.participants.filter((participant) => participant.status === "JOINED");
  const invited = call.participants.filter((participant) => participant.status === "INVITED");
  return <div className={`flex min-h-0 flex-col gap-3 p-3 ${expanded ? "h-full" : ""}`}>
    <RoomAudioRenderer room={room} />
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300"><p role="status">{connection} · {joined.length}/3 participants</p>{!canPlayAudio && <button className="rounded bg-sky-800 px-3 py-2" onClick={() => void startAudio().catch(() => setError("Audio playback is blocked. Check browser permissions and try again."))}>Enable call audio</button>}</div>
    {error && <p role="alert" className="rounded-lg bg-red-950 p-2 text-sm text-red-200">{error} <button className="underline" onClick={retry}>Retry media</button></p>}
    <GroupScreenShare call={call} socket={socket} userId={userId} deviceId={deviceId} mainRoom={room} enabled={ready && connection === ConnectionState.Connected} expanded={expanded} onVisible={setScreenVisible} />
    <div className={`grid gap-2 ${joined.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"} ${!screenVisible && expanded ? "min-h-40 flex-1" : ""}`} aria-label="Call participants">
      {joined.map((member) => {
        const participant = participants.find((value) => value.identity === member.userId);
        const reference = cameras.find((value) => value.participant.identity === member.userId);
        const visible = groupCameraVisible(reference?.publication);
        const speaking = speakers.some((value) => value.identity === member.userId);
        const name = member.user?.username || participant?.name || (member.userId === userId ? "You" : "Participant");
        return <div key={member.userId} className={`relative overflow-hidden rounded-xl border-2 bg-gray-900 ${speaking ? "border-emerald-400" : "border-gray-800"} ${screenVisible ? "h-24 sm:h-28" : expanded ? "min-h-36" : "h-44 sm:h-56"}`}>
          {visible && reference ? <VideoTrack trackRef={reference} muted playsInline className="h-full w-full object-contain" /> : <div className="flex h-full min-h-24 items-center justify-center px-2 pb-5 text-center text-sm text-gray-400">{participant ? "Camera off" : "Connecting…"}</div>}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/70 px-2 py-1 text-xs"><span className="truncate">{name}{member.userId === userId && name !== "You" ? " (you)" : ""}</span><span aria-label={speaking ? "Speaking" : participant?.isMicrophoneEnabled ? "Microphone on" : "Microphone muted"}>{speaking ? "Speaking" : participant?.isMicrophoneEnabled ? "" : "Muted"}</span></div>
        </div>;
      })}
    </div>
    {invited.length > 0 && <p className="text-xs text-gray-400">Invited: {invited.map((member) => member.user?.username || "Conversation member").join(", ")}. Up to three people can join.</p>}
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 rounded-xl bg-gray-900 p-2">
      <button disabled={!ready || changing} className="min-h-11 rounded-lg bg-gray-700 px-3 py-2 text-sm disabled:opacity-50" aria-pressed={!isMicrophoneEnabled} onClick={microphone}>{isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}</button>
      <button disabled={!ready || changing} className="min-h-11 rounded-lg bg-gray-700 px-3 py-2 text-sm disabled:opacity-50" onClick={camera}>{isCameraEnabled ? "Camera off" : "Camera on"}</button>
      <select disabled={!ready || changing} aria-label="Group call microphone" defaultValue={choices.current.microphoneId} className="min-h-11 max-w-full rounded-lg bg-gray-700 p-2 text-sm disabled:opacity-50 sm:max-w-48" onChange={(event) => microphoneDevice(event.target.value)}><option value="">Microphone</option>{devices.filter((device) => device.kind === "audioinput").map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Microphone"}</option>)}</select>
    </div>
  </div>;
}

function GroupScreenShare({ call, socket, userId, deviceId, mainRoom, enabled, expanded, onVisible }: Props & { mainRoom: Room; enabled: boolean; onVisible: (visible: boolean) => void }) {
  const [view, setView] = useState(() => screenLeaseView(call));
  const viewRef = useRef(view); viewRef.current = view;
  const [capture, setCapture] = useState<{ leaseId: string; stream: MediaStream } | null>(null);
  const captureRef = useRef(capture); captureRef.current = capture;
  const pendingCapture = useRef<MediaStream | null>(null);
  const [screenRoom, setScreenRoom] = useState<Room | null>(null);
  const [screenAttempt, setScreenAttempt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const captureGuard = useRef(createScreenCaptureGuard());
  const availability = useRef(enabled); availability.current = enabled;
  const [signaling, setSignaling] = useState(socket.connected);
  const [expired, setExpired] = useState(false);
  const lease = !expired && signaling ? view.share : null;
  const leaseId = lease?.leaseId;
  const holder = ownsScreenLease(lease, userId, deviceId);
  const holderName = call.participants.find((participant) => participant.userId === lease?.userId)?.user?.username || "Another participant";

  const receive = useCallback((next: Call) => {
    setView((previous) => acceptScreenLease(previous, screenLeaseView(next)));
  }, []);
  const release = useCallback((leaseId: string) => {
    if (!socket.connected) return;
    void emitWithAck<{ call: Call }>(socket, "call:screenRelease", { callId: call.id, deviceId, leaseId }).then((result) => receive(result.call)).catch(() => { /* A retired lease is already safe; server expiry remains authoritative. */ });
  }, [socket, call.id, deviceId, receive]);
  const stopOwned = useCallback((message = "") => {
    captureGuard.current.invalidate(); busyRef.current = false; setBusy(false);
    if (pendingCapture.current) { stopStream(pendingCapture.current); pendingCapture.current = null; }
    const current = captureRef.current;
    if (current) { stopStream(current.stream); captureRef.current = null; setCapture(null); release(current.leaseId); }
    setNotice(message);
  }, [release]);

  useEffect(() => { receive(call); }, [call, receive]);
  useEffect(() => {
    setExpired(false);
    if (!view.share) return;
    const timer = setTimeout(() => { setExpired(true); stopOwned("Screen sharing expired. Your microphone and camera remain connected."); }, Math.max(0, view.deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [view, stopOwned]);
  useEffect(() => {
    onVisible(Boolean(lease));
    const current = captureRef.current;
    if (current && current.leaseId !== lease?.leaseId) stopOwned("Screen-sharing permission changed. Your microphone and camera remain connected.");
    if (lease && !holder && (pendingCapture.current || busyRef.current)) stopOwned("Another participant is presenting. Your microphone and camera remain connected.");
  }, [lease, holder, onVisible, stopOwned]);
  useEffect(() => {
    if (!enabled && (captureRef.current || pendingCapture.current || busyRef.current)) stopOwned("Screen sharing stopped while group media reconnects.");
  }, [enabled, stopOwned]);
  useEffect(() => {
    const connected = () => setSignaling(true);
    const disconnected = () => { setSignaling(false); stopOwned("Screen sharing stopped while call signaling reconnects."); };
    socket.on("connect", connected); socket.on("disconnect", disconnected);
    return () => { socket.off("connect", connected); socket.off("disconnect", disconnected); };
  }, [socket, stopOwned]);
  useEffect(() => {
    const guard = captureGuard.current;
    generation.current += 1;
    return () => { generation.current += 1; guard.invalidate(); if (pendingCapture.current) { stopStream(pendingCapture.current); pendingCapture.current = null; } const current = captureRef.current; if (current) { stopStream(current.stream); release(current.leaseId); } };
  }, [release]);

  useEffect(() => {
    if (!capture || !leaseId || capture.leaseId !== leaseId || !holder) return;
    let refreshing = false;
    let disposed = false;
    const timer = setInterval(() => {
      if (refreshing || disposed) return;
      refreshing = true;
      void emitWithAck<{ call: Call }>(socket, "call:screenHeartbeat", { callId: call.id, deviceId, leaseId: capture.leaseId })
        .then((result) => { if (!disposed) receive(result.call); })
        .catch(() => { if (!disposed) stopOwned("Screen sharing stopped because its permission could not refresh."); })
        .finally(() => { refreshing = false; });
    }, 7000);
    return () => { disposed = true; clearInterval(timer); };
  }, [capture, leaseId, holder, socket, call.id, deviceId, receive, stopOwned]);

  useEffect(() => {
    if (!leaseId || (holder && capture?.leaseId !== leaseId)) { setScreenRoom(null); return; }
    let disposed = false;
    const current = () => !disposed;
    const controller = new AbortController();
    const room = newRoom(); setScreenRoom(room); setError("");
    const failed = () => { if (!disposed) { setError("Shared content disconnected. The microphone call remains active."); if (holder) stopOwned(); } };
    room.on(RoomEvent.Disconnected, failed);
    void (async () => {
      const token = await credentials(call.id, deviceId, "screen", controller.signal, leaseId);
      if (!current()) return;
      if (token.leaseId !== leaseId) throw new Error("Screen-sharing permission changed.");
      await room.connect(token.serverUrl, token.token, { autoSubscribe: true, peerConnectionTimeout: 15_000 });
      if (!current()) { await room.disconnect(); return; }
      if (holder && capture) await publishGroupCapture(capture.stream,
        (track) => room.localParticipant.publishTrack(track, { ...publishDefaults, source: track.kind === "audio" ? Track.Source.ScreenShareAudio : Track.Source.ScreenShare }),
        (track) => room.localParticipant.unpublishTrack(track), current);
    })().catch((reason) => { if (current()) { setError(mediaError(reason)); if (holder) stopOwned(); } });
    return () => { disposed = true; controller.abort(); room.off(RoomEvent.Disconnected, failed); void room.disconnect(true).catch(() => {}); };
  }, [leaseId, holder, capture, call.id, deviceId, stopOwned, screenAttempt]);

  function startShare() {
    if (busyRef.current || !enabled || mainRoom.state !== ConnectionState.Connected || !socket.connected || viewRef.current.share) return;
    if (!navigator.mediaDevices?.getDisplayMedia) { setError("Screen sharing is unavailable in this browser. Try a supported desktop browser."); return; }
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    const session = generation.current;
    const ticket = captureGuard.current.begin();
    const current = () => generation.current === session && captureGuard.current.valid(ticket, availability.current && mainRoom.state === ConnectionState.Connected && socket.connected);
    // Capture is requested synchronously from the click, before any lease or HTTP
    // request. Only a winning server lease can publish the captured tracks.
    void captureForSession(() => navigator.mediaDevices.getDisplayMedia({ ...screenCaptureOptions, video: { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 15, max: 15 } } }), current)
      .then(async (stream) => {
        if (!stream) return;
        pendingCapture.current = stream;
        const audio = safeScreenAudio(stream);
        stream.getAudioTracks().filter((track) => track !== audio).forEach((track) => { track.stop(); stream.removeTrack(track); });
        try {
          const result = await emitWithAck<{ call: Call; screenShare: ScreenShareLease }>(socket, "call:screenClaim", { callId: call.id, deviceId });
          if (!current()) { stopStream(stream); release(result.screenShare.leaseId); return; }
          if (!ownsScreenLease(result.screenShare, userId, deviceId) || (result.call.screenVersion || 0) < viewRef.current.version || stream.getVideoTracks()[0]?.readyState !== "live") { release(result.screenShare.leaseId); throw new Error("Screen capture ended or its permission changed before sharing could start."); }
          const next = { leaseId: result.screenShare.leaseId, stream };
          captureRef.current = next; setCapture(next); receive(result.call);
          stream.getVideoTracks()[0].addEventListener("ended", () => { if (current() && captureRef.current?.leaseId === next.leaseId) stopOwned(); }, { once: true });
          setNotice(audio ? "Sharing tab audio. Microphone mute does not mute the shared content." : "Video only. For sound, choose another browser tab and enable Share tab audio; browser support varies.");
        } catch (reason) { stopStream(stream); throw reason; }
        finally { if (pendingCapture.current === stream) pendingCapture.current = null; }
      }).catch((reason) => { if (current()) setError(mediaError(reason)); })
      .finally(() => { if (generation.current === session && captureGuard.current.valid(ticket, true)) { busyRef.current = false; setBusy(false); } });
  }

  return <>
    {lease && <div className={`min-h-40 overflow-hidden rounded-xl border border-gray-700 bg-black ${expanded ? "flex-1" : "h-[min(44dvh,440px)]"}`}>
      {screenRoom ? <ScreenStage room={screenRoom} holderName={holder ? "You" : holderName} /> : <div className="flex h-full items-center justify-center text-sm text-gray-400">Connecting shared content…</div>}
    </div>}
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button disabled={busy || (!holder && (!enabled || Boolean(view.share) || !signaling))} className="min-h-10 rounded-lg bg-gray-700 px-3 py-2 text-sm disabled:opacity-50" onClick={() => holder ? stopOwned() : startShare()}>{busy ? "Preparing screen…" : holder ? "Stop sharing" : lease ? `${holderName} is sharing` : "Share screen"}</button>
      <span className="text-gray-400">One presenter at a time. Share another tab with “Share tab audio”; use headphones.</span>
    </div>
    {notice && <p role="status" className="text-xs text-sky-200">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-200">{error}{lease && !holder && <button className="ml-2 underline" onClick={() => setScreenAttempt((value) => value + 1)}>Retry shared content</button>}</p>}
  </>;
}

function ScreenStage({ room, holderName }: { room: Room; holderName: string }) {
  const tracks = useTracks([Track.Source.ScreenShare], { room, onlySubscribed: false });
  const audio = useTracks([Track.Source.ScreenShareAudio], { room });
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  const reference = tracks.find((track) => groupCameraVisible(track.publication));
  return <div className="relative h-full min-h-40 w-full">
    {/* Main room audio is rendered separately exactly once. This room contains
        only the presenter's screen audio; local publications are never replayed. */}
    <RoomAudioRenderer room={room} />
    {reference ? <VideoTrack trackRef={reference} muted playsInline className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">Waiting for shared content…</div>}
    <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs">{holderName} · Shared screen{audio.length ? " · Tab audio" : ""}</span>
    {!canPlayAudio && <button className="absolute bottom-2 left-2 rounded bg-sky-800 px-3 py-2 text-sm" onClick={() => void startAudio().catch(() => {})}>Enable shared audio</button>}
  </div>;
}
