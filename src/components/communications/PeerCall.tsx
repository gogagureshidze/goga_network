"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { emitWithAck } from "@/hooks/useRealtimeSocket";
import { acceptPeerMediaState, captureForSession, createCallAudioMixer, initializePeerMedia, nextMediaSequence, peerVideoSender, prepareAnswerVideo, replaceCapturedTrack, safeScreenAudio, screenCaptureOptions, showPeerVideo, type PeerMediaState } from "@/lib/peer-media";
import type { Call } from "./types";
import { createIceCredentialRefresher, createRemoteIceBuffer, iceTransportPolicy, selectedIcePaths, type IceCredentials, type IcePathDiagnostic } from "@/lib/peer-ice";

type Signal = { callId: string; fromUserId: string; toDeviceId?: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; ready?: boolean; mediaState?: PeerMediaState };

export default function PeerCall({ call, socket, userId, deviceId, onLeave, expanded = false }: { call: Call; socket: Socket; userId: string; deviceId: string; onLeave: () => void; expanded?: boolean }) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const screen = useRef<MediaStream | null>(null);
  const mixer = useRef<ReturnType<typeof createCallAudioMixer> | null>(null);
  const mediaFlags = useRef({ cameraEnabled: call.kind === "VIDEO", screenSharing: false, screenAudio: false, microphoneMuted: false });
  const publishMedia = useRef<() => void>(() => {});
  const epoch = useRef(0);
  const actionInFlight = useRef(false);
  const mediaOperation = useRef<Promise<void>>(Promise.resolve());
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Preparing microphone…");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(call.kind === "VIDEO");
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [remoteMedia, setRemoteMedia] = useState<PeerMediaState | null>(null);
  const [receivingVideo, setReceivingVideo] = useState(false);
  const [signalingConnected, setSignalingConnected] = useState(socket.connected);
  const [available, setAvailable] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [changingDevice, setChangingDevice] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [meterTrack, setMeterTrack] = useState<MediaStreamTrack | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [relayAvailable, setRelayAvailable] = useState<boolean | null>(null);
  const [relayNotice, setRelayNotice] = useState("");
  const [icePaths, setIcePaths] = useState<IcePathDiagnostic[]>([]);
  const [iceServerErrors, setIceServerErrors] = useState<number[]>([]);
  const forceRelay = iceTransportPolicy(process.env.NEXT_PUBLIC_RTC_FORCE_RELAY) === "relay";
  const other = call.participants.find((participant) => participant.userId !== userId)?.userId;
  const joinedParticipant = useRef(false);
  joinedParticipant.current = call.participants.some((participant) => participant.userId === other && participant.status === "JOINED");

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
    const candidates = createRemoteIceBuffer();
    const pending: Signal[] = [];
    let ready = false;
    let otherJoined = joinedParticipant.current;
    let latestRemoteMedia: PeerMediaState | null = null;
    let awaitingRemoteState = false;
    let acknowledgedMedia = "";
    let acknowledgedSequence = 0;
    let pendingMedia = "";
    let pendingSequence = 0;
    let offering = false;
    let lastOfferAt = 0;
    let restartAttempts = 0;
    let lastRestartAt = 0;
    let disconnectedTimer: ReturnType<typeof setTimeout> | undefined;
    let credentialsRefresh: ReturnType<typeof createIceCredentialRefresher> | null = null;
    let relayRestartPending = false;
    let iceConfigurationRevision = 0;
    let relayRestartRequestedAt = 0;
    let pathReadPending = false;
    const controller = new AbortController();
    mediaFlags.current = { cameraEnabled: call.kind === "VIDEO", screenSharing: false, screenAudio: false, microphoneMuted: false };
    setAvailable(false); setVideoReady(false); setError(""); setMuted(false); setCamera(call.kind === "VIDEO"); setSharing(false); setChangingDevice(false);
    setShareNotice(""); setRelayNotice(""); setIcePaths([]); setIceServerErrors([]); setRemoteMedia(null); setReceivingVideo(false); setSignalingConnected(socket.connected);
    async function readIce() {
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 15000);
      try {
        const response = await fetch(`/api/calls/${call.id}/ice?deviceId=${encodeURIComponent(deviceId)}`, { signal: request.signal, cache: "no-store" });
        if (!response.ok) {
          if ((response.status === 401 || response.status === 403) && ready && isCurrent()) leaveRef.current();
          throw new Error(response.status === 401 || response.status === 403 ? "Call access expired. Please hang up and retry." : "Relay configuration is temporarily unavailable. Please retry.");
        }
        return await response.json() as IceCredentials;
      } finally { clearTimeout(timeout); controller.signal.removeEventListener("abort", abort); }
    }
    const send = (payload: Partial<Signal>) => emitWithAck(socket, "call:signal", { callId: call.id, toUserId: other, deviceId, ...payload });
    const announceMedia = (force = false) => {
      if (!ready || !otherJoined || !isCurrent() || !socket.connected) return;
      const fingerprint = JSON.stringify(mediaFlags.current);
      if (!force && (fingerprint === acknowledgedMedia || fingerprint === pendingMedia)) return;
      const sequence = nextMediaSequence(); pendingSequence = sequence; pendingMedia = fingerprint;
      void send({ mediaState: { ...mediaFlags.current, sequence } }).then(() => {
        if (sequence > acknowledgedSequence) { acknowledgedSequence = sequence; acknowledgedMedia = fingerprint; }
      }).catch(() => {
        if (isCurrent() && sequence >= acknowledgedSequence) setError("Media status could not sync. Reconnecting will retry.");
      }).finally(() => { if (sequence === pendingSequence) pendingMedia = ""; });
    };
    publishMedia.current = announceMedia;
    // The server permits only the initiating participant to offer. Its reserved
    // video m-line allows device changes without offer collisions.
    const offer = async (restart = false) => {
      if (!pc || offering || !isCurrent() || !socket.connected || call.initiatorId !== userId) return;
      if (pc.signalingState !== "stable") {
        if (!restart || pc.signalingState !== "have-local-offer" || Date.now() - lastOfferAt < 10000) return;
        await pc.setLocalDescription({ type: "rollback" });
      }
      offering = true;
      try {
        await credentialsRefresh?.ensureFresh();
        if (!pc || !isCurrent() || !socket.connected) return;
        const revision = iceConfigurationRevision;
        await pc.setLocalDescription(await pc.createOffer({ iceRestart: restart || relayRestartPending }));
        if (!isCurrent()) return;
        lastOfferAt = Date.now();
        await send({ description: pc.localDescription!.toJSON() });
        if (revision === iceConfigurationRevision) relayRestartPending = false;
      } finally { offering = false; }
    };
    const retryConnection = async () => {
      if (!pc || !ready || !isCurrent() || !socket.connected || pc.connectionState === "connected") return;
      if (restartAttempts >= 2 || Date.now() - lastRestartAt < 10000) return;
      lastRestartAt = Date.now(); restartAttempts += 1;
      setStatus("Reconnecting media…");
      await credentialsRefresh?.ensureFresh();
      if (!isCurrent() || !socket.connected) return;
      if (call.initiatorId === userId) queue = queue.then(() => offer(true)).catch(failedSignal);
      else await send({ ready: true });
    };
    function requestRelayRestart() {
      if (!relayRestartPending || !ready || !isCurrent() || !socket.connected || Date.now() - relayRestartRequestedAt < 5000) return;
      relayRestartRequestedAt = Date.now();
      if (call.initiatorId === userId) queue = queue.then(() => { if (relayRestartPending) return offer(true); }).catch(failedSignal);
      else void send({ ready: true }).catch(failedSignal);
    }
    const readPaths = async () => {
      if (!pc || !isCurrent() || pathReadPending || pc.connectionState !== "connected") return;
      pathReadPending = true;
      try { const paths = selectedIcePaths(await pc.getStats()); if (isCurrent()) setIcePaths(paths); }
      catch { /* Statistics are optional; media does not depend on them. */ }
      finally { pathReadPending = false; }
    };
    const process = async (signal: Signal) => {
      if (!pc || !isCurrent()) return;
      if (signal.mediaState) {
        otherJoined = true;
        const next = acceptPeerMediaState(latestRemoteMedia, signal.mediaState);
        if (next !== latestRemoteMedia) {
          latestRemoteMedia = next; awaitingRemoteState = false;
          setRemoteMedia(next); setSignalingConnected(socket.connected);
        }
        return;
      }
      if (signal.ready) {
        otherJoined = true; announceMedia(true);
        if (call.initiatorId === userId && Date.now() - lastOfferAt > 2000) await offer(Boolean(pc.localDescription && (pc.connectionState === "connected" || Date.now() - lastOfferAt > 10000)));
        return;
      }
      if (signal.description) {
        otherJoined = true;
        if (signal.description.type === "answer" && pc.signalingState !== "have-local-offer") return;
        if (signal.description.type === "offer") {
          // Refresh the answering side before gathering for a renewed ICE session.
          await credentialsRefresh?.ensureFresh();
          if (!isCurrent()) return;
          relayRestartPending = false;
        }
        await pc.setRemoteDescription(signal.description);
        for (const candidate of candidates.applyDescription(signal.description)) await pc.addIceCandidate(candidate);
        if (signal.description.type === "offer") {
          // Browser stop-sharing callbacks and device replacements use the same
          // operation boundary as an ICE restart's answer video attachment.
          await mediaOperation.current;
          if (!isCurrent() || !local.current) return;
          const videoTrack = screen.current?.getVideoTracks().find((track) => track.readyState === "live") || local.current.getVideoTracks().find((track) => track.readyState === "live") || null;
          actionInFlight.current = true; setChangingDevice(true);
          const attachment = prepareAnswerVideo(pc, local.current, videoTrack, isCurrent)
            .finally(() => { if (isCurrent()) { actionInFlight.current = false; setChangingDevice(false); } });
          mediaOperation.current = attachment.then(() => {}, () => {});
          const negotiatedVideo = await attachment;
          if (!isCurrent()) return;
          setVideoReady(negotiatedVideo);
          await pc.setLocalDescription(await pc.createAnswer());
          if (!isCurrent()) return;
          await send({ description: pc.localDescription!.toJSON() });
          announceMedia(true);
        }
      } else if (signal.candidate) {
        const candidate = candidates.receive(signal.candidate);
        if (candidate) await pc.addIceCandidate(candidate);
      }
    };
    const failedSignal = () => { if (isCurrent()) setError("Call signaling was interrupted. Reconnection will retry; hang up if it does not recover."); };
    const listener = (signal: Signal) => {
      if (signal.callId !== call.id || signal.fromUserId !== other || (signal.toDeviceId && signal.toDeviceId !== deviceId)) return;
      if (!ready) { if (pending.length < 100) pending.push(signal); return; }
      queue = queue.then(() => process(signal)).catch(failedSignal);
    };
    const announceReady = () => {
      if (isCurrent()) setSignalingConnected(socket.connected && !awaitingRemoteState);
      if (!ready || !isCurrent() || !socket.connected) return;
      announceMedia(true);
      if (call.initiatorId !== userId || awaitingRemoteState) void send({ ready: true }).catch(failedSignal);
      else if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") void retryConnection().catch(failedSignal);
    };
    const joined = ({ call: updated }: { call: Call }) => {
      if (updated.id === call.id && updated.participants.some((participant) => participant.userId === other && participant.status === "JOINED")) { otherJoined = true; announceReady(); }
    };
    socket.on("callSignal", listener);
    socket.on("callUpdated", joined);
    const networkRecovered = () => {
      if (!ready || !isCurrent()) return;
      restartAttempts = 0; lastRestartAt = 0;
      void credentialsRefresh?.ensureFresh().then(() => { if (isCurrent()) { requestRelayRestart(); announceReady(); } }).catch(() => {});
    };
    const foreground = () => { if (document.visibilityState === "visible") networkRecovered(); };
    socket.on("connect", networkRecovered);
    window.addEventListener("online", networkRecovered);
    document.addEventListener("visibilitychange", foreground);
    const signalingDisconnected = () => {
      // A lost signaling channel cannot prove that the camera is still enabled.
      // Hide stale visuals until fresh authorized state arrives; audio stays live.
      awaitingRemoteState = latestRemoteMedia !== null;
      if (isCurrent()) setSignalingConnected(false);
    };
    socket.on("disconnect", signalingDisconnected);
    const handshakeTimer = setInterval(() => {
      requestRelayRestart();
      announceMedia(); // Retry only unsynchronized state; steady calls send nothing.
      if (awaitingRemoteState && ready && socket.connected && pc?.connectionState === "connected") void send({ ready: true }).catch(failedSignal);
      if (ready && pc?.connectionState !== "connected") {
        if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") void retryConnection().catch(failedSignal);
        else announceReady();
      }
    }, 5000);
    const diagnosticsTimer = setInterval(() => { void readPaths(); }, 15000);
    void (async () => {
      if (typeof window.RTCPeerConnection !== "function" || typeof navigator.mediaDevices?.getUserMedia !== "function") throw new Error("Calls require a supported browser and HTTPS.");
      let credentials = await readIce();
      if (!isCurrent()) return;
      setRelayAvailable(credentials.relayAvailable);
      if (forceRelay && !credentials.relayAvailable) throw new Error("Relay-only validation requires configured TURN credentials.");
      const stream = await captureForSession(() => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: call.kind === "VIDEO" }), isCurrent);
      if (!stream) return;
      local.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      // A browser permission prompt can remain open longer than the TURN TTL.
      if (credentials.expiresAt <= Date.now() + 120000) credentials = await readIce();
      if (!isCurrent()) return;
      setRelayAvailable(credentials.relayAvailable);
      pc = new RTCPeerConnection({ iceServers: credentials.iceServers, iceTransportPolicy: forceRelay ? "relay" : "all" });
      credentialsRefresh = createIceCredentialRefresher({ read: readIce, isCurrent,
        apply: (renewed) => {
          if (!pc || !isCurrent()) return;
          pc.setConfiguration({ ...pc.getConfiguration(), iceServers: renewed.iceServers });
          iceConfigurationRevision += 1;
          setRelayAvailable(renewed.relayAvailable); setRelayNotice("");
          relayRestartPending = renewed.relayAvailable;
          requestRelayRestart();
        },
        onError: () => { if (isCurrent()) setRelayNotice("Relay credentials could not refresh. Retrying automatically; restrictive networks may disconnect if this continues."); },
      });
      credentialsRefresh.start(credentials);
      peer.current = pc;
      remote = new MediaStream();
      if (remoteVideo.current) remoteVideo.current.srcObject = remote;
      initializePeerMedia(pc, stream, call.initiatorId === userId);
      setVideoReady(call.initiatorId === userId);
      pc.onicecandidate = (event) => { if (event.candidate && isCurrent()) void send({ candidate: event.candidate.toJSON() }).catch(failedSignal); };
      pc.onicecandidateerror = (event) => {
        if (isCurrent() && Number.isInteger(event.errorCode)) setIceServerErrors((previous) => Array.from(new Set([...previous, event.errorCode])).slice(-6));
      };
      pc.ontrack = (event) => {
        if (!isCurrent() || !remote) return;
        if (!remote.getTracks().some((track) => track.id === event.track.id)) remote.addTrack(event.track);
        if (event.track.kind === "video") {
          const updateVideo = () => { if (isCurrent()) setReceivingVideo(event.track.readyState === "live" && !event.track.muted); };
          event.track.onmute = updateVideo; event.track.onunmute = updateVideo; event.track.onended = updateVideo;
          updateVideo();
        }
        if (remoteVideo.current) void remoteVideo.current.play().catch(() => { if (isCurrent()) setError("Tap the remote video to enable call audio."); });
      };
      pc.onconnectionstatechange = () => {
        if (!pc || !isCurrent()) return;
        setStatus(pc.connectionState === "connected" ? "Connected" : pc.connectionState);
        if (pc.connectionState !== "connected") setIcePaths([]);
        if (pc.connectionState === "connected") { restartAttempts = 0; setError(""); void readPaths(); announceMedia(true); if (disconnectedTimer) clearTimeout(disconnectedTimer); }
        if (pc.connectionState === "failed") {
          setError("Connection interrupted. Some networks require a configured TURN relay.");
          void retryConnection().catch(failedSignal);
        }
        if (pc.connectionState === "disconnected") { if (disconnectedTimer) clearTimeout(disconnectedTimer); disconnectedTimer = setTimeout(() => void retryConnection().catch(failedSignal), 8000); }
      };
      for (const track of stream.getTracks()) track.onended = () => {
        if (!isCurrent()) return;
        if (track.kind === "video") { mediaFlags.current.cameraEnabled = false; setCamera(false); announceMedia(); }
        setError("A camera or microphone disconnected. Select a device or rejoin.");
      };
      setMeterTrack(stream.getAudioTracks()[0] || null);
      const deviceList = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (!isCurrent()) return;
      setDevices(deviceList); setAvailable(true);
      ready = true;
      announceMedia();
      setStatus("Waiting for the other participant…");
      // Queue initial events through the same promise chain as subsequent ones.
      for (const signal of pending.splice(0)) queue = queue.then(() => process(signal));
      await queue.catch(failedSignal);
      if (call.initiatorId !== userId) await send({ ready: true }).catch(failedSignal);
    })().catch((reason) => {
      if (!isCurrent()) return;
      ready = false;
      credentialsRefresh?.dispose();
      pc?.close();
      peer.current = null;
      local.current?.getTracks().forEach((track) => track.stop());
      mixer.current?.dispose(); mixer.current = null;
      setAvailable(false); setMeterTrack(null);
      setError(reason.name === "NotAllowedError" ? "Camera or microphone access was denied. Allow access in your browser, then rejoin." : reason.name === "AbortError" ? "Call setup timed out. Please rejoin." : reason.message);
      setStatus("Unable to connect");
    });
    const changeDevices = () => { void navigator.mediaDevices.enumerateDevices().then((list) => { if (isCurrent()) setDevices(list); }).catch(() => {}); };
    navigator.mediaDevices?.addEventListener("devicechange", changeDevices);
    return () => {
      epoch.current += 1;
      controller.abort(); clearInterval(handshakeTimer); clearInterval(diagnosticsTimer);
      credentialsRefresh?.dispose();
      if (disconnectedTimer) clearTimeout(disconnectedTimer);
      socket.off("callSignal", listener); socket.off("callUpdated", joined); socket.off("connect", networkRecovered);
      window.removeEventListener("online", networkRecovered); document.removeEventListener("visibilitychange", foreground); socket.off("disconnect", signalingDisconnected);
      navigator.mediaDevices?.removeEventListener("devicechange", changeDevices);
      local.current?.getTracks().forEach((track) => track.stop());
      screen.current?.getTracks().forEach((track) => track.stop());
      mixer.current?.dispose(); mixer.current = null;
      remote?.getTracks().forEach((track) => track.stop());
      pc?.close(); peer.current = null; local.current = null; screen.current = null;
      actionInFlight.current = false;
      mediaOperation.current = Promise.resolve(); publishMedia.current = () => {};
      if (localElement) localElement.srcObject = null;
      if (remoteElement) remoteElement.srcObject = null;
    };
  }, [call.id, call.kind, call.initiatorId, other, socket, userId, deviceId, forceRelay]);

  const videoSender = () => peer.current ? peerVideoSender(peer.current, call.initiatorId === userId) : undefined;
  function changeDevice(action: (isCurrent: () => boolean) => Promise<void>) {
    if (actionInFlight.current || !peer.current || !available) return Promise.resolve();
    const currentEpoch = epoch.current;
    const isCurrent = () => currentEpoch === epoch.current && Boolean(peer.current && peer.current.connectionState !== "closed");
    actionInFlight.current = true; setChangingDevice(true); setError("");
    // Invoke in the click's task so getDisplayMedia retains user activation.
    const operation = action(isCurrent)
      .catch((reason) => { if (isCurrent()) setError(reason instanceof DOMException && reason.name === "NotAllowedError" ? "Permission was cancelled or denied. Check browser access and try again." : reason instanceof Error ? reason.message : "The device is unavailable."); })
      .finally(() => { if (isCurrent()) { actionInFlight.current = false; setChangingDevice(false); } });
    mediaOperation.current = operation;
    return operation;
  }
  function toggleCamera() {
    void changeDevice(async (isCurrent) => {
      const sender = videoSender();
      if (!sender) return;
      if (mediaFlags.current.cameraEnabled) {
        // The screen owns the video sender while sharing. The camera can still
        // be disabled independently, including its hardware and local preview.
        if (!screen.current) await sender.replaceTrack(null);
        if (!isCurrent()) return;
        local.current?.getVideoTracks().forEach((track) => { track.stop(); local.current?.removeTrack(track); });
        mediaFlags.current.cameraEnabled = false; setCamera(false); publishMedia.current();
      } else {
        const stream = await captureForSession(() => navigator.mediaDevices.getUserMedia({ video: true }), isCurrent);
        if (!stream) return;
        const track = screen.current ? stream.getVideoTracks()[0] : await replaceCapturedTrack(sender, stream, "video", isCurrent);
        if (!isCurrent()) { stream.getTracks().forEach((value) => value.stop()); return; }
        local.current?.getVideoTracks().forEach((old) => { old.stop(); local.current?.removeTrack(old); });
        local.current?.addTrack(track);
        track.onended = () => { if (isCurrent()) { mediaFlags.current.cameraEnabled = false; setCamera(false); publishMedia.current(); setError("Camera disconnected. Choose Camera on to reconnect it."); } };
        mediaFlags.current.cameraEnabled = true; setCamera(true); publishMedia.current();
      }
    });
  }
  async function stopSharing(stream: MediaStream, isCurrent: () => boolean) {
    if (!isCurrent() || screen.current !== stream) return;
    screen.current = null;
    stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    mediaFlags.current.screenSharing = false; mediaFlags.current.screenAudio = false;
    setSharing(false); setShareNotice(""); publishMedia.current();
    const currentMixer = mixer.current;
    currentMixer?.setDisplay(null);
    const audioSender = peer.current?.getSenders().find((sender) => sender.track?.kind === "audio");
    if (currentMixer && audioSender) {
      try {
        await audioSender.replaceTrack(local.current?.getAudioTracks()[0] || null);
        if (!isCurrent()) return;
        currentMixer.dispose(); if (mixer.current === currentMixer) mixer.current = null;
      } catch {
        // Keep the microphone-only mix live if the browser refuses replacement.
        // Its display input is already disconnected, and hangup disposes it.
        if (isCurrent()) setError("Your microphone is still connected. Shared audio has stopped.");
      }
    }
    if (!isCurrent()) return;
    try { await videoSender()?.replaceTrack(local.current?.getVideoTracks().find((track) => track.readyState === "live") || null); }
    catch {
      if (!isCurrent()) return;
      local.current?.getVideoTracks().forEach((track) => { track.stop(); local.current?.removeTrack(track); });
      mediaFlags.current.cameraEnabled = false; setCamera(false); publishMedia.current();
      setError("Camera could not resume. Choose Camera on to retry.");
    }
  }
  function shareScreen() {
    void changeDevice(async (isCurrent) => {
      const sender = videoSender();
      if (!sender) return;
      if (screen.current) return stopSharing(screen.current, isCurrent);
      if (typeof navigator.mediaDevices.getDisplayMedia !== "function") throw new Error("Screen sharing is not supported in this browser.");
      let candidateMixer = mixer.current;
      let audioReady: Promise<boolean> = Promise.resolve(false);
      let audioTimeout: ReturnType<typeof setTimeout> | undefined;
      const microphone = local.current?.getAudioTracks()[0];
      try {
        if (!candidateMixer && microphone) candidateMixer = createCallAudioMixer(microphone);
        // Resume from the user gesture, before the capture picker resolves.
        if (candidateMixer) {
          const resume = candidateMixer.resume();
          audioReady = new Promise<boolean>((resolve) => {
            audioTimeout = setTimeout(() => resolve(false), 2500);
            void resume.then(() => resolve(true), () => resolve(false));
          }).finally(() => { if (audioTimeout) clearTimeout(audioTimeout); });
        }
      } catch { /* Screen video and direct microphone remain usable without Web Audio. */ }
      try {
        const stream = await captureForSession(() => navigator.mediaDevices.getDisplayMedia(screenCaptureOptions), isCurrent);
        if (!stream) return;
        const track = await replaceCapturedTrack(sender, stream, "video", isCurrent);
        screen.current = stream; mediaFlags.current.screenSharing = true; setSharing(true);
        const displayAudio = safeScreenAudio(stream);
        // Browsers that ignore the tab-only hints must not leak desktop call audio.
        stream.getAudioTracks().filter((value) => value !== displayAudio).forEach((value) => value.stop());
        let sharingAudio = false;
        if (displayAudio && candidateMixer && await audioReady && isCurrent()) {
          try {
            const audioSender = peer.current?.getSenders().find((value) => value.track?.kind === "audio");
            if (!audioSender) throw new Error("Microphone sender unavailable.");
            candidateMixer.setDisplay(displayAudio);
            await audioSender.replaceTrack(candidateMixer.track);
            if (!isCurrent()) return;
            mixer.current = candidateMixer; sharingAudio = true;
          } catch { candidateMixer.setDisplay(null); displayAudio.stop(); }
        } else displayAudio?.stop();
        if (!isCurrent()) return;
        mediaFlags.current.screenAudio = sharingAudio;
        setShareNotice(sharingAudio ? "Sharing tab audio and your microphone. Mute only affects your microphone." : "Sharing video only. For sound, choose another browser tab and enable Share tab audio. This browser or selected surface may not support audio.");
        publishMedia.current();
        if (displayAudio) displayAudio.onended = () => {
          if (!isCurrent() || screen.current !== stream) return;
          mixer.current?.setDisplay(null); mediaFlags.current.screenAudio = false; publishMedia.current();
          setShareNotice("Tab audio stopped. Screen video and microphone remain connected.");
        };
        track.onended = () => {
          // The browser's Stop sharing may arrive during a camera/mic prompt or
          // sender replacement. Wait for it, then restore the latest camera.
          void mediaOperation.current.then(() => {
            if (isCurrent() && screen.current === stream) return changeDevice((current) => stopSharing(stream, current));
          });
        };
        if (track.readyState === "ended") await stopSharing(stream, isCurrent);
      } finally {
        if (audioTimeout) clearTimeout(audioTimeout);
        if (candidateMixer && candidateMixer !== mixer.current) candidateMixer.dispose();
      }
    });
  }
  function selectMic(id: string) {
    if (!id) return;
    void changeDevice(async (isCurrent) => {
      const sender = peer.current?.getSenders().find((value) => value.track?.kind === "audio");
      if (!sender) throw new Error("The microphone is unavailable. Rejoin the call.");
      const stream = await captureForSession(() => navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id }, echoCancellation: true, noiseSuppression: true, channelCount: 1 } }), isCurrent);
      if (!stream) return;
      stream.getAudioTracks().forEach((track) => { track.enabled = !mediaFlags.current.microphoneMuted; });
      let track: MediaStreamTrack;
      try {
        if (mixer.current && sender.track === mixer.current.track) { track = stream.getAudioTracks()[0]; mixer.current.setMicrophone(track); }
        else track = await replaceCapturedTrack(sender, stream, "audio", isCurrent);
      } catch (reason) { stream.getTracks().forEach((value) => value.stop()); throw reason; }
      if (!isCurrent()) { stream.getTracks().forEach((value) => value.stop()); return; }
      local.current?.getAudioTracks().forEach((old) => { old.stop(); local.current?.removeTrack(old); });
      local.current?.addTrack(track); setMeterTrack(track);
      track.onended = () => { if (isCurrent()) setError("Microphone disconnected. Select another microphone or rejoin."); };
    });
  }

  const remoteVisible = showPeerVideo(remoteMedia, receivingVideo, signalingConnected);
  return <div className={`flex min-h-0 flex-col gap-3 p-3 ${expanded ? "h-full" : ""}`}>
    <p role="status" className="text-sm text-gray-300">{status} · {speaking && !muted ? "Your microphone is active" : "Microphone quiet"}</p>
    {error && <p role="alert" className="rounded-lg bg-red-950 p-2 text-sm text-red-200">{error}</p>}
    {relayNotice && <p role="status" className="text-xs text-amber-200">{relayNotice}</p>}
    {forceRelay && <p className="text-xs text-amber-200">Relay-only validation mode: direct peer connections are disabled.</p>}
    <details className="text-xs text-gray-400"><summary className="cursor-pointer">Connection details</summary><p className="mt-1">{icePaths.length ? icePaths.map((path) => `${path.route === "relay" ? "TURN relay" : path.route === "direct" ? "Direct peer connection" : "Unknown path"}${path.protocol ? ` · ${path.protocol.toUpperCase()}` : ""}${path.roundTripMs !== null ? ` · ${path.roundTripMs} ms round trip` : ""} · sent ${Math.round(path.bytesSent / 1024)} KiB / received ${Math.round(path.bytesReceived / 1024)} KiB`).join("; ") : "Selected network path is not available yet in this browser."}</p>{iceServerErrors.length > 0 && <p>ICE server response codes: {iceServerErrors.join(", ")}. A failed server candidate does not mean the selected connection failed.</p>}</details>
    {relayAvailable === false && <p className="text-xs text-amber-200">This server has no TURN relay configured. Calls may fail across restrictive networks.</p>}
    <div className={`relative isolate min-h-40 overflow-hidden rounded-xl bg-black ${expanded ? "flex-1" : "h-[min(44dvh,420px)]"}`}>
      {/* Keep one playback element mounted, including when camera-off hides its
          pixels. Removing it or muting it would interrupt microphone audio. */}
      <video ref={remoteVideo} aria-label={remoteMedia?.screenSharing ? "Remote shared screen and audio" : "Remote participant video and audio"} autoPlay playsInline onClick={(event) => void event.currentTarget.play().catch(() => setError("Audio playback was blocked. Try again."))} className={`absolute inset-0 h-full w-full object-contain ${remoteVisible ? "opacity-100" : "opacity-0"}`} />
      {!remoteVisible && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-300"><span className="rounded-full bg-gray-800 p-4 text-2xl" aria-hidden="true">◉</span><p>{remoteMedia && !remoteMedia.cameraEnabled && !remoteMedia.screenSharing ? "Camera off" : "Waiting for video…"}</p><span className="text-xs text-gray-500">Call audio stays connected</span></div>}
      {remoteMedia?.screenSharing && <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs">Shared screen{remoteMedia.screenAudio ? " · Tab audio" : ""}</span>}
      <div className="pointer-events-none absolute bottom-2 right-2 h-20 w-28 overflow-hidden rounded-lg border border-white/20 bg-gray-800 shadow-xl sm:h-24 sm:w-36">
        <video ref={localVideo} aria-label="Your camera preview" autoPlay muted playsInline className={`h-full w-full object-cover ${camera ? "opacity-100" : "opacity-0"}`} />
        {!camera && <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-300">Your camera is off</span>}
      </div>
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 rounded-xl bg-gray-900 p-2">
      <button aria-pressed={muted} disabled={!available || changingDevice} className="min-h-11 rounded-lg bg-gray-700 px-3 py-2 text-sm disabled:opacity-50" onClick={() => { const next = !mediaFlags.current.microphoneMuted; local.current?.getAudioTracks().forEach((track) => { track.enabled = !next; }); mediaFlags.current.microphoneMuted = next; setMuted(next); publishMedia.current(); }}>{muted ? "Unmute microphone" : "Mute microphone"}</button>
      <button className="min-h-11 rounded-lg bg-gray-700 px-3 py-2 text-sm disabled:opacity-50" disabled={!available || !videoReady || changingDevice} onClick={toggleCamera}>{camera ? "Camera off" : "Camera on"}</button>
      <button className="min-h-11 rounded-lg bg-gray-700 px-3 py-2 text-sm disabled:opacity-50" disabled={!available || !videoReady || changingDevice} onClick={shareScreen}>{sharing ? "Stop sharing" : "Share screen"}</button>
      <select aria-label="Microphone" disabled={!available || changingDevice} className="min-h-11 max-w-full rounded-lg bg-gray-700 p-2 text-sm disabled:opacity-50 sm:max-w-48" onChange={(event) => selectMic(event.target.value)}><option value="">Microphone</option>{devices.filter((device) => device.kind === "audioinput").map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Microphone"}</option>)}</select>
    </div>
    {shareNotice && <p role="status" className="text-xs text-sky-200">{shareNotice}</p>}
    <p className="shrink-0 text-xs text-gray-400">For sound, share another browser tab and enable “Share tab audio”. Use headphones to avoid speaker feedback. This call tab and desktop audio are excluded where supported. Browser support varies; protected content may appear black. Watch together synchronizes playback separately.</p>
  </div>;
}
