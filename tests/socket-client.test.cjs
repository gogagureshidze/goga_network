const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const loadTs = require('./helpers/load-ts.cjs');

function harness({ getToken, connectImmediately = true } = {}) {
  const effects = [];
  const sockets = [];
  let tokens = 0;
  let intervals = 0;
  const intervalCallbacks = new Map();
  const browser = new EventEmitter();
  browser.addEventListener = browser.on.bind(browser);
  browser.removeEventListener = browser.off.bind(browser);
  const page = new EventEmitter();
  page.visibilityState = 'visible';
  page.addEventListener = page.on.bind(page);
  page.removeEventListener = page.off.bind(page);
  const loadedModule = loadTs('src/hooks/useRealtimeSocket.ts', {
    '@clerk/nextjs': { useAuth: () => ({ userId: 'member-a', isLoaded: true, getToken: getToken || (async () => `fresh-token-${++tokens}`) }) },
    react: { useEffect: effect => effects.push(effect), useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    'socket.io-client': { io: (url, options) => {
      const socket = new EventEmitter();
      socket.io = new EventEmitter(); socket.url = url; socket.options = options;
      socket.connected = false; socket.disconnects = 0; socket.connects = 0; socket.active = false;
      socket.connect = () => { socket.connects += 1; socket.active = true; socket.connected = connectImmediately; return socket; };
      socket.disconnect = () => { socket.connected = false; socket.active = false; socket.disconnects += 1; return socket; };
      sockets.push(socket); return socket;
    } },
  }, { queueMicrotask, document: page, window: browser,
    setInterval: callback => { intervals += 1; intervalCallbacks.set(intervals, callback); return intervals; },
    clearInterval: id => { intervals -= 1; intervalCallbacks.delete(id); },
  });
  return { module: loadedModule, sockets, effects, page, browser, intervalCallbacks, intervals: () => intervals };
}

test('components share one connection and only the final subscriber disconnects it', async () => {
  const fixture = harness();
  fixture.module.useRealtimeSocket(); fixture.module.useRealtimeSocket();
  const firstCleanup = fixture.effects[0]();
  const lastCleanup = fixture.effects[1]();
  assert.equal(fixture.sockets.length, 1);
  assert.equal(fixture.intervals(), 1);
  firstCleanup();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.sockets[0].disconnects, 0);
  lastCleanup();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.sockets[0].disconnects, 1);
  assert.equal(fixture.intervals(), 0);
  assert.equal(fixture.page.listenerCount('visibilitychange'), 0);
  assert.equal(fixture.browser.listenerCount('online'), 0);
});

test('server-expired sessions explicitly reconnect with a fresh handshake token', async () => {
  const fixture = harness();
  fixture.module.useRealtimeSocket(); const cleanup = fixture.effects[0]();
  const socket = fixture.sockets[0];
  const initial = await new Promise(resolve => socket.options.auth(resolve));
  socket.emit('sessionExpired', { code: 'UNAUTHENTICATED' });
  socket.connected = false; socket.active = false;
  socket.emit('disconnect', 'io server disconnect');
  assert.equal(socket.connects, 2);
  const recovered = await new Promise(resolve => socket.options.auth(resolve));
  assert.notEqual(recovered.token, initial.token);
  cleanup(); await new Promise(resolve => setImmediate(resolve));
});

test('foreground recovery is bounded when the server keeps rejecting credentials', async () => {
  const fixture = harness({ connectImmediately: false });
  const hook = fixture.module.useRealtimeSocket(); const cleanup = fixture.effects[0]();
  const socket = fixture.sockets[0];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    socket.active = false; socket.emit('connect_error', new Error('Unauthorized'));
    fixture.page.emit('visibilitychange'); fixture.browser.emit('online');
  }
  assert.equal(socket.connects, 4, 'initial connection plus at most three automatic recoveries');
  hook.reconnect();
  assert.equal(socket.connects, 5, 'explicit user retry can reset the bounded recovery budget');
  cleanup(); await new Promise(resolve => setImmediate(resolve));
});

test('foreground refresh renews a connected session without opening another socket', async () => {
  const fixture = harness();
  fixture.module.useRealtimeSocket(); const cleanup = fixture.effects[0]();
  const socket = fixture.sockets[0];
  const refreshed = [];
  socket.on('auth:refresh', payload => refreshed.push(payload));
  fixture.page.emit('visibilitychange'); fixture.browser.emit('online');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(socket.connects, 1);
  assert.equal(refreshed.length, 1, 'foreground events coalesce instead of causing refresh storms');
  assert.equal(refreshed[0].token, 'fresh-token-1');
  cleanup(); await new Promise(resolve => setImmediate(resolve));
});

test('late authentication promises cannot revive or refresh a released account connection', async () => {
  const resolutions = [];
  const fixture = harness({ getToken: () => new Promise(resolve => resolutions.push(resolve)) });
  fixture.module.useRealtimeSocket(); const cleanup = fixture.effects[0]();
  const socket = fixture.sockets[0];
  let callbacks = 0;
  socket.options.auth(() => { callbacks += 1; });
  socket.on('auth:refresh', () => { callbacks += 1; });
  fixture.page.emit('visibilitychange');
  cleanup(); await new Promise(resolve => setImmediate(resolve));
  resolutions.forEach(resolve => resolve('old-account-token'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(callbacks, 0);
  assert.equal(socket.connects, 1);
  assert.equal(socket.disconnects, 1);
});

test('socket handshake supplies a fresh session token and no forgeable user ID query', async () => {
  const fixture = harness();
  fixture.module.useRealtimeSocket(); const cleanup = fixture.effects[0]();
  const options = fixture.sockets[0].options;
  const first = await new Promise(resolve => options.auth(resolve));
  const second = await new Promise(resolve => options.auth(resolve));
  assert.equal(first.token, 'fresh-token-1');
  assert.equal(second.token, 'fresh-token-2');
  assert.equal(options.query, undefined);
  assert.equal(options.reconnectionAttempts, 8);
  cleanup();
  await new Promise(resolve => setImmediate(resolve));
});

test('ack helper rejects offline sends before socket buffering', async () => {
  const { module } = harness();
  let attempted = false;
  await assert.rejects(module.emitWithAck({ connected: false, timeout() { attempted = true; } }, 'sendMessage', {}), /offline/);
  assert.equal(attempted, false);
});

test('ack helper surfaces server denial and uses a bounded acknowledgement deadline', async () => {
  const { module } = harness();
  let deadline;
  const socket = { connected: true, timeout(value) { deadline = value; return { emitWithAck: async () => ({ ok: false, error: { code: 'FORBIDDEN', message: 'Conversation is unavailable' } }) }; } };
  await assert.rejects(module.emitWithAck(socket, 'sendMessage', {}), /Conversation is unavailable/);
  assert.equal(deadline, 12000);
});
