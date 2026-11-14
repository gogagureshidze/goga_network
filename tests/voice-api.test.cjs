const assert = require('node:assert/strict');
const test = require('node:test');
const loadTs = require('./helpers/load-ts.cjs');
const id = '98556c70-17e4-4be0-bddd-4452d128ce22';
const mediaPath = `/api/chat/media/${id}`;

function api(fetch = () => { throw new Error('Unexpected request'); }, env = { NEXT_PUBLIC_MEDIA_API_URL: 'https://media.example.test', NODE_ENV: 'production' }) {
  return loadTs('src/lib/voice-api.ts', {}, { fetch, process: { env }, Blob, DOMException, TextDecoder, Uint8Array });
}
const signal = () => new AbortController().signal;
const audioResponse = () => new Response(new Uint8Array(16), { headers: { 'Content-Type': 'audio/mp4', 'Content-Length': '16' } });

test('media routing requires an explicit HTTPS origin and permits only loopback HTTP development', () => {
  const { mediaApiOrigin } = api();
  assert.equal(mediaApiOrigin('https://media.example.test/'), 'https://media.example.test');
  assert.equal(mediaApiOrigin('http://127.0.0.1:3002', false), 'http://127.0.0.1:3002');
  for (const value of ['', 'http://media.example.test', 'https://evil@example.test', 'https://example.test/media', 'https://example.test/?secret=1', 'https://example.test/#token', '//example.test']) {
    assert.throws(() => mediaApiOrigin(value));
  }
  assert.throws(() => mediaApiOrigin('http://localhost:3002', true));
  assert.throws(() => api(undefined, {}).mediaApiOrigin(), /not configured/);
});

test('old relative private references remain compatible without trusting remote or token-bearing URLs', () => {
  const { privateVoicePath } = api();
  assert.equal(privateVoicePath(mediaPath), mediaPath);
  assert.equal(privateVoicePath('ignored legacy value', id), mediaPath);
  for (const value of [`https://example.test${mediaPath}`, `${mediaPath}?token=secret`, '/api/chat/media/../file', 'blob:untrusted', '/private/file.mp4']) {
    assert.throws(() => privateVoicePath(value));
  }
  assert.throws(() => privateVoicePath(mediaPath, 'bad-id'));
});

test('private playback carries Clerk bearer only to the configured origin and omits credentials and redirects', async () => {
  let requests = 0;
  const client = api(async (url, init) => {
    requests++;
    assert.equal(url, `https://media.example.test${mediaPath}`);
    assert.equal(init.method, 'GET');
    assert.equal(JSON.stringify(init.headers), JSON.stringify({ Authorization: 'Bearer signed-session' }));
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.referrerPolicy, 'no-referrer');
    return audioResponse();
  });
  const blob = await client.fetchPrivateVoice(mediaPath, null, async () => 'signed-session', signal());
  assert.equal(blob.type, 'audio/mp4'); assert.equal(blob.size, 16); assert.equal(requests, 1);
});

test('missing authentication and cancelled token acquisition perform no network request', async () => {
  const client = api();
  await assert.rejects(client.fetchPrivateVoice(mediaPath, id, async () => null, signal()), /Sign in again/);
  const controller = new AbortController();
  await assert.rejects(client.fetchPrivateVoice(mediaPath, id, async () => { controller.abort(); return 'token'; }, controller.signal), { name: 'AbortError' });
});

test('private playback bounds declared and streamed bodies and rejects non-audio/partial responses', async () => {
  const oversized = api(async () => new Response(new Uint8Array(16), { headers: { 'Content-Type': 'audio/mp4', 'Content-Length': String(4 * 1024 * 1024 + 1) } }));
  await assert.rejects(oversized.fetchPrivateVoice(mediaPath, id, async () => 'token', signal()), /oversized/);
  let cancelled = false;
  const streamed = api(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'audio/mp4' } }));
  await assert.rejects(streamed.fetchPrivateVoice(mediaPath, id, async () => 'token', signal()), /oversized/);
  assert.equal(cancelled, true);
  for (const response of [new Response('secret server details', { status: 403 }), new Response('<html>sign in</html>', { headers: { 'Content-Type': 'text/html' } }), new Response(new Uint8Array(16), { status: 206, headers: { 'Content-Type': 'audio/mp4' } })]) {
    await assert.rejects(api(async () => response).fetchPrivateVoice(mediaPath, id, async () => 'token', signal()), /unavailable|unsupported/);
  }
});

test('voice uploads use the VPS origin, bounded structured metadata, and never adopt a public playback URL', async () => {
  const attachment = { mediaAssetId: id, mediaUrl: mediaPath, mediaType: 'voice', durationMs: 1000, waveform: [0.1, 0.5], conversationId: 3 };
  const form = new FormData(); form.set('durationMs', '1000');
  const client = api(async (url, init) => {
    assert.equal(url, 'https://media.example.test/api/chat/voice');
    assert.equal(init.method, 'POST'); assert.equal(init.body, form);
    assert.equal(init.headers.Authorization, 'Bearer token'); assert.equal(init.credentials, 'omit');
    return Response.json(attachment);
  });
  assert.equal(JSON.stringify(await client.uploadPrivateVoice(form, async () => 'token', signal())), JSON.stringify(attachment));
  for (const modified of [{ mediaUrl: 'https://public.example.test/audio.mp4' }, { durationMs: 120001 }, { waveform: [2] }, { mediaAssetId: '../file' }]) {
    await assert.rejects(api(async () => Response.json({ ...attachment, ...modified })).uploadPrivateVoice(form, async () => 'token', signal()), /invalid upload/);
  }
  await assert.rejects(api(async () => new Response('x'.repeat(16385))).uploadPrivateVoice(form, async () => 'token', signal()), /invalid upload/);
});
