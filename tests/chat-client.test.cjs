const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const { mergeMessages, reconcileHistory } = loadTs('src/lib/chat-client.ts');
const entry = (id, key, text = 'message') => ({ id, clientMessageId: key, text, createdAt: '2026-11-13T10:00:00.000Z' });

test('server acknowledgement and echo replace one optimistic message', () => {
  const optimistic = entry(-1, 'request-a');
  const persisted = entry(11, 'request-a');
  const state = mergeMessages(mergeMessages([optimistic], [persisted]), [persisted]);
  assert.equal(state.length, 1);
  assert.equal(state[0].id, 11);
});

test('independent optimistic messages with identical millisecond IDs remain distinct', () => {
  const result = mergeMessages([entry(-100, 'request-a')], [entry(-100, 'request-b')]);
  assert.equal(result.length, 2);
});

test('history refresh retains unconfirmed sends and events arriving during the fetch', () => {
  const result = reconcileHistory([entry(10, 'old', 'stale')], [entry(-20, 'pending')], [entry(10, 'old', 'edited'), entry(12, 'incoming')]);
  assert.equal(result.length, 3);
  assert.equal(result.find(message => message.id === 10).text, 'edited');
  assert.ok(result.some(message => message.clientMessageId === 'pending'));
  assert.ok(result.some(message => message.id === 12));
});

test('a persisted retry replaces its failed queue entry when history catches up', () => {
  const result = reconcileHistory([entry(20, 'retry')], [entry(-20, 'retry')], []);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 20);
});

test('older pages deduplicate overlap and keep the newest messages available', () => {
  const current = Array.from({length: 60}, (_, index) => entry(index + 21, `key-${index + 21}`));
  const older = Array.from({length: 30}, (_, index) => entry(index + 1, `key-${index + 1}`));
  const result = mergeMessages(current, older);
  assert.equal(result.length, 80);
  assert.equal(result[0].id, 1);
  assert.equal(result.at(-1).id, 80);
  assert.equal(current.length, 60);
});
