const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
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

test('Netlify voice routes fail closed without importing storage or allocating uploads', async () => {
  // loadTs rejects any dependency not explicitly mocked; these routes import none.
  const upload = loadTs('src/app/api/chat/voice/route.ts', {});
  const playback = loadTs('src/app/api/chat/media/[id]/route.ts', {});
  for (const response of [await upload.POST(), await playback.GET(), await playback.HEAD()]) {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('location'), null);
  }
  assert.equal((await (await upload.POST()).json()).error, 'MEDIA_API_REQUIRED');
});
