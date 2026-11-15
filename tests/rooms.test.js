const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoomService, createRoomRegistrar } = require('../server/rooms');
const { ChatError } = require('../server/chat-service');

function setup({ group = false, enabled = false, env = {} } = {}) {
  let clock = 1_800_000_000_000;
  const members = new Set(group ? ['alice', 'bob', 'charlie'] : ['alice', 'bob']);
  const calls = new Map(), parties = new Map(), retired = new Map();
  const conversation = { id: 1, kind: group ? 'GROUP' : 'DIRECT' };
  const chat = {
    async authorizeConversation(userId, id) { if (id !== 1 || !members.has(userId)) throw new ChatError('FORBIDDEN', 'Denied', 403); return { ...conversation, participantIds: [...members] }; },
    async getOrCreateDirect(userId) { return this.authorizeConversation(userId, 1); },
    async getDeliveryRecipients() { return [...members]; },
  };
  const dataUpdate = (row, data) => { for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value; };
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'participants') return row.participants.some(participant => matches(participant, value.some));
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('in' in value) return value.in.includes(row[key]);
        if ('gt' in value) return new Date(row[key]) > value.gt;
        if ('lte' in value) return new Date(row[key]) <= value.lte;
      }
      return row[key] === value;
    });
  }
  const copy = row => row ? structuredClone(row) : null;
  const prisma = {
    conversation: { update: async () => conversation },
    callSession: {
      findUnique: async ({ where }) => copy(calls.get(where.id)),
      findFirst: async ({ where }) => copy([...calls.values()].find(row => matches(row, where))),
      findMany: async ({ where }) => [...calls.values()].filter(row => matches(row, where)).map(copy),
      create: async ({ data }) => {
        const row = { mediaVersion: 0, screenVersion: 0, screenLeaseId: null, screenRoomName: null, screenUserId: null, screenDeviceId: null, screenExpiresAt: null, ...data, createdAt: new Date(clock), startedAt: null, endedAt: null, conversation,
          participants: data.participants.create.map(participant => ({ ...participant, callId: data.id, user: { id: participant.userId, username: participant.userId } })) };
        calls.set(row.id, row); return copy(row);
      },
      update: async ({ where, data }) => { const row = calls.get(where.id); dataUpdate(row, data); return copy(row); },
    },
    callParticipant: {
      update: async ({ where, data }) => { const row = calls.get(where.callId_userId.callId).participants.find(member => member.userId === where.callId_userId.userId); dataUpdate(row, data); return copy(row); },
      updateMany: async ({ where, data }) => { let count = 0; for (const call of calls.values()) for (const row of call.participants) if (matches(row, where)) { dataUpdate(row, data); count++; } return { count }; },
    },
    retiredMediaRoom: {
      findMany: async ({ where }) => [...retired.values()].filter(row => matches(row, where)).map(copy),
      upsert: async ({ where, create }) => { if (!retired.has(where.roomName)) retired.set(where.roomName, { attempts: 0, lastErrorCode: null, createdAt: new Date(clock), ...create }); return copy(retired.get(where.roomName)); },
      update: async ({ where, data }) => { const row = retired.get(where.roomName); dataUpdate(row, data); return copy(row); },
      updateMany: async ({ where, data }) => { const row = retired.get(where.roomName); if (!row) return { count: 0 }; dataUpdate(row, data); return { count: 1 }; },
      deleteMany: async ({ where }) => { retired.delete(where.roomName); },
    },
    watchParty: {
      findUnique: async ({ where }) => copy(parties.get(where.id)),
      findFirst: async ({ where }) => copy([...parties.values()].find(row => matches(row, where))),
      findMany: async ({ where }) => [...parties.values()].filter(row => matches(row, where)).map(copy),
      create: async ({ data }) => { const row = { id: `party-${parties.size + 1}`, version: 0, endedAt: null, playing: false, collaborative: false, position: 0, createdAt: new Date(clock), ...data }; parties.set(row.id, row); return copy(row); },
      updateMany: async ({ where, data }) => { let count = 0; for (const row of parties.values()) if (matches(row, where)) { dataUpdate(row, data); count++; } return { count }; },
    },
    $transaction: async callback => callback(prisma),
  };
  const removed = [], deleted = [], published = [];
  const livekit = { createRoom: async options => options, removeParticipant: async (...args) => removed.push(args), deleteRoom: async (...args) => deleted.push(args) };
  const service = createRoomService({ prisma, chat, now: () => clock,
    env: { ENABLE_GROUP_CALLS: enabled ? 'true' : 'false', GROUP_CALL_SECURITY_REVIEWED: enabled ? 'true' : 'false', WATCH_ALLOWED_HOSTS: 'media.example.test', ...env },
    livekit: enabled ? livekit : undefined, logger: { error() {} } });
  service.setPublisher(async (...args) => published.push(args));
  return { service, prisma, members, calls, parties, retired, livekit, removed, deleted, published, advance: ms => { clock += ms; } };
}
const start = service => service.initiate('alice', { conversationId: 1, kind: 'VIDEO', deviceId: 'alice-tab' });
const accept = (service, callId, userId = 'bob', deviceId = 'bob-tab') => service.respond(userId, { callId, accept: true, deviceId });
const watch = service => service.createWatch('alice', { conversationId: 1, authorized: true, sourceUrl: 'https://media.example.test/movie.mp4', title: 'Movie' });

test('call read and join authorization reject a second account outside the conversation', async () => {
  const { service } = setup(); const call = await start(service);
  await assert.rejects(service.getCall('mallory', call.id), error => error.code === 'FORBIDDEN');
  await assert.rejects(service.authorizeCall('mallory', call.id), error => error.code === 'FORBIDDEN');
  await assert.rejects(service.authorizeCall('bob', call.id), error => error.code === 'FORBIDDEN');
  await accept(service, call.id);
  assert.equal((await service.authorizeCall('bob', call.id, 'bob-tab')).status, 'ACTIVE');
});

test('accepted device is pinned and another tab cannot signal or end the call', async () => {
  const { service } = setup(); const call = await start(service); await accept(service, call.id);
  await assert.rejects(accept(service, call.id, 'bob', 'other-tab'), error => error.code === 'CONFLICT');
  await assert.rejects(service.leave('bob', { callId: call.id, deviceId: 'other-tab' }), error => error.code === 'FORBIDDEN');
  await assert.rejects(service.validateSignal('bob', { callId: call.id, deviceId: 'other-tab', toUserId: 'alice', ready: true }), error => error.code === 'FORBIDDEN');
  const signal = await service.validateSignal('bob', { callId: call.id, deviceId: 'bob-tab', toUserId: 'alice', ready: true });
  assert.equal(signal.payload.toDeviceId, 'alice-tab');
});

test('device identifiers respect the persisted 64-character bound before writes', async () => {
  const { service, calls } = setup();
  await assert.rejects(service.initiate('alice', { conversationId: 1, kind: 'VIDEO', deviceId: 'a'.repeat(65) }), error => error.code === 'INVALID_INPUT');
  assert.equal(calls.size, 0);
  const call = await service.initiate('alice', { conversationId: 1, kind: 'VIDEO', deviceId: 'a'.repeat(64) });
  await assert.rejects(accept(service, call.id, 'bob', 'b'.repeat(65)), error => error.code === 'INVALID_INPUT');
  assert.equal(calls.get(call.id).participants.find(member => member.userId === 'bob').status, 'INVITED');
  assert.equal((await accept(service, call.id, 'bob', 'b'.repeat(64))).status, 'ACTIVE');
});

test('internal account deletion rejects absent or unbounded identifiers before any query', async () => {
  const { service } = setup();
  for (const id of [undefined, null, '', 123, {}, 'u'.repeat(192)]) {
    await assert.rejects(service.deleteAccountUser(id), error => error.code === 'INVALID_INPUT');
  }
});

test('signaling validates sender, recipient, offer role and bounded SDP', async () => {
  const { service } = setup(); const call = await start(service); await accept(service, call.id);
  const base = { callId: call.id, deviceId: 'bob-tab', toUserId: 'alice' };
  await assert.rejects(service.validateSignal('bob', { ...base, description: { type: 'offer', sdp: 'sdp' } }), error => error.code === 'FORBIDDEN');
  await assert.rejects(service.validateSignal('bob', { ...base, description: { type: 'answer', sdp: 'x'.repeat(48001) } }), error => error.code === 'INVALID_INPUT');
  await assert.rejects(service.validateSignal('bob', { ...base, toUserId: 'mallory', ready: true }), error => error.code === 'FORBIDDEN');
  assert.equal((await service.validateSignal('alice', { callId: call.id, deviceId: 'alice-tab', toUserId: 'bob', description: { type: 'offer', sdp: 'v=0' } })).payload.description.type, 'offer');
});

test('media state is scoped to accepted participants, devices and current membership', async () => {
  const { service, members } = setup(); const call = await start(service);
  const mediaState = { sequence: 1, cameraEnabled: false, screenSharing: true, screenAudio: true, microphoneMuted: false };
  const input = { callId: call.id, deviceId: 'alice-tab', toUserId: 'bob', mediaState };
  await assert.rejects(service.validateSignal('alice', input), error => error.code === 'FORBIDDEN');
  await accept(service, call.id);
  assert.deepEqual((await service.validateSignal('alice', input)).payload, {
    callId: call.id, fromUserId: 'alice', fromDeviceId: 'alice-tab', toDeviceId: 'bob-tab', mediaState,
  });
  await assert.rejects(service.validateSignal('alice', { ...input, deviceId: 'other-tab' }), error => error.code === 'FORBIDDEN');
  await assert.rejects(service.validateSignal('mallory', input), error => error.code === 'FORBIDDEN');
  members.delete('bob');
  await assert.rejects(service.validateSignal('alice', input), error => error.code === 'FORBIDDEN');
});

test('media signals require bounded ordered state and cannot smuggle unrelated signaling', async () => {
  const { service } = setup(); const call = await start(service); await accept(service, call.id);
  const mediaState = { sequence: 1, cameraEnabled: false, screenSharing: false, screenAudio: false, microphoneMuted: true };
  const input = { callId: call.id, deviceId: 'alice-tab', toUserId: 'bob', mediaState };
  for (const invalidState of [null, [], {}, { ...mediaState, sequence: -1 }, { ...mediaState, sequence: Infinity },
    { ...mediaState, sequence: 1.5 }, { ...mediaState, sequence: Number.MAX_SAFE_INTEGER + 1 },
    { ...mediaState, cameraEnabled: 'false' }, { ...mediaState, screenAudio: true },
    { ...mediaState, source: 'untrusted' }]) {
    await assert.rejects(service.validateSignal('alice', { ...input, mediaState: invalidState }), error => error.code === 'INVALID_INPUT');
  }
  for (const extra of [{ ready: true }, { ready: false }, { description: { type: 'offer', sdp: 'v=0' } }, { candidate: { candidate: '' } }]) {
    await assert.rejects(service.validateSignal('alice', { ...input, ...extra }), error => error.code === 'INVALID_INPUT');
  }
  await service.leave('alice', { callId: call.id, deviceId: 'alice-tab' });
  await assert.rejects(service.validateSignal('alice', input), error => error.code === 'FORBIDDEN');
});

test('duplicate active call is rejected and hanging up persists ended lifecycle', async () => {
  const { service } = setup(); const call = await start(service);
  await assert.rejects(start(service), error => error.code === 'CONFLICT');
  await accept(service, call.id);
  const ended = await service.leave('bob', { callId: call.id, deviceId: 'bob-tab' });
  assert.equal(ended.status, 'ENDED');
  assert.ok(ended.endedAt);
  assert.ok(ended.participants.every(member => member.status === 'LEFT'));
});

test('unanswered call becomes missed after ringing expiry', async () => {
  const { service, advance, published } = setup(); const call = await start(service);
  advance(46_000); await service.sweep();
  assert.equal((await service.getCall('alice', call.id)).status, 'MISSED');
  assert.equal(published[0][1], 'callUpdated');
});

test('group calls are disabled unless configured and revoke SFU membership on removal', async () => {
  await assert.rejects(start(setup({ group: true }).service), error => error.code === 'UNAVAILABLE');
  const { service, members, deleted } = setup({ group: true, enabled: true });
  const call = await start(service); await accept(service, call.id);
  members.delete('bob'); await service.onMembershipRevoked(1, 'bob');
  await service.sweep();
  assert.equal(deleted[0][0], call.roomName);
  assert.equal((await service.getCall('alice', call.id)).mediaVersion, 1);
  await assert.rejects(service.authorizeCall('bob', call.id, 'bob-tab'), error => error.code === 'FORBIDDEN');
});

test('watch creation requires membership, authorization declaration and approved HTTPS source', async () => {
  const { service } = setup();
  await assert.rejects(service.createWatch('mallory', { conversationId: 1, authorized: true, sourceUrl: 'https://media.example.test/movie.mp4' }), error => error.code === 'FORBIDDEN');
  for (const sourceUrl of ['http://media.example.test/movie.mp4', 'https://unapproved.test/movie.mp4', 'https://media.example.test/page', 'https://u:p@media.example.test/movie.mp4']) {
    await assert.rejects(service.createWatch('alice', { conversationId: 1, authorized: true, sourceUrl }), error => error.code === 'INVALID_INPUT');
  }
  await assert.rejects(service.createWatch('alice', { conversationId: 1, sourceUrl: 'https://media.example.test/movie.mp4' }), error => error.code === 'INVALID_INPUT');
});

const localWatchEnvironment = {
  NODE_ENV: 'development', GOGA_LOCAL_DEVELOPMENT: 'true',
  DATABASE_URL: 'mysql://synthetic:private-test-password@127.0.0.1:33367/goga_development',
  WATCH_ALLOWED_HOSTS: 'localhost,127.0.0.1,media.example.test',
};

test('watch source permits explicitly allowlisted local HTTP fixtures only with the isolated development configuration', async () => {
  for (const sourceUrl of ['http://localhost:3000/dev-fixtures/movie.mp4', 'http://127.0.0.1:3000/dev-fixtures/movie.webm']) {
    const { service, parties } = setup({ env: localWatchEnvironment });
    const party = await service.createWatch('alice', { conversationId: 1, authorized: true, sourceUrl });
    assert.equal(party.sourceUrl, sourceUrl);
    assert.equal(parties.size, 1);
  }
});

test('local HTTP watch fixtures cannot bypass production, opt-in, database or host restrictions', async () => {
  const cases = [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'test' },
    { NODE_ENV: undefined },
    { GOGA_LOCAL_DEVELOPMENT: undefined },
    { GOGA_LOCAL_DEVELOPMENT: 'false' },
    { DATABASE_URL: undefined },
    { DATABASE_URL: localWatchEnvironment.DATABASE_URL.replace('127.0.0.1', 'production.example.test') },
    { DATABASE_URL: localWatchEnvironment.DATABASE_URL.replace(':33367', ':3306') },
    { DATABASE_URL: localWatchEnvironment.DATABASE_URL.replace('/goga_development', '/goga_validation') },
    { DATABASE_URL: `${localWatchEnvironment.DATABASE_URL}?socket=/tmp/mysql.sock` },
    { WATCH_ALLOWED_HOSTS: 'media.example.test' },
  ];
  for (const overrides of cases) {
    const { service, parties } = setup({ env: { ...localWatchEnvironment, ...overrides } });
    await assert.rejects(service.createWatch('alice', { conversationId: 1, authorized: true, sourceUrl: 'http://localhost:3000/dev-fixtures/movie.mp4' }), error => {
      assert.equal(error.code, 'INVALID_INPUT');
      assert.doesNotMatch(error.message, /synthetic|private-test-password|DATABASE_URL|mysql:/);
      return true;
    });
    assert.equal(parties.size, 0);
  }
});

test('development watch exception rejects remote HTTP and keeps credential, format and HTTPS port checks', async () => {
  const { service, parties } = setup({ env: localWatchEnvironment });
  for (const sourceUrl of [
    'http://media.example.test/movie.mp4',
    'http://localhost.evil.test:3000/movie.mp4',
    'http://localhost:3000@media.example.test/movie.mp4',
    'http://user:secret@localhost:3000/movie.mp4',
    'http://localhost:3000/page',
    'ftp://localhost:3000/movie.mp4',
    'https://media.example.test:8443/movie.mp4',
  ]) {
    await assert.rejects(service.createWatch('alice', { conversationId: 1, authorized: true, sourceUrl }), error => error.code === 'INVALID_INPUT');
  }
  assert.equal(parties.size, 0);
  assert.equal((await watch(service)).sourceUrl, 'https://media.example.test/movie.mp4');
});

test('watch controls enforce host privilege and reject stale event versions', async () => {
  const { service } = setup(); const party = await watch(service);
  await assert.rejects(service.controlWatch('bob', { partyId: party.id, version: 0, action: 'play' }), error => error.code === 'FORBIDDEN');
  const playing = await service.controlWatch('alice', { partyId: party.id, version: 0, action: 'play', position: 10 });
  assert.equal(playing.version, 1); assert.equal(playing.playing, true);
  await assert.rejects(service.controlWatch('alice', { partyId: party.id, version: 0, action: 'pause' }), error => error.code === 'CONFLICT');
  assert.equal((await service.getWatch('bob', party.id)).playing, true);
});

test('watch reconnect restores authoritative time and collaborative controls do not grant host privilege', async () => {
  const { service, advance } = setup(); const party = await watch(service);
  await service.controlWatch('alice', { partyId: party.id, version: 0, action: 'play', position: 10 });
  advance(5000);
  const enabled = await service.controlWatch('alice', { partyId: party.id, version: 1, action: 'collaborative', collaborative: true });
  assert.equal(enabled.position, 15);
  const paused = await service.controlWatch('bob', { partyId: party.id, version: 2, action: 'pause' });
  assert.equal(paused.position, 15); assert.equal(paused.playing, false);
  await assert.rejects(service.controlWatch('bob', { partyId: party.id, version: 3, action: 'host', hostId: 'bob' }), error => error.code === 'FORBIDDEN');
  const restored = await service.sync('bob', 1); assert.equal(restored.party.version, 3); assert.equal(restored.party.position, 15);
});

test('watch membership removal revokes control and transfers host deterministically', async () => {
  const { service, members } = setup(); const party = await watch(service);
  await service.joinWatch('alice', party.id, 'socket-a'); await service.joinWatch('bob', party.id, 'socket-b');
  members.delete('alice'); await service.onMembershipRevoked(1, 'alice');
  const transferred = await service.getWatch('bob', party.id);
  assert.equal(transferred.hostId, 'bob'); assert.deepEqual(transferred.participants, ['bob']);
  await assert.rejects(service.controlWatch('alice', { partyId: party.id, version: transferred.version, action: 'play' }), error => error.code === 'FORBIDDEN');
});

test('conversation removal racing call creation is rechecked after acquiring transaction lock', async () => {
  const { service, prisma, members, calls } = setup();
  prisma.conversation.update = async () => { members.delete('alice'); };
  await assert.rejects(start(service), error => error.code === 'FORBIDDEN');
  assert.equal(calls.size, 0);
});

test('conversation removal racing call acceptance or playback control cannot persist privilege', async () => {
  const callTest = setup(); const call = await start(callTest.service);
  callTest.prisma.conversation.update = async () => { callTest.members.delete('bob'); };
  await assert.rejects(accept(callTest.service, call.id), error => error.code === 'FORBIDDEN');
  assert.equal(callTest.calls.get(call.id).participants.find(member => member.userId === 'bob').status, 'INVITED');
  const watchTest = setup(); const party = await watch(watchTest.service);
  watchTest.prisma.conversation.update = async () => { watchTest.members.delete('alice'); };
  await assert.rejects(watchTest.service.controlWatch('alice', { partyId: party.id, action: 'play', version: 0 }), error => error.code === 'FORBIDDEN');
  assert.equal(watchTest.parties.get(party.id).playing, false);
});

test('watch leave removes only the requesting socket and preserves other tabs', async () => {
  const { service } = setup(); const party = await watch(service);
  await service.joinWatch('alice', party.id, 'tab-a'); await service.joinWatch('alice', party.id, 'tab-b'); await service.joinWatch('bob', party.id, 'tab-c');
  await service.leaveWatch('alice', party.id, 'tab-c');
  assert.deepEqual((await service.getWatch('alice', party.id)).participants, ['alice', 'bob']);
  await service.leaveWatch('alice', party.id, 'tab-a');
  assert.deepEqual((await service.getWatch('alice', party.id)).participants, ['alice', 'bob']);
  await service.leaveWatch('alice', party.id, 'tab-b');
  assert.deepEqual((await service.getWatch('alice', party.id)).participants, ['bob']);
});

test('revocation privately notifies removed user with only identifiers before normal filtered publication', async () => {
  const { service, members } = setup(); const call = await start(service); await accept(service, call.id);
  const revoked = []; service.setRevoker(async (userId, payload) => revoked.push({ userId, payload }));
  members.delete('bob'); await service.onMembershipRevoked(1, 'bob');
  assert.deepEqual(revoked, [{ userId: 'bob', payload: { callId: call.id, conversationId: 1 } }]);
});

test('room registrar routes revocation only to the removed authenticated identity room', async () => {
  let revoke; const deliveries = [];
  createRoomRegistrar({ setPublisher() {}, setRevoker(fn) { revoke = fn; } })({
    socket: { data: { userId: 'alice' }, on() {} }, handle() {}, emitToConversation() {}, userRoom: id => `user:${id}`,
    io: { to: room => ({ emit: (event, payload) => deliveries.push({ room, event, payload }) }) },
  });
  revoke('bob', { callId: 'call-1', conversationId: 1 });
  assert.deepEqual(deliveries, [{ room: 'user:bob', event: 'callRevoked', payload: { callId: 'call-1', conversationId: 1 } }]);
});

test('group acceptance caps joined identities at three while other invitations remain pending', async () => {
  const { service, members } = setup({ group: true, enabled: true, env: { GROUP_CALL_MAX_PARTICIPANTS: '99' } });
  members.add('dana');
  const call = await start(service);
  await accept(service, call.id);
  await accept(service, call.id, 'charlie', 'charlie-tab');
  await assert.rejects(accept(service, call.id, 'dana', 'dana-tab'), error => error.code === 'CONFLICT');
  assert.equal((await service.getCall('alice', call.id)).participants.filter(member => member.status === 'JOINED').length, 3);
});

test('exclusive screen leases enforce owner/device, expiry and delayed release isolation', async () => {
  const { service, advance, deleted } = setup({ group: true, enabled: true });
  const call = await start(service); await accept(service, call.id);
  const claimed = await service.claimScreen('alice', { callId: call.id, deviceId: 'alice-tab' });
  assert.equal(claimed.screenShare.userId, 'alice');
  assert.equal(Object.hasOwn(claimed.screenShare, 'roomName'), false);
  const leaseId = claimed.screenShare.leaseId;
  await assert.rejects(service.claimScreen('bob', { callId: call.id, deviceId: 'bob-tab' }), error => error.code === 'CONFLICT');
  await assert.rejects(service.heartbeatScreen('alice', { callId: call.id, deviceId: 'wrong-tab', leaseId }), error => error.code === 'FORBIDDEN');
  await assert.rejects(service.releaseScreen('bob', { callId: call.id, deviceId: 'bob-tab', leaseId }), error => error.code === 'FORBIDDEN');
  advance(7000);
  const renewed = await service.heartbeatScreen('alice', { callId: call.id, deviceId: 'alice-tab', leaseId });
  assert.ok(new Date(renewed.screenShare.expiresAt) > new Date(claimed.screenShare.expiresAt));
  advance(21000);
  await assert.rejects(service.heartbeatScreen('alice', { callId: call.id, deviceId: 'alice-tab', leaseId }), error => error.code === 'CONFLICT');
  const replacement = await service.claimScreen('bob', { callId: call.id, deviceId: 'bob-tab' });
  await service.sweep();
  assert.notEqual(replacement.screenShare.leaseId, leaseId);
  assert.equal((await service.releaseScreen('alice', { callId: call.id, deviceId: 'alice-tab', leaseId })).screenShare.leaseId, replacement.screenShare.leaseId);
  assert.ok(deleted.length > 0);
});

test('group departure rotates listener rooms and screen leases; SFU deletion failures remain durable and retried', async () => {
  const { service, livekit, retired, deleted, advance } = setup({ group: true, enabled: true });
  const call = await start(service); await accept(service, call.id); await accept(service, call.id, 'charlie', 'charlie-tab');
  await service.claimScreen('bob', { callId: call.id, deviceId: 'bob-tab' });
  livekit.deleteRoom = async () => { throw new Error('synthetic SFU unavailable'); };
  const changed = await service.leave('bob', { callId: call.id, deviceId: 'bob-tab' });
  await service.sweep();
  assert.equal(changed.status, 'ACTIVE'); assert.equal(changed.mediaVersion, 1); assert.equal(changed.screenShare, null);
  assert.notEqual(changed.roomName, call.roomName);
  assert.equal(retired.size, 2);
  assert.ok([...retired.values()].every(row => row.attempts === 1));
  livekit.deleteRoom = async roomName => deleted.push(roomName);
  advance(6000); await service.sweep();
  assert.equal(deleted.length, 2);
  assert.ok([...retired.values()].every(row => row.attempts === 0));
  assert.equal(retired.size, 2, 'Successful cleanup retains tombstones against refreshed old tokens');
});

test('slow SFU cleanup does not delay authoritative departure or shutdown ownership', { timeout: 2000 }, async () => {
  const { service, livekit } = setup({ group: true, enabled: true });
  const call = await start(service); await accept(service, call.id);
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  livekit.deleteRoom = async () => blocked;
  try {
    const changed = await service.leave('bob', { callId: call.id, deviceId: 'bob-tab' });
    assert.equal(changed.mediaVersion, 1);
    let closed = false;
    const closing = service.close().then(() => { closed = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(closed, false, 'Graceful shutdown tracks its outstanding cleanup request');
    release(); await closing;
    assert.equal(closed, true);
  } finally { release(); await service.close(); }
});

test('disconnecting the screen holder releases sharing immediately without ending the main call grace', async () => {
  const { service } = setup({ group: true, enabled: true });
  const call = await start(service); await accept(service, call.id);
  await service.attachCall('alice', call.id, 'alice-tab', 'alice-socket');
  await service.claimScreen('alice', { callId: call.id, deviceId: 'alice-tab' });
  await service.disconnected('alice-socket');
  const current = await service.getCall('bob', call.id);
  assert.equal(current.screenShare, null); assert.equal(current.status, 'ACTIVE');
  service.close();
});

test('ICE signaling preserves bounded username fragments for restart-generation guards', async () => {
  const { service } = setup(); const call = await start(service); await accept(service, call.id);
  const input = { callId: call.id, deviceId: 'alice-tab', toUserId: 'bob', candidate: { candidate: 'candidate:1 1 UDP 1 127.0.0.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'restart_ufrag' } };
  assert.equal((await service.validateSignal('alice', input)).payload.candidate.usernameFragment, 'restart_ufrag');
  for (const usernameFragment of [42, 'a'.repeat(129)]) await assert.rejects(service.validateSignal('alice', { ...input, candidate: { ...input.candidate, usernameFragment } }), error => error.code === 'INVALID_INPUT');
});
