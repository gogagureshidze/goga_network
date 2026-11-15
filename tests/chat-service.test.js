const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatService } = require('../server/chat-service');
const { createFixture } = require('./helpers/chat-fixture');

const setup = () => { const fixture = createFixture(); return { ...fixture, chat: createChatService(fixture.prisma) }; };
const rejected = promise => assert.rejects(promise, error => error.code === 'FORBIDDEN');

test('sender impersonation, block direction and private contact are enforced', async () => {
  const { chat, state } = setup();
  await rejected(chat.sendMessage('alice', { senderId: 'bob', receiverId: 'eve', text: 'forged' }));
  state.blocks.push({ id: 1, blockerId: 'bob', blockedId: 'alice' });
  await rejected(chat.sendMessage('alice', { receiverId: 'bob', text: 'blocked' }));
  state.blocks = [];
  state.users.find(u => u.id === 'bob').isPrivate = true;
  await rejected(chat.sendMessage('alice', { receiverId: 'bob', text: 'private' }));
  state.followers.push({ id: 1, followerId: 'alice', followingId: 'bob' });
  assert.equal((await chat.sendMessage('alice', { receiverId: 'bob', text: 'allowed' })).senderId, 'alice');
});

test('same idempotency key returns durable message once, including racing sends', async () => {
  const { chat, state } = setup();
  const input = { receiverId: 'bob', text: 'one', clientMessageId: 'retry-key-123' };
  const [first, second] = await Promise.all([chat.sendMessage('alice', input), chat.sendMessage('alice', input)]);
  assert.equal(first.id, second.id);
  assert.equal(state.messages.length, 1);
  assert.equal(state.conversations.length, 1);
  await assert.rejects(chat.sendMessage('alice', { ...input, receiverId: 'eve' }), error => error.code === 'CONFLICT');
});

test('message membership, reply scope, ownership and receipt boundary are validated', async () => {
  const { chat, state } = setup();
  const first = await chat.sendMessage('alice', { receiverId: 'bob', text: 'first' });
  const second = await chat.sendMessage('alice', { receiverId: 'bob', text: 'second' });
  await rejected(chat.getMessage('eve', first.id));
  await rejected(chat.editMessage('bob', { messageId: first.id, text: 'forged edit' }));
  await rejected(chat.sendMessage('alice', { receiverId: 'eve', text: 'leak', replyToId: first.id }));
  await chat.markRead('bob', { conversationId: first.conversationId, messageId: first.id });
  assert.equal(state.messages.find(m => m.id === first.id).isRead, true);
  assert.equal(state.messages.find(m => m.id === second.id).isRead, false);
  const reaction = await chat.reactMessage('bob', { messageId: first.id, emoji: '❤️' });
  assert.equal(reaction.reactions.length, 1);
  await chat.reactMessage('bob', { messageId: first.id, emoji: '❤️' });
  assert.equal(state.reactions.length, 1);
  const deleted = await chat.deleteMessage('alice', { messageId: first.id });
  assert.equal(deleted.text, null);
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.reactions.length, 0);
});

test('group invitations are not membership; acceptance, removal and role checks are durable', async () => {
  const { chat } = setup();
  const group = await chat.createGroup('alice', { name: 'Friends', memberIds: ['bob'] });
  await rejected(chat.authorizeConversation('bob', group.id));
  await chat.respondInvite('bob', { conversationId: group.id, accept: true });
  assert.deepEqual((await chat.authorizeConversation('bob', group.id)).participantIds, ['alice', 'bob']);
  await rejected(chat.inviteMember('bob', { conversationId: group.id, memberId: 'eve' }));
  const message = await chat.sendMessage('bob', { conversationId: group.id, text: 'Hello group' });
  assert.equal(message.receiverId, null);
  await chat.updateMember('alice', { conversationId: group.id, memberId: 'bob', remove: true });
  await rejected(chat.getMessage('bob', message.id));
});

test('voice messages require owned, unexpired assets bound to this conversation', async () => {
  const { chat, state } = setup();
  const direct = await chat.getOrCreateDirect('alice', 'bob');
  state.assets.push({ id: 'asset-123', ownerId: 'alice', conversationId: direct.id, expiresAt: new Date(Date.now() + 10000), durationMs: 2000, waveform: [0.2, 0.4] });
  await rejected(chat.sendMessage('bob', { conversationId: direct.id, mediaAssetId: 'asset-123' }));
  const voice = await chat.sendMessage('alice', { conversationId: direct.id, mediaAssetId: 'asset-123' });
  assert.equal(voice.mediaType, 'voice');
  assert.equal(voice.mediaUrl, '/api/chat/media/asset-123');
  assert.equal(voice.durationMs, 2000);
  await assert.rejects(chat.sendMessage('alice', { receiverId: 'bob', mediaType: 'voice', mediaUrl: 'https://evil.example/audio' }), error => error.code === 'INVALID_INPUT');
});

test('historical shared-post snapshots are hidden when their author becomes private', async () => {
  const { chat, state } = setup();
  const conversation = await chat.getOrCreateDirect('bob', 'eve');
  state.messages.push({ id: 42, conversationId: conversation.id, senderId: 'bob', receiverId: 'eve', mediaType: 'shared_post', mediaUrl: JSON.stringify({ postId: 1, post: { desc: 'private snapshot' } }) });
  assert.ok((await chat.getMessage('eve', 42)).mediaUrl);
  state.users.find(user => user.id === 'alice').isPrivate = true;
  const message = await chat.getMessage('eve', 42);
  assert.equal(message.mediaUrl, null);
  assert.equal(message.text, 'This shared post is no longer available.');
  assert.ok(state.messages[0].mediaUrl, 'Stored snapshot is preserved');
});

test('inbox sorts by messages, counts only incoming nondeleted unread and preserves monotonic group reads', async () => {
  const { chat, state } = setup();
  const first = await chat.sendMessage('alice', { receiverId: 'bob', text: 'direct' });
  const group = await chat.createGroup('alice', { name: 'Group', memberIds: ['bob'] });
  const beforeJoin = await chat.sendMessage('alice', { conversationId: group.id, text: 'group history' });
  let list = await chat.listConversations('bob');
  assert.equal(list.find(row => row.id === group.id).unreadCount, 0);
  assert.deepEqual(list.find(row => row.id === group.id).messages, []);
  await chat.respondInvite('bob', { conversationId: group.id, accept: true });
  const latest = await chat.sendMessage('alice', { conversationId: group.id, text: 'latest' });
  state.conversations.find(row => row.id === first.conversationId).updatedAt = new Date(Date.now() + 60000);
  list = await chat.listConversations('bob');
  assert.equal(list[0].id, group.id, 'membership changes cannot move an older message ahead');
  assert.equal(list[0].unreadCount, 2);
  assert.equal(list[1].unreadCount, 1);
  await chat.markRead('bob', { conversationId: group.id, messageId: latest.id });
  const stale = await chat.markRead('bob', { conversationId: group.id, messageId: beforeJoin.id });
  assert.equal(stale.messageId, latest.id);
  assert.equal((await chat.listConversations('bob'))[0].unreadCount, 0);
  await chat.deleteMessage('alice', { messageId: first.id });
  assert.equal((await chat.listConversations('bob')).find(row => row.id === first.conversationId).unreadCount, 0);
});

test('presence queries require current membership and suppress blocks in both directions', async () => {
  const { chat, state } = setup();
  const direct = await chat.getOrCreateDirect('alice', 'bob');
  const group = await chat.createGroup('alice', { name: 'Private', memberIds: ['eve'] });
  assert.deepEqual(await chat.presenceParticipants('eve', [direct.id, group.id]), []);
  assert.deepEqual((await chat.presenceParticipants('bob', [direct.id])).sort(), ['alice', 'bob']);
  await assert.rejects(chat.setActivityStatus('alice', 'false'), error => error.code === 'INVALID_INPUT');
  await chat.setActivityStatus('alice', false);
  assert.deepEqual(await chat.visiblePresence(['alice', 'bob'], 'bob'), ['bob']);
  await chat.setActivityStatus('alice', true);
  state.blocks.push({ id: 1, blockerId: 'alice', blockedId: 'bob' });
  assert.deepEqual(await chat.presenceParticipants('bob', [direct.id]), []);
  assert.deepEqual(await chat.visiblePresence(['alice', 'bob'], 'bob'), ['bob']);
});
