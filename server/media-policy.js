const { randomUUID } = require('node:crypto');
const MAX_VOICE_BYTES = 4 * 1024 * 1024;
const MAX_VOICE_DURATION_MS = 120000;
const MIME_FORMATS = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };
class MediaError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
function validateVoice(bytes, mime, durationMs) {
  const type = String(mime).split(';')[0].toLowerCase();
  const format = MIME_FORMATS[type];
  if (!format || !Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > MAX_VOICE_BYTES) throw new MediaError('INVALID_AUDIO');
  if (!Number.isFinite(durationMs) || durationMs < 100 || durationMs > MAX_VOICE_DURATION_MS) throw new MediaError('INVALID_DURATION');
  const magic = format === 'webm' ? bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))
    : format === 'ogg' ? bytes.toString('ascii',0,4) === 'OggS'
    : format === 'mp4' ? bytes.toString('ascii',4,8) === 'ftyp'
    : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WAVE';
  if (!magic) throw new MediaError('INVALID_AUDIO');
  return format;
}
// Single-process limits: bounded memory, per-account rather than client-controlled IP.
const buckets = new Map();
function limitMedia(userId, now = Date.now()) {
  for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
  const b = buckets.get(userId) || { count: 0, until: now + 60000 };
  if (b.count >= 6 || (!buckets.has(userId) && buckets.size >= 10000)) throw new MediaError('RATE_LIMITED', 429);
  b.count++; buckets.set(userId,b);
}
function createMediaService({ prisma, chat, upload, destroy, now = () => Date.now() }) {
  return {
    async uploadVoice(userId, input) {
      if (!userId) throw new MediaError('UNAUTHORIZED',401);
      validateVoice(input.bytes, input.mime, input.durationMs);
      const conversation = input.conversationId
        ? await chat.authorizeConversation(userId, Number(input.conversationId))
        : await chat.getOrCreateDirect(userId, input.receiverId);
      limitMedia(userId,now());
      const id = randomUUID();
      const publicId = `goga/voice/${id}`;
      let result;
      try {
        result = await upload(input.bytes, publicId);
        // Container signatures alone cannot prove an upload has no video tracks.
        if (!result.audio || result.width > 0 || result.height > 0 || !Number.isFinite(result.duration) || result.duration <= 0 || result.duration > 120 || !Object.values(MIME_FORMATS).includes(result.format) || result.bytes > MAX_VOICE_BYTES) throw new MediaError('INVALID_AUDIO');
        // Encoding may take seconds; membership can be revoked while it runs.
        await chat.authorizeConversation(userId, conversation.id);
        const waveform = Array.isArray(input.waveform) && input.waveform.length <= 64 && input.waveform.every(x => Number.isFinite(x) && x >= 0 && x <= 1) ? input.waveform : [];
        const asset = await prisma.mediaAsset.create({data: {id, ownerId:userId, conversationId:conversation.id, publicId, format:result.format, bytes:result.bytes, durationMs:Math.round(result.duration*1000), waveform, expiresAt:new Date(now()+86400000)}});
        return {mediaAssetId:asset.id, mediaUrl:`/api/chat/media/${asset.id}`, mediaType:'voice', durationMs:asset.durationMs, waveform, conversationId:conversation.id};
      } catch(error) {
        // Public id is generated before upload; cleanup also covers uncertain upload outcomes.
        await destroy(publicId).catch(() => console.warn(JSON.stringify({event:'voice_cleanup_failed',assetId:id})));
        throw error;
      }
    },
    async authorizeAsset(userId,id) {
      if (!userId) throw new MediaError('UNAUTHORIZED',401);
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new MediaError('NOT_FOUND',404);
      const asset = await prisma.mediaAsset.findUnique({where:{id},include:{message:{select:{deletedAt:true}}}});
      if (!asset || asset.expiresAt.getTime() <= now() || asset.message?.deletedAt) throw new MediaError('NOT_FOUND',404);
      await chat.authorizeConversation(userId,asset.conversationId);
      if (!asset.message && asset.ownerId !== userId) throw new MediaError('NOT_FOUND',404);
      return asset;
    }
  };
}
module.exports = {MAX_VOICE_BYTES, MAX_VOICE_DURATION_MS, MediaError, validateVoice, createMediaService};
