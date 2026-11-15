// Test-only transport adapters. Nothing here is imported by application code.
const assert = require('node:assert/strict');
const { generateKeyPairSync, randomUUID, sign } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { createServer } = require('node:http');
const { Readable } = require('node:stream');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { verifyToken } = require('@clerk/backend');
const { io: connect } = require('socket.io-client');
const loadTs = require('./load-ts.cjs');

function disposableDatabaseUrl(configured) {
  if (!configured) throw new Error('GOGA_TEST_DATABASE_URL is required; no .env is loaded');
  const url = new URL(configured);
  if (url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' || url.port !== '33367' || url.pathname !== '/goga_validation' || url.hash ||
      [...url.searchParams].some(([key, value]) => !['connection_limit', 'pool_timeout', 'connect_timeout'].includes(key) || !/^\d+$/.test(value))) {
    throw new Error('Runtime integration is restricted to mysql://127.0.0.1:33367/goga_validation; socket overrides are forbidden');
  }
  return configured;
}

function syntheticSessions(origin) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwtKey = publicKey.export({ type: 'spki', format: 'pem' });
  const kid = randomUUID();
  return {
    token(userId, overrides = {}) {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: userId, sid: `sess_runtime_${randomUUID()}`, iss: 'https://goga-runtime.invalid',
        azp: origin, iat: now, nbf: now - 5, exp: now + 600, ...overrides })).toString('base64url');
      const data = `${header}.${payload}`;
      return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
    },
    // The actual production SDK verifier checks the ephemeral signature and azp.
    // These are synthetic identities, not sessions obtained from a Clerk login.
    verify: token => verifyToken(token, { jwtKey, authorizedParties: [origin] }),
  };
}

function event(socket, name, predicate = () => true, timeout = 5000) {
  const pending = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timed out waiting for ${name}`)); }, timeout);
    const listener = value => {
      if (!predicate(value)) return;
      clearTimeout(timer); socket.off(name, listener); resolve(value);
    };
    socket.on(name, listener);
  });
  // An earlier failed ack can end the subtest before it reaches this await.
  // Observe that rejection without changing what awaiting callers receive.
  pending.catch(() => {});
  return pending;
}

async function runtimeHarness(t, configured, { roomEnv = {}, livekit, names = ['alice', 'bob', 'outsider'], now } = {}) {
  const databaseUrl = disposableDatabaseUrl(configured);
  const { PrismaClient } = require('../../src/generated/prisma');
  const { createChatService } = require('../../server/chat-service');
  const { createSocketApp } = require('../../server/socket-app');
  const { createRoomService, createRoomRegistrar } = require('../../server/rooms');
  const { createCallCredentials } = require('../../server/call-credentials');
  const { createMediaApi } = require('../../server/media-http');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prefix = `runtime_${randomUUID()}`;
  const ids = Object.fromEntries(names.map(name => [name, `${prefix}_${name}`]));
  const userIds = Object.values(ids);
  const clients = [];
  const origin = 'http://localhost:3000';
  const sessions = syntheticSessions(origin);
  const chat = createChatService(prisma, { mediaCloudName: 'runtime-test-only' });
  const rooms = createRoomService({ prisma, chat, livekit, ...(now ? { now } : {}), env: { WATCH_ALLOWED_HOSTS: 'media.example.test', ...roomEnv } });
  const credentials = createCallCredentials({ rooms, ...(now ? { now } : {}), env: { RTC_STUN_URLS: 'stun:127.0.0.1:3478', ...roomEnv } });
  let socketApp, httpServer, mediaApi, root;
  t.after(async () => {
    for (const socket of clients) socket.disconnect();
    if (socketApp) await socketApp.close(); else rooms.close();
    if (mediaApi) await mediaApi.close();
    if (httpServer?.listening) {
      httpServer.closeAllConnections();
      await new Promise(resolve => httpServer.close(resolve));
    }
    try {
      // Delete only this run's identities and rows; never truncate or reset tables.
      const ownedCalls = await prisma.callSession.findMany({ where: { initiatorId: { in: userIds } }, select: { id: true } });
      await prisma.retiredMediaRoom.deleteMany({ where: { callId: { in: ownedCalls.map(call => call.id) } } });
      await prisma.conversation.deleteMany({ where: { OR: [{ user1Id: { in: userIds } }, { user2Id: { in: userIds } }, { ownerId: { in: userIds } }] } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await prisma.$disconnect();
      if (root) await fs.rm(root, { recursive: true, force: true });
    }
  });
  await prisma.$queryRaw`SELECT 1`;
  await prisma.user.createMany({ data: userIds.map(id => ({ id, username: id.split('_').at(-1) })) });
  root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'goga-runtime-voice-'));
  mediaApi = createMediaApi({ prisma, verifyToken: sessions.verify, env: {
    NODE_ENV: 'development', GOGA_LOCAL_DEVELOPMENT: 'true', MEDIA_ALLOWED_ORIGINS: origin,
    MEDIA_API_PUBLIC_ORIGIN: 'http://localhost:3002',
    VOICE_STORAGE_DIR: root, VOICE_STORAGE_RESERVE_BYTES: String(64 * 1024 * 1024),
    FFMPEG_PATH: process.env.FFMPEG_PATH || (process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : '/usr/bin/ffmpeg'),
    FFPROBE_PATH: process.env.FFPROBE_PATH || (process.platform === 'darwin' ? '/opt/homebrew/bin/ffprobe' : '/usr/bin/ffprobe'),
  }, logger: { info() {}, error(message) { t.diagnostic(message); } } });
  await new Promise((resolve, reject) => { mediaApi.server.once('error', reject); mediaApi.server.listen(0, '127.0.0.1', resolve); });
  const mediaUrl = `http://127.0.0.1:${mediaApi.server.address().port}`;
  const requests = new AsyncLocalStorage();
  const auth = async () => {
    const token = requests.getStore()?.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return { userId: null };
    try { return { userId: (await sessions.verify(token)).sub }; }
    catch { return { userId: null }; }
  };
  const globals = { Headers, File, setTimeout, clearTimeout, process: { env: { APP_ORIGIN: origin } } };
  const httpSecurity = loadTs('src/lib/http-security.ts', { 'server-only': {} }, globals);
  const dependencies = {
    '@clerk/nextjs/server': { auth },
    '@/lib/call-server': { callCredentials: () => credentials },
    '@/lib/http-security': httpSecurity,
    '../../../../../server/request-limits': require('../../server/request-limits'),
    '../../../../../../server/request-limits': require('../../server/request-limits'),
    '../../../../../server/media-policy': require('../../server/media-policy'),
    'node:stream': { Readable },
  };
  // Execute the application's actual route handlers. Only Next's request-local
  // session binding is adapted, using the cryptographically verified JWT above.
  const iceRoute = loadTs('src/app/api/calls/[id]/ice/route.ts', dependencies, globals);
  const tokenRoute = loadTs('src/app/api/calls/[id]/token/route.ts', dependencies, globals);
  let httpUrl;
  httpServer = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, httpUrl);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      const controller = new AbortController();
      request.once('aborted', () => controller.abort());
      const input = new Request(url, { method: request.method, headers, signal: controller.signal,
        ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: Readable.toWeb(request), duplex: 'half' }) });
      const callMatch = /^\/api\/calls\/([^/]+)\/(ice|token)$/.exec(url.pathname);
      const result = await requests.run(input, async () => {
        if (callMatch) {
          const context = { params: Promise.resolve({ id: callMatch[1] }) };
          if (request.method === 'GET' && callMatch[2] === 'ice') return iceRoute.GET(input, context);
          if (request.method === 'POST' && callMatch[2] === 'token') return tokenRoute.POST(input, context);
        }
        return new Response(null, { status: 404 });
      });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      if (!result.body) response.end();
      else {
        const stream = Readable.fromWeb(result.body);
        response.once('close', () => stream.destroy());
        stream.once('error', () => response.destroy());
        stream.pipe(response);
      }
    } catch {
      response.writeHead(500); response.end('Runtime test transport failed');
    }
  });
  await new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(0, '127.0.0.1', resolve); });
  httpUrl = `http://127.0.0.1:${httpServer.address().port}`;
  socketApp = createSocketApp({ chat, verifyToken: sessions.verify, allowedOrigins: [origin], registerRoomEvents: createRoomRegistrar(rooms),
    onMembershipRevoked: (conversationId, userId) => rooms.onMembershipRevoked(conversationId, userId),
    sweepRooms: () => rooms.sweep(), closeRooms: () => rooms.close(),
    logger: { info() {}, error(message) { t.diagnostic(message); } },
    ready: async () => { await prisma.$queryRaw`SELECT 1`; return true; },
  });
  const address = await socketApp.listen(0, '127.0.0.1');
  const socketUrl = `http://127.0.0.1:${address.port}`;
  async function client(userId, options = {}) {
    const socket = connect(socketUrl, { autoConnect: false, auth: { token: sessions.token(userId) },
      transports: ['websocket'], reconnection: false, forceNew: true, extraHeaders: { Origin: origin }, ...options });
    clients.push(socket);
    const connected = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { clean(); reject(new Error('Socket handshake timed out')); }, 5000);
      const clean = () => { clearTimeout(timeout); socket.off('connect', success); socket.off('connect_error', failed); };
      const success = () => { clean(); resolve(socket); };
      const failed = error => { clean(); reject(error); };
      socket.once('connect', success); socket.once('connect_error', failed);
    });
    socket.connect();
    return connected;
  }
  const rawAck = (socket, name, data = {}) => socket.timeout(5000).emitWithAck(name, data);
  const ack = async (socket, name, data = {}) => {
    const result = await rawAck(socket, name, data);
    assert.equal(result.ok, true, `${name}: ${JSON.stringify(result.error)}`);
    return result;
  };
  const denied = async (socket, name, data, code = 'FORBIDDEN') => {
    const result = await rawAck(socket, name, data);
    assert.equal(result.ok, false, name); assert.equal(result.error.code, code, name);
    return result;
  };
  const request = (userId, pathname, options = {}) => fetch(`${pathname.startsWith('/api/chat/') ? mediaUrl : httpUrl}${pathname}`, { ...options,
    headers: { Origin: origin, ...(userId ? { Authorization: `Bearer ${sessions.token(userId)}` } : {}), ...options.headers },
    signal: AbortSignal.timeout(30000), redirect: 'error',
  });
  return { prisma, chat, ids, rooms, credentials, client, ack, rawAck, denied, request, event, sessions, origin, socketUrl };
}

function audioWav() {
  const frames = 8000;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) bytes.writeInt16LE(Math.round(Math.sin(i / 8000 * 440 * Math.PI * 2) * 1000), 44 + i * 2);
  return bytes;
}

module.exports = { runtimeHarness, syntheticSessions, disposableDatabaseUrl, audioWav };
