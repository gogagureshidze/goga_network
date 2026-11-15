const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const { createIceCredentialRefresher, createRemoteIceBuffer, iceRenewalDelay, selectedIcePaths, iceTransportPolicy } = loadTs('src/lib/peer-ice.ts', {}, { setTimeout, clearTimeout });
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  let time = 0, nextTimer = 0, current = true;
  const timers = new Map(), applied = [];
  let failures = 0, reads = 0;
  let reader = async () => ({ iceServers: [{ urls: 'turn:example.test:3478', username: 'temporary', credential: 'private' }], expiresAt: time + 300000, relayAvailable: true });
  const refresher = createIceCredentialRefresher({
    now: () => time, isCurrent: () => current,
    setTimer(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: time + delay }); return id; },
    clearTimer(id) { timers.delete(id); },
    read: async () => { reads++; return reader(); }, apply: credentials => applied.push({ ...credentials, installedAt: time }), onError: () => { failures++; },
  });
  return { refresher, applied, timers, reads: () => reads, failures: () => failures,
    setReader(value) { reader = value; }, setCurrent(value) { current = value; }, setTime(value) { time = value; },
    async advance(ms) { time += ms; for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback(); } await flush(); },
  };
}
const initial = { iceServers: [], expiresAt: 300000, relayAvailable: true };

test('renewal keeps a two-minute lead and avoids zero-delay timer loops', () => {
  assert.equal(iceRenewalDelay(300000, 0), 180000);
  assert.equal(iceRenewalDelay(150000, 0), 30000);
  assert.equal(iceRenewalDelay(0, 1000), 1000);
  assert.equal(iceRenewalDelay(9999999, 0), 180000);
});

test('long call renews across seven credential lifetimes without overlapping reads', async () => {
  const f = fixture(); f.refresher.start(initial);
  let previousExpiry = initial.expiresAt;
  for (let cycle = 0; cycle < 7; cycle++) {
    await f.advance(180000);
    const installed = f.applied.at(-1);
    assert.ok(installed.installedAt < previousExpiry, 'replacement installed before old expiry');
    previousExpiry = installed.expiresAt;
  }
  assert.equal(f.reads(), 7);
  assert.equal(f.applied.length, 7);
  assert.equal(f.timers.size, 1);
  f.refresher.dispose(); assert.equal(f.timers.size, 0);
});

test('timer, foreground and negotiation share one refresh after a sleeping device wakes', async () => {
  const f = fixture(); f.refresher.start(initial); f.setTime(600000);
  let finish;
  f.setReader(() => new Promise(resolve => { finish = resolve; }));
  const a = f.refresher.ensureFresh(); const b = f.refresher.ensureFresh();
  assert.equal(a, b);
  await flush(); assert.equal(f.reads(), 1);
  finish({ ...initial, expiresAt: 900000 }); await a;
  assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0].installedAt, 600000);
  f.refresher.dispose();
});

test('a transient renewal failure retries before expiry and resets the schedule after recovery', async () => {
  const f = fixture(); f.refresher.start(initial);
  f.setReader(async () => { throw new Error('offline'); });
  await f.advance(180000); assert.equal(f.failures(), 1);
  await f.advance(5000); assert.equal(f.failures(), 2);
  f.setReader(async () => ({ ...initial, expiresAt: 495000 }));
  await f.advance(10000);
  assert.equal(f.applied.length, 1); assert.equal(f.reads(), 3);
  assert.equal([...f.timers.values()][0].at, 375000);
  f.refresher.dispose();
});

test('hangup discards a late HTTP response and schedules no new timer', async () => {
  const f = fixture(); f.refresher.start(initial); f.setTime(200000);
  let finish; f.setReader(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.refresher.ensureFresh(); await flush();
  f.setCurrent(false); f.refresher.dispose(); finish({ ...initial, expiresAt: 500000 }); await pending;
  assert.equal(f.applied.length, 0); assert.equal(f.timers.size, 0);
});

test('expired API credentials never replace the active RTC configuration', async () => {
  const f = fixture(); f.refresher.start(initial); f.setTime(200000);
  f.setReader(async () => ({ ...initial, expiresAt: 100000 }));
  await assert.rejects(f.refresher.ensureFresh(), /Expired ICE credentials/);
  assert.equal(f.applied.length, 0); assert.equal(f.failures(), 1);
  f.refresher.dispose();
});

test('relay-only mode is explicit and normal calling retains all candidate types', () => {
  assert.equal(iceTransportPolicy('true'), 'relay');
  for (const value of [undefined, '', 'false', 'TRUE']) assert.equal(iceTransportPolicy(value), 'all');
});

const remoteSdp = (audio, video = audio) => ({ type: 'offer', sdp: `v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:audio\r\na=ice-ufrag:${audio}\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=mid:video\r\na=ice-ufrag:${video}\r\n` });
const remoteCandidate = (usernameFragment, extra = {}) => ({ candidate: 'candidate:1 1 udp 1234 192.0.2.1 12345 typ host', sdpMid: 'audio', sdpMLineIndex: 0, usernameFragment, ...extra });

test('new restart candidates arriving before their SDP wait while old-generation media stays connected', () => {
  const buffer = createRemoteIceBuffer();
  const first = remoteCandidate('first');
  assert.equal(buffer.receive(first), null);
  assert.deepEqual(Array.from(buffer.applyDescription(remoteSdp('first'))), [first]);
  const restart = remoteCandidate('restart');
  assert.equal(buffer.receive(restart), null, 'old remoteDescription must not accept new generation');
  assert.equal(buffer.receive(first), first, 'current generation still works during negotiation');
  assert.deepEqual(Array.from(buffer.applyDescription(remoteSdp('restart'))), [restart]);
  assert.equal(buffer.receive(first), null, 'retired generation is discarded');
  assert.equal(buffer.applyDescription(remoteSdp('restart')).length, 0);
});

test('candidate generation checks respect the candidate media section', () => {
  const buffer = createRemoteIceBuffer(); buffer.applyDescription(remoteSdp('audio-one', 'video-one'));
  const video = remoteCandidate('video-two', { sdpMid: 'video', sdpMLineIndex: 1 });
  assert.equal(buffer.receive(video), null);
  assert.equal(buffer.applyDescription(remoteSdp('audio-two', 'video-one')).length, 0);
  assert.deepEqual(Array.from(buffer.applyDescription(remoteSdp('audio-two', 'video-two'))), [video]);
});

test('old signaling compatibility recovers ufrag from candidate lines without applying it to old SDP', () => {
  const buffer = createRemoteIceBuffer(); buffer.applyDescription(remoteSdp('old'));
  const candidate = remoteCandidate(null, { candidate: 'candidate:1 1 udp 1234 192.0.2.1 12345 typ host ufrag future network-cost 999' });
  assert.equal(buffer.receive(candidate), null);
  const flushed = buffer.applyDescription(remoteSdp('future'));
  assert.equal(flushed.length, 1); assert.equal(flushed[0].usernameFragment, 'future');
  assert.equal(flushed[0].candidate, candidate.candidate);
});

test('session-level ICE credentials and legacy null fragments remain compatible', () => {
  const buffer = createRemoteIceBuffer();
  const legacy = remoteCandidate(null);
  assert.equal(buffer.receive(legacy), null);
  assert.deepEqual(Array.from(buffer.applyDescription({ type: 'answer', sdp: 'v=0\r\na=ice-ufrag:session\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:audio\r\n' })), [legacy]);
  const candidate = remoteCandidate('session', { sdpMid: null });
  assert.equal(buffer.receive(candidate), candidate);
  assert.equal(buffer.receive(legacy), legacy);
});

test('future generation buffering is bounded and retains the newest candidates in order', () => {
  const buffer = createRemoteIceBuffer(); buffer.applyDescription(remoteSdp('old'));
  for (let index = 0; index < 120; index++) assert.equal(buffer.receive(remoteCandidate('new', { candidate: `candidate:${index}` })), null);
  const flushed = buffer.applyDescription(remoteSdp('new'));
  assert.equal(flushed.length, 100); assert.equal(flushed[0].candidate, 'candidate:20'); assert.equal(flushed.at(-1).candidate, 'candidate:119');
});

function report(extra = []) {
  return new Map([
    ['transport', { id: 'transport', type: 'transport', selectedCandidatePairId: 'selected' }],
    ['selected', { id: 'selected', type: 'candidate-pair', state: 'succeeded', localCandidateId: 'local', remoteCandidateId: 'remote', bytesSent: 2048, bytesReceived: 4096, currentRoundTripTime: 0.055 }],
    ['local', { id: 'local', type: 'local-candidate', candidateType: 'relay', protocol: 'udp', relayProtocol: 'tls', address: '192.0.2.1', port: 49160, url: 'turns:private.example:5349', usernameFragment: 'private-user' }],
    ['remote', { id: 'remote', type: 'remote-candidate', candidateType: 'host', address: '192.0.2.2' }], ...extra,
  ]);
}

test('diagnostics use the actual selected pair and expose only safe aggregate fields', () => {
  const stats = report([['unused', { id: 'unused', type: 'candidate-pair', nominated: true, state: 'succeeded' }]]);
  const paths = selectedIcePaths(stats);
  assert.equal(paths.length, 1); assert.equal(paths[0].route, 'relay'); assert.equal(paths[0].protocol, 'tls');
  assert.equal(paths[0].roundTripMs, 55); assert.equal(paths[0].bytesReceived, 4096);
  assert.doesNotMatch(JSON.stringify(paths), /192\.0|private|49160|username|address|url/);
});

test('unknown or merely gathered candidate pairs never count as verified TURN media', () => {
  const stats = report(); stats.delete('transport');
  assert.equal(selectedIcePaths(stats).length, 0);
  stats.get('selected').selected = true;
  assert.equal(selectedIcePaths(stats)[0].route, 'relay');
  stats.get('selected').state = 'failed';
  assert.equal(selectedIcePaths(stats).length, 0);
});

test('direct selected path stays distinct from relay availability', () => {
  const stats = report(); stats.get('local').candidateType = 'srflx'; stats.get('local').relayProtocol = undefined;
  assert.equal(selectedIcePaths(stats)[0].route, 'direct');
  assert.equal(selectedIcePaths(stats)[0].protocol, 'udp');
});
