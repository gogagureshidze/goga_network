const test = require('node:test');
const assert = require('node:assert/strict');
const { createMediaService, validateVoice } = require('../server/media-policy');
const bytes = Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]), Buffer.alloc(16)]);
const input = { bytes, mime: 'audio/webm', durationMs: 1000, conversationId: 1, waveform: [0.2, 0.7] };
function fixture() {
  let stored, deleted = [], uploaded = 0;
  const prisma = { mediaAsset: {
    create: async ({ data }) => { stored = data; return data; },
    findUnique: async () => stored ? { ...stored, message: { deletedAt: null } } : null,
  } };
  const service = createMediaService({ prisma,
    chat: { authorizeConversation: async userId => { if (userId !== 'alice') throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' }); return { id: 1 }; } },
    upload: async () => { uploaded++; return { audio: { codec_name: 'aac' }, format: 'mp4', bytes: 100, duration: 2, width: 0, height: 0 }; },
    destroy: async id => deleted.push(id),
  });
  return { service, prisma, deleted, uploads: () => uploaded, stored: () => stored };
}
test('voice signature, duration, MIME and size limits reject invalid input', () => {
  assert.equal(validateVoice(bytes, 'audio/webm;codecs=opus', 1000), 'webm');
  for (const args of [[bytes, 'image/png', 1000], [Buffer.alloc(20), 'audio/webm', 1000], [bytes, 'audio/webm', 120001], [Buffer.alloc(4 * 1024 * 1024 + 1), 'audio/webm', 1000]]) assert.throws(() => validateVoice(...args));
});
test('second user cannot upload or read another conversation voice asset', async () => {
  const { service, uploads } = fixture();
  await assert.rejects(service.uploadVoice('bob', input), { code: 'FORBIDDEN' });
  assert.equal(uploads(), 0);
  const result = await service.uploadVoice('alice', input);
  assert.equal(result.durationMs, 2000, 'Actual probed duration wins over client duration');
  assert.equal(result.mediaType, 'voice');
  await assert.rejects(service.authorizeAsset('bob', result.mediaAssetId), { code: 'FORBIDDEN' });
  assert.equal((await service.authorizeAsset('alice', result.mediaAssetId)).id, result.mediaAssetId);
});
test('failed metadata persistence removes the private file and expired media is denied', async () => {
  const { service, prisma, deleted, stored } = fixture();
  const result = await service.uploadVoice('alice', input);
  stored().expiresAt = new Date(0);
  await assert.rejects(service.authorizeAsset('alice', result.mediaAssetId), { code: 'NOT_FOUND' });
  prisma.mediaAsset.create = async () => { throw new Error('database unavailable'); };
  await assert.rejects(service.uploadVoice('alice', input), /database unavailable/);
  assert.equal(deleted.length, 1);
});

test('membership revoked during encoding prevents asset persistence and removes the encoded file', async () => {
  let authorized = true, destroyed = 0, writes = 0;
  const service = createMediaService({
    prisma: { mediaAsset: { create: async () => writes++ } },
    chat: { authorizeConversation: async () => { if (!authorized) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' }); return { id: 1 }; } },
    upload: async () => { authorized = false; return { audio: true, format: 'mp4', bytes: 100, duration: 1 }; },
    destroy: async () => destroyed++,
  });
  await assert.rejects(service.uploadVoice('revoked-user', input), { code: 'FORBIDDEN' });
  assert.equal(writes, 0); assert.equal(destroyed, 1);
});
