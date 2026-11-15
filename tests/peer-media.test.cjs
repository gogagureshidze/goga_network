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

const { acceptPeerMediaState, nextMediaSequence, showPeerVideo, safeScreenAudio, screenCaptureOptions } = loadTs('src/lib/peer-media.ts');
const state = (sequence, values = {}) => ({ sequence, cameraEnabled: true, screenSharing: false, screenAudio: false, microphoneMuted: false, ...values });

test('camera-off hides the old frame immediately while screen sharing remains visible', () => {
  assert.equal(showPeerVideo(state(1), true), true);
  assert.equal(showPeerVideo(state(2, { cameraEnabled: false }), true), false);
  assert.equal(showPeerVideo(state(3, { cameraEnabled: false, screenSharing: true }), true), true);
  assert.equal(showPeerVideo(state(4), false), false, 'muted or ended video never displays a stale frame');
  assert.equal(showPeerVideo(null, true), true, 'legacy peers retain live video during additive rollout');
  assert.equal(showPeerVideo(null, true, false), false, 'hide legacy video when signaling disconnects');
  assert.equal(showPeerVideo(state(5, { cameraEnabled: false }), true, true), false, 'reconnect must not clear an authoritative camera-off state');
});

test('out-of-order camera/screen state cannot restore a stale frame and remount revisions advance', () => {
  const off = state(20, { cameraEnabled: false });
  assert.equal(acceptPeerMediaState(off, state(19)), off);
  assert.equal(acceptPeerMediaState(off, state(20)), off);
  assert.equal(acceptPeerMediaState(off, state(21)).cameraEnabled, true);
  const first = nextMediaSequence(100);
  assert.ok(nextMediaSequence(100) > first);
  assert.ok(nextMediaSequence(50) > first, 'clock adjustment or component remount cannot move the module revision backward');
});

test('screen capture requests audio but excludes call-tab and desktop loopback', () => {
  assert.equal(screenCaptureOptions.audio, true);
  assert.equal(screenCaptureOptions.selfBrowserSurface, 'exclude');
  assert.equal(screenCaptureOptions.systemAudio, 'exclude');
  assert.equal(screenCaptureOptions.windowAudio, 'exclude');
  const audio = { readyState: 'live', kind: 'audio' };
  const stream = surface => ({ getVideoTracks: () => [{ getSettings: () => ({ displaySurface: surface }) }], getAudioTracks: () => [audio] });
  assert.equal(safeScreenAudio(stream('browser')), audio);
  assert.equal(safeScreenAudio(stream('monitor')), null);
  assert.equal(safeScreenAudio(stream('window')), null);
  assert.equal(safeScreenAudio(stream(undefined)), null, 'unidentified loopback capture fails closed');
  audio.readyState = 'ended';
  assert.equal(safeScreenAudio(stream('browser')), null);
});

function mixerFixture() {
  const output = { kind: 'audio', stopped: false, stop() { this.stopped = true; } };
  const sources = [];
  function node(label) {
    return { label, connections: [], disconnected: false, connect(target) { this.connections.push(target); }, disconnect() { this.disconnected = true; } };
  }
  const destination = { ...node('stream destination'), stream: { getAudioTracks: () => [output], getTracks: () => [output] } };
  const limiter = { ...node('limiter'), threshold: {}, knee: {}, ratio: {} };
  const context = {
    state: 'suspended', closed: 0, destination: node('audible speaker'),
    createMediaStreamDestination: () => destination,
    createDynamicsCompressor: () => limiter,
    createMediaStreamSource(stream) { const source = { ...node('source'), stream }; sources.push(source); return source; },
    async resume() { this.state = 'running'; },
    async close() { this.closed += 1; this.state = 'closed'; },
  };
  const api = loadTs('src/lib/peer-media.ts', {}, { MediaStream: class { constructor(tracks) { this.tracks = tracks; } } });
  return { api, context, destination, output, limiter, sources };
}

test('screen sound and microphone share one mono sender source without audible local monitoring', async () => {
  const { api, context, destination, output, limiter, sources } = mixerFixture();
  const mic = { kind: 'audio', enabled: true, stop() { throw Error('mixer must not stop owned input'); } };
  const tab = { kind: 'audio', enabled: true, stop() { throw Error('mixer must not stop owned input'); } };
  const mixer = api.createCallAudioMixer(mic, context);
  await mixer.resume();
  mixer.setDisplay(tab);
  assert.equal(mixer.track, output);
  assert.equal(destination.channelCount, 1);
  assert.equal(destination.channelCountMode, 'explicit');
  assert.equal(sources.length, 2);
  assert.equal(sources[0].stream.tracks[0], mic);
  assert.equal(sources[1].stream.tracks[0], tab);
  assert.equal(sources[0].connections[0], limiter);
  assert.equal(sources[1].connections[0], limiter);
  assert.equal(limiter.connections[0], destination);
  assert.ok([...sources, limiter, destination].every(node => !node.connections.includes(context.destination)), 'never monitor the mixed stream locally');
  mic.enabled = false;
  assert.equal(tab.enabled, true, 'muting conversation microphone leaves shared audio intact');
  mixer.dispose(); mixer.dispose();
  assert.equal(context.closed, 1);
  assert.equal(output.stopped, true);
  assert.ok(sources.every(source => source.disconnected));
});

test('microphone changes and repeated screen starts disconnect old sources without duplicating them', () => {
  const { api, context, sources } = mixerFixture();
  const mixer = api.createCallAudioMixer({ kind: 'audio' }, context);
  mixer.setDisplay({ kind: 'audio', id: 'tab1' });
  mixer.setMicrophone({ kind: 'audio', id: 'mic2' });
  assert.equal(sources[0].disconnected, true);
  assert.equal(sources[1].disconnected, false, 'device switching keeps tab audio connected');
  mixer.setDisplay(null);
  assert.equal(sources[1].disconnected, true);
  assert.equal(sources[2].disconnected, false, 'stopping screen audio preserves microphone');
  mixer.setDisplay({ kind: 'audio', id: 'tab2' });
  assert.equal(sources.filter(source => !source.disconnected).length, 2);
  mixer.dispose();
  assert.equal(sources.filter(source => !source.disconnected).length, 0);
  assert.throws(() => mixer.setMicrophone({ kind: 'audio' }), /ended/);
});

test('a suspended browser AudioContext fails explicitly instead of silently replacing working microphone audio', async () => {
  const { api, context } = mixerFixture();
  context.resume = async () => {};
  const mixer = api.createCallAudioMixer({ kind: 'audio' }, context);
  await assert.rejects(mixer.resume(), /could not start/);
  mixer.dispose();
});

test('a failed video replacement also stops the display audio track', async () => {
  const video = media('video').track;
  const audio = media('audio').track;
  const stream = { getTracks: () => [video, audio] };
  await assert.rejects(replaceCapturedTrack({ replaceTrack: async () => { throw Error('encoder'); } }, stream, 'video', () => true));
  assert.equal(video.stopped, true);
  assert.equal(audio.stopped, true);
});
