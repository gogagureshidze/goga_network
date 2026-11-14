const {root,useSupportedNode:ensureSupportedNode,loadDevelopmentEnv,portOpen,runNode} = require('./local-development');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
async function main() {
  ensureSupportedNode();
  const mode = process.argv[2] || 'web';
  if (!['web','socket'].includes(mode)) throw new Error('Use npm run dev or npm run dev:socket');
  const env = {...loadDevelopmentEnv()};
  const port = mode === 'web' ? 3000 : 3001;
  if (await portOpen(port)) throw new Error(`LOCAL_PORT_IN_USE: ${port} already has a listener. Stop that local process before starting another; no cache was removed.`);
  if (!await portOpen(33367)) throw new Error('LOCAL_MYSQL_OFFLINE: run npm run dev:setup first.');
  const generated = path.join(root,'src/generated/prisma/schema.prisma');
  if (!fs.existsSync(generated) || fs.readFileSync(generated,'utf8') !== fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8')) {
    runNode(require.resolve('prisma/build/index.js'),['generate'],env);
  }
  // Read-only preflight before a frontend or background room sweeper can run.
  const {PrismaClient} = require('../src/generated/prisma');
  const prisma = new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
  try { await require('../server/db-preflight').preflightDatabase(prisma); }
  finally {await prisma.$disconnect();}
  env.PORT = String(port);
  env.SOCKET_HOST = '127.0.0.1';
  const script = mode === 'web' ? require.resolve('next/dist/bin/next') : path.join(root,'socket-server.js');
  // Next normalizes loopback IPs to localhost in middleware URLs. Clerk's
  // same-page rewrite must share that origin or Next proxies it back to itself.
  const args = mode === 'web' ? [script,'dev','--turbopack','--hostname','localhost','--port','3000'] : [script];
  console.info(`Starting ${mode} on localhost:${port}; isolated local database goga_development on port 33367.`);
  const child = spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'});
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>child.kill(signal));
  child.once('error',()=>{console.error('Local process could not start');process.exitCode=1;});
  child.once('exit',code=>{process.exitCode=code ?? 0;});
}
main().catch(error=>{
  if (error.name?.startsWith('Prisma') || error.name === 'DatabasePreflightError') {
    require('../server/diagnostics').reportException(console,'development.start_failed',error);
    console.error('Local database preflight failed. Run npm run dev:setup; no migration was attempted by this launcher.');
  } else console.error(error.message);
  process.exitCode=1;
});
