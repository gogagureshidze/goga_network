export type IceCredentials = { iceServers: RTCIceServer[]; expiresAt: number; relayAvailable: boolean };

/** Leave two minutes for throttled background timers and a failed HTTP retry. */
export function iceRenewalDelay(expiresAt: number, now = Date.now()) {
  return Math.max(1000, Math.min(180000, expiresAt - now - 120000));
}

export function iceTransportPolicy(forceRelay: string | undefined): RTCIceTransportPolicy {
  return forceRelay === "true" ? "relay" : "all";
}

/** Trickle candidates may overtake the SDP for an ICE restart. A previous
 * remoteDescription is not enough: addIceCandidate requires the same ufrag.
 * Keep future candidates until their SDP arrives and discard retired ones. */
export function createRemoteIceBuffer() {
  let description: RTCSessionDescriptionInit | null = null;
  let fragments = new Set<string>();
  const retired = new Set<string>();
  let queued: RTCIceCandidateInit[] = [];
  const fragment = (candidate: RTCIceCandidateInit) => candidate.usernameFragment || candidate.candidate?.match(/(?:^|\s)ufrag\s+(\S+)/)?.[1] || null;
  const matches = (candidate: RTCIceCandidateInit) => {
    if (!description) return false;
    const value = fragment(candidate);
    // Legacy peers without generation metadata use the latest remote SDP,
    // matching the WebRTC API's specified null-usernameFragment behavior.
    if (!value) return true;
    const sections = (description.sdp || "").split(/\r?\nm=/);
    const sessionFragment = sections[0].match(/(?:^|\r?\n)a=ice-ufrag:([^\r\n]+)/)?.[1];
    let section: string | undefined;
    if (candidate.sdpMid != null) section = sections.slice(1).find((part) => part.match(/(?:^|\r?\n)a=mid:([^\r\n]+)/)?.[1] === candidate.sdpMid);
    else if (candidate.sdpMLineIndex != null) section = sections[candidate.sdpMLineIndex + 1];
    else return fragments.has(value);
    if (section === undefined) return false;
    return (section.match(/(?:^|\r?\n)a=ice-ufrag:([^\r\n]+)/)?.[1] || sessionFragment) === value;
  };
  return {
    receive(candidate: RTCIceCandidateInit): RTCIceCandidateInit | null {
      const value = fragment(candidate);
      // Some older signaling servers omit the property but preserve the
      // candidate-line extension. Restore it for browser generation checks.
      const normalized = value && !candidate.usernameFragment ? { ...candidate, usernameFragment: value } : candidate;
      if (matches(normalized)) return normalized;
      if (value && retired.has(value)) return null;
      if (queued.length === 100) queued.shift();
      queued.push(normalized);
      return null;
    },
    applyDescription(next: RTCSessionDescriptionInit) {
      const nextFragments = new Set([...(next.sdp || "").matchAll(/(?:^|\r?\n)a=ice-ufrag:([^\r\n]+)/g)].map((match) => match[1]));
      for (const value of fragments) if (!nextFragments.has(value)) retired.add(value);
      while (retired.size > 32) retired.delete(retired.values().next().value!);
      description = next; fragments = nextFragments;
      const ready = queued.filter(matches);
      queued = queued.filter((candidate) => !matches(candidate) && !retired.has(fragment(candidate) || ""));
      return ready;
    },
  };
}

/** A single in-flight refresh shared by timer, network recovery and negotiation. */
export function createIceCredentialRefresher(options: {
  read: () => Promise<IceCredentials>;
  apply: (credentials: IceCredentials) => void;
  onError: () => void;
  isCurrent: () => boolean;
  now?: () => number;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}) {
  const now = options.now || Date.now;
  const setTimer = options.setTimer || setTimeout;
  const clearTimer = options.clearTimer || clearTimeout;
  let expiresAt = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | null = null;
  let failures = 0;
  const active = () => !disposed && options.isCurrent();
  function schedule(delay: number) {
    if (timer) clearTimer(timer);
    if (active()) timer = setTimer(() => { void ensureFresh(120000).catch(() => {}); }, delay);
  }
  function accept(credentials: IceCredentials) {
    if (!Number.isFinite(credentials.expiresAt) || credentials.expiresAt <= now() + 1000 || !Array.isArray(credentials.iceServers)) throw new Error("Invalid or expired ICE credentials");
    expiresAt = credentials.expiresAt;
    failures = 0;
    schedule(iceRenewalDelay(expiresAt, now()));
  }
  function ensureFresh(minValidityMs = 120000): Promise<void> {
    if (!active()) return Promise.resolve();
    if (pending) return pending;
    if (expiresAt - now() > minValidityMs) { schedule(iceRenewalDelay(expiresAt, now())); return Promise.resolve(); }
    pending = Promise.resolve().then(options.read).then(credentials => {
      if (!active()) return;
      if (!Number.isFinite(credentials.expiresAt) || credentials.expiresAt <= now() + 1000) throw new Error("Expired ICE credentials");
      options.apply(credentials);
      accept(credentials);
    }).catch(error => {
      if (active()) { failures += 1; options.onError(); schedule(Math.min(30000, 5000 * 2 ** Math.min(failures - 1, 3))); }
      throw error;
    }).finally(() => { pending = null; });
    return pending;
  }
  return {
    start: accept,
    ensureFresh,
    dispose() { disposed = true; if (timer) clearTimer(timer); },
  };
}

type DiagnosticStat = { type: string; id: string; selectedCandidatePairId?: string; localCandidateId?: string; remoteCandidateId?: string; candidateType?: string; protocol?: string; relayProtocol?: string; currentRoundTripTime?: number; bytesSent?: number; bytesReceived?: number; selected?: boolean; state?: string };
export type IcePathDiagnostic = { route: "relay" | "direct" | "unknown"; protocol: "udp" | "tcp" | "tls" | null; roundTripMs: number | null; bytesSent: number; bytesReceived: number };

/** Only allowlisted aggregate values leave getStats; never addresses, SDP or credentials. */
export function selectedIcePaths(report: RTCStatsReport): IcePathDiagnostic[] {
  const stats: DiagnosticStat[] = [];
  report.forEach(value => stats.push(value as DiagnosticStat));
  const selected = new Set(stats.filter(value => value.type === "transport" && value.selectedCandidatePairId).map(value => value.selectedCandidatePairId!));
  // Older engines expose selected on a candidate pair instead of transport.
  if (!selected.size) stats.filter(value => value.type === "candidate-pair" && value.selected === true).forEach(value => selected.add(value.id));
  return [...selected].flatMap(id => {
    const pair = report.get(id) as DiagnosticStat | undefined;
    if (!pair || pair.state !== "succeeded") return [];
    const local = report.get(pair.localCandidateId || "") as DiagnosticStat | undefined;
    const remote = report.get(pair.remoteCandidateId || "") as DiagnosticStat | undefined;
    const relay = local?.candidateType === "relay" || remote?.candidateType === "relay";
    const candidateTypes = ["host", "srflx", "prflx", "relay"];
    const known = Boolean(local && remote && candidateTypes.includes(local.candidateType || "") && candidateTypes.includes(remote.candidateType || ""));
    const protocol = local?.candidateType === "relay" ? local.relayProtocol : local?.protocol;
    return [{ route: relay ? "relay" as const : known ? "direct" as const : "unknown" as const,
      protocol: protocol === "udp" || protocol === "tcp" || protocol === "tls" ? protocol : null,
      roundTripMs: typeof pair.currentRoundTripTime === "number" && Number.isFinite(pair.currentRoundTripTime) ? Math.round(pair.currentRoundTripTime * 1000) : null,
      bytesSent: Number.isFinite(pair.bytesSent) ? Math.max(0, pair.bytesSent!) : 0,
      bytesReceived: Number.isFinite(pair.bytesReceived) ? Math.max(0, pair.bytesReceived!) : 0 }];
  });
}
