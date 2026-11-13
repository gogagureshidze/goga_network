const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const loadTs = require('./helpers/load-ts.cjs');
const { consumeRequestLimit, beginVoiceRequest } = require('../server/request-limits');
const error = () => Object.assign(new Error('Limited'), { code: 'RATE_LIMITED', status: 429 });

test('HTTP action limits are per-account, share recipients are weighted, and windows reset', () => {
  const user = randomUUID();
  consumeRequestLimit(user, 'share', 20, 100000);
  assert.throws(() => consumeRequestLimit(user, 'share', 11, 100000), { code: 'RATE_LIMITED' });
  consumeRequestLimit(user, 'share', 10, 100000);
  assert.throws(() => consumeRequestLimit(user, 'share', 1, 100000), { code: 'RATE_LIMITED' });
  consumeRequestLimit(user, 'share', 1, 160001);
  const finish = beginVoiceRequest(randomUUID());
  const second = beginVoiceRequest(randomUUID());
  assert.throws(() => beginVoiceRequest(randomUUID()), { code: 'RATE_LIMITED' });
  finish(); finish(); second();
});

test('sendMessage server action enforces limiter before persistence', async () => {
  let writes = 0;
  const action = loadTs('src/actions/sendMessage.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'alice' }) },
    '@/lib/chat-server': { chatService: { sendMessage: async () => writes++ } },
    '../../server/request-limits': { consumeRequestLimit: () => { throw error(); } },
  });
  await assert.rejects(action.sendMessage({ receiverId: 'bob', text: 'spam' }), { code: 'RATE_LIMITED' });
  assert.equal(writes, 0);
});

test('sharePost accounts for recipient count before database or snapshot access', async () => {
  let charged = 0, reads = 0;
  const action = loadTs('src/actions/sharePost.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'alice' }) },
    '@/lib/client': {}, '@/lib/chat-server': {}, 'next/cache': {},
    '@/lib/social-access': { assertCanViewPost: async () => reads++ },
    '../../server/request-limits': { consumeRequestLimit: (_user, category, cost) => { assert.equal(category, 'share'); charged = cost; throw error(); } },
  }, { console: { warn() {}, error() {} } });
  assert.equal((await action.sharePost(1, ['bob', 'eve', 'bob'])).success, false);
  assert.equal(charged, 2); assert.equal(reads, 0);
});

test('voice route refuses excess requests before reading or allocating upload body', async () => {
  let reads = 0;
  const route = loadTs('src/app/api/chat/voice/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'alice' }) },
    '@/lib/media-server': {},
    '@/lib/http-security': { requireSameOrigin() {}, boundedBody: async () => reads++, apiError: error => Response.json({ error: error.code }, { status: error.status }) },
    '../../../../../server/request-limits': { beginVoiceRequest: () => { throw error(); } },
    '../../../../../server/media-policy': { MAX_VOICE_BYTES: 4194304 },
  });
  const response = await route.POST(new Request('https://goga.test/api/chat/voice', { method: 'POST' }));
  assert.equal(response.status, 429); assert.equal(reads, 0);
});

test('authorized media route streams exact range and denies outsider before filesystem access', async () => {
  let opened = 0;
  let allowed = true;
  const route = loadTs('src/app/api/chat/media/[id]/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'alice' }) },
    'node:stream': { Readable },
    '@/lib/media-server': {
      mediaService: { authorizeAsset: async () => { if (!allowed) throw Object.assign(new Error('denied'), { status: 403 }); return { publicId: 'private' }; } },
      mediaStorage: () => ({ open: async () => { opened++; return { stream: Readable.from(Buffer.from('bc')), start: 1, end: 2, size: 4, partial: true }; } }),
    },
    '@/lib/http-security': { apiError: error => new Response(null, { status: error.status }) },
    '../../../../../../server/request-limits': { consumeRequestLimit() {} },
  }, { Headers });
  const request = () => new Request('https://goga.test/api/chat/media/id', { headers: { Range: 'bytes=1-2' } });
  const response = await route.GET(request(), { params: Promise.resolve({ id: 'id' }) });
  assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 1-2/4'); assert.equal(await response.text(), 'bc');
  allowed = false;
  assert.equal((await route.GET(request(), { params: Promise.resolve({ id: 'id' }) })).status, 403);
  assert.equal(opened, 1);
});
