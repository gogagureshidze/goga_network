// Isolated localhost MySQL only; no production environment or credentials are loaded.
const test = require('node:test');
const assert = require('node:assert/strict');
const { runtimeHarness, disposableDatabaseUrl } = require('./helpers/runtime-harness.cjs');
const databaseUrl = disposableDatabaseUrl(process.env.GOGA_TEST_DATABASE_URL);

test('inbox ordering, durable reads and authorized presence on real MySQL and signed Socket.IO sessions', { timeout: 90000 }, async t => {
  const h = await runtimeHarness(t, databaseUrl);
  const { prisma, ids, ack, denied, event } = h;
  const [alice, bob, bobTab, outsider] = await Promise.all([h.client(ids.alice), h.client(ids.bob), h.client(ids.bob), h.client(ids.outsider)]);
  const first = (await ack(alice, 'sendMessage', { receiverId: ids.bob, text: 'first' })).message;
  const second = (await ack(alice, 'sendMessage', { conversationId: first.conversationId, text: 'second' })).message;
  let list = (await ack(bob, 'listConversations')).conversations;
  assert.equal(list[0].unreadCount, 2);
  const syncedRead = event(bobTab, 'messagesRead', value => value.messageId === first.id);
  await ack(bob, 'markRead', { conversationId: first.conversationId, messageId: first.id });
  await syncedRead;
  assert.equal((await ack(bobTab, 'listConversations')).conversations[0].unreadCount, 1);
  await ack(bobTab, 'markRead', { conversationId: first.conversationId, messageId: second.id });
  await ack(bob, 'markRead', { conversationId: first.conversationId, messageId: first.id });
  assert.equal((await ack(bob, 'listConversations')).conversations[0].unreadCount, 0);
  const group = (await ack(alice, 'createGroup', { name: 'Inbox verification', memberIds: [ids.bob] })).conversation;
  const groupFirst = (await ack(alice, 'sendMessage', { conversationId: group.id, text: 'group first' })).message;
  const invited = (await ack(bob, 'listConversations')).conversations.find(row => row.id === group.id);
  assert.equal(invited.unreadCount, 0); assert.deepEqual(invited.messages, []);
  await ack(bob, 'respondInvite', { conversationId: group.id, accept: true });
  const groupSecond = (await ack(alice, 'sendMessage', { conversationId: group.id, text: 'group second' })).message;
  assert.equal((await ack(bob, 'listConversations')).conversations[0].unreadCount, 2);
  await ack(bobTab, 'markRead', { conversationId: group.id, messageId: groupSecond.id });
  assert.equal((await ack(bob, 'markRead', { conversationId: group.id, messageId: groupFirst.id })).messageId, groupSecond.id);
  assert.equal((await ack(bob, 'listConversations')).conversations[0].unreadCount, 0);
  await denied(outsider, 'markRead', { conversationId: group.id, messageId: groupSecond.id });
  assert.deepEqual((await ack(outsider, 'listConversations')).presence, []);
  await ack(alice, 'listConversations');
  const hidden = event(alice, 'presenceChanged', value => !value.presence.includes(ids.bob));
  const ownSetting = event(bobTab, 'activityStatusChanged', value => !value.showActivityStatus);
  await ack(bob, 'setActivityStatus', { showActivityStatus: false }); await hidden; await ownSetting;
  assert.deepEqual((await ack(alice, 'getPresence', { conversationId: group.id })).presence, [ids.alice]);
  const shown = event(alice, 'presenceChanged', value => value.presence.includes(ids.bob));
  await ack(bob, 'setActivityStatus', { showActivityStatus: true }); await shown;
  bob.disconnect();
  assert.ok((await ack(alice, 'getPresence', {})).presence.includes(ids.bob));
  const offline = event(alice, 'presenceChanged', value => !value.presence.includes(ids.bob));
  bobTab.disconnect(); await offline;
  const online = event(alice, 'presenceChanged', value => value.presence.includes(ids.bob));
  const reconnected = await h.client(ids.bob); await online;
  assert.equal((await ack(reconnected, 'listConversations')).conversations.find(row => row.id === group.id).unreadCount, 0);
  await prisma.block.create({ data: { blockerId: ids.alice, blockedId: ids.bob } });
  assert.deepEqual((await ack(reconnected, 'listConversations')).conversations, []);
  assert.deepEqual((await ack(reconnected, 'getPresence', {})).presence, []);
  await denied(reconnected, 'getPresence', { conversationId: first.conversationId });
  await prisma.block.deleteMany({ where: { blockerId: ids.alice, blockedId: ids.bob } });

  // A membership update may make 100 old conversations look newer by updatedAt.
  // The actual newest message must still survive the bounded inbox page cutoff.
  const old = new Date('2020-01-01T00:00:00Z');
  await prisma.conversation.update({ where: { id: first.conversationId }, data: { updatedAt: old } });
  const newest = await prisma.message.create({ data: { conversationId: first.conversationId, senderId: ids.alice, receiverId: ids.bob, text: 'Newest message survives cutoff' } });
  for (let index = 0; index < 101; index++) {
    await prisma.conversation.create({ data: { kind: 'GROUP', ownerId: ids.alice, name: `Old inbox ${index}`,
      members: { create: [{ userId: ids.alice, role: 'OWNER', status: 'ACTIVE' }, { userId: ids.bob, role: 'MEMBER', status: 'ACTIVE' }] },
      messages: { create: { senderId: ids.alice, text: 'old history', createdAt: old } } } });
  }
  list = (await ack(reconnected, 'listConversations')).conversations;
  assert.equal(list.length, 100);
  assert.equal(list[0].id, first.conversationId);
  assert.equal(list[0].messages[0].id, newest.id);
  assert.equal(list[0].unreadCount, 1);
  assert.ok(list.every(row => row.members.every(member => member.userId !== ids.outsider)));
});
