const assert = require('node:assert/strict');
const test = require('node:test');
const loadTs = require('./helpers/load-ts.cjs');

function harness({ decodedDuration = 119.25, decoderUnavailable = false, uploadVoice, onSend = () => { throw new Error('Unexpected upload'); } } = {}) {
  const hooks = [], effects = [], deadlines = new Map(), intervals = new Map();
  let cursor = 0, clock = 0, nextTimer = 0, recorder, tree, urls = 0;
  const track = { stopped: false, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track] };
  const react = {
    useRef(initial) { const index = cursor++; return hooks[index] || (hooks[index] = { current: initial }); },
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: initial };
      return [hooks[index].value, value => { hooks[index].value = value; }];
    },
    useEffect(callback) { const index = cursor++; if (!hooks[index]) { hooks[index] = {}; effects.push(() => { hooks[index].cleanup = callback(); }); } },
  };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(_stream, { mimeType }) { this.mimeType = mimeType; this.state = 'inactive'; this.stops = 0; recorder = this; }
    start() { this.state = 'recording'; }
    stop() { assert.equal(this.state, 'recording'); this.state = 'inactive'; this.stops++; }
  }
  const element = (type, props) => ({ type, props });
  const VoiceMessage = () => {};
  const { default: VoiceRecorder } = loadTs('src/components/chat/VoiceRecorder.tsx', {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: Symbol('fragment') },
    'lucide-react': { Mic: () => {}, Square: () => {}, X: () => {} },
    '@clerk/nextjs': { useAuth: () => ({ getToken: async () => 'test-session' }) },
    '@/lib/voice-api': { uploadPrivateVoice(...args) { if (!uploadVoice) throw new Error('Unexpected upload'); return uploadVoice(...args); } },
    './VoiceMessage': { default: VoiceMessage, __esModule: true, formatDuration: value => String(value) },
  }, {
    Blob, FormData, AbortController, DOMException, Error,
    window: { isSecureContext: true, MediaRecorder: Recorder },
    MediaRecorder: Recorder,
    navigator: { mediaDevices: { getUserMedia: async () => stream } },
    performance: { now: () => clock },
    AudioContext: class {
      async decodeAudioData() {
        if (decoderUnavailable) throw new Error('Decoder unavailable');
        return { duration: decodedDuration, getChannelData: () => new Float32Array([0.1, -0.2, 0.3]) };
      }
      async close() {}
    },
    URL: { createObjectURL: () => `blob:preview-${++urls}`, revokeObjectURL() {} },
    setTimeout(callback, delay) { const id = ++nextTimer; deadlines.set(id, { callback, delay }); return id; },
    clearTimeout: id => deadlines.delete(id),
    setInterval(callback, delay) { const id = ++nextTimer; intervals.set(id, { callback, delay }); return id; },
    clearInterval: id => intervals.delete(id),
  });
  function render() {
    cursor = 0;
    tree = VoiceRecorder({ conversationId: 1, onSend });
    effects.splice(0).forEach(effect => effect());
    return tree;
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) return node.map(value => find(predicate, value)).find(Boolean);
    if (predicate(node)) return node;
    return node.props?.children === undefined ? undefined : find(predicate, node.props.children);
  }
  render(); render();
  return {
    track, deadlines, intervals,
    get recorder() { return recorder; },
    get urls() { return urls; },
    now(value) { clock = value; },
    async start() { await find(node => node.type === 'button' && node.props.title?.startsWith('Record a voice')).props.onClick(); render(); },
    deadline(at) { clock = at; const deadline = [...deadlines.values()][0]; assert.ok(deadline); deadline.callback(); render(); },
    async finish(at) { clock = at; recorder.ondataavailable({ data: new Blob(['synthetic-recording']) }); await recorder.onstop(); render(); },
    stop() { find(node => node.props?.['aria-label'] === 'Stop recording').props.onClick(); render(); },
    async upload() { const pending = find(node => node.type === 'button' && node.props.children === 'Send voice').props.onClick(); render(); await pending; render(); },
    cancel() { find(node => node.props?.['aria-label'] === 'Cancel voice message').props.onClick(); render(); },
    unmount() { for (const hook of hooks) hook.cleanup?.(); },
    preview() { return find(node => node.type === VoiceMessage)?.props; },
    error() { return find(node => node.props?.role === 'alert')?.props.children; },
  };
}

test('recording deadline leaves encoder headroom and releases capture before the queued stop event', async () => {
  const fixture = harness();
  await fixture.start();
  assert.equal([...fixture.deadlines.values()][0].delay, 119000);
  assert.equal([...fixture.intervals.values()][0].delay, 250);
  fixture.deadline(119250); // A delayed callback still leaves 750ms of headroom.
  assert.equal(fixture.recorder.stops, 1);
  assert.equal(fixture.track.stopped, true);
  assert.equal(fixture.deadlines.size, 0);
  assert.equal(fixture.intervals.size, 0);
  await fixture.finish(121000); // The queued event is not recording duration.
  assert.equal(fixture.preview().durationMs, 119250);
  assert.equal(fixture.error(), undefined);
});

test('a suspended-tab overrun is rejected before preview instead of clamping metadata to 120 seconds', async () => {
  const fixture = harness({ decodedDuration: 120.25 });
  await fixture.start();
  fixture.deadline(120250);
  await fixture.finish(120300);
  assert.match(fixture.error(), /exceeded two minutes/);
  assert.equal(fixture.preview(), undefined);
  assert.equal(fixture.urls, 0);
  assert.equal(fixture.track.stopped, true);
});

test('decoded duration rejects codec overflow and supplies truthful preview metadata', async () => {
  const tooLong = harness({ decodedDuration: 120.01 });
  await tooLong.start(); tooLong.deadline(119000); await tooLong.finish(119020);
  assert.match(tooLong.error(), /exceeds two minutes/);
  assert.equal(tooLong.urls, 0);
  const manual = harness({ decodedDuration: 1.02 });
  await manual.start(); manual.now(1000); manual.stop(); await manual.finish(1250);
  assert.equal(manual.preview().durationMs, 1020);
  assert.equal(manual.deadlines.size, 0);
});

test('unsupported local decoding uses the capture stop time rather than a delayed event time', async () => {
  const fixture = harness({ decoderUnavailable: true });
  await fixture.start(); fixture.deadline(119250); await fixture.finish(121000);
  assert.equal(fixture.preview().durationMs, 119250);
  assert.equal(fixture.preview().waveform.length, 0);
  assert.equal(fixture.error(), undefined);
});

test('cancel and unmount clear the hard deadline and release tracks without late previews', async () => {
  for (const cleanup of ['cancel', 'unmount']) {
    const fixture = harness({ decodedDuration: 1 });
    await fixture.start(); fixture.now(1000); fixture[cleanup](); await fixture.finish(1050);
    assert.equal(fixture.track.stopped, true);
    assert.equal(fixture.deadlines.size, 0);
    assert.equal(fixture.intervals.size, 0);
    assert.equal(fixture.urls, 0);
  }
});

test('recorded attachments use authenticated media API with conversation scope and normalize the sent result', async () => {
  let sent;
  const attachment = { mediaAssetId: '98556c70-17e4-4be0-bddd-4452d128ce22', mediaUrl: '/api/chat/media/98556c70-17e4-4be0-bddd-4452d128ce22', mediaType: 'voice', durationMs: 1000, waveform: [0.1] };
  const fixture = harness({ decodedDuration: 1, onSend(value) { sent = value; }, async uploadVoice(form, getToken, signal) {
    assert.equal(await getToken(), 'test-session');
    assert.equal(form.get('conversationId'), '1'); assert.equal(form.get('durationMs'), '1000');
    assert.equal(form.get('audio').type, 'audio/webm;codecs=opus');
    assert.equal(signal.aborted, false); return attachment;
  } });
  await fixture.start(); fixture.now(1000); fixture.stop(); await fixture.finish(1000); await fixture.upload();
  assert.equal(sent.mediaAssetId, attachment.mediaAssetId); assert.equal(sent.mediaUrl, attachment.mediaUrl);
  assert.equal(fixture.preview(), undefined); assert.equal(fixture.deadlines.size, 0);
});

test('cancelled or unauthorized voice uploads cannot send a late attachment and retain a retryable preview on failure', async () => {
  let resolve, requestSignal, sent = false;
  const cancelled = harness({ decodedDuration: 1, onSend() { sent = true; }, uploadVoice(_form, _getToken, signal) { requestSignal = signal; return new Promise(done => { resolve = done; }); } });
  await cancelled.start(); cancelled.now(1000); cancelled.stop(); await cancelled.finish(1000);
  const pending = cancelled.upload(); cancelled.cancel();
  assert.equal(requestSignal.aborted, true); resolve({}); await pending;
  assert.equal(sent, false); assert.equal(cancelled.preview(), undefined);
  const denied = harness({ decodedDuration: 1, uploadVoice() { throw new Error('Sign in again to use voice messages.'); } });
  await denied.start(); denied.now(1000); denied.stop(); await denied.finish(1000); await denied.upload();
  assert.match(denied.error(), /Sign in again/); assert.ok(denied.preview()); assert.equal(denied.deadlines.size, 0);
});
