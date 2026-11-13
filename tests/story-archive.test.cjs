const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const story = { id: 4, userId: 'alice', img: '/story.jpg', createdAt: new Date('2026-01-01'), expiresAt: new Date('2026-01-02'), showLikes: true, likes: [], views: [], comments: [] };

function service(db) { return loadTs('src/lib/story-archive.ts', { 'server-only': {}, '@/lib/client': db }); }

test('archive locks the owner source and preserves highlights before deleting within one transaction', async () => {
  const writes = [];
  const db = {
    story: { update: async ({where}) => { assert.equal(where.userId, 'alice'); writes.push('lock'); }, findUnique: async () => story, delete: async () => writes.push('delete') },
    archivedStory: { findFirst: async () => null, create: async ({data}) => { assert.equal(data.originalStoryId, 4); writes.push('snapshot'); return {id: 8}; } },
    highlightStory: { updateMany: async ({data}) => { assert.equal(data.storyId, null); assert.equal(data.archivedStoryId, 8); writes.push('highlights'); } },
  };
  db.$transaction = async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); writes.push('begin'); const result = await fn(db); writes.push('commit'); return result; };
  assert.equal((await service(db).archiveStorySnapshot(4, 'alice')).id, 8);
  assert.deepEqual(writes, ['begin', 'lock', 'snapshot', 'highlights', 'delete', 'commit']);
});

test('a duplicate archive request returns its existing snapshot without writes', async () => {
  const db = { story: { update: async () => { throw Object.assign(new Error('missing'), {code:'P2025'}); } }, archivedStory: { findFirst: async ({where}) => { assert.equal(where.userId, 'alice'); return {id:8}; } } };
  db.$transaction = async fn => fn(db);
  const result = await service(db).archiveStorySnapshot(4, 'alice');
  assert.equal(result.id, 8); assert.equal(result.created, false);
});

test('failed archive creation never reaches source deletion or highlight mutation', async () => {
  let removed = false;
  const db = { story: { update: async () => story, findUnique: async () => story, delete: async () => { removed = true; } }, archivedStory: { findFirst: async () => null, create: async () => { throw new Error('storage failure'); } } };
  db.$transaction = async fn => fn(db);
  await assert.rejects(service(db).archiveStorySnapshot(4, 'alice'), /storage failure/);
  assert.equal(removed, false);
});

test('expired processing scopes public actions to the session owner and bounds each batch', async () => {
  let selection;
  const db = { story: { findMany: async value => { selection = value; return []; } } };
  await service(db).archiveExpiredStoryBatch({ ownerId:'alice', limit:100000 });
  assert.equal(selection.where.userId, 'alice'); assert.equal(selection.take, 100);
  const calls = [];
  const create = userId => loadTs('src/actions/storySettingsActions.ts', { '@/lib/client': {}, '@/lib/story-archive': { archiveExpiredStoryBatch: async input => {calls.push(input); return {success:true,count:0};} }, '@clerk/nextjs/server': { currentUser: async () => userId ? {id:userId} : null }, 'next/cache': {revalidatePath(){}} });
  assert.equal((await create(null).autoArchiveExpiredStories()).success, false);
  assert.equal(calls.length, 0);
  await create('alice').autoArchiveExpiredStories();
  assert.equal(calls[0].ownerId, 'alice'); assert.equal(calls[0].limit, 25);
});

test('serialization conflicts retry at most three times', async () => {
  let attempts = 0;
  const db = { $transaction: async () => { attempts++; throw Object.assign(new Error('retry transaction'), {code:'P2034'}); } };
  await assert.rejects(service(db).archiveStorySnapshot(4, 'alice'), /retry transaction/);
  assert.equal(attempts, 3);
});
