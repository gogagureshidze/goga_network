// Only explicit disposable local MySQL is accepted; this suite never loads .env.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../src/generated/prisma');
const { createMediaApi } = require('../server/media-http');
const { createChatService } = require('../server/chat-service');
const { disposableDatabaseUrl, syntheticSessions, audioWav } = require('./helpers/runtime-harness.cjs');
const databaseUrl = disposableDatabaseUrl(process.env.GOGA_TEST_DATABASE_URL);

async function harness(t) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prefix = `media_http_${randomUUID()}`;
  const ids = Object.fromEntries(['alice', 'bob', 'outsider'].map(name => [name, `${prefix}_${name}`]));
  const userIds = Object.values(ids);
  let api, root, afterConversationRead;
  const errors = [];
  const instrumentedPrisma = new Proxy(prisma, { get(target, key) {
    if (key === 'conversation') return new Proxy(target.conversation, { get(model, operation) {
      if (operation !== 'findUnique') return model[operation];
      return async args => { const value = await model.findUnique(args); await afterConversationRead?.(args); return value; };
    } });
    return target[key];
  } });
  t.after(async () => {
    if (api) await api.close();
    try {
      await prisma.conversation.deleteMany({ where: { OR: [{ user1Id: { in: userIds } }, { user2Id: { in: userIds } }, { ownerId: { in: userIds } }] } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await prisma.$disconnect();
      if (root) await fs.rm(root, { recursive: true, force: true });
    }
  });
  await prisma.$queryRaw`SELECT 1`;
  await prisma.user.createMany({ data: userIds.map(id => ({ id, username: id.split('_').at(-1) })) });
  const origin = 'http://localhost:3000';
  const sessions = syntheticSessions(origin);
  root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'goga-media-api-integration-'));
  api = createMediaApi({ prisma: instrumentedPrisma, verifyToken: sessions.verify,
    logger: { info() {}, error(message) { errors.push(message); t.diagnostic(message); } },
    env: { NODE_ENV: 'development', GOGA_LOCAL_DEVELOPMENT: 'true', MEDIA_ALLOWED_ORIGINS: origin,
      MEDIA_API_PUBLIC_ORIGIN: 'http://localhost:3002', VOICE_STORAGE_DIR: root,
      VOICE_STORAGE_RESERVE_BYTES: String(64 * 1024 * 1024),
      FFMPEG_PATH: process.env.FFMPEG_PATH || (process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : '/usr/bin/ffmpeg'),
      FFPROBE_PATH: process.env.FFPROBE_PATH || (process.platform === 'darwin' ? '/opt/homebrew/bin/ffprobe' : '/usr/bin/ffprobe'),
    },
  });
  await new Promise((resolve, reject) => { api.server.once('error', reject); api.server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${api.server.address().port}`;
  const request = (userId, pathname, options = {}) => fetch(`${base}${pathname}`, {
    ...options, signal: AbortSignal.timeout(30000), redirect: 'error',
    headers: { Origin: origin, ...(userId ? { Authorization: `Bearer ${sessions.token(userId)}` } : {}), ...options.headers },
  });
  const form = (conversationId, audio = audioWav()) => {
    const data = new FormData(); data.set('audio', new File([audio], 'test-voice.wav', { type: 'audio/wav' }));
    data.set('conversationId', String(conversationId)); data.set('durationMs', String(audio.readUInt32LE(40) / 16)); data.set('waveform', '[0.1,0.8,0.3]');
    return data;
  };
  const upload = (userId, conversationId, audio) => request(userId, '/api/chat/voice', { method: 'POST', body: form(conversationId, audio) });
  return { prisma, ids, root, origin, base, sessions, request, upload, errors, onConversationRead(callback) { afterConversationRead = callback; }, chat: createChatService(prisma) };
}

test('dedicated VPS media HTTP API preserves authorized MySQL messages and private FFmpeg files', async t => {
  const h = await harness(t);
  const { prisma, ids, chat, request, upload, root } = h;
  const direct = await chat.getOrCreateDirect(ids.alice, ids.bob);
  let asset, bytes, message;

  await t.test('multipart upload validates identity and conversation before durable private storage', async () => {
    assert.equal((await upload(null, direct.id)).status, 401);
    assert.equal((await upload(ids.outsider, direct.id)).status, 403);
    const response = await upload(ids.alice, direct.id);
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.mediaUrl, `/api/chat/media/${result.mediaAssetId}`, 'Store only protected relative paths, never permanent public URLs');
    assert.equal(response.headers.get('access-control-allow-origin'), h.origin);
    asset = await prisma.mediaAsset.findUnique({ where: { id: result.mediaAssetId } });
    assert.equal(asset.ownerId, ids.alice); assert.equal(asset.conversationId, direct.id);
    assert.equal(asset.format, 'mp4'); assert.equal(result.mediaType, 'voice');
    assert.ok(asset.durationMs >= 1000 && asset.durationMs < 1100);
    assert.deepEqual(asset.waveform, [0.1, 0.8, 0.3]);
    const filenames = await fs.readdir(root);
    assert.deepEqual(filenames, [`${asset.id}.mp4`], 'No raw upload or transient FFmpeg input remains');
    assert.equal((await fs.stat(root)).mode & 0o777, 0o700);
    assert.equal((await fs.stat(path.join(root, filenames[0]))).mode & 0o777, 0o600);
    const draft = await request(ids.alice, result.mediaUrl);
    assert.equal(draft.status, 200); bytes = Buffer.from(await draft.arrayBuffer());
    assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
    assert.equal((await request(ids.bob, result.mediaUrl)).status, 404);
    assert.equal((await request(ids.outsider, result.mediaUrl)).status, 403);
    assert.equal((await request(null, result.mediaUrl)).status, 401);
  });

  await t.test('sent media retains existing message references and serves authenticated HEAD and byte ranges', async () => {
    message = await chat.sendMessage(ids.alice, { conversationId: direct.id, mediaAssetId: asset.id, clientMessageId: 'http-api-voice-test' });
    assert.equal(message.mediaAssetId, asset.id);
    assert.equal(message.mediaUrl, `/api/chat/media/${asset.id}`);
    const url = message.mediaUrl;
    const full = await request(ids.bob, url);
    assert.equal(full.status, 200); assert.equal(full.headers.get('content-type'), 'audio/mp4');
    assert.equal(full.headers.get('cache-control'), 'private, no-store');
    assert.equal(full.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(full.headers.get('accept-ranges'), 'bytes');
    assert.equal(full.headers.get('access-control-allow-credentials'), null);
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    const head = await request(ids.bob, url, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(Number(head.headers.get('content-length')), bytes.length);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    for (const [header, start, end] of [['bytes=12-31', 12, 31], ['bytes=-16', bytes.length - 16, bytes.length - 1], ['bytes=20-', 20, bytes.length - 1]]) {
      const partial = await request(ids.bob, url, { headers: { Range: header } });
      assert.equal(partial.status, 206);
      assert.equal(partial.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
      assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(start, end + 1));
    }
    const headRange = await request(ids.bob, url, { method: 'HEAD', headers: { Range: 'bytes=12-31' } });
    assert.equal(headRange.status, 206); assert.equal(headRange.headers.get('content-length'), '20');
    assert.equal((await headRange.arrayBuffer()).byteLength, 0);
    for (const range of [`bytes=${bytes.length}-`, 'bytes=8-2', 'bytes=0-1,4-5', 'bytes=-0', 'wrong']) {
      const rejected = await request(ids.bob, url, { headers: { Range: range } });
      assert.equal(rejected.status, 416); assert.equal(rejected.headers.get('content-range'), `bytes */${bytes.length}`);
    }
    assert.equal((await request(ids.alice, url, { method: 'DELETE' })).status, 409, 'Attached messages cannot be bypassed by draft deletion');
  });

  await t.test('new blocks revoke playback and upload while message deletion invalidates previously valid URLs', async () => {
    await prisma.block.create({ data: { blockerId: ids.bob, blockedId: ids.alice } });
    assert.equal((await request(ids.bob, message.mediaUrl)).status, 403);
    assert.equal((await request(ids.alice, message.mediaUrl)).status, 403);
    assert.equal((await upload(ids.bob, direct.id)).status, 403);
    await prisma.block.deleteMany({ where: { blockerId: ids.bob, blockedId: ids.alice } });
    await chat.deleteMessage(ids.alice, { messageId: message.id });
    assert.equal((await request(ids.alice, `/api/chat/media/${asset.id}`)).status, 404);
    assert.equal((await request(ids.bob, `/api/chat/media/${asset.id}`)).status, 404);
    const persisted = await prisma.message.findUnique({ where: { id: message.id } });
    assert.ok(persisted.deletedAt); assert.equal(persisted.mediaUrl, null);
  });

  await t.test('only the owner can delete an unattached recording and both file and metadata are removed', async () => {
    const response = await upload(ids.alice, direct.id);
    assert.equal(response.status, 200, await response.clone().text());
    const draft = await response.json();
    assert.ok([403, 404].includes((await request(ids.bob, draft.mediaUrl, { method: 'DELETE' })).status));
    assert.ok([403, 404].includes((await request(ids.outsider, draft.mediaUrl, { method: 'DELETE' })).status));
    const removed = await request(ids.alice, draft.mediaUrl, { method: 'DELETE' });
    assert.equal(removed.status, 204, await removed.clone().text());
    assert.equal(await prisma.mediaAsset.findUnique({ where: { id: draft.mediaAssetId } }), null);
    await assert.rejects(fs.stat(path.join(root, `${draft.mediaAssetId}.mp4`)), { code: 'ENOENT' });
    assert.equal((await request(ids.alice, draft.mediaUrl)).status, 404);
  });

  await t.test('concurrent send and draft deletion never leave a sent message pointing to a removed file', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const uploaded = await upload(ids.alice, direct.id);
      assert.equal(uploaded.status, 200, await uploaded.clone().text());
      const draft = await uploaded.json();
      const [removal, sent] = await Promise.allSettled([
        request(ids.alice, draft.mediaUrl, { method: 'DELETE' }),
        chat.sendMessage(ids.alice, { conversationId: direct.id, mediaAssetId: draft.mediaAssetId, clientMessageId: `media-delete-race-${attempt}` }),
      ]);
      assert.equal(removal.status, 'fulfilled');
      const references = await prisma.message.count({ where: { mediaAssetId: draft.mediaAssetId } });
      if (removal.value.status === 204) {
        assert.equal(sent.status, 'rejected'); assert.equal(references, 0);
        assert.equal(await prisma.mediaAsset.findUnique({ where: { id: draft.mediaAssetId } }), null);
        await assert.rejects(fs.stat(path.join(root, `${draft.mediaAssetId}.mp4`)), { code: 'ENOENT' });
      } else {
        assert.equal(removal.value.status, 409, await removal.value.clone().text());
        assert.equal(sent.status, 'fulfilled'); assert.equal(references, 1);
        assert.ok((await fs.stat(path.join(root, `${draft.mediaAssetId}.mp4`))).size > 0);
        assert.equal((await request(ids.bob, draft.mediaUrl)).status, 200);
      }
    }
  });

  await t.test('revocation after encoding prevents metadata publication and removes the newly encoded file', async () => {
    const filesBefore = (await fs.readdir(root)).sort();
    const metadataBefore = await prisma.mediaAsset.count({ where: { ownerId: ids.alice } });
    let checks = 0;
    h.onConversationRead(async ({ where }) => {
      if (where.id !== direct.id || ++checks !== 2) return;
      assert.equal((await fs.readdir(root)).length, filesBefore.length + 1, 'Encoding completed before permission is revoked');
      await prisma.block.create({ data: { blockerId: ids.bob, blockedId: ids.alice } });
    });
    try {
      const rejected = await upload(ids.alice, direct.id);
      assert.equal(rejected.status, 403, await rejected.clone().text());
      assert.equal(checks, 2, 'Authorization is repeated after encoding');
      assert.equal(await prisma.mediaAsset.count({ where: { ownerId: ids.alice } }), metadataBefore);
      assert.deepEqual((await fs.readdir(root)).sort(), filesBefore);
    } finally {
      h.onConversationRead(undefined);
      await prisma.block.deleteMany({ where: { blockerId: ids.bob, blockedId: ids.alice } });
    }
  });

  await t.test('group invitations, active membership and removal apply to both voice upload and playback', async () => {
    const group = await chat.createGroup(ids.alice, { name: 'Media API access test', memberIds: [ids.bob, ids.outsider] });
    assert.equal((await upload(ids.bob, group.id)).status, 403, 'An invitation alone cannot upload');
    await chat.respondInvite(ids.bob, { conversationId: group.id, accept: true });
    const response = await upload(ids.bob, group.id);
    assert.equal(response.status, 200, await response.clone().text());
    const voice = await response.json();
    await chat.sendMessage(ids.bob, { conversationId: group.id, mediaAssetId: voice.mediaAssetId, clientMessageId: 'http-api-group-voice' });
    assert.equal((await request(ids.alice, voice.mediaUrl)).status, 200);
    assert.equal((await request(ids.outsider, voice.mediaUrl)).status, 403, 'Invited users cannot read existing group media');
    await chat.respondInvite(ids.outsider, { conversationId: group.id, accept: true });
    assert.equal((await request(ids.outsider, voice.mediaUrl)).status, 200);
    await chat.updateMember(ids.alice, { conversationId: group.id, memberId: ids.outsider, remove: true });
    assert.equal((await request(ids.outsider, voice.mediaUrl)).status, 403);
    assert.equal((await upload(ids.outsider, group.id)).status, 403);
  });
  await t.test('aborted authenticated playback closes streams and later ranged playback stays healthy', async () => {
    const single = audioWav();
    const long = Buffer.concat([single.subarray(0, 44), ...Array.from({ length: 20 }, () => single.subarray(44))]);
    long.writeUInt32LE(long.length - 8, 4); long.writeUInt32LE(long.length - 44, 40);
    const uploaded = await upload(ids.bob, direct.id, long);
    assert.equal(uploaded.status, 200, await uploaded.clone().text());
    const voice = await uploaded.json();
    await chat.sendMessage(ids.bob, { conversationId: direct.id, mediaAssetId: voice.mediaAssetId, clientMessageId: 'http-api-playback-abort' });
    for (let attempt = 0; attempt < 5; attempt++) {
      const partial = await new Promise((resolve, reject) => {
        const req = http.get(`${h.base}${voice.mediaUrl}`, { headers: {
          Origin: h.origin, Authorization: `Bearer ${h.sessions.token(ids.alice)}`,
        } }, res => {
          res.once('error', error => { if (error.code !== 'ECONNRESET') reject(error); });
          res.once('data', chunk => {
            const received = chunk.length, total = Number(res.headers['content-length']);
            res.once('close', () => resolve({ received, total, status: res.statusCode }));
            res.destroy(); req.destroy();
          });
        });
        req.once('error', error => { if (error.code !== 'ECONNRESET') reject(error); });
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('Playback abort test timeout')); });
      });
      assert.equal(partial.status, 200);
      assert.ok(partial.received > 0 && partial.received < partial.total, 'Client aborts before receiving the complete audio');
    }
    const recovered = await request(ids.alice, voice.mediaUrl, { headers: { Range: 'bytes=0-15' } });
    assert.equal(recovered.status, 206); assert.equal((await recovered.arrayBuffer()).byteLength, 16);
    assert.equal((await request(null, '/health')).status, 200);
  });
  assert.deepEqual(h.errors, [], 'Successful and denied requests must not cause stream or server exceptions');
});
