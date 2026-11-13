const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const { projectPlayback, createMediaEventGuard, createPlaybackCommandQueue } = loadTs('src/lib/watch-playback.ts');

test('playback projects authoritative elapsed time, clamps at end and ignores negative clock drift', () => {
  const snapshot = { position: 10, playing: true, updatedAt: '2026-01-01T00:00:00Z' };
  const time = Date.parse(snapshot.updatedAt);
  assert.equal(projectPlayback(snapshot, time + 5000, 60).position, 15);
  assert.equal(projectPlayback(snapshot, time - 5000, 60).position, 10);
  assert.equal(projectPlayback(snapshot, time + 70_000, 60).position, 60);
  assert.equal(projectPlayback(snapshot, time + 70_000, 60).playing, false);
  assert.equal(projectPlayback({ ...snapshot, playing: false }, time + 5000, 60).position, 10);
});

test('only corresponding programmatic media events are suppressed; subsequent user events pass immediately', () => {
  const guard = createMediaEventGuard();
  assert.equal(guard.consume('play'), false);
  guard.expect('seeked'); guard.expect('seeked'); // Browsers coalesce pending seeks.
  assert.equal(guard.consume('pause'), false);
  assert.equal(guard.consume('seeked'), true);
  assert.equal(guard.consume('seeked'), false);
  guard.expect('play'); guard.cancel('play');
  assert.equal(guard.consume('play'), false);
});

test('seek and play commands serialize using each acknowledged authoritative version', async () => {
  let snapshot = { version: 0 }; const sent = [];
  const queue = createPlaybackCommandQueue({
    current: () => snapshot,
    send: async (version, action) => { sent.push([version, action]); await Promise.resolve(); return { version: version + 1 }; },
    accept: value => { snapshot = value; }, recover: async () => snapshot,
  });
  await Promise.all([queue.enqueue('seek', { position: 20 }), queue.enqueue('play')]);
  assert.deepEqual(sent, [[0, 'seek'], [1, 'play']]);
  assert.equal(snapshot.version, 2);
});

test('stale control recovers fresh snapshot before the next queued operation', async () => {
  let snapshot = { version: 0 }; const sent = [];
  const queue = createPlaybackCommandQueue({
    current: () => snapshot,
    send: async (version, action) => { sent.push([version, action]); if (action === 'seek') throw new Error('CONFLICT'); return { version: version + 1 }; },
    accept: value => { snapshot = value; }, recover: async () => ({ version: 5 }),
  });
  const seek = queue.enqueue('seek'); const pause = queue.enqueue('pause');
  await assert.rejects(seek, /CONFLICT/); await pause;
  assert.deepEqual(sent, [[0, 'seek'], [5, 'pause']]);
  assert.equal(snapshot.version, 6);
});

test('leaving a watch panel cancels queued unsent playback changes', async () => {
  let sent = 0;
  const queue = createPlaybackCommandQueue({ current: () => ({ version: 0 }), send: async () => { sent++; return { version: 1 }; }, accept() {}, recover: async () => ({ version: 0 }) });
  const command = queue.enqueue('play'); queue.cancel(); await command;
  assert.equal(sent, 0);
});
