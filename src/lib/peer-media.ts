/** Browser permission prompts can resolve after the component has gone away. */
export async function captureForSession(request: () => Promise<MediaStream>, isCurrent: () => boolean) {
  if (!isCurrent()) return null;
  const stream = await request();
  if (!isCurrent()) {
    stream.getTracks().forEach((track) => track.stop());
    return null;
  }
  return stream;
}

/** The newly captured stream remains our responsibility until replacement succeeds. */
export async function replaceCapturedTrack(sender: RTCRtpSender, stream: MediaStream, kind: "audio" | "video", isCurrent: () => boolean) {
  const track = stream.getTracks().find((value) => value.kind === kind);
  try {
    if (!track || !isCurrent()) throw new Error("The call has ended.");
    await sender.replaceTrack(track);
    if (!isCurrent()) throw new Error("The call has ended.");
    return track;
  } catch (error) {
    stream.getTracks().forEach((value) => value.stop());
    throw error;
  }
}

/** Only the offerer may reserve a video m-line before negotiation. The answerer
 * must use the transceiver associated by setRemoteDescription(offer). */
export function initializePeerMedia(peer: RTCPeerConnection, stream: MediaStream, isInitiator: boolean) {
  for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
  if (isInitiator) peer.addTransceiver(stream.getVideoTracks()[0] || "video", { direction: "sendrecv", streams: [stream] });
}

export function peerVideoSender(peer: RTCPeerConnection, allowUnassociated = false) {
  const videos = peer.getTransceivers().filter((transceiver) => transceiver.direction !== "stopped" && transceiver.receiver.track.kind === "video");
  return (videos.find((transceiver) => transceiver.mid !== null) || (allowUnassociated ? videos[0] : undefined))?.sender;
}

/** Attach the answerer's camera/screen to the offered video m-line, including
 * audio-only calls whose video sender is reserved for a later screen share. */
export async function prepareAnswerVideo(peer: RTCPeerConnection, stream: MediaStream, track: MediaStreamTrack | null, isCurrent: () => boolean) {
  if (!isCurrent()) return false;
  const transceiver = peer.getTransceivers().find((value) => value.direction !== "stopped" && value.mid !== null && value.receiver.track.kind === "video");
  if (!transceiver) return false;
  transceiver.direction = "sendrecv";
  transceiver.sender.setStreams(stream);
  await transceiver.sender.replaceTrack(track);
  return isCurrent();
}

export type PeerMediaState = {
  sequence: number;
  cameraEnabled: boolean;
  screenSharing: boolean;
  screenAudio: boolean;
  microphoneMuted: boolean;
};

// Kept outside the component so a remount on the accepted device cannot send a
// lower revision than the previous instance. Reconnect announcements also advance.
let lastMediaSequence = 0;
export function nextMediaSequence(now = Date.now()) {
  lastMediaSequence = Math.max(lastMediaSequence + 1, now);
  return lastMediaSequence;
}

export function acceptPeerMediaState(previous: PeerMediaState | null, next: PeerMediaState) {
  return !previous || next.sequence > previous.sequence ? next : previous;
}

export function showPeerVideo(state: PeerMediaState | null, receivingVideo: boolean, signalingConnected = true) {
  // Older clients do not publish media state. Continue their live video during
  // additive rollout; once state arrives it remains authoritative, even offline.
  return signalingConnected && receivingVideo && (!state || state.screenSharing || state.cameraEnabled);
}

/** Request another browser tab, never loop desktop call output back to the peer.
 * Browsers may ignore these hints. The returned surface is checked separately. */
export const screenCaptureOptions: DisplayMediaStreamOptions & {
  selfBrowserSurface: "exclude";
  systemAudio: "exclude";
  windowAudio: "exclude";
} = {
  video: { frameRate: { ideal: 15, max: 30 } },
  audio: true,
  selfBrowserSurface: "exclude",
  systemAudio: "exclude",
  windowAudio: "exclude",
};

export function safeScreenAudio(stream: MediaStream) {
  // Whole-desktop/window loopback can contain the remote participant's voice.
  // Tab audio is safe when a separate content tab is chosen. Unknown capture
  // surfaces fail closed; their video can still be shared without sound.
  if (stream.getVideoTracks()[0]?.getSettings().displaySurface !== "browser") return null;
  return stream.getAudioTracks().find((track) => track.readyState === "live") || null;
}

/** Mix only local microphone + captured content into the existing audio sender.
 * Nothing connects to context.destination: local monitoring would cause echo.
 * Mono output matches our mono microphone constraint, avoiding renegotiation. */
export function createCallAudioMixer(microphone: MediaStreamTrack, context = new AudioContext()) {
  const destination = context.createMediaStreamDestination();
  destination.channelCount = 1;
  destination.channelCountMode = "explicit";
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.connect(destination);
  let micSource: MediaStreamAudioSourceNode | null = null;
  let displaySource: MediaStreamAudioSourceNode | null = null;
  let disposed = false;
  const connect = (track: MediaStreamTrack) => {
    if (disposed) throw new Error("Call audio has ended.");
    const source = context.createMediaStreamSource(new MediaStream([track]));
    source.connect(limiter);
    return source;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    micSource?.disconnect(); displaySource?.disconnect(); limiter.disconnect(); destination.disconnect();
    destination.stream.getTracks().forEach((track) => track.stop());
    void context.close().catch(() => {});
  };
  try { micSource = connect(microphone); } catch (error) { dispose(); throw error; }
  return {
    track: destination.stream.getAudioTracks()[0],
    async resume() {
      await context.resume();
      if (disposed || context.state !== "running") throw new Error("Shared audio could not start. Stop sharing and try again.");
    },
    setMicrophone(track: MediaStreamTrack) {
      const replacement = connect(track);
      micSource?.disconnect(); micSource = replacement;
    },
    setDisplay(track: MediaStreamTrack | null) {
      const replacement = track ? connect(track) : null;
      displaySource?.disconnect(); displaySource = replacement;
    },
    dispose,
  };
}
