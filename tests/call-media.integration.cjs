const test = require('node:test');
const assert = require('node:assert/strict');
const { runtimeHarness, disposableDatabaseUrl } = require('./helpers/runtime-harness.cjs');
const databaseUrl = disposableDatabaseUrl(process.env.GOGA_TEST_DATABASE_URL);

test('real socket media-state signaling retains device and conversation authorization', { timeout: 30000 }, async t => {
  const h = await runtimeHarness(t, databaseUrl);
  const { ids, ack, denied, event, prisma } = h;
  const [alice, aliceTab, bob, outsider] = await Promise.all([
    h.client(ids.alice), h.client(ids.alice), h.client(ids.bob), h.client(ids.outsider),
  ]);
  const conversationId = (await ack(alice, 'sendMessage', {
    receiverId: ids.bob, text: 'Media signaling regression', clientMessageId: 'media-state-message-01',
  })).message.conversationId;
  const call = (await ack(alice, 'call:start', { conversationId, kind: 'VIDEO', deviceId: 'alice-tab' })).call;
  await ack(bob, 'call:respond', { callId: call.id, deviceId: 'bob-tab', accept: true });
  const base = { callId: call.id, deviceId: 'alice-tab', toUserId: ids.bob };
  let sequence = Date.now();
  for (const state of [
    { cameraEnabled: false, screenSharing: false, screenAudio: false, microphoneMuted: false },
    { cameraEnabled: false, screenSharing: true, screenAudio: true, microphoneMuted: true },
    { cameraEnabled: true, screenSharing: false, screenAudio: false, microphoneMuted: false },
  ]) {
    const mediaState = { sequence: sequence++, ...state };
    const delivery = event(bob, 'callSignal', signal => signal.mediaState?.sequence === mediaState.sequence);
    await ack(alice, 'call:signal', { ...base, mediaState });
    const received = await delivery;
    assert.deepEqual(received.mediaState, mediaState);
    assert.equal(received.fromUserId, ids.alice);
    assert.equal(received.toDeviceId, 'bob-tab');
  }
  const mediaState = { sequence: sequence++, cameraEnabled: false, screenSharing: false, screenAudio: false, microphoneMuted: false };
  await denied(aliceTab, 'call:signal', { ...base, deviceId: 'other-tab', mediaState });
  await denied(outsider, 'call:signal', { ...base, mediaState });
  await denied(alice, 'call:signal', { ...base, mediaState: { ...mediaState, screenAudio: true } }, 'INVALID_INPUT');
  await denied(alice, 'call:signal', { ...base, mediaState, ready: true }, 'INVALID_INPUT');
  // The data is ephemeral. A reconnect resends current state through the same
  // policy; it neither creates a new media session nor permits device takeover.
  const reconnect = await h.client(ids.alice);
  await ack(reconnect, 'call:state', { callId: call.id, deviceId: 'alice-tab' });
  const resynced = event(bob, 'callSignal', signal => signal.mediaState?.sequence === mediaState.sequence);
  await ack(reconnect, 'call:signal', { ...base, mediaState });
  await resynced;
  await prisma.block.create({ data: { blockerId: ids.bob, blockedId: ids.alice } });
  await denied(reconnect, 'call:signal', { ...base, mediaState: { ...mediaState, sequence: sequence++ } });
});
