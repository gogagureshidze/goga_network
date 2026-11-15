const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const { sortInbox, applyInboxMessage, applyInboxRead, messagePreview, canReadVisibleMessage } = loadTs('src/lib/chat-inbox.ts');
const message = (id, conversationId, createdAt, extra = {}) => ({ id, conversationId, createdAt, text: `message ${id}`, ...extra });
const conversation = (id, latest, extra = {}) => ({ id, kind: 'DIRECT', members: [], messages: latest ? [latest] : [], ...extra });

test('inbox order follows latest messages, not membership modifications', () => {
  const rows = [conversation(1, message(1, 1, '2026-01-01'), { updatedAt: '2026-03-01' }), conversation(2, message(2, 2, '2026-02-01')), conversation(3, null, { updatedAt: '2026-04-01' })];
  assert.deepEqual(Array.from(sortInbox(rows), row => row.id), [2, 1, 3]);
  assert.deepEqual(rows.map(row => row.id), [1, 2, 3]);
});

test('received/sent messages reorder immediately and duplicate echoes do not alter unread counts', () => {
  const rows = [conversation(2, message(3, 2, '2026-02-01'), { unreadCount: 2 }), conversation(1, message(1, 1, '2026-01-01'), { unreadCount: 4 })];
  const incoming = message(4, 1, '2026-03-01');
  const next = applyInboxMessage(applyInboxMessage(rows, incoming), incoming);
  assert.equal(next[0].id, 1);
  assert.equal(next[0].messages[0].id, 4);
  assert.equal(next[0].unreadCount, 4); // refreshed from authoritative server counts
  assert.equal(next.length, 2);
});

test('old edit/replayed event cannot replace the latest message or reorder a thread', () => {
  const rows = [conversation(2, message(3, 2, '2026-02-01')), conversation(1, message(2, 1, '2026-01-01'))];
  const next = applyInboxMessage(rows, message(1, 1, '2026-01-01', { text: 'edited old text' }));
  assert.deepEqual(Array.from(next, row => row.id), [2, 1]);
  assert.equal(next[1].messages[0].id, 2);
});

test('preview edits and deletion update in place without leaking deleted text', () => {
  const rows = [conversation(1, message(1, 1, '2026-01-01'))];
  const next = applyInboxMessage(rows, message(1, 1, '2026-01-01', { deletedAt: '2026-02-01' }));
  assert.equal(messagePreview(next[0].messages[0]), 'Message deleted');
  assert.equal(messagePreview({ mediaType: 'voice' }), 'Voice message');
  assert.equal(messagePreview({ mediaType: 'shared_post' }), 'Shared a post');
});

test('genuine read requires active foreground focus and a visible message bottom', () => {
  const visible = { connected: true, visible: true, focused: true, loading: false, panelTop: 100, panelBottom: 600, messageTop: 200, messageBottom: 400 };
  assert.equal(canReadVisibleMessage(visible), true);
  for (const patch of [{ unobscured: false }, { connected: false }, { visible: false }, { focused: false }, { loading: true }, { messageBottom: 700 }, { messageTop: 10, messageBottom: 99 }, { panelBottom: 100 }, { messageTop: 700, messageBottom: 800 }]) {
    assert.equal(canReadVisibleMessage({ ...visible, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(canReadVisibleMessage({ ...visible, messageTop: -200, messageBottom: 300 }), true, 'long message may be read once its bottom is in view');
});


test('unread indicator updates immediately for a new inbound message, once per durable id', () => {
  const rows = [conversation(1, message(1, 1, '2026-01-01'), { unreadCount: 1 })];
  const inbound = message(2, 1, '2026-01-02', { senderId: 'bob' });
  const once = applyInboxMessage(rows, inbound, 'alice');
  assert.equal(once[0].unreadCount, 2);
  assert.equal(applyInboxMessage(once, inbound, 'alice')[0].unreadCount, 2);
  assert.equal(applyInboxMessage(once, message(3, 1, '2026-01-03', { senderId: 'alice' }), 'alice')[0].unreadCount, 2);
});

test('own cross-device receipt clears counts, while stale and another user receipts do not', () => {
  const rows = [conversation(1, message(4, 1, '2026-01-01'), { unreadCount: 2 })];
  assert.equal(applyInboxRead(rows, { conversationId: 1, userId: 'alice', messageId: 4 }, 'alice')[0].unreadCount, 0);
  assert.equal(applyInboxRead(rows, { conversationId: 1, userId: 'alice', messageId: 3 }, 'alice')[0].unreadCount, 2);
  assert.equal(applyInboxRead(rows, { conversationId: 1, userId: 'bob', messageId: 4 }, 'alice')[0].unreadCount, 2);
});


test('simultaneous timestamps use newest message id rather than conversation id', () => {
  const rows = [conversation(10, message(20, 10, '2026-01-01')), conversation(1, message(21, 1, '2026-01-01'))];
  assert.deepEqual(Array.from(sortInbox(rows), row => row.id), [1, 10]);
});
