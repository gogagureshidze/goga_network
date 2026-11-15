const { verifyToken } = require('@clerk/backend');
const { PrismaClient } = require('./src/generated/prisma');
const { createChatService } = require('./server/chat-service');
const { createSocketApp } = require('./server/socket-app');
const { createRoomService, createRoomRegistrar } = require('./server/rooms');
const { isIP } = require('node:net');
const { preflightDatabase } = require('./server/db-preflight');
const { reportException } = require('./server/diagnostics');

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

async function main({ env = process.env, PrismaClientConstructor = PrismaClient, socketFactory = createSocketApp,
  roomFactory = createRoomService, roomRegistrar = createRoomRegistrar, preflight = preflightDatabase,
  logger = console, signalSource = process, developmentGuard = env => require('./server/development-guard').assertLocalDatabase(env, { allowValidation: true }) } = {}) {
  let prisma, app;
  let phase = 'configuration';
  try {
    const origins = configuredOrigins(env);
    const host = configuredHost(env);
    const port = Number(env.PORT || 3001);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
    if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) throw new Error('Configure Clerk verification on the socket server');
    let livekit;
    if (env.ENABLE_GROUP_CALLS === 'true') {
      if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) throw new Error('Group calls require LiveKit server configuration');
      const { RoomServiceClient } = require('livekit-server-sdk');
      livekit = new RoomServiceClient(env.LIVEKIT_URL.replace(/^ws/, 'http'), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, { requestTimeout: 5, failover: false });
    }
    if (env.NODE_ENV !== 'production') developmentGuard(env);
    phase = 'database-preflight';
    prisma = new PrismaClientConstructor();
    // Do not construct the socket application or its sweep timers until schema readiness
    // is established. This performs metadata reads only; migration approval is separate.
    const readiness = await preflight(prisma);
    logger.info?.(JSON.stringify({ event: 'server.preflight_passed', ...readiness }));
    phase = 'application';
    const chat = createChatService(prisma);
    const rooms = roomFactory({ prisma, chat, livekit, env, logger });
    app = socketFactory({
      chat, logger, allowedOrigins: origins,
      verifyToken: token => verifyToken(token, {
        ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : { secretKey: env.CLERK_SECRET_KEY }),
        authorizedParties: origins,
      }),
      registerRoomEvents: roomRegistrar(rooms),
      onMembershipRevoked: (conversationId, userId) => rooms.onMembershipRevoked(conversationId, userId),
      sweepRooms: () => rooms.sweep(),
      closeRooms: () => rooms.close?.(),
      ready: async () => { await prisma.$queryRaw`SELECT 1`; return true; },
    });
    phase = 'listen';
    await app.listen(port, host);
    let stopping = false;
    const shutdown = async signal => {
      if (stopping) return;
      stopping = true;
      logger.info?.(JSON.stringify({ event: 'server.shutdown', signal }));
      const deadline = setTimeout(() => process.exit(1), 10_000);
      deadline.unref();
      try { await app.close(); await prisma.$disconnect(); }
      catch (error) { reportException(logger, 'server.shutdown_failed', error, { phase: 'shutdown' }); process.exitCode = 1; }
      finally { clearTimeout(deadline); }
    };
    signalSource.once('SIGINT', () => { void shutdown('SIGINT'); });
    signalSource.once('SIGTERM', () => { void shutdown('SIGTERM'); });
    logger.info?.(JSON.stringify({ event: 'server.ready', port, allowedOriginCount: origins.length }));
    return { app, prisma, shutdown };
  } catch (error) {
    if (phase === 'configuration' && !error.code) error.code = 'SERVER_CONFIGURATION_INVALID';
    reportException(logger, 'server.start_failed', error, { phase });
    try { await app?.close(); await prisma?.$disconnect(); }
    catch (cleanupError) { reportException(logger, 'server.start_cleanup_failed', cleanupError, { phase: 'cleanup' }); }
    throw error;
  }
}

if (require.main === module) main().catch(() => { process.exitCode = 1; });
module.exports = { main, configuredOrigins, configuredHost };
