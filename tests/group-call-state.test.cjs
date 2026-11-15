const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const { isCurrentCallUpdate, isCallInvitation, screenLeaseView, acceptScreenLease, ownsScreenLease, groupCameraVisible, publishGroupCapture, createScreenCaptureGuard, captureGroupDevices } = loadTs('src/lib/group-call-state.ts');
const call = (overrides = {}) => ({ id: 'call-1', status: 'ACTIVE', initiatorId: 'alice', mediaVersion: 1, screenVersion: 2, serverTime: 1000, participants: [{ userId: 'alice', status: 'JOINED' }, { userId: 'bob', status: 'JOINED' }, { userId: 'charlie', status: 'INVITED' }], ...overrides });
const lease = (overrides = {}) => ({ leaseId: 'lease-1', version: 2, userId: 'alice', deviceId: 'alice-device', expiresAt: new Date(21000).toISOString(), ...overrides });

test('third participant remains invited after two participants activate the call', () => {
  assert.equal(isCallInvitation(call(), 'charlie'), true);
  assert.equal(isCallInvitation(call(), 'alice'), false);
  assert.equal(isCallInvitation(call(), 'bob'), false);
  assert.equal(isCallInvitation(call({ status: 'ENDED' }), 'charlie'), false);
  assert.equal(isCallInvitation(call({ status: 'RINGING' }), 'charlie'), true);
});

test('delayed state cannot reconnect clients to retired main rooms or screen leases', () => {
  const current = call({ mediaVersion: 3, screenVersion: 8, serverTime: 2000 });
  assert.equal(isCurrentCallUpdate(current, call({ mediaVersion: 2, screenVersion: 9, serverTime: 2100 })), false);
  assert.equal(isCurrentCallUpdate(current, call({ mediaVersion: 3, screenVersion: 7, serverTime: 2100 })), false);
  assert.equal(isCurrentCallUpdate(current, call({ mediaVersion: 3, screenVersion: 8, serverTime: 1900 })), false);
  assert.equal(isCurrentCallUpdate(current, call({ mediaVersion: 4, screenVersion: 9, serverTime: 2100 })), true);
  assert.equal(isCurrentCallUpdate(null, call()), true);
});

test('screen publish controls require both the authenticated user and accepted device', () => {
  assert.equal(ownsScreenLease(lease(), 'alice', 'alice-device'), true);
  assert.equal(ownsScreenLease(lease(), 'alice', 'second-tab'), false);
  assert.equal(ownsScreenLease(lease(), 'bob', 'alice-device'), false);
  assert.equal(ownsScreenLease(null, 'alice', 'alice-device'), false);
});

test('screen expiry uses server-relative lifetime and cannot be extended beyond the lease limit by clock skew', () => {
  const view = screenLeaseView(call({ screenShare: lease() }), 1_000_000);
  assert.equal(view.deadline, 1_020_000);
  const expired = screenLeaseView(call({ serverTime: 22000, screenShare: lease() }), 1_000_000);
  assert.equal(expired.deadline, 1_000_000);
  const excessive = screenLeaseView(call({ screenShare: lease({ expiresAt: new Date(999999).toISOString() }) }), 1_000_000);
  assert.equal(excessive.deadline, 1_020_000);
});

test('old heartbeat and claim acknowledgements cannot restore a released screen', () => {
  const held = screenLeaseView(call({ screenShare: lease() }), 1000);
  const released = screenLeaseView(call({ screenVersion: 3, screenShare: null, serverTime: 2000 }), 2000);
  assert.equal(acceptScreenLease(held, released), released);
  assert.equal(acceptScreenLease(released, held), released);
  const refreshed = screenLeaseView(call({ serverTime: 7000, screenShare: lease({ expiresAt: new Date(27000).toISOString() }) }), 7000);
  assert.equal(acceptScreenLease(held, refreshed), refreshed);
  assert.equal(acceptScreenLease(refreshed, held), refreshed);
});

test('muted, unpublished and ended cameras render placeholders even with a retained last frame', () => {
  assert.equal(groupCameraVisible(undefined), false);
  assert.equal(groupCameraVisible({ isMuted: false }), false);
  assert.equal(groupCameraVisible({ isMuted: true, track: { mediaStreamTrack: { readyState: 'live' } } }), false);
  assert.equal(groupCameraVisible({ isMuted: false, track: { mediaStreamTrack: { readyState: 'ended' } } }), false);
  assert.equal(groupCameraVisible({ isMuted: false, track: { mediaStreamTrack: { readyState: 'live' } } }), true);
});

function capture() {
  const tracks = ['video', 'audio'].map(kind => ({ kind, readyState: 'live', stop() { this.readyState = 'ended'; } }));
  return { tracks, getTracks: () => tracks };
}

test('hangup while SDK publication is pending stops captured media and unpublishes late completion', async () => {
  const stream = capture();
  let current = true;
  let resolve;
  const unpublished = [];
  const pending = publishGroupCapture(stream, () => new Promise(done => { resolve = done; }), async track => unpublished.push(track), () => current);
  current = false;
  resolve();
  await assert.rejects(pending, /ended/);
  assert.ok(stream.tracks.every(track => track.readyState === 'ended'));
  assert.deepEqual(unpublished, [stream.tracks[0]]);
});

test('a partial screen publication failure stops audio/video and removes already-published video', async () => {
  const stream = capture();
  const published = [];
  const unpublished = [];
  await assert.rejects(publishGroupCapture(stream, async track => { if (track.kind === 'audio') throw Error('audio publish denied'); published.push(track); }, async track => unpublished.push(track), () => true), /denied/);
  assert.ok(stream.tracks.every(track => track.readyState === 'ended'));
  assert.deepEqual(unpublished, published);
});

test('a successful authorized screen capture remains live until its owning lease releases it', async () => {
  const stream = capture();
  const published = [];
  await publishGroupCapture(stream, async track => published.push(track), async () => { throw Error('unexpected cleanup'); }, () => true);
  assert.equal(published.length, 2);
  assert.ok(stream.tracks.every(track => track.readyState === 'live'));
});


test('a picker opened before media or signaling loss cannot claim after the connection recovers', () => {
  const guard = createScreenCaptureGuard();
  const pendingPicker = guard.begin();
  assert.equal(guard.valid(pendingPicker, true), true);
  assert.equal(guard.valid(pendingPicker, false), false, 'latest media availability gates each async boundary');
  guard.invalidate();
  assert.equal(guard.valid(pendingPicker, true), false, 'reconnection cannot revive an invalidated picker');
  const newPicker = guard.begin();
  assert.equal(guard.valid(newPicker, true), true);
  assert.equal(guard.valid(pendingPicker, true), false, 'old picker completion cannot release a newer operation lock');
});


test('denied camera falls back to microphone without claiming video works', async () => {
  const requests = [];
  const audio = capture();
  const result = await captureGroupDevices(async constraints => { requests.push(constraints); if (constraints.video) throw Error('camera denied'); return audio; }, { audio: { echoCancellation: true }, video: true }, () => true);
  assert.equal(result.stream, audio);
  assert.equal(result.cameraUnavailable, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].video, undefined);
  assert.equal(requests[1].audio.echoCancellation, true);
});

test('camera failure never captures a microphone the participant chose to mute', async () => {
  let requests = 0;
  await assert.rejects(captureGroupDevices(async () => { requests += 1; throw Error('camera denied'); }, { audio: false, video: true }, () => true), /denied/);
  assert.equal(requests, 1);
});

test('voice fallback resolving after hangup stops its late capture', async () => {
  let current = true;
  const audio = capture();
  const result = await captureGroupDevices(async constraints => { if (constraints.video) throw Error('camera denied'); current = false; return audio; }, { audio: true, video: true }, () => current);
  assert.equal(result.stream, null);
  assert.ok(audio.tracks.every(track => track.readyState === 'ended'));
});
