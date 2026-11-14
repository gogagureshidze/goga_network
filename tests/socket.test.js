const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { once } = require('node:events');
const { createChatService } = require('../server/chat-service');
const { createSocketApp, DEFAULT_LIMITS } = require('../server/socket-app');
const { createFixture } = require('./helpers/chat-fixture');
const { leaveConversationRoom } = require('./helpers/load-ts.cjs')('src/lib/chat-client.ts');

async function setup(t, options = {}) {
  const fixture = createFixture();
  const chat = createChatService(fixture.prisma);
  const app = createSocketApp({ chat, allowedOrigins: ['http://localhost:3000'],
    verifyToken: async token => {
      if (!['alice', 'bob', 'eve'].includes(token)) throw new Error('bad signature');
      return { sub: token, exp: Date.now() / 1000 + 120 };
    }, logger: { info() {}, error() {} }, ...options });
  const address = await app.listen(0, '127.0.0.1');
  const clients = [];
  t.after(async () => { clients.forEach(client => client.disconnect()); await app.close(); });
  async function client(token, extra = {}) {
    const socket = connect(`http://127.0.0.1:${address.port}`, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true, ...extra });
    clients.push(socket); await once(socket, 'connect'); return socket;
  }
  const ack = (socket, event, data) => socket.timeout(1000).emitWithAck(event, data);
  return { ...fixture, app, chat, client, ack, url: `http://127.0.0.1:${address.port}` };
}

test('real Socket.IO rejects unauthenticated clients and handshake query impersonation', async t => {
  const { url, client, ack, state } = await setup(t);
  const unauthenticated = connect(url, { query: { userId: 'alice' }, transports: ['websocket'], reconnection: false });
  t.after(() => unauthenticated.disconnect());
  const [error] = await once(unauthenticated, 'connect_error');
  assert.equal(error.data.code, 'UNAUTHENTICATED');
  const eve = await client('eve', { query: { userId: 'alice' } });
  const result = await ack(eve, 'sendMessage', { senderId: 'alice', receiverId: 'bob', text: 'forged' });
  assert.equal(result.error.code, 'FORBIDDEN');
  assert.equal(state.messages.length, 0);
});

test('two users and multiple tabs receive one durable ID across ack retries', async t => {
  const { client, ack, state, app } = await setup(t);
  const alice = await client('alice');
  const aliceTab = await client('alice');
  const bob = await client('bob');
  assert.equal(app.metrics.connections, 3);
  const receivedByBob = once(bob, 'receiveMessage');
  const receivedByTab = once(aliceTab, 'receiveMessage');
  const payload = { receiverId: 'bob', text: 'Hello', clientMessageId: 'idempotent-123' };
  const first = await ack(alice, 'sendMessage', payload);
  assert.equal(first.ok, true);
  assert.equal((await receivedByBob)[0].id, first.message.id);
  assert.equal((await receivedByTab)[0].id, first.message.id);
  const retry = await ack(alice, 'sendMessage', payload);
  assert.equal(retry.message.id, first.message.id);
  assert.equal(state.messages.length, 1);
  const presence = await ack(alice, 'joinConversation', { conversationId: first.message.conversationId });
  assert.deepEqual(presence.presence.sort(), ['alice', 'bob']);
  aliceTab.disconnect();
  assert.equal((await ack(bob, 'getPresence', { conversationId: first.message.conversationId })).presence.includes('alice'), true);
});

test('outsider cannot join, read, type, edit or mark receipts in another conversation', async t => {
  const { client, ack } = await setup(t);
  const alice = await client('alice');
  const eve = await client('eve');
  const { message } = await ack(alice, 'sendMessage', { receiverId: 'bob', text: 'Secret' });
  for (const [event, data] of [
    ['joinConversation', { conversationId: message.conversationId }],
    ['getMessages', { conversationId: message.conversationId }],
    ['chatTyping', { conversationId: message.conversationId, isTyping: true }],
    ['editMessage', { messageId: message.id, text: 'Forged' }],
    ['markRead', { conversationId: message.conversationId, messageId: message.id }],
  ]) assert.equal((await ack(eve, event, data)).error.code, 'FORBIDDEN', event);
});

test('post typing derives profile name and rechecks privacy for stale room access', async t => {
  const { client, ack, state } = await setup(t);
  const alice = await client('alice');
  const bob = await client('bob');
  await ack(alice, 'joinPost', { postId: 1 });
  await ack(bob, 'joinPost', { postId: 1 });
  const update = once(alice, 'typingUpdate');
  assert.equal((await ack(bob, 'userTyping', { postId: 1, username: 'Administrator', isTyping: true })).ok, true);
  assert.deepEqual((await update)[0].typingUsers, ['Bob']);
  state.blocks.push({ id: 1, blockerId: 'alice', blockedId: 'bob' });
  assert.equal((await ack(bob, 'userTyping', { postId: 1, isTyping: true })).error.code, 'FORBIDDEN');
});

test('per-user limits span tabs, health is available and malformed events do not crash', async t => {
  const { client, ack, url } = await setup(t, { limits: { ...DEFAULT_LIMITS, message: [1, 60_000] } });
  const alice = await client('alice');
  const tab = await client('alice');
  assert.equal((await ack(alice, 'sendMessage', { receiverId: 'bob', text: 'one' })).ok, true);
  assert.equal((await ack(tab, 'sendMessage', { receiverId: 'bob', text: 'two' })).error.code, 'RATE_LIMITED');
  assert.equal((await ack(alice, 'joinPost', null)).error.code, 'INVALID_INPUT');
  const health = await fetch(`${url}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
});

test('typing across tabs stays active and presence respects changed privacy preference', async t => {
  const { client, ack, state } = await setup(t);
  const alice = await client('alice');
  const tab = await client('alice');
  const bob = await client('bob');
  const { message } = await ack(alice, 'sendMessage', { receiverId: 'bob', text: 'Hello' });
  const conversationId = message.conversationId;
  await ack(alice, 'chatTyping', { conversationId, isTyping: true });
  await ack(tab, 'chatTyping', { conversationId, isTyping: true });
  const update = once(bob, 'chatTyping');
  await ack(tab, 'chatTyping', { conversationId, isTyping: false });
  assert.equal((await update)[0].isTyping, true);
  state.users.find(user => user.id === 'alice').showActivityStatus = false;
  assert.deepEqual((await ack(bob, 'getPresence', { conversationId })).presence, ['bob']);
});

test('chat client cleanup releases the actual server room and typing without removing group membership', async t => {
  const { client, ack, chat, app } = await setup(t);
  const alice = await client('alice');
  const bob = await client('bob');
  const group = await chat.createGroup('alice', { name: 'Cleanup contract', memberIds: ['bob'] });
  await chat.respondInvite('bob', { conversationId: group.id, accept: true });
  assert.equal((await ack(alice, 'joinConversation', { conversationId: group.id })).ok, true);
  const serverSocket = app.io.sockets.sockets.get(alice.id);
  assert.equal(serverSocket.rooms.has(`conversation:${group.id}`), true);
  await ack(alice, 'chatTyping', { conversationId: group.id, isTyping: true });
  const typingStopped = once(bob, 'chatTyping');
  leaveConversationRoom(alice, group.id);
  assert.equal((await typingStopped)[0].isTyping, false);
  assert.equal(serverSocket.rooms.has(`conversation:${group.id}`), false);
  assert.equal(serverSocket.rooms.has('alice'), true, 'personal delivery room stays joined');
  assert.deepEqual((await chat.authorizeConversation('alice', group.id)).participantIds, ['alice', 'bob']);
  assert.equal((await ack(alice, 'joinConversation', { conversationId: group.id })).ok, true);
});
