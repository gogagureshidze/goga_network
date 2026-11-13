const test = require('node:test');
const assert = require('node:assert/strict');
const { pruneVoiceMedia } = require('../scripts/prune-voice-media');

test('retention defaults to dry run and only applies locked expired records', async () => {
  const expired = { id: 'old', publicId: 'goga/voice/old', bytes: 100 };
  const destroyed = [], deleted = [];
  const prisma = {
    mediaAsset: {
      findMany: async ({ where }) => where.id ? [] : [expired],
      findUnique: async () => null,
      delete: async ({ where }) => deleted.push(where.id),
    },
    message: { updateMany: async () => {} },
    $queryRaw: async () => [{ id: expired.id }],
  };
  prisma.$transaction = fn => fn(prisma);
  const storage = { destroy: async id => destroyed.push(id), listStored: async () => [] };
  const dryRun = await pruneVoiceMedia({ prisma, storage, log() {} });
  assert.equal(dryRun.candidates, 1); assert.equal(dryRun.removed, 0); assert.equal(destroyed.length, 0);
  const applied = await pruneVoiceMedia({ prisma, storage, apply: true, log() {} });
  assert.equal(applied.removed, 1); assert.deepEqual(destroyed, [expired.publicId]); assert.deepEqual(deleted, [expired.id]);
  destroyed.length = 0;
  prisma.$queryRaw = async () => []; // Concurrent send extended expiry before lock was acquired.
  assert.equal((await pruneVoiceMedia({ prisma, storage, apply: true, log() {} })).removed, 0);
  assert.equal(destroyed.length, 0);
});
