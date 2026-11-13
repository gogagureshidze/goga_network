const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createVoiceStorage, parseRange, assetId } = require('../server/voice-storage');
const run = promisify(execFile);
const ffmpeg = process.env.FFMPEG_PATH || (process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : '/usr/bin/ffmpeg');
const ffprobe = process.env.FFPROBE_PATH || (process.platform === 'darwin' ? '/opt/homebrew/bin/ffprobe' : '/usr/bin/ffprobe');
function wav(seconds = 1) {
  const frames = 8000 * seconds;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) bytes.writeInt16LE(Math.round(Math.sin(i / 8000 * 440 * Math.PI * 2) * 1000), 44 + i * 2);
  return bytes;
}
async function setup(t, options = {}) {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'goga-voice-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const env = { VOICE_STORAGE_DIR: root, FFMPEG_PATH: ffmpeg, FFPROBE_PATH: ffprobe, VOICE_STORAGE_RESERVE_BYTES: String(64 * 1024 * 1024) };
  return { root, storage: createVoiceStorage({ env, ...options }) };
}
const consume = async stream => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); };

test('Range parsing supports browser seeks and suffixes, rejects invalid/multipart ranges', () => {
  assert.deepEqual(parseRange('bytes=10-20', 100), { start: 10, end: 20, partial: true });
  assert.deepEqual(parseRange('bytes=-15', 100), { start: 85, end: 99, partial: true });
  assert.deepEqual(parseRange('bytes=95-', 100), { start: 95, end: 99, partial: true });
  assert.deepEqual(parseRange(null, 100), { start: 0, end: 99, partial: false });
  for (const range of ['bytes=-', 'bytes=100-', 'bytes=30-20', 'bytes=0-1,5-9', 'bytes=-0', 'bytes=999999999999999999999-']) assert.throws(() => parseRange(range, 100), { status: 416 });
  assert.throws(() => assetId('goga/voice/../../etc/passwd'));
  assert.throws(() => createVoiceStorage({ env: { VOICE_STORAGE_DIR: path.join(process.cwd(), 'public/voices') } }));
});

test('actual FFmpeg validates and normalizes audio; private Range reads preserve bytes', async t => {
  const { root, storage } = await setup(t);
  const id = randomUUID(), publicId = `goga/voice/${id}`;
  const result = await storage.upload(wav(), publicId);
  assert.equal(result.format, 'mp4');
  assert.equal(result.audio.codec_name, 'aac');
  assert.ok(result.duration >= 1 && result.duration < 1.1);
  const stat = await fs.stat(path.join(root, `${id}.mp4`));
  assert.equal(stat.mode & 0o777, 0o600);
  assert.equal((await fs.stat(root)).mode & 0o777, 0o700);
  const full = await storage.open(publicId, null);
  const original = await consume(full.stream);
  const partial = await storage.open(publicId, 'bytes=12-31');
  assert.deepEqual(await consume(partial.stream), original.subarray(12, 32));
  assert.equal((await storage.listStored()).length, 1);
  await assert.rejects(storage.open(publicId, 'bytes=9999999-'), { status: 416 });
  await storage.destroy(publicId);
  await assert.rejects(storage.open(publicId, null), { status: 404 });
});

test('actual probe rejects malformed audio, audio with video, and duration overflow', async t => {
  const { root, storage } = await setup(t);
  const id = () => `goga/voice/${randomUUID()}`;
  await assert.rejects(storage.upload(Buffer.alloc(32), id()), { code: 'INVALID_AUDIO' });
  await assert.rejects(storage.upload(wav(121), id()), { code: 'INVALID_DURATION' });
  const video = path.join(root, 'fixture.mp4');
  await run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=16x16:r=1:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'mpeg4', '-c:a', 'aac', '-threads', '1', video]);
  await assert.rejects(storage.upload(await fs.readFile(video), id()), { code: 'INVALID_AUDIO' });
  assert.equal((await fs.readdir(root)).some(name => name.startsWith('.')), false, 'Temporary files are removed after rejection');
});

test('streaming WebM without duration is decoded and measured; concurrent processing is bounded', async t => {
  const { storage } = await setup(t);
  const { stdout } = await run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'libopus', '-threads', '1', '-f', 'webm', 'pipe:1'], { encoding: 'buffer' });
  const first = storage.upload(stdout, `goga/voice/${randomUUID()}`);
  await assert.rejects(storage.upload(stdout, `goga/voice/${randomUUID()}`), { code: 'VOICE_PROCESSING_BUSY' });
  const result = await first;
  assert.ok(result.duration >= 1 && result.duration < 1.1);
});

test('symlink replacement cannot expose a file outside private storage', async t => {
  const { root, storage } = await setup(t);
  const publicId = `goga/voice/${randomUUID()}`;
  await storage.listStored();
  const outside = path.join(root, 'secret'); await fs.writeFile(outside, 'private');
  await fs.symlink(outside, path.join(root, `${assetId(publicId)}.mp4`));
  await assert.rejects(storage.open(publicId, null), { status: 404 });
});

test('disk reserve and file quota fail closed before native decoding starts', async t => {
  const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'goga-quota-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const env = { VOICE_STORAGE_DIR: root, FFMPEG_PATH: ffmpeg, FFPROBE_PATH: ffprobe, VOICE_STORAGE_RESERVE_BYTES: String(Number.MAX_SAFE_INTEGER) };
  const full = createVoiceStorage({ env });
  await assert.rejects(full.upload(wav(), `goga/voice/${randomUUID()}`), { code: 'VOICE_STORAGE_FULL' });
  const limited = createVoiceStorage({ env: { ...env, VOICE_STORAGE_RESERVE_BYTES: String(64 * 1024 * 1024), VOICE_STORAGE_MAX_FILES: '1' } });
  await limited.upload(wav(), `goga/voice/${randomUUID()}`);
  await assert.rejects(limited.upload(wav(), `goga/voice/${randomUUID()}`), { code: 'VOICE_STORAGE_QUOTA' });
});
