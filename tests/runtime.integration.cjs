// Explicit opt-in only. No .env, production Clerk login, browser, or production service.
// Run after migrations: GOGA_TEST_DATABASE_URL=... node --test tests/runtime.integration.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { runtimeHarness, disposableDatabaseUrl, audioWav } = require('./helpers/runtime-harness.cjs');
const databaseUrl = disposableDatabaseUrl(process.env.GOGA_TEST_DATABASE_URL);

test('actual Socket.IO, signed synthetic sessions, HTTP routes, FFmpeg and disposable MySQL', { timeout: 90000 }, async t => {
  const h = await runtimeHarness(t, databaseUrl);
  const { prisma, ids, ack, rawAck, denied, request, event } = h;
  let alice, aliceTab, bob, outsider, directId, groupId, initialMessage;

  await t.test('real Clerk SDK rejects forged, expired and wrong-party JWT handshakes', async () => {
    const token = h.sessions.token(ids.alice);
    assert.equal((await h.sessions.verify(token)).sub, ids.alice);
    const [header, payload, signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: ids.bob })).toString('base64url');
    for (const invalid of [undefined, `${header}.${forgedPayload}.${signature}`,
      h.sessions.token(ids.alice, { exp: Math.floor(Date.now() / 1000) - 120 }),
      h.sessions.token(ids.alice, { azp: 'https://wrong-origin.invalid' })]) {
      await assert.rejects(h.client(ids.alice, { auth: { token: invalid } }), error => error.data?.code === 'UNAUTHENTICATED');
    }
    [alice, aliceTab, bob, outsider] = await Promise.all([
      h.client(ids.alice), h.client(ids.alice), h.client(ids.bob),
      h.client(ids.outsider, { query: { userId: ids.alice } }),
    ]);
    await denied(outsider, 'sendMessage', { senderId: ids.alice, receiverId: ids.bob, text: 'forged identity' });
    await ack(alice, 'auth:refresh', { token: h.sessions.token(ids.alice) });
    await denied(alice, 'auth:refresh', { token: h.sessions.token(ids.bob) }, 'UNAUTHENTICATED');
  });

  await t.test('message list, pagination, retries, tabs, reactions, receipts and presence persist through real events', async () => {
    const bobDelivery = event(bob, 'receiveMessage', message => message.text === 'runtime hello');
    const tabDelivery = event(aliceTab, 'receiveMessage', message => message.text === 'runtime hello');
    const input = { receiverId: ids.bob, text: 'runtime hello', clientMessageId: 'runtime-message-0001' };
    initialMessage = (await ack(alice, 'sendMessage', input)).message;
    directId = initialMessage.conversationId;
    assert.equal((await bobDelivery).id, initialMessage.id);
    assert.equal((await tabDelivery).id, initialMessage.id);
    const retries = await Promise.all([rawAck(alice, 'sendMessage', input), rawAck(aliceTab, 'sendMessage', input)]);
    assert.ok(retries.every(result => result.ok && result.message.id === initialMessage.id));
    assert.equal(await prisma.message.count({ where: { conversationId: directId } }), 1);
    const reply = (await ack(bob, 'sendMessage', { conversationId: directId, text: 'runtime reply', replyToId: initialMessage.id, clientMessageId: 'runtime-message-0002' })).message;
    assert.equal(reply.replyTo.id, initialMessage.id);
    const conversations = (await ack(alice, 'listConversations')).conversations;
    assert.equal(conversations.find(value => value.id === directId).messages[0].id, reply.id);
    for (const name of ['user1', 'user2']) assert.equal(Object.hasOwn(conversations[0][name], 'lastActiveAt'), false);
    const latest = await ack(alice, 'getMessages', { conversationId: directId, limit: 1 });
    assert.equal(latest.messages[0].id, reply.id); assert.equal(latest.hasMore, true);
    const previous = await ack(alice, 'getMessages', { conversationId: directId, limit: 1, before: reply.id });
    assert.equal(previous.messages[0].id, initialMessage.id); assert.equal(previous.hasMore, false);
    for (const [name, input] of [
      ['joinConversation', { conversationId: directId }], ['getMessages', { conversationId: directId }],
      ['chatTyping', { conversationId: directId, isTyping: true }], ['editMessage', { messageId: initialMessage.id, text: 'forged' }],
      ['markRead', { conversationId: directId, messageId: initialMessage.id }],
    ]) await denied(outsider, name, input);
    assert.equal((await ack(outsider, 'listConversations')).conversations.length, 0);
    const reacted = event(alice, 'messageUpdated', message => message.id === initialMessage.id && message.reactions.length === 1);
    await ack(bob, 'reactMessage', { messageId: initialMessage.id, emoji: '❤️' });
    assert.equal((await reacted).reactions[0].userId, ids.bob);
    const read = event(alice, 'messagesRead', value => value.userId === ids.bob);
    await ack(bob, 'markRead', { conversationId: directId, messageId: initialMessage.id });
    assert.equal((await read).messageId, initialMessage.id);
    assert.equal((await prisma.message.findUnique({ where: { id: initialMessage.id } })).isRead, true);
    await ack(alice, 'editMessage', { messageId: initialMessage.id, text: 'runtime edited' });
    assert.equal((await ack(bob, 'getMessages', { conversationId: directId })).messages[0].text, 'runtime edited');
    const joined = await ack(alice, 'joinConversation', { conversationId: directId });
    assert.deepEqual(joined.presence.sort(), [ids.alice, ids.bob].sort());
    const typing = event(bob, 'chatTyping', value => value.userId === ids.alice && value.isTyping);
    await ack(alice, 'chatTyping', { conversationId: directId, isTyping: true }); await typing;
    await ack(alice, 'chatTyping', { conversationId: directId, isTyping: false });
    await prisma.user.update({ where: { id: ids.alice }, data: { showActivityStatus: false } });
    assert.deepEqual((await ack(bob, 'getPresence', { conversationId: directId })).presence, [ids.bob]);
    await prisma.user.update({ where: { id: ids.alice }, data: { showActivityStatus: true } });
  });

  await t.test('real multipart voice upload decodes audio, sends durable metadata and authorizes ranged playback', async () => {
    const body = () => {
      const form = new FormData(); form.set('audio', new File([audioWav()], 'runtime.wav', { type: 'audio/wav' }));
      form.set('conversationId', String(directId)); form.set('durationMs', '1000'); form.set('waveform', '[0.2,0.8,0.4]');
      return form;
    };
    assert.equal((await request(null, '/api/chat/voice', { method: 'POST', body: body() })).status, 401);
    assert.equal((await request(ids.alice, '/api/chat/voice', { method: 'POST', body: body(), headers: { Origin: 'https://wrong-origin.invalid' } })).status, 403);
    assert.equal((await request(ids.outsider, '/api/chat/voice', { method: 'POST', body: body() })).status, 403);
    const uploaded = await request(ids.alice, '/api/chat/voice', { method: 'POST', body: body() });
    assert.equal(uploaded.status, 200, await uploaded.clone().text());
    const media = await uploaded.json();
    const row = await prisma.mediaAsset.findUnique({ where: { id: media.mediaAssetId } });
    assert.equal(row.ownerId, ids.alice); assert.equal(row.format, 'mp4');
    assert.ok(row.durationMs >= 1000 && row.durationMs < 1100);
    assert.equal((await request(ids.bob, media.mediaUrl)).status, 404, 'An unsent draft stays owner-only');
    await denied(bob, 'sendMessage', { conversationId: directId, mediaAssetId: row.id, clientMessageId: 'runtime-stolen-voice' });
    const received = event(bob, 'receiveMessage', message => message.mediaAssetId === row.id);
    const voice = (await ack(alice, 'sendMessage', { conversationId: directId, mediaAssetId: row.id, clientMessageId: 'runtime-voice-message' })).message;
    assert.equal((await received).id, voice.id);
    assert.equal(voice.durationMs, row.durationMs); assert.deepEqual(voice.waveform, [0.2, 0.8, 0.4]);
    const full = await request(ids.bob, media.mediaUrl);
    assert.equal(full.status, 200); assert.equal(full.headers.get('content-type'), 'audio/mp4');
    assert.equal(full.headers.get('cache-control'), 'private, no-store');
    const bytes = Buffer.from(await full.arrayBuffer());
    assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
    const range = await request(ids.bob, media.mediaUrl, { headers: { Range: 'bytes=12-31' } });
    assert.equal(range.status, 206); assert.equal(range.headers.get('content-range'), `bytes 12-31/${bytes.length}`);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(12, 32));
    assert.equal((await request(ids.outsider, media.mediaUrl)).status, 403);
    assert.equal((await request(null, media.mediaUrl)).status, 401);
    assert.equal((await request(ids.bob, media.mediaUrl, { headers: { Range: `bytes=${bytes.length}-` } })).status, 416);
    await ack(alice, 'deleteMessage', { messageId: voice.id });
    assert.equal((await request(ids.bob, media.mediaUrl)).status, 404);
  });

  await t.test('group invitations hide history until acceptance and enforce moderator roles', async () => {
    const changed = event(bob, 'conversationsChanged');
    groupId = (await ack(alice, 'createGroup', { name: 'Runtime private group', memberIds: [ids.bob] })).conversation.id;
    assert.equal((await changed).conversationId, groupId);
    await ack(alice, 'sendMessage', { conversationId: groupId, text: 'before acceptance', clientMessageId: 'runtime-group-0001' });
    const invitation = (await ack(bob, 'listConversations')).conversations.find(value => value.id === groupId);
    assert.equal(invitation.members.find(value => value.userId === ids.bob).status, 'INVITED');
    assert.deepEqual(invitation.messages, []);
    await denied(bob, 'getMessages', { conversationId: groupId });
    await ack(bob, 'respondInvite', { conversationId: groupId, accept: true });
    assert.equal((await ack(bob, 'getMessages', { conversationId: groupId })).messages[0].text, 'before acceptance');
    const received = event(alice, 'receiveMessage', message => message.conversationId === groupId && message.senderId === ids.bob);
    const message = (await ack(bob, 'sendMessage', { conversationId: groupId, text: 'group accepted', clientMessageId: 'runtime-group-0002' })).message;
    assert.equal(message.receiverId, null); assert.equal((await received).id, message.id);
    await denied(bob, 'updateMember', { conversationId: groupId, memberId: ids.alice, remove: true });
    await denied(outsider, 'inviteMember', { conversationId: groupId, memberId: ids.outsider });
    await ack(alice, 'inviteMember', { conversationId: groupId, memberId: ids.outsider });
    await denied(outsider, 'getMessages', { conversationId: groupId });
    await ack(outsider, 'respondInvite', { conversationId: groupId, accept: false });
    assert.equal((await ack(outsider, 'listConversations')).conversations.some(value => value.id === groupId), false);
    await denied(alice, 'call:start', { conversationId: groupId, kind: 'AUDIO', deviceId: 'runtime-alice' }, 'UNAVAILABLE');
  });

  await t.test('direct calls ring, accept, bind devices, signal, hang up, reject and expire', async () => {
    const ringing = event(bob, 'callUpdated', value => value.call.status === 'RINGING');
    const call = (await ack(alice, 'call:start', { conversationId: directId, kind: 'VIDEO', deviceId: 'runtime-alice' })).call;
    assert.equal((await ringing).call.id, call.id); assert.equal(call.transport, 'p2p');
    await denied(outsider, 'call:state', { callId: call.id });
    const ice = deviceId => `/api/calls/${call.id}/ice?deviceId=${deviceId}`;
    assert.equal((await request(ids.bob, ice('runtime-bob'))).status, 403);
    assert.equal((await ack(bob, 'call:respond', { callId: call.id, accept: true, deviceId: 'runtime-bob' })).call.status, 'ACTIVE');
    await denied(aliceTab, 'call:signal', { callId: call.id, deviceId: 'other-alice-tab', toUserId: ids.bob, ready: true });
    const ready = event(alice, 'callSignal', value => value.callId === call.id && value.ready);
    await ack(bob, 'call:signal', { callId: call.id, deviceId: 'runtime-bob', toUserId: ids.alice, ready: true });
    assert.equal((await ready).toDeviceId, 'runtime-alice');
    // Signaling transport/authorization only: no browser RTCPeerConnection is simulated.
    const description = { type: 'offer', sdp: 'v=0\r\ns=runtime-signaling-test\r\n' };
    const offered = event(bob, 'callSignal', value => Boolean(value.description));
    await ack(alice, 'call:signal', { callId: call.id, deviceId: 'runtime-alice', toUserId: ids.bob, description });
    assert.deepEqual((await offered).description, description);
    await denied(outsider, 'call:signal', { callId: call.id, deviceId: 'runtime-outsider', toUserId: ids.bob, ready: true });
    const allowed = await request(ids.bob, ice('runtime-bob'));
    assert.equal(allowed.status, 200); assert.deepEqual((await allowed.json()).iceServers, [{ urls: ['stun:127.0.0.1:3478'] }]);
    assert.equal((await request(ids.alice, ice('other-alice-tab'))).status, 403);
    assert.equal((await request(ids.outsider, ice('runtime-outsider'))).status, 403);
    assert.equal((await request(null, ice('runtime-bob'))).status, 401);
    const token = await request(ids.alice, `/api/calls/${call.id}/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'runtime-alice' }) });
    assert.equal(token.status, 503, 'LiveKit remains disabled');
    const ended = event(bob, 'callUpdated', value => value.call.id === call.id && value.call.status === 'ENDED');
    await ack(alice, 'call:leave', { callId: call.id, deviceId: 'runtime-alice' }); await ended;
    assert.equal((await request(ids.bob, ice('runtime-bob'))).status, 403);
    const declined = (await ack(alice, 'call:start', { conversationId: directId, kind: 'AUDIO', deviceId: 'runtime-alice' })).call;
    assert.equal((await ack(bob, 'call:respond', { callId: declined.id, accept: false, deviceId: 'runtime-bob' })).call.status, 'ENDED');
    const missed = (await ack(alice, 'call:start', { conversationId: directId, kind: 'AUDIO', deviceId: 'runtime-alice' })).call;
    const expired = event(alice, 'callUpdated', value => value.call.id === missed.id && value.call.status === 'MISSED');
    await prisma.callSession.update({ where: { id: missed.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await h.rooms.sweep(); await expired;
    assert.equal((await ack(alice, 'call:state', { callId: missed.id })).call.status, 'MISSED');
  });

  await t.test('watch controls persist ordered versions, recover on reconnect, transfer host and revoke group access', async () => {
    const started = event(bob, 'watchUpdated', value => value.party.conversationId === groupId);
    let party = (await ack(alice, 'watch:create', { conversationId: groupId, sourceUrl: 'https://media.example.test/authorized.mp4', authorized: true, title: 'Runtime watch' })).party;
    assert.equal((await started).party.id, party.id);
    assert.ok((await ack(bob, 'watch:join', { partyId: party.id })).party.participants.includes(ids.bob));
    await denied(outsider, 'watch:join', { partyId: party.id });
    await denied(bob, 'watch:control', { partyId: party.id, version: party.version, action: 'play', position: 2 });
    party = (await ack(alice, 'watch:control', { partyId: party.id, version: party.version, action: 'play', position: 2 })).party;
    party = (await ack(alice, 'watch:control', { partyId: party.id, version: party.version, action: 'collaborative', collaborative: true })).party;
    const racing = await Promise.all([
      rawAck(alice, 'watch:control', { partyId: party.id, version: party.version, action: 'pause', position: 8 }),
      rawAck(bob, 'watch:control', { partyId: party.id, version: party.version, action: 'seek', position: 20 }),
    ]);
    assert.equal(racing.filter(value => value.ok).length, 1);
    assert.equal(racing.find(value => !value.ok).error.code, 'CONFLICT');
    party = racing.find(value => value.ok).party;
    const persisted = await prisma.watchParty.findUnique({ where: { id: party.id } });
    assert.equal(persisted.version, party.version); assert.equal(persisted.position, party.position);
    bob.disconnect(); bob = await h.client(ids.bob);
    const restored = (await ack(bob, 'session:sync', { conversationId: groupId })).party;
    assert.equal(restored.version, party.version); assert.equal(restored.position, party.position);
    await ack(bob, 'watch:join', { partyId: party.id });
    await ack(bob, 'watch:leave', { partyId: party.id });
    assert.equal((await ack(alice, 'session:sync', { conversationId: groupId })).party.participants.includes(ids.bob), false);
    await ack(bob, 'watch:join', { partyId: party.id });
    party = (await ack(alice, 'watch:control', { partyId: party.id, version: party.version, action: 'host', hostId: ids.bob })).party;
    await denied(alice, 'watch:end', { partyId: party.id, version: party.version });
    const removed = event(bob, 'conversationRemoved', value => value.conversationId === groupId);
    await ack(alice, 'updateMember', { conversationId: groupId, memberId: ids.bob, remove: true }); await removed;
    party = (await ack(alice, 'session:sync', { conversationId: groupId })).party;
    assert.equal(party.hostId, ids.alice);
    await denied(bob, 'getMessages', { conversationId: groupId });
    await denied(bob, 'watch:control', { partyId: party.id, version: party.version, action: 'play', position: 0 });
    await denied(bob, 'session:sync', { conversationId: groupId });
    const ended = (await ack(alice, 'watch:end', { partyId: party.id, version: party.version })).party;
    assert.ok(ended.endedAt);
  });

  await t.test('a new block removes history and credentials and delivers explicit private call revocation', async () => {
    const call = (await ack(alice, 'call:start', { conversationId: directId, kind: 'AUDIO', deviceId: 'runtime-alice' })).call;
    await ack(bob, 'call:respond', { callId: call.id, accept: true, deviceId: 'runtime-bob' });
    const revoked = event(alice, 'callRevoked', value => value.callId === call.id);
    await prisma.block.create({ data: { blockerId: ids.bob, blockedId: ids.alice } });
    await h.rooms.sweep();
    assert.deepEqual(Object.keys(await revoked).sort(), ['callId', 'conversationId']);
    await denied(alice, 'getMessages', { conversationId: directId });
    await denied(alice, 'sendMessage', { conversationId: directId, text: 'blocked message' });
    assert.equal((await ack(alice, 'listConversations')).conversations.some(value => value.id === directId), false);
    assert.equal((await request(ids.alice, `/api/calls/${call.id}/ice?deviceId=runtime-alice`)).status, 403);
  });
});
