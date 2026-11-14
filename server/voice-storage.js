/** Private local voice storage. No URL supplied by a client reaches FFmpeg. */
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { MediaError, MAX_VOICE_BYTES } = require('./media-policy');
const execute = promisify(execFile);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const gateKey = Symbol.for('goga.voice.encoder');
const globalGate = globalThis[gateKey] || (globalThis[gateKey] = { busy: false, stores: new Map() });

function assetId(publicId) {
  const match = /^goga\/voice\/([^/]+)$/.exec(publicId || '');
  if (!match || !UUID.test(match[1])) throw new MediaError('INVALID_AUDIO_ID');
  return match[1];
}
function storageError(code = 'VOICE_STORAGE_UNAVAILABLE', status = 503) { return new MediaError(code, status); }
function numericSetting(value, fallback, min, max) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw storageError();
  return number;
}
function parseRange(header, size) {
  if (!Number.isSafeInteger(size) || size < 1) throw new MediaError('NOT_FOUND', 404);
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new MediaError('INVALID_RANGE', 416);
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) throw new MediaError('INVALID_RANGE', 416);
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) throw new MediaError('INVALID_RANGE', 416);
    end = Math.min(end, size - 1);
  }
  return { start, end, partial: true };
}

function createVoiceStorage({ env = process.env, run = execute } = {}) {
  const configured = env.VOICE_STORAGE_DIR;
  if (!configured || !path.isAbsolute(configured)) throw storageError();
  const root = path.resolve(configured);
  // Next public/static roots must never contain private media or temporary inputs.
  const relative = path.relative(process.cwd(), root);
  if (root === path.parse(root).root || !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..')) throw storageError();
  const quotaBytes = numericSetting(env.VOICE_STORAGE_QUOTA_BYTES, 1024 * 1024 * 1024, 8 * 1024 * 1024, Number.MAX_SAFE_INTEGER);
  const reserveBytes = numericSetting(env.VOICE_STORAGE_RESERVE_BYTES, 1024 * 1024 * 1024, 64 * 1024 * 1024, Number.MAX_SAFE_INTEGER);
  const maxFiles = numericSetting(env.VOICE_STORAGE_MAX_FILES, 10000, 1, 100000);
  const ffmpeg = env.FFMPEG_PATH || '/usr/bin/ffmpeg';
  const ffprobe = env.FFPROBE_PATH || '/usr/bin/ffprobe';
  if (!path.isAbsolute(ffmpeg) || !path.isAbsolute(ffprobe)) throw storageError();
  if (!globalGate.stores.has(root)) globalGate.stores.set(root, { initialization: undefined, usedBytes: 0, fileCount: 0 });
  const state = globalGate.stores.get(root);
  const filename = publicId => path.join(root, `${assetId(publicId)}.mp4`);

  async function initialize() {
    if (!state.initialization) state.initialization = (async () => {
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      const rootStat = await fs.lstat(root);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw storageError();
      // Reject symlinked parents, which could place files in a public directory.
      if (await fs.realpath(root) !== root) throw storageError();
      await fs.chmod(root, 0o700);
      state.usedBytes = 0; state.fileCount = 0;
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.mp4') || !UUID.test(entry.name.slice(0, -4))) continue;
        const stat = await fs.lstat(path.join(root, entry.name));
        state.usedBytes += stat.size; state.fileCount++;
      }
    })().catch(error => { state.initialization = undefined; throw error instanceof MediaError ? error : storageError(); });
    await state.initialization;
  }
  async function checkSpace() {
    const stat = await fs.statfs(root);
    if (stat.bavail * stat.bsize < reserveBytes + 2 * MAX_VOICE_BYTES) throw storageError('VOICE_STORAGE_FULL', 507);
    if (state.usedBytes + MAX_VOICE_BYTES > quotaBytes || state.fileCount >= maxFiles) throw storageError('VOICE_STORAGE_QUOTA', 507);
  }
  async function command(binary, args, timeout) {
    try { return await run(binary, args, { timeout, killSignal: 'SIGKILL', maxBuffer: 256 * 1024, windowsHide: true, env: { PATH: '/usr/bin:/bin', LANG: 'C' } }); }
    catch (error) {
      if (error.code === 'ENOENT') throw storageError();
      if (error.killed || error.signal === 'SIGKILL') throw storageError('AUDIO_PROCESSING_TIMEOUT');
      throw new MediaError('INVALID_AUDIO');
    }
  }
  async function probe(file) {
    const result = await command(ffprobe, ['-v', 'error', '-max_alloc', '33554432', '-threads', '1', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'matroska,webm,mov,ogg,wav', '-show_entries', 'stream=codec_type,codec_name,channels,sample_rate:format=duration,size', '-of', 'json', file], 5000);
    let data;
    try { data = JSON.parse(result.stdout); } catch { throw new MediaError('INVALID_AUDIO'); }
    if (!Array.isArray(data.streams) || data.streams.length !== 1 || data.streams[0].codec_type !== 'audio') throw new MediaError('INVALID_AUDIO');
    const audio = data.streams[0];
    if (!['opus', 'aac', 'vorbis', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le', 'pcm_u8'].includes(audio.codec_name) || ![1, 2].includes(audio.channels) || Number(audio.sample_rate) < 8000 || Number(audio.sample_rate) > 96000) throw new MediaError('INVALID_AUDIO');
    return { audio, duration: Number(data.format?.duration), bytes: Number(data.format?.size) };
  }

  async function upload(bytes, publicId) {
    const target = filename(publicId);
    if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > MAX_VOICE_BYTES) throw new MediaError('INVALID_AUDIO');
    if (globalGate.busy) throw storageError('VOICE_PROCESSING_BUSY', 429);
    globalGate.busy = true;
    let input, output, linked = false;
    try {
      await initialize();
      await checkSpace();
      const nonce = randomUUID();
      input = path.join(root, `.${nonce}.input`);
      output = path.join(root, `.${nonce}.output`);
      await fs.writeFile(input, bytes, { flag: 'wx', mode: 0o600 });
      const source = await probe(input);
      if (Number.isFinite(source.duration) && (source.duration <= 0 || source.duration > 120)) throw new MediaError('INVALID_DURATION');
      // A browser WebM may have no container duration. Decode up to 121 seconds and
      // verify the actual normalized output, rejecting recordings longer than 120.
      await fs.writeFile(output, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
      await command(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-max_alloc', '33554432', '-threads', '1', '-filter_threads', '1', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'matroska,webm,mov,ogg,wav', '-i', input, '-map', '0:a:0', '-vn', '-sn', '-dn', '-map_metadata', '-1', '-t', '121', '-ac', '1', '-ar', '48000', '-c:a', 'aac', '-b:a', '64k', '-threads', '1', '-fs', String(MAX_VOICE_BYTES), '-movflags', '+faststart', '-f', 'mp4', '-y', output], 20000);
      const result = await probe(output);
      const stat = await fs.lstat(output);
      if (!stat.isFile() || !Number.isFinite(result.duration) || result.duration <= 0 || result.duration > 120 || stat.size < 12 || stat.size > MAX_VOICE_BYTES) throw new MediaError('INVALID_AUDIO');
      await fs.chmod(output, 0o600);
      // Atomic no-clobber publication on the same filesystem, unlike rename().
      await fs.link(output, target);
      linked = true;
      state.usedBytes += stat.size; state.fileCount++;
      return { audio: result.audio, duration: result.duration, bytes: stat.size, format: 'mp4', width: 0, height: 0 };
    } catch (error) {
      if (linked) await destroy(publicId).catch(() => {});
      throw error instanceof MediaError ? error : storageError();
    } finally {
      await Promise.all([input, output].filter(Boolean).map(file => fs.unlink(file).catch(() => {})));
      globalGate.busy = false;
    }
  }

  async function destroy(publicId) {
    const target = filename(publicId);
    await initialize();
    try {
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) throw storageError();
      await fs.unlink(target);
      state.usedBytes = Math.max(0, state.usedBytes - stat.size); state.fileCount = Math.max(0, state.fileCount - 1);
      return { deleted: true };
    } catch (error) { if (error.code === 'ENOENT') return { deleted: false }; throw error; }
  }

  async function open(publicId, rangeHeader) {
    await initialize();
    let handle;
    try {
      handle = await fs.open(filename(publicId), constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_VOICE_BYTES) throw new MediaError('NOT_FOUND', 404);
      let range;
      try { range = parseRange(rangeHeader, stat.size); }
      catch (error) { error.size = stat.size; throw error; }
      // The open descriptor prevents path-swap and deletion races during playback.
      // Transfer descriptor ownership to the FileHandle's stream. Manually closing
      // on both end/close races destroy() (HEAD/client abort) and fd reuse.
      const stream = handle.createReadStream({ autoClose: true, start: range.start, end: range.end });
      return { stream, size: stat.size, ...range };
    } catch (error) {
      await handle?.close().catch(() => {});
      if (['ENOENT', 'ELOOP'].includes(error.code)) throw new MediaError('NOT_FOUND', 404);
      throw error;
    }
  }

  async function listStored() {
    await initialize();
    const entries = await fs.readdir(root, { withFileTypes: true });
    const result = [];
    for (const entry of entries) if (entry.isFile() && entry.name.endsWith('.mp4') && UUID.test(entry.name.slice(0, -4))) {
      const stat = await fs.lstat(path.join(root, entry.name));
      result.push({ publicId: `goga/voice/${entry.name.slice(0, -4)}`, bytes: stat.size, modifiedAt: stat.mtime });
    }
    return result;
  }
  async function ready() {
    await initialize();
    await Promise.all([fs.access(root, constants.R_OK | constants.W_OK), fs.access(ffmpeg, constants.X_OK), fs.access(ffprobe, constants.X_OK)]);
  }
  return { upload, destroy, open, listStored, ready };
}
module.exports = { createVoiceStorage, parseRange, assetId };
