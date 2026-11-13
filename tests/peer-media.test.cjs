const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const { captureForSession, replaceCapturedTrack, initializePeerMedia, peerVideoSender, prepareAnswerVideo } = loadTs('src/lib/peer-media.ts');
function media(kind = 'audio') {
  const track = { kind, stopped: false, stop() { this.stopped = true; } };
  return { track, stream: { getTracks() { return [track]; } } };
}

test('a permission prompt resolving after hangup stops its new tracks', async () => {
  const { stream, track } = media();
  let current = true;
  let resolve;
  const pending = captureForSession(() => new Promise(done => { resolve = done; }), () => current);
  current = false;
  resolve(stream);
  assert.equal(await pending, null);
  assert.equal(track.stopped, true);
});

test('a successful current capture stays live for the owning call', async () => {
  const { stream, track } = media();
  assert.equal(await captureForSession(async () => stream, () => true), stream);
  assert.equal(track.stopped, false);
});

test('failed device replacement stops newly acquired microphone or screen tracks', async () => {
  const { stream, track } = media('video');
  await assert.rejects(replaceCapturedTrack({ replaceTrack: async () => { throw new Error('encoder unavailable'); } }, stream, 'video', () => true));
  assert.equal(track.stopped, true);
});

test('hangup during asynchronous track replacement stops captured media', async () => {
  const { stream, track } = media();
  let current = true;
  await assert.rejects(replaceCapturedTrack({ replaceTrack: async () => { current = false; } }, stream, 'audio', () => current));
  assert.equal(track.stopped, true);
});

test('successful replacement retains the stream until the call releases it', async () => {
  const { stream, track } = media('video');
  let transmitted;
  const returned = await replaceCapturedTrack({ replaceTrack: async value => { transmitted = value; } }, stream, 'video', () => true);
  assert.equal(returned, track);
  assert.equal(transmitted, track);
  assert.equal(track.stopped, false);
});

function negotiationFixture(withCamera = true) {
  const audio = { kind: 'audio' };
  const camera = withCamera ? { kind: 'video' } : null;
  const stream = { getAudioTracks: () => [audio], getVideoTracks: () => camera ? [camera] : [] };
  const transceivers = [];
  const peer = {
    addTrack(track) { transceivers.push(transceiver(track.kind, null, track)); },
    addTransceiver(track) { const value = transceiver(typeof track === 'string' ? track : track.kind, null, typeof track === 'string' ? null : track); transceivers.push(value); return value; },
    getTransceivers: () => transceivers,
  };
  return { peer, stream, camera, transceivers };
}
function transceiver(kind, mid, track = null) {
  return { mid, stopped: false, direction: 'recvonly', receiver: { track: { kind } }, sender: {
    track, streams: [], setStreams(...streams) { this.streams = streams; }, async replaceTrack(value) { this.track = value; },
  } };
}

test('answerer attaches camera and subsequent screen sharing to the offer-associated sender', async () => {
  const { peer, stream, camera, transceivers } = negotiationFixture();
  initializePeerMedia(peer, stream, false);
  assert.equal(transceivers.filter(value => value.receiver.track.kind === 'video').length, 0,
    'answerer must not precreate an unassociated addTransceiver video sender');
  // Applying a remote offer creates the associated video transceiver. An answer
  // cannot negotiate a separate addTransceiver-created video m-line.
  const offered = transceiver('video', '1'); transceivers.push(offered);
  assert.equal(await prepareAnswerVideo(peer, stream, camera, () => true), true);
  assert.equal(offered.direction, 'sendrecv');
  assert.equal(offered.sender.track, camera);
  assert.equal(offered.sender.streams[0], stream);
  const screen = media('video');
  await replaceCapturedTrack(peerVideoSender(peer), screen.stream, 'video', () => true);
  assert.equal(offered.sender.track, screen.track);
  assert.equal(transceivers.length, 2, 'camera/screen replacement needs no extra m-line');
});

test('audio-only answer keeps an associated sendrecv video sender for later camera enable', async () => {
  const { peer, stream, transceivers } = negotiationFixture(false);
  initializePeerMedia(peer, stream, false);
  const offered = transceiver('video', '1'); transceivers.push(offered);
  assert.equal(await prepareAnswerVideo(peer, stream, null, () => true), true);
  assert.equal(offered.sender.track, null);
  assert.equal(offered.direction, 'sendrecv');
  const camera = media('video');
  await replaceCapturedTrack(peerVideoSender(peer), camera.stream, 'video', () => true);
  assert.equal(offered.sender.track, camera.track);
});

test('only initiator reserves video before an offer and sender selection prefers associated media', () => {
  const { peer, stream, transceivers } = negotiationFixture(false);
  initializePeerMedia(peer, stream, true);
  const reserved = transceivers.find(value => value.receiver.track.kind === 'video');
  assert.ok(reserved);
  assert.equal(peerVideoSender(peer), undefined);
  assert.equal(peerVideoSender(peer, true), reserved.sender);
  const associated = transceiver('video', '1'); transceivers.push(associated);
  assert.equal(peerVideoSender(peer, true), associated.sender);
});
