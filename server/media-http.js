/** Dedicated private voice API. Never serves a filesystem directory or accepts cookie auth. */
const { createServer } = require('node:http');
const { createChatService, ChatError } = require('./chat-service');
const { createMediaService, MediaError, MAX_VOICE_BYTES } = require('./media-policy');
const { createVoiceStorage } = require('./voice-storage');
const { beginVoiceRequest, consumeRequestLimit } = require('./request-limits');
const { reportException } = require('./diagnostics');

function configuredMedia(env) {
  const production = env.NODE_ENV === 'production';
  const local = !production && env.GOGA_LOCAL_DEVELOPMENT === 'true';
  const validOrigin = value => {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password || (url.protocol !== 'https:' &&
      !(local && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Invalid media origin');
    return value;
  };
  const origins = (env.MEDIA_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.length > 10) throw new Error('Configure exact MEDIA_ALLOWED_ORIGINS');
  origins.forEach(validOrigin);
  const publicOrigin = validOrigin(env.MEDIA_API_PUBLIC_ORIGIN || '');
  const host = env.MEDIA_API_HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1'].includes(host)) throw new Error('Media API must bind to loopback behind the HTTPS proxy');
  const port = Number(env.MEDIA_API_PORT || 3002);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid media API port');
  return { origins, publicOrigin, host, port, production };
}

function boundedBody(request, max) {
  // A client can disconnect while JWT or profile verification is still awaiting.
  // Do not wait for an aborted event that has already fired or reserve a body slot.
  if (request.aborted || request.destroyed) return Promise.reject(new MediaError('REQUEST_ABORTED', 400));
  if (Number(request.headers['content-length']) > max) return Promise.reject(new MediaError('TOO_LARGE', 413));
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const cleanup = () => {
      clearTimeout(timer);
      request.off('data', data); request.off('end', end); request.off('aborted', aborted); request.off('error', aborted);
    };
    const fail = error => { cleanup(); request.pause(); reject(error); };
    const data = chunk => { size += chunk.length; if (size > max) fail(new MediaError('TOO_LARGE', 413)); else chunks.push(chunk); };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    const aborted = () => fail(new MediaError('REQUEST_ABORTED', 400));
    const timer = setTimeout(() => fail(new MediaError('REQUEST_TIMEOUT', 408)), 20_000);
    request.on('data', data); request.once('end', end); request.once('aborted', aborted); request.once('error', aborted);
  });
}

function createMediaApi({ prisma, verifyToken, env = process.env, logger = console }) {
  const config = configuredMedia(env);
  const origins = new Set(config.origins);
  const chat = createChatService(prisma);
  const storage = createVoiceStorage({ env });
  const media = createMediaService({ prisma, chat, upload: storage.upload, destroy: storage.destroy });
  let inFlight = 0;
  const metrics = { requests: 0, rejected: 0, failed: 0, uploaded: 0, reads: 0, deleted: 0 };
  const methods = ['GET', 'HEAD', 'POST', 'DELETE'];
  const allowedHeaders = new Set(['authorization', 'content-type', 'range']);
  const logMetrics = () => logger.info?.(JSON.stringify({ event: 'media.metrics', ...metrics, inFlight }));
  const timer = setInterval(logMetrics, 60_000); timer.unref();

  const server = createServer({ maxHeaderSize: 20 * 1024, headersTimeout: 10_000, requestTimeout: 25_000,
    keepAliveTimeout: 5_000, connectionsCheckingInterval: 1_000 }, async (request, response) => {
    let release;
    let counted = false;
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Vary', 'Origin');
    const json = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
    const done = () => { if (counted) { counted = false; inFlight--; } };
    response.once('close', done); response.once('finish', done);
    try {
      if (inFlight >= 32) throw new MediaError('SERVICE_BUSY', 503);
      inFlight++; counted = true; metrics.requests++;
      // No forwarding or redirects. Query tokens and cache-busting parameters are rejected.
      if (!request.url?.startsWith('/') || request.url.startsWith('//') || request.url.length > 256 || request.url.includes('?')) throw new MediaError('NOT_FOUND', 404);
      if (request.method === 'GET' && ['/health', '/ready'].includes(request.url)) {
        if (request.url === '/ready') {
          let timeout;
          try { await Promise.race([Promise.all([prisma.$queryRaw`SELECT 1`, storage.ready()]), new Promise((_, reject) => { timeout = setTimeout(() => reject(new MediaError('UNAVAILABLE', 503)), 3000); })]); }
          catch (error) { reportException(logger, 'media.readiness_failed', error); throw new MediaError('UNAVAILABLE', 503); }
          finally { clearTimeout(timeout); }
        }
        return json(200, { status: 'ok' });
      }
      const origin = request.headers.origin;
      if (typeof origin !== 'string' || !origins.has(origin)) throw new MediaError('INVALID_ORIGIN', 403);
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Retry-After');
      // Only our loopback reverse proxy is trusted to overwrite this header.
      if (config.production && request.headers['x-forwarded-proto'] !== 'https') throw new MediaError('HTTPS_REQUIRED', 403);
      if (config.production && request.headers.host?.toLowerCase() !== new URL(config.publicOrigin).host.toLowerCase()) throw new MediaError('INVALID_HOST', 403);
      const assetMatch = /^\/api\/chat\/media\/([0-9a-f-]{36})$/i.exec(request.url);
      const upload = request.url === '/api/chat/voice';
      if (!assetMatch && !upload) throw new MediaError('NOT_FOUND', 404);
      if (request.method === 'OPTIONS') {
        const method = request.headers['access-control-request-method'];
        const headers = String(request.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
        if (!methods.includes(method) || (upload ? method !== 'POST' : !['GET', 'HEAD', 'DELETE'].includes(method)) || headers.some(value => !allowedHeaders.has(value))) throw new MediaError('INVALID_PREFLIGHT', 403);
        response.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
        response.writeHead(204, { 'Access-Control-Allow-Methods': upload ? 'POST' : 'GET, HEAD, DELETE',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range', 'Access-Control-Max-Age': '600' });
        return response.end();
      }
      if (upload ? request.method !== 'POST' : !['GET', 'HEAD', 'DELETE'].includes(request.method)) throw new MediaError('METHOD_NOT_ALLOWED', 405);
      const authorization = request.headers.authorization;
      if (typeof authorization !== 'string' || authorization.length > 16384 || !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || request.headersDistinct.authorization?.length !== 1) throw new MediaError('UNAUTHORIZED', 401);
      let claims, timeout;
      try {
        claims = await Promise.race([verifyToken(authorization.slice(7)), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Verification timeout')), 5000); })]);
      } catch { throw new MediaError('UNAUTHORIZED', 401); }
      finally { clearTimeout(timeout); }
      if (!claims || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 191 || typeof claims.sid !== 'string' || !claims.sid || claims.sid.length > 191 || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || claims.azp !== origin) throw new MediaError('UNAUTHORIZED', 401);
      if (request.aborted || request.destroyed || response.destroyed) throw new MediaError('REQUEST_ABORTED', 400);
      const userId = claims.sub;
      await chat.getProfile(userId);
      if (request.aborted || request.destroyed || response.destroyed) throw new MediaError('REQUEST_ABORTED', 400);
      if (upload) {
        release = beginVoiceRequest(userId);
        if (!request.headers['content-type']?.toLowerCase().startsWith('multipart/form-data;')) throw new MediaError('INVALID_CONTENT_TYPE', 415);
        const bytes = await boundedBody(request, MAX_VOICE_BYTES + 32768);
        let form, waveform;
        try {
          form = await new Response(bytes, { headers: { 'Content-Type': request.headers['content-type'] } }).formData();
          waveform = JSON.parse(String(form.get('waveform') || '[]'));
        } catch { throw new MediaError('INVALID_FORM', 400); }
        const audio = form.get('audio');
        if (!(audio instanceof File) || audio.size > MAX_VOICE_BYTES) throw new MediaError('INVALID_AUDIO', 400);
        const result = await media.uploadVoice(userId, { bytes: Buffer.from(await audio.arrayBuffer()), mime: audio.type,
          durationMs: Number(form.get('durationMs')), conversationId: form.get('conversationId') || undefined,
          receiverId: form.get('receiverId') || undefined, waveform });
        metrics.uploaded++;
        return json(200, result);
      }
      consumeRequestLimit(userId, request.method === 'DELETE' ? 'mediaDelete' : 'mediaRead');
      if (request.method === 'DELETE') {
        await media.deleteDraft(userId, assetMatch[1]); metrics.deleted++;
        response.writeHead(204); return response.end();
      }
      const asset = await media.authorizeAsset(userId, assetMatch[1]);
      const file = await storage.open(asset.publicId, request.headers.range);
      const close = () => file.stream.destroy();
      response.once('close', close);
      file.stream.once('close', () => response.off('close', close));
      file.stream.once('error', error => { reportException(logger, 'media.stream_failed', error); response.destroy(); });
      response.setHeader('Content-Type', 'audio/mp4');
      response.setHeader('Content-Disposition', 'inline');
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Length', String(file.end - file.start + 1));
      if (file.partial) response.setHeader('Content-Range', `bytes ${file.start}-${file.end}/${file.size}`);
      response.writeHead(file.partial ? 206 : 200); metrics.reads++;
      if (request.method === 'HEAD' || response.destroyed) { close(); response.end(); }
      else file.stream.pipe(response);
    } catch (error) {
      const known = error instanceof MediaError || error instanceof ChatError;
      const status = known ? error.status : 500;
      if (known) metrics.rejected++; else metrics.failed++;
      const reference = !known ? reportException(logger, 'media.request_failed', error) : {};
      if (!response.headersSent && !response.destroyed) {
        if (status === 416) response.setHeader('Content-Range', `bytes */${error.size || '*'}`);
        if ([429, 503].includes(status)) response.setHeader('Retry-After', String(Math.max(1, Math.ceil((error.retryAfterMs || 5000) / 1000))));
        // Never retain a socket with an unconsumed/oversized request body.
        if (!request.complete) { response.setHeader('Connection', 'close'); response.once('finish', () => request.destroy()); }
        json(status, { error: known ? error.code : 'REQUEST_FAILED', ...reference });
      } else response.destroy();
    } finally { release?.(); }
  });
  server.maxConnections = 64;
  server.maxRequestsPerSocket = 100;
  server.setTimeout(60_000, socket => socket.destroy());
  server.on('clientError', (_, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  return { server, ready: () => storage.ready(), async close() {
    clearInterval(timer);
    if (!server.listening) return;
    await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
    logMetrics();
  } };
}
module.exports = { createMediaApi, configuredMedia };
