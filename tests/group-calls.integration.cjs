// Explicitly gated to the owned disposable MySQL instance by runtimeHarness.
// The SFU control adapter is synthetic here; real SFU grants are checked separately.
const test = require('node:test');
const assert = require('node:assert/strict');
const { runtimeHarness, disposableDatabaseUrl } = require('./helpers/runtime-harness.cjs');
const { createRoomService } = require('../server/rooms');
const databaseUrl = disposableDatabaseUrl(process.env.GOGA_TEST_DATABASE_URL);
const groupEnv = { NODE_ENV: 'test', ENABLE_GROUP_CALLS: 'true', GROUP_CALL_SECURITY_REVIEWED: 'true', GROUP_CALL_MAX_PARTICIPANTS: '3',
  LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_API_KEY: 'synthetic-key', LIVEKIT_API_SECRET: 'synthetic-secret-never-production-123456789' };

test('three-person group admission and screen leases serialize on real MySQL across signed sockets', { timeout: 90000 }, async t => {
  let clock = Date.now();
  let failCleanup = false;
  const prepared = [], deleted = [];
  const livekit = { createRoom: async options => { prepared.push(options); return options; }, deleteRoom: async name => { if (failCleanup) throw new Error('synthetic SFU outage'); deleted.push(name); } };
  const h = await runtimeHarness(t, databaseUrl, { livekit, names: ['alice', 'bob', 'charlie', 'dana', 'outsider'], now: () => clock,
    roomEnv: { NODE_ENV: 'test', ENABLE_GROUP_CALLS: 'true', GROUP_CALL_SECURITY_REVIEWED: 'true', GROUP_CALL_MAX_PARTICIPANTS: '3', LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_API_KEY: 'synthetic-key', LIVEKIT_API_SECRET: 'synthetic-secret-never-production-123456789' } });
  const { prisma, ids, ack, rawAck, denied, credentials, rooms } = h;
  const clients = Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([name, id]) => [name, await h.client(id)])));
  const group = (await ack(clients.alice, 'createGroup', { name: 'Three-person validation', memberIds: [ids.bob, ids.charlie, ids.dana] })).conversation;
  for (const name of ['bob', 'charlie', 'dana']) await ack(clients[name], 'respondInvite', { conversationId: group.id, accept: true });
  const call = (await ack(clients.alice, 'call:start', { conversationId: group.id, kind: 'VIDEO', deviceId: 'alice-device' })).call;
  const acceptances = await Promise.all(['bob', 'charlie', 'dana'].map(name => rawAck(clients[name], 'call:respond', { callId: call.id, deviceId: `${name}-device`, accept: true })));
  assert.equal(acceptances.filter(result => result.ok).length, 2);
  assert.equal(acceptances.filter(result => result.error?.code === 'CONFLICT').length, 1);
  const state = await rooms.getCall(ids.alice, call.id);
  const joined = state.participants.filter(member => member.status === 'JOINED');
  assert.equal(joined.length, 3);
  const otherName = ['bob', 'charlie', 'dana'].find(name => joined.some(member => member.userId === ids[name]));
  const other = clients[otherName];
  const outsiderName = ['bob', 'charlie', 'dana'].find(name => !joined.some(member => member.userId === ids[name]));
  const grants = result => JSON.parse(Buffer.from(result.token.split('.')[1], 'base64url').toString('utf8')).video;
  await assert.rejects(credentials.issueToken(ids[outsiderName], call.id, `${outsiderName}-device`), error => error.code === 'FORBIDDEN');
  const main = await credentials.issueToken(ids.alice, call.id, 'alice-device');
  assert.deepEqual(grants(main).canPublishSources, ['microphone', 'camera']);
  assert.equal(prepared[0].maxParticipants, 3);

  const claims = await Promise.all([
    rawAck(clients.alice, 'call:screenClaim', { callId: call.id, deviceId: 'alice-device' }),
    rawAck(other, 'call:screenClaim', { callId: call.id, deviceId: `${otherName}-device` }),
  ]);
  assert.equal(claims.filter(result => result.ok).length, 1);
  assert.equal(claims.filter(result => result.error?.code === 'CONFLICT').length, 1);
  const winner = claims.find(result => result.ok).screenShare;
  const holderName = winner.userId === ids.alice ? 'alice' : otherName;
  const subscriberName = holderName === 'alice' ? otherName : 'alice';
  const screen = await credentials.issueToken(ids[holderName], call.id, `${holderName}-device`, { media: 'screen', leaseId: winner.leaseId });
  const subscriber = await credentials.issueToken(ids[subscriberName], call.id, `${subscriberName}-device`, { media: 'screen', leaseId: winner.leaseId });
  assert.notEqual(screen.roomName, main.roomName);
  assert.deepEqual(grants(screen).canPublishSources, ['screen_share', 'screen_share_audio']);
  assert.equal(grants(subscriber).canPublish, false);
  await denied(clients.outsider, 'call:screenClaim', { callId: call.id, deviceId: 'outsider-device' });
  await denied(clients[subscriberName], 'call:screenRelease', { callId: call.id, deviceId: `${subscriberName}-device`, leaseId: winner.leaseId });
  await denied(clients[holderName], 'call:screenHeartbeat', { callId: call.id, deviceId: 'another-device', leaseId: winner.leaseId });

  clock += 7000;
  const renewed = (await ack(clients[holderName], 'call:screenHeartbeat', { callId: call.id, deviceId: `${holderName}-device`, leaseId: winner.leaseId })).screenShare;
  assert.ok(new Date(renewed.expiresAt) > new Date(winner.expiresAt));
  clock += 21000;
  await denied(clients[holderName], 'call:screenHeartbeat', { callId: call.id, deviceId: `${holderName}-device`, leaseId: winner.leaseId }, 'CONFLICT');
  const next = (await ack(clients[subscriberName], 'call:screenClaim', { callId: call.id, deviceId: `${subscriberName}-device` })).screenShare;
  const staleStop = await ack(clients[holderName], 'call:screenRelease', { callId: call.id, deviceId: `${holderName}-device`, leaseId: winner.leaseId });
  assert.equal(staleStop.screenShare.leaseId, next.leaseId);
  await assert.rejects(credentials.issueToken(ids[holderName], call.id, `${holderName}-device`, { media: 'screen', leaseId: winner.leaseId }), error => error.code === 'CONFLICT');

  failCleanup = true;
  const departed = (await ack(other, 'call:leave', { callId: call.id, deviceId: `${otherName}-device` })).call;
  await rooms.sweep();
  assert.equal(departed.mediaVersion, 1); assert.equal(departed.screenShare, null);
  const replacement = await credentials.issueToken(ids.alice, call.id, 'alice-device');
  assert.notEqual(grants(replacement).room, grants(main).room, 'Old main tokens cannot join the listeners new room');
  await assert.rejects(credentials.issueToken(ids[otherName], call.id, `${otherName}-device`), error => error.code === 'FORBIDDEN');
  const tombstones = await prisma.retiredMediaRoom.findMany({ where: { callId: call.id } });
  assert.ok(tombstones.some(room => room.roomName === main.roomName && room.attempts > 0));
  failCleanup = false; clock += 6000; await rooms.sweep();
  assert.ok(deleted.includes(main.roomName));
  assert.ok((await prisma.retiredMediaRoom.findMany({ where: { callId: call.id } })).length >= 2);

  // A fresh service instance recovers persisted room state and expires leases
  // without relying on the first instance's connection maps or timers.
  const recovered = createRoomService({ prisma, chat: h.chat, livekit, now: () => clock,
    env: { ENABLE_GROUP_CALLS: 'true', GROUP_CALL_SECURITY_REVIEWED: 'true' } });
  t.after(() => recovered.close());
  assert.equal((await recovered.getCall(ids.alice, call.id)).mediaVersion, 1);
  const current = (await ack(clients.alice, 'call:screenClaim', { callId: call.id, deviceId: 'alice-device' })).screenShare;
  assert.equal((await recovered.getCall(ids.alice, call.id)).screenShare.leaseId, current.leaseId);
  clock += 21000; await recovered.sweep();
  assert.equal((await recovered.getCall(ids.alice, call.id)).screenShare, null);
  assert.equal((await prisma.callSession.findUnique({ where: { id: call.id } })).screenLeaseId, null);
});

test('account deletion retires room epochs before its call roster cascades away', { timeout: 90000 }, async t => {
  const livekit = { createRoom: async options => options, deleteRoom: async () => {} };
  const h = await runtimeHarness(t, databaseUrl, { livekit, names: ['alice', 'bob', 'charlie'], roomEnv: groupEnv });
  const clients = Object.fromEntries(await Promise.all(Object.entries(h.ids).map(async ([name, id]) => [name, await h.client(id)])));
  const group = (await h.ack(clients.alice, 'createGroup', { name: 'Account deletion validation', memberIds: [h.ids.bob, h.ids.charlie] })).conversation;
  for (const name of ['bob', 'charlie']) await h.ack(clients[name], 'respondInvite', { conversationId: group.id, accept: true });
  const call = (await h.ack(clients.alice, 'call:start', { conversationId: group.id, kind: 'VIDEO', deviceId: 'alice-device' })).call;
  for (const name of ['bob', 'charlie']) await h.ack(clients[name], 'call:respond', { callId: call.id, accept: true, deviceId: `${name}-device` });
  await h.ack(clients.alice, 'call:screenClaim', { callId: call.id, deviceId: 'alice-device' });
  const before = await h.credentials.issueToken(h.ids.alice, call.id, 'alice-device');
  assert.equal((await h.rooms.deleteAccountUser(h.ids.alice)).count, 1);
  const after = await h.rooms.getCall(h.ids.bob, call.id);
  assert.equal(after.mediaVersion, 1);
  assert.equal(after.screenShare, null);
  assert.ok(after.participants.every(member => member.userId !== h.ids.alice));
  const token = await h.credentials.issueToken(h.ids.bob, call.id, 'bob-device');
  assert.notEqual(token.roomName, before.roomName, 'Retained deleted-account tokens cannot reach current listeners');
  assert.ok(await h.prisma.retiredMediaRoom.findUnique({ where: { roomName: before.roomName } }));
  await assert.rejects(h.credentials.issueToken(h.ids.alice, call.id, 'alice-device'), error => error.code === 'FORBIDDEN');
  assert.equal((await h.rooms.deleteAccountUser(h.ids.alice)).count, 0, 'Webhook retries remain idempotent');
});

test('account deletion user lock prevents a concurrent new call from retaining the deleted identity', { timeout: 90000 }, async t => {
  const livekit = { createRoom: async options => options, deleteRoom: async () => {} };
  const h = await runtimeHarness(t, databaseUrl, { livekit, names: ['alice', 'bob'], roomEnv: groupEnv });
  const alice = await h.client(h.ids.alice), bob = await h.client(h.ids.bob);
  const group = (await h.ack(bob, 'createGroup', { name: 'Concurrent deletion validation', memberIds: [h.ids.alice] })).conversation;
  await h.ack(alice, 'respondInvite', { conversationId: group.id, accept: true });
  let locked, unlock;
  const acquired = new Promise(resolve => { locked = resolve; });
  const barrier = new Promise(resolve => { unlock = resolve; });
  // Hold the real parent-row lock just long enough to overlap a normal call
  // initiation. The SQL, FK check and application operations remain real.
  const deletionPrisma = { retiredMediaRoom: h.prisma.retiredMediaRoom, $transaction: (callback, options) => h.prisma.$transaction(async tx => {
    const guarded = new Proxy(tx, { get(target, property) {
      if (property !== 'user') return target[property];
      return new Proxy(target.user, { get(user, method) {
        if (method !== 'updateMany') return user[method];
        return async input => { const result = await user.updateMany(input); locked(); await barrier; return result; };
      } });
    } });
    return callback(guarded);
  }, options) };
  const deletion = createRoomService({ prisma: deletionPrisma, chat: h.chat, livekit, env: groupEnv });
  t.after(() => deletion.close());
  let attempting;
  const attempt = new Promise(resolve => { attempting = resolve; });
  const competingPrisma = { $transaction: (callback, options) => h.prisma.$transaction(tx => callback(new Proxy(tx, { get(target, property) {
    if (property !== 'callSession') return target[property];
    return new Proxy(target.callSession, { get(session, method) {
      if (method !== 'create') return session[method];
      return input => { attempting(); return session.create(input); };
    } });
  } })), options) };
  const competing = createRoomService({ prisma: competingPrisma, chat: h.chat, livekit, env: groupEnv });
  t.after(() => competing.close());
  const pendingDelete = deletion.deleteAccountUser(h.ids.alice);
  await acquired;
  const pendingCall = competing.initiate(h.ids.alice, { conversationId: group.id, kind: 'VIDEO', deviceId: 'alice-device' });
  // Release deletion only after the normal call path has authorized and is
  // attempting its real nested CallParticipant insert; no timing assumption.
  await attempt;
  unlock();
  const outcomes = await Promise.allSettled([pendingDelete, pendingCall]);
  // A deadlock victim is retriable; successful deletion must never leave a
  // joined identity behind, and no pending operation can silently skip the FK.
  if (outcomes[0].status === 'rejected') {
    assert.equal(outcomes[0].reason.code, 'P2034');
    await h.rooms.deleteAccountUser(h.ids.alice);
  }
  assert.equal(await h.prisma.user.count({ where: { id: h.ids.alice } }), 0);
  assert.equal(await h.prisma.callParticipant.count({ where: { userId: h.ids.alice } }), 0);
  const active = await h.prisma.callSession.findMany({ where: { conversationId: group.id, status: { in: ['RINGING', 'ACTIVE'] } } });
  assert.equal(active.length, 0);
  assert.ok(outcomes[1].status === 'rejected' || outcomes[0].status === 'rejected');
});

test('restricted account deletion rolls back all call mutations and schedules no SFU deletion', { timeout: 90000 }, async t => {
  const deleted = [];
  const livekit = { createRoom: async options => options, deleteRoom: async name => { deleted.push(name); } };
  const h = await runtimeHarness(t, databaseUrl, { livekit, names: ['alice', 'bob', 'outsider'], roomEnv: groupEnv });
  const alice = await h.client(h.ids.alice), bob = await h.client(h.ids.bob);
  const group = (await h.ack(alice, 'createGroup', { name: 'Restricted deletion validation', memberIds: [h.ids.bob] })).conversation;
  await h.ack(bob, 'respondInvite', { conversationId: group.id, accept: true });
  const call = (await h.ack(alice, 'call:start', { conversationId: group.id, kind: 'VIDEO', deviceId: 'alice-device' })).call;
  await h.ack(bob, 'call:respond', { callId: call.id, accept: true, deviceId: 'bob-device' });
  await h.chat.getOrCreateDirect(h.ids.alice, h.ids.outsider);
  await assert.rejects(h.rooms.deleteAccountUser(h.ids.alice), error => error.code === 'P2003');
  const after = await h.rooms.getCall(h.ids.alice, call.id);
  assert.equal(after.roomName, call.roomName);
  assert.equal(after.mediaVersion, 0);
  assert.equal(after.participants.find(member => member.userId === h.ids.alice).status, 'JOINED');
  assert.equal(await h.prisma.retiredMediaRoom.count({ where: { callId: call.id } }), 0);
  assert.deepEqual(deleted, []);
});
