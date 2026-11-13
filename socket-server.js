const { verifyToken } = require('@clerk/backend');
const { PrismaClient } = require('./src/generated/prisma');
const { createChatService } = require('./server/chat-service');
const { createSocketApp } = require('./server/socket-app');
const { createRoomService, createRoomRegistrar } = require('./server/rooms');
const { isIP } = require('node:net');

function configuredHost(env) {
  const host = env.SOCKET_HOST || '127.0.0.1';
  if (!isIP(host)) throw new Error('SOCKET_HOST must be a literal IPv4 or IPv6 address');
  return host;
}

function configuredOrigins(env) {
  const origins = (env.SOCKET_ALLOWED_ORIGINS || (env.NODE_ENV === 'production' ? '' : 'http://localhost:3000')).split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error('SOCKET_ALLOWED_ORIGINS must contain exact application origins');
  return origins.map(origin => {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || (env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new Error('Invalid SOCKET_ALLOWED_ORIGINS entry');
    return origin;
  });
}

async function main() {
  const origins = configuredOrigins(process.env);
  if (!process.env.CLERK_SECRET_KEY && !process.env.CLERK_JWT_KEY) throw new Error('Configure CLERK_SECRET_KEY or CLERK_JWT_KEY on the socket server');
  const prisma = new PrismaClient();
  const chat = createChatService(prisma);
  let livekit;
  if (process.env.ENABLE_GROUP_CALLS === 'true') {
    if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) throw new Error('Group calls require LiveKit server configuration');
    const { RoomServiceClient } = require('livekit-server-sdk');
    livekit = new RoomServiceClient(process.env.LIVEKIT_URL.replace(/^ws/, 'http'), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  }
  const rooms = createRoomService({ prisma, chat, livekit });
  const app = createSocketApp({
    chat,
    allowedOrigins: origins,
    verifyToken: token => verifyToken(token, {
      ...(process.env.CLERK_JWT_KEY ? { jwtKey: process.env.CLERK_JWT_KEY } : { secretKey: process.env.CLERK_SECRET_KEY }),
      authorizedParties: origins,
    }),
    registerRoomEvents: createRoomRegistrar(rooms),
    onMembershipRevoked: (conversationId, userId) => rooms.onMembershipRevoked(conversationId, userId),
    sweepRooms: () => rooms.sweep(),
    closeRooms: () => rooms.close?.(),
    ready: async () => { await prisma.$queryRaw`SELECT 1`; return true; },
  });
  let stopping = false;
  const shutdown = async signal => {
    if (stopping) return;
    stopping = true;
    console.info(JSON.stringify({ event: 'server.shutdown', signal }));
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    try { await app.close(); await prisma.$disconnect(); clearTimeout(deadline); }
    catch { process.exitCode = 1; }
  };
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  const port = Number(process.env.PORT || 3001);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  await app.listen(port, configuredHost(process.env));
  console.info(JSON.stringify({ event: 'server.ready', port, allowedOriginCount: origins.length }));
}

if (require.main === module) main().catch(() => {
  console.error(JSON.stringify({ event: 'server.start_failed', message: 'Verify server environment, dependencies and database connectivity' }));
  process.exitCode = 1;
});
module.exports = { main, configuredOrigins, configuredHost };
