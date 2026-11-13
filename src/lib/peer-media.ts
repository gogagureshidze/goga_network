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
