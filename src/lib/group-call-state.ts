import type { Call, ScreenShareLease } from "@/components/communications/types";
import { captureForSession } from "@/lib/peer-media";

export type ScreenLeaseView = { version: number; share: ScreenShareLease | null; serverTime: number; deadline: number };

/** Keep delayed HTTP polls/Socket.IO acknowledgements from restoring a retired
 * media room or a screen lease. Terminal call state is handled by the caller. */
export function isCurrentCallUpdate(previous: Call | null, next: Call) {
  if (!previous || previous.id !== next.id) return true;
  return (next.mediaVersion || 0) >= (previous.mediaVersion || 0) &&
    (next.screenVersion || 0) >= (previous.screenVersion || 0) &&
    (next.serverTime === undefined || previous.serverTime === undefined || next.serverTime >= previous.serverTime);
}

export function isCallInvitation(call: Call, userId: string) {
  return ["RINGING", "ACTIVE"].includes(call.status) && call.initiatorId !== userId &&
    call.participants.some((participant) => participant.userId === userId && participant.status === "INVITED");
}

export function screenLeaseView(call: Call, receivedAt = Date.now()): ScreenLeaseView {
  const serverTime = call.serverTime ?? receivedAt;
  const share = call.screenShare || null;
  const lifetime = share ? Math.max(0, Math.min(20_000, Date.parse(share.expiresAt) - serverTime)) : 0;
  return { version: call.screenVersion || 0, share, serverTime, deadline: receivedAt + lifetime };
}

export function acceptScreenLease(previous: ScreenLeaseView, next: ScreenLeaseView) {
  if (next.version < previous.version || (next.version === previous.version && next.serverTime < previous.serverTime)) return previous;
  return next;
}

export function ownsScreenLease(share: ScreenShareLease | null | undefined, userId: string, deviceId: string) {
  return Boolean(share && share.userId === userId && share.deviceId === deviceId);
}

export function groupCameraVisible(publication?: { isMuted: boolean; track?: { mediaStreamTrack: { readyState: string } } }) {
  return Boolean(publication && !publication.isMuted && publication.track?.mediaStreamTrack.readyState === "live");
}

/** Cancels a pending browser picker even when it has not returned a stream yet.
 * Availability is checked again after each async boundary, including a lease ack. */
export function createScreenCaptureGuard() {
  let revision = 0;
  return {
    begin: () => ++revision,
    invalidate: () => { revision += 1; },
    valid: (ticket: number, available: boolean) => ticket === revision && available,
  };
}

/** Camera denial/device failure can still leave an authorized voice call usable.
 * Never request a microphone if the participant's current choice is muted. */
export async function captureGroupDevices(request: (constraints: MediaStreamConstraints) => Promise<MediaStream>, constraints: MediaStreamConstraints, isCurrent: () => boolean) {
  try {
    return { stream: await captureForSession(() => request(constraints), isCurrent), cameraUnavailable: false };
  } catch (error) {
    if (!isCurrent() || !constraints.video || !constraints.audio) throw error;
    return { stream: await captureForSession(() => request({ audio: constraints.audio }), isCurrent), cameraUnavailable: true };
  }
}

/** The SDK publish may resolve after hangup, device replacement or lease loss.
 * Release both raw capture and any publications in all those failure paths. */
export async function publishGroupCapture(
  stream: MediaStream,
  publish: (track: MediaStreamTrack) => Promise<unknown>,
  unpublish: (track: MediaStreamTrack) => Promise<unknown>,
  isCurrent: () => boolean,
) {
  const published: MediaStreamTrack[] = [];
  try {
    for (const track of stream.getTracks()) {
      if (!isCurrent() || track.readyState !== "live") throw new Error("Media session ended.");
      await publish(track);
      published.push(track);
      if (!isCurrent()) throw new Error("Media session ended.");
    }
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await Promise.allSettled(published.map((track) => unpublish(track)));
    throw error;
  }
}
