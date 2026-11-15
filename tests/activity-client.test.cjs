const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const loadTs = require('./helpers/load-ts.cjs');
const { observeActivityStatus } = loadTs('src/lib/activity-client.ts');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('settings hydrate from fresh state on initial mount and reconnect after another device changes it', async () => {
  const socket = new EventEmitter(); socket.connected = true;
  let sharing = true; const values = [];
  const stop = observeActivityStatus(socket, async () => ({ showActivityStatus: sharing }), status => values.push(status.showActivityStatus));
  await flush();
  socket.connected = false; socket.emit('disconnect'); sharing = false;
  socket.connected = true; socket.emit('connect'); await flush();
  assert.deepEqual(values, [true, false]);
  stop(); assert.equal(socket.listenerCount('connect'), 0);
});

test('a stale settings read cannot overwrite a live privacy change or update a disposed account', async () => {
  const socket = new EventEmitter(); socket.connected = true;
  let resolve; const values = [];
  const stop = observeActivityStatus(socket, () => new Promise(done => { resolve = done; }), status => values.push(status.showActivityStatus));
  socket.emit('activityStatusChanged', { showActivityStatus: false });
  resolve({ showActivityStatus: true }); await flush();
  assert.deepEqual(values, [false]);
  socket.emit('connect'); stop(); resolve({ showActivityStatus: true }); await flush();
  assert.deepEqual(values, [false]);
});
