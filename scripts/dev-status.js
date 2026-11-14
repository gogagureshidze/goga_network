const {useSupportedNode:ensureSupportedNode,loadDevelopmentEnv} = require('./local-development');
const {verifyOwnedDatabase} = require('./dev-setup');
const {counts} = require('./lib/development-fixtures');
(async()=>{
  ensureSupportedNode(); loadDevelopmentEnv(); verifyOwnedDatabase();
  const {PrismaClient} = require('../src/generated/prisma');
  const prisma = new PrismaClient({log:[]});
  try {
    const rows = await prisma.$queryRaw`SELECT DATABASE() AS databaseName, @@port AS port`;
    console.info(JSON.stringify({host:'127.0.0.1',database:rows[0].databaseName,port:Number(rows[0].port),counts:await counts(prisma),developmentAccountProfiles:await prisma.user.count({where:{id:{startsWith:'user_'}}}),syntheticProfiles:await prisma.user.count({where:{id:{startsWith:'goga_demo_v1_'}}})}));
  } finally {await prisma.$disconnect();}
})().catch(error=>{console.error(`Local status failed: ${error.code || error.name || 'FAILED'}`); process.exitCode=1;});
