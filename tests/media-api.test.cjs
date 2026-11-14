const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { createMediaApi, configuredMedia } = require('../server/media-http');
const { syntheticSessions } = require('./helpers/runtime-harness.cjs');

async function fixture(t, overrides = {}, behavior = {}) {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'goga-media-http-unit-'));
  const origin = overrides.MEDIA_ALLOWED_ORIGINS || 'http://localhost:3000';
  const sessions = syntheticSessions(origin);
  let queries = 0;
  const api = createMediaApi({
    prisma: {
      user: { findUnique: async ({ where }) => ({ id: where.id, username: 'Synthetic test' }) },
      $queryRaw: async () => { queries++; return [{ one: 1 }]; },
      mediaAsset: { findUnique: async () => { queries++; return null; } },
    },
    verifyToken: async token => {
      const claims = await sessions.verify(token);
      await behavior.beforeVerificationCompletes?.();
      return claims;
    },
    logger: { info() {}, error() {} },
    env: { NODE_ENV: 'development', GOGA_LOCAL_DEVELOPMENT: 'true', MEDIA_ALLOWED_ORIGINS: origin,
      MEDIA_API_PUBLIC_ORIGIN: 'http://localhost:3002', VOICE_STORAGE_DIR: root,
      FFMPEG_PATH: process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : '/usr/bin/ffmpeg',
      FFPROBE_PATH: process.platform === 'darwin' ? '/opt/homebrew/bin/ffprobe' : '/usr/bin/ffprobe',
      ...overrides },
  });
  t.after(async () => { await api.close(); await fs.rm(root, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => { api.server.once('error', reject); api.server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${api.server.address().port}`;
  const user = `media-unit-${randomUUID()}`;
  const request = (pathname, options = {}) => fetch(`${base}${pathname}`, {
    ...options, signal: AbortSignal.timeout(5000), redirect: 'error',
    headers: { Origin: origin, Authorization: `Bearer ${sessions.token(user)}`, ...options.headers },
  });
  return { api, root, origin, sessions, user, base, request, queries: () => queries };
}

test('VPS media CORS permits only exact configured origins and never enables cookie credentials', async t => {
  const h = await fixture(t);
  const accepted = await h.request('/api/chat/voice', { method: 'OPTIONS', headers: {
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(accepted.status, 204);
  assert.equal(accepted.headers.get('access-control-allow-origin'), h.origin);
  assert.equal(accepted.headers.get('access-control-allow-credentials'), null);
  assert.match(accepted.headers.get('access-control-allow-headers'), /authorization/i);
  assert.match(accepted.headers.get('vary'), /origin/i);
  for (const origin of ['https://attacker.invalid', `${h.origin}.attacker.invalid`, 'null', '']) {
    const denied = await h.request('/api/chat/voice', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
  for (const headers of [
    { 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization' },
    { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,x-forged-user' },
  ]) assert.equal((await h.request('/api/chat/voice', { method: 'OPTIONS', headers })).status, 403);
  assert.equal(h.queries(), 0, 'Cross-origin rejection must precede database access');
});

test('VPS media rejects missing, forged, expired and non-session Clerk identities before data access', async t => {
  const h = await fixture(t);
  const url = `/api/chat/media/${randomUUID()}`;
  const token = h.sessions.token(h.user);
  const [header, payload, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: 'attacker' })).toString('base64url');
  const tokens = [undefined, 'not-a-token', `${header}.${forged}.${signature}`,
    h.sessions.token(h.user, { exp: Math.floor(Date.now() / 1000) - 120 }),
    h.sessions.token(h.user, { sid: undefined }),
    h.sessions.token(h.user, { azp: undefined }),
    h.sessions.token(h.user, { azp: 'https://attacker.invalid' }),
  ];
  for (const value of tokens) {
    const response = await h.request(url, { headers: { Authorization: value ? `Bearer ${value}` : '', Cookie: `__session=${token}` } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('set-cookie'), null);
  }
  const leaked = await fetch(`${h.base}${url}?token=${encodeURIComponent(token)}`, { headers: { Origin: h.origin } });
  assert.equal(leaked.status, 404, 'Query-string tokens are rejected before authentication');
  assert.equal(h.queries(), 0);
});

test('VPS media rejects malformed multipart and oversized uploads without encoding or metadata writes', async t => {
  const h = await fixture(t);
  const wrongType = await h.request('/api/chat/voice', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  assert.equal(wrongType.status, 415);
  const malformed = await h.request('/api/chat/voice', { method: 'POST', body: 'not multipart', headers: { 'Content-Type': 'multipart/form-data; boundary=missing' } });
  assert.equal(malformed.status, 400);
  const noAudio = new FormData(); noAudio.set('conversationId', '1'); noAudio.set('durationMs', '1000');
  assert.equal((await h.request('/api/chat/voice', { method: 'POST', body: noAudio })).status, 400);
  const tooLarge = await new Promise((resolve, reject) => {
    const req = http.request(`${h.base}/api/chat/voice`, { method: 'POST', headers: {
      Origin: h.origin, Authorization: `Bearer ${h.sessions.token(h.user)}`,
      'Content-Type': 'multipart/form-data; boundary=test', 'Content-Length': String(4 * 1024 * 1024 + 32769),
    } }, res => { res.resume(); res.once('end', () => resolve(res)); });
    req.once('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Upload limit test timeout')));
    req.flushHeaders();
  });
  assert.equal(tooLarge.statusCode, 413);
  assert.equal(h.queries(), 0);
});

test('VPS media applies upload rate limits to verified accounts', async t => {
  const h = await fixture(t);
  for (let i = 0; i < 6; i++) {
    const response = await h.request('/api/chat/voice', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    assert.equal(response.status, 415);
  }
  const rejected = await h.request('/api/chat/voice', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  assert.equal(rejected.status, 429);
  assert.ok(Number(rejected.headers.get('retry-after')) > 0);
});

test('VPS media rejects chunked bodies exceeding the same bounded upload limit', async t => {
  const h = await fixture(t);
  const response = await new Promise((resolve, reject) => {
    const req = http.request(`${h.base}/api/chat/voice`, { method: 'POST', headers: {
      Origin: h.origin, Authorization: `Bearer ${h.sessions.token(h.user)}`,
      'Content-Type': 'multipart/form-data; boundary=chunked', 'Transfer-Encoding': 'chunked',
    } }, res => { res.resume(); res.once('end', () => resolve(res)); });
    req.once('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Upload test timeout')));
    req.write(Buffer.alloc(2 * 1024 * 1024)); req.write(Buffer.alloc(2 * 1024 * 1024));
    req.end(Buffer.alloc(32769));
  });
  assert.equal(response.statusCode, 413);
  assert.equal(h.queries(), 0);
});


test('VPS media production configuration rejects insecure origins and publicly bound listeners', () => {
  const base = { NODE_ENV: 'production', MEDIA_ALLOWED_ORIGINS: 'https://goga.example', MEDIA_API_PUBLIC_ORIGIN: 'https://media.goga.example' };
  assert.equal(configuredMedia(base).host, '127.0.0.1');
  for (const overrides of [
    { MEDIA_ALLOWED_ORIGINS: '' }, { MEDIA_ALLOWED_ORIGINS: '*' },
    { MEDIA_ALLOWED_ORIGINS: 'http://goga.example' }, { MEDIA_ALLOWED_ORIGINS: 'https://goga.example/path' },
    { MEDIA_ALLOWED_ORIGINS: 'https://user:secret@goga.example' },
    { MEDIA_API_PUBLIC_ORIGIN: '' }, { MEDIA_API_PUBLIC_ORIGIN: 'http://media.goga.example' },
    { MEDIA_API_PUBLIC_ORIGIN: 'https://media.goga.example/?token=value' },
    { MEDIA_API_HOST: '0.0.0.0' }, { MEDIA_API_HOST: '::' }, { MEDIA_API_PORT: 'NaN' },
  ]) assert.throws(() => configuredMedia({ ...base, ...overrides }));
  assert.throws(() => configuredMedia({ NODE_ENV: 'development', MEDIA_ALLOWED_ORIGINS: 'http://localhost:3000', MEDIA_API_PUBLIC_ORIGIN: 'http://localhost:3002' }), 'HTTP needs the explicit development marker');
});

test('VPS media production rejects HTTP forwarding and honors only the explicit TLS proxy header', async t => {
  const h = await fixture(t, { NODE_ENV: 'production', GOGA_LOCAL_DEVELOPMENT: 'false',
    MEDIA_ALLOWED_ORIGINS: 'https://goga.example', MEDIA_API_PUBLIC_ORIGIN: 'https://media.goga.example' });
  for (const proto of ['', 'http', 'https,http']) {
    const response = await h.request(`/api/chat/media/${randomUUID()}`, { headers: { 'X-Forwarded-Proto': proto } });
    assert.equal(response.status, 403); assert.equal((await response.json()).error, 'HTTPS_REQUIRED');
  }
  const wrongHost = await h.request(`/api/chat/media/${randomUUID()}`, { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(wrongHost.status, 403); assert.equal((await wrongHost.json()).error, 'INVALID_HOST');
  // Use the native request transport for proxy Host: fetch owns its Host header.
  const allowed = await new Promise((resolve, reject) => {
    const req = http.get(`${h.base}/api/chat/media/${randomUUID()}`, { headers: {
      Origin: h.origin, Authorization: `Bearer ${h.sessions.token(h.user)}`,
      'X-Forwarded-Proto': 'https', Host: 'media.goga.example',
    } }, res => { res.resume(); res.once('end', () => resolve(res)); });
    req.once('error', reject);
  });
  assert.equal(allowed.statusCode, 404, 'A verified HTTPS request reaches asset authorization');
  assert.equal(h.queries(), 1);
});

test('VPS media releases upload slots after real clients abort partial request bodies', async t => {
  const h = await fixture(t);
  for (let attempt = 0; attempt < 3; attempt++) {
    let serverRequest;
    const receiving = new Promise(resolve => h.api.server.once('request', request => {
      serverRequest = request;
      const watching = event => {
        if (event === 'data') { request.off('newListener', watching); resolve(); }
      };
      request.on('newListener', watching);
    }));
    const client = http.request(`${h.base}/api/chat/voice`, { method: 'POST', headers: {
      Origin: h.origin, Authorization: `Bearer ${h.sessions.token(h.user)}`,
      'Content-Type': 'multipart/form-data; boundary=aborted', 'Transfer-Encoding': 'chunked',
    } });
    client.on('error', () => {}); // A deliberately aborted client is expected to receive ECONNRESET.
    client.flushHeaders();
    await Promise.race([receiving, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not start bounded upload read')), 1000); timer.unref();
    })]);
    const partial = new Promise(resolve => serverRequest.once('data', resolve));
    client.write('--aborted\r\nContent-Disposition: form-data; name="audio"; filename="voice.wav"\r\n\r\nRIFF');
    await partial;
    const closed = new Promise(resolve => serverRequest.once('close', resolve));
    client.destroy();
    await closed;
  }
  const next = await h.request('/api/chat/voice', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  assert.equal(next.status, 415, 'Aborted uploads must release both concurrency slots');
  assert.equal((await h.request('/health')).status, 200);
  assert.deepEqual(await fs.readdir(h.root), [], 'Partial uploads never reach storage');
  assert.equal(h.queries(), 0);
});

test('VPS media readiness fails closed for an unusable private storage directory', async t => {
  const h = await fixture(t);
  await fs.rmdir(h.root); await fs.writeFile(h.root, 'not a directory');
  assert.equal((await h.request('/health')).status, 200);
  const readiness = await h.request('/ready');
  assert.equal(readiness.status, 503); assert.equal((await readiness.json()).error, 'UNAVAILABLE');
  await assert.rejects(h.api.ready());
});

test('VPS media readiness fails closed when FFmpeg is unavailable', async t => {
  const h = await fixture(t, { FFMPEG_PATH: path.join(os.tmpdir(), `goga-missing-ffmpeg-${randomUUID()}`) });
  assert.equal((await h.request('/health')).status, 200);
  assert.equal((await h.request('/ready')).status, 503);
  await assert.rejects(h.api.ready(), { code: 'ENOENT' });
});

test('VPS media notices disconnects during asynchronous identity verification before reserving upload capacity', async t => {
  const releases = [];
  let verificationStarted;
  const h = await fixture(t, {}, { beforeVerificationCompletes: () => {
    if (releases.length === 2) return;
    return new Promise(resolve => { releases.push(resolve); verificationStarted(); });
  } });
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = new Promise(resolve => { verificationStarted = resolve; });
    const closed = new Promise(resolve => h.api.server.once('request', request => request.once('close', resolve)));
    const client = http.request(`${h.base}/api/chat/voice`, { method: 'POST', headers: {
      Origin: h.origin, Authorization: `Bearer ${h.sessions.token(h.user)}`,
      'Content-Type': 'multipart/form-data; boundary=aborted-auth', 'Transfer-Encoding': 'chunked',
    } });
    client.on('error', () => {}); client.flushHeaders();
    await started; client.destroy(); await closed; releases[attempt]();
    await new Promise(resolve => setImmediate(resolve));
  }
  const next = await h.request('/api/chat/voice', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
  assert.equal(next.status, 415, 'Already-aborted requests must not hold upload capacity until the body timeout');
  assert.equal((await h.request('/health')).status, 200);
});
