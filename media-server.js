/** VPS-only media process. Environment is supplied by systemd; never loads .env. */
const { verifyToken } = require('@clerk/backend');
const { PrismaClient } = require('./src/generated/prisma');
const { createMediaApi, configuredMedia } = require('./server/media-http');
const { preflightDatabase } = require('./server/db-preflight');
const { reportException } = require('./server/diagnostics');

async function main({ env = process.env, PrismaClientConstructor = PrismaClient, apiFactory = createMediaApi,
  preflight = preflightDatabase, logger = console, signalSource = process } = {}) {
  let prisma, app;
  let phase = 'configuration';
  try {
    const config = configuredMedia(env);
    if (!env.DATABASE_URL || new URL(env.DATABASE_URL).protocol !== 'mysql:') throw new Error('An explicit MySQL DATABASE_URL is required');
    if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) throw new Error('Clerk verification is required');
    if (env.NODE_ENV !== 'production') require('./server/development-guard').assertLocalDatabase(env, { allowValidation: true });
    phase = 'database-preflight';
    prisma = new PrismaClientConstructor({ datasources: { db: { url: env.DATABASE_URL } } });
    await preflight(prisma); // Metadata reads only. Never deploys migrations.
    phase = 'application';
    app = apiFactory({ prisma, env, logger, verifyToken: token => verifyToken(token, {
      ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : { secretKey: env.CLERK_SECRET_KEY }),
      authorizedParties: config.origins,
    }) });
    await app.ready();
    phase = 'listen';
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(config.port, config.host, resolve); });
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      const timer = setTimeout(() => app.server.closeAllConnections(), 30_000); timer.unref();
      try { await app.close(); await prisma.$disconnect(); }
      catch (error) { reportException(logger, 'media.shutdown_failed', error); process.exitCode = 1; }
      finally { clearTimeout(timer); }
    };
    signalSource.once('SIGTERM', () => { void shutdown(); });
    signalSource.once('SIGINT', () => { void shutdown(); });
    logger.info?.(JSON.stringify({ event: 'media.ready', port: config.port, allowedOriginCount: config.origins.length }));
    return { app, prisma, shutdown };
  } catch (error) {
    if (phase === 'configuration' && !error.code) error.code = 'SERVER_CONFIGURATION_INVALID';
    reportException(logger, 'media.start_failed', error, { phase });
    await app?.close(); await prisma?.$disconnect();
    throw error;
  }
}
if (require.main === module) main().catch(() => { process.exitCode = 1; });
module.exports = { main };
