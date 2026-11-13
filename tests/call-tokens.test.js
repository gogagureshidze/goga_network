const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { TokenVerifier } = require('livekit-server-sdk');
const { createCallCredentials, getLiveKitUrl } = require('../server/call-credentials');
const { createRoomService } = require('../server/rooms');
const { ChatError } = require('../server/chat-service');

function setup({ direct = false, reviewed = true } = {}) {
  const env = { NODE_ENV: 'production', LIVEKIT_URL: 'wss://media.example.test', LIVEKIT_API_KEY: 'test-api-key', LIVEKIT_API_SECRET: 'test-secret-at-least-thirty-two-characters', ENABLE_GROUP_CALLS: 'true', GROUP_CALL_SECURITY_REVIEWED: reviewed ? 'true' : 'false',
    RTC_STUN_URLS: 'stun:turn.example.test:3478', TURN_URLS: 'turn:turn.example.test:3478?transport=udp,turns:turn.example.test:5349?transport=tcp', TURN_SHARED_SECRET: 'test-turn-shared-secret-not-production' };
  const members = new Set(['alice', 'bob']);
  const call = { id: 'call-1', conversationId: 1, roomName: 'server-owned-random-room', status: 'ACTIVE', expiresAt: new Date(Date.now() + 3600_000), conversation: { kind: direct ? 'DIRECT' : 'GROUP' }, participants: [
    { userId: 'alice', status: 'JOINED', deviceId: 'alice-tab' }, { userId: 'bob', status: 'JOINED', deviceId: 'bob-tab' },
  ] };
  const chat = { authorizeConversation: async userId => { if (!members.has(userId)) throw new ChatError('FORBIDDEN', 'Denied', 403); return { id: 1 }; } };
  const rooms = createRoomService({ prisma: { callSession: { findUnique: async () => call } }, chat, env, livekit: {} });
  const service = createCallCredentials({ rooms, env });
  return { service, env, call, members };
}

test('real signed LiveKit token is scoped to authenticated user and server-selected room with 30s initial TTL', async () => {
  const { service, env } = setup();
  const result = await service.issueToken('alice', 'call-1', 'alice-tab');
  const verified = await new TokenVerifier(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET).verify(result.token);
  assert.equal(verified.sub, 'alice');
  const payload = JSON.parse(Buffer.from(result.token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(payload.exp - payload.nbf, 30);
  assert.equal(payload.video.room, 'server-owned-random-room');
  assert.equal(payload.video.roomJoin, true);
  assert.equal(payload.video.canSubscribe, true);
  assert.equal(payload.video.canPublishData, false);
  assert.equal(payload.video.roomAdmin, false);
  assert.equal(payload.video.roomCreate, false);
  assert.equal(payload.video.roomRecord, false);
  assert.deepEqual(payload.video.canPublishSources, ['microphone', 'camera', 'screen_share', 'screen_share_audio']);
  assert.equal(result.serverUrl, 'wss://media.example.test');
});

test('second account outside conversation never receives token, and another tab cannot mint for accepted device', async () => {
  const { service } = setup();
  await assert.rejects(service.issueToken('mallory', 'call-1', 'mallory-tab'), error => error.code === 'FORBIDDEN');
  await assert.rejects(service.issueToken('bob', 'call-1', 'other-tab'), error => error.code === 'FORBIDDEN');
  const bob = await service.issueToken('bob', 'call-1', 'bob-tab');
  const claims = JSON.parse(Buffer.from(bob.token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(claims.sub, 'bob');
});

test('invited, removed and ended call participants cannot receive credentials', async () => {
  const { service, call, members } = setup();
  call.participants[1].status = 'INVITED';
  await assert.rejects(service.issueToken('bob', 'call-1', 'bob-tab'), error => error.code === 'FORBIDDEN');
  call.participants[1].status = 'JOINED'; members.delete('bob');
  await assert.rejects(service.issueToken('bob', 'call-1', 'bob-tab'), error => error.code === 'FORBIDDEN');
  call.status = 'ENDED';
  await assert.rejects(service.issueToken('alice', 'call-1', 'alice-tab'), error => error.code === 'FORBIDDEN');
});

test('group feature and security review gate fail closed; production refuses insecure media URL', async () => {
  await assert.rejects(setup({ reviewed: false }).service.issueToken('alice', 'call-1', 'alice-tab'), error => error.code === 'UNAVAILABLE');
  assert.throws(() => getLiveKitUrl({ NODE_ENV: 'production', LIVEKIT_URL: 'ws://localhost:7880' }), error => error.code === 'UNAVAILABLE');
  assert.throws(() => getLiveKitUrl({ NODE_ENV: 'production', LIVEKIT_URL: 'wss://user:secret@media.example.test' }), error => error.code === 'UNAVAILABLE');
  assert.equal(getLiveKitUrl({ NODE_ENV: 'development', LIVEKIT_URL: 'ws://localhost:7880' }), 'ws://localhost:7880');
});

test('TURN REST credentials are per-request, opaque-user-bound HMAC SHA1 with at most five minute lifetime', async () => {
  const { service, env } = setup({ direct: true });
  const before = Date.now();
  const result = await service.issueIce('alice', 'call-1', 'alice-tab');
  assert.equal(result.relayAvailable, true);
  assert.equal(result.iceServers.length, 2);
  const turn = result.iceServers[1];
  assert.equal(turn.credential, createHmac('sha1', env.TURN_SHARED_SECRET).update(turn.username).digest('base64'));
  const expiry = Number(turn.username.split(':')[0]) * 1000;
  assert.ok(expiry >= before + 299_000 && expiry <= Date.now() + 300_000);
  assert.ok(!turn.username.includes('alice'));
  const second = await service.issueIce('alice', 'call-1', 'alice-tab');
  assert.notEqual(second.iceServers[1].username, turn.username);
  await assert.rejects(service.issueIce('mallory', 'call-1', 'mallory-tab'), error => error.code === 'FORBIDDEN');
});

test('credential endpoint enforces shared per-account 30 requests/minute budget', async () => {
  const { service } = setup({ direct: true });
  for (let i = 0; i < 30; i++) await service.issueIce('alice', 'call-1', 'alice-tab');
  await assert.rejects(service.issueIce('alice', 'call-1', 'alice-tab'), error => error.code === 'RATE_LIMITED');
  assert.equal((await service.issueIce('bob', 'call-1', 'bob-tab')).relayAvailable, true);
});
