const assert = require('node:assert/strict');
const test = require('node:test');
const loadTs = require('./helpers/load-ts.cjs');
const id = '98556c70-17e4-4be0-bddd-4452d128ce22';

function harness({ preview = false, fetchVoice } = {}) {
  const hooks = [], effects = [], revoked = [], requests = [];
  let cursor = 0, tree, created = 0, userId = 'user_dev';
  const audio = { src: '', currentTime: 0, plays: 0, pauses: 0, assignments: 0, load() {}, removeAttribute() { this.src = ''; }, async play() { this.plays++; }, pause() { this.pauses++; } };
  const react = {
    useRef(initial) { const index = cursor++; return hooks[index] || (hooks[index] = { current: initial }); },
    useState(initial) { const index = cursor++; hooks[index] ||= { value: initial }; return [hooks[index].value, value => { hooks[index].value = value; }]; },
    useEffect(callback, dependencies) {
      const index = cursor++, old = hooks[index];
      if (!old || dependencies.some((value, i) => value !== old.dependencies[i])) {
        hooks[index] = { dependencies, cleanup: old?.cleanup };
        effects.push(() => { hooks[index].cleanup?.(); hooks[index].cleanup = callback(); });
      }
    },
  };
  const element = (type, props) => ({ type, props });
  const { default: VoiceMessage } = loadTs('src/components/chat/VoiceMessage.tsx', {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element }, 'lucide-react': { Pause() {}, Play() {} },
    '@clerk/nextjs': { useAuth: () => ({ userId, getToken: async () => 'session-token' }) },
    '@/lib/voice-api': { async fetchPrivateVoice(...args) { requests.push(args); return fetchVoice ? fetchVoice(...args) : new Blob(['voice']); } },
  }, { URL: { createObjectURL() { return `blob:private-${++created}`; }, revokeObjectURL(value) { revoked.push(value); } }, Error, AbortController, setTimeout, clearTimeout });
  const props = { src: preview ? 'blob:recording-preview' : `/api/chat/media/${id}`, mediaAssetId: preview ? undefined : id, durationMs: 3000, preview };
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) return node.map(child => child === undefined ? undefined : find(predicate, child)).find(Boolean);
    if (predicate(node)) return node;
    return node.props?.children === undefined ? undefined : find(predicate, node.props.children);
  }
  function render() {
    cursor = 0; tree = VoiceMessage(props);
    find(node => node.type === 'audio').props.ref.current = audio;
    effects.splice(0).forEach(effect => effect());
  }
  render(); render();
  return {
    audio, requests, revoked,
    get created() { return created; },
    audioProps() { return find(node => node.type === 'audio').props; },
    async toggle() { const pending = find(node => node.type === 'button').props.onClick(); render(); await pending; render(); },
    playEvent() { find(node => node.type === 'audio').props.onPlay(); render(); },
    pauseEvent() { find(node => node.type === 'audio').props.onPause(); render(); },
    error() { return find(node => node.props?.role === 'alert')?.props.children; },
    signOut() { userId = null; render(); render(); },
    unmount() { hooks.forEach(hook => hook.cleanup?.()); },
  };
}

test('private audio does not preload credentials or URLs and loads one bounded blob on demand', async () => {
  const fixture = harness();
  assert.equal(fixture.audioProps().src, undefined);
  assert.equal(fixture.audioProps().preload, 'none');
  assert.equal(fixture.requests.length, 0);
  await fixture.toggle();
  assert.equal(fixture.requests.length, 1); assert.equal(fixture.requests[0][1], id);
  assert.equal(await fixture.requests[0][2](), 'session-token');
  assert.equal(fixture.audio.src, 'blob:private-1'); assert.equal(fixture.audio.plays, 1);
  fixture.playEvent(); await fixture.toggle(); fixture.pauseEvent();
  await fixture.toggle();
  assert.equal(fixture.requests.length, 1); assert.equal(fixture.audio.plays, 2);
  fixture.unmount(); assert.deepEqual(fixture.revoked, ['blob:private-1']); assert.equal(fixture.audio.src, '');
});

test('sign out releases private audio and aborts in-flight requests without a late playback leak', async () => {
  let finish;
  const fixture = harness({ fetchVoice: () => new Promise(resolve => { finish = resolve; }) });
  const pending = fixture.toggle();
  assert.equal(fixture.requests[0][3].aborted, false);
  fixture.signOut();
  assert.equal(fixture.requests[0][3].aborted, true);
  finish(new Blob(['voice'])); await pending;
  assert.equal(fixture.created, 0); assert.equal(fixture.audio.plays, 0);
  fixture.unmount();
});

test('authorization failures remain visible and retries request authorization again', async () => {
  let attempts = 0;
  const fixture = harness({ fetchVoice: () => { if (++attempts === 1) throw new Error('Voice access denied'); return new Blob(['voice']); } });
  await fixture.toggle(); assert.equal(fixture.error(), 'Voice access denied');
  await fixture.toggle(); assert.equal(fixture.error(), undefined);
  assert.equal(fixture.requests.length, 2); assert.equal(fixture.audio.plays, 1);
  fixture.unmount();
});

test('local recording previews stay local and preserve seek position when resumed', async () => {
  const fixture = harness({ preview: true });
  await fixture.toggle(); fixture.playEvent(); fixture.audio.currentTime = 1.5;
  await fixture.toggle(); fixture.pauseEvent(); await fixture.toggle();
  assert.equal(fixture.audio.src, 'blob:recording-preview'); assert.equal(fixture.audio.currentTime, 1.5);
  assert.equal(fixture.requests.length, 0); assert.equal(fixture.created, 0);
  fixture.unmount(); assert.equal(fixture.revoked.length, 0); // Recorder owns its preview URL.
});
