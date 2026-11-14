const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {local,useSupportedNode:ensureSupportedNode,loadDevelopmentEnv,findBinary} = require('./local-development');
const {verifyOwnedDatabase,checkedFile} = require('./dev-setup');
const {populateFixtures,counts} = require('./lib/development-fixtures');

async function main() {
  ensureSupportedNode();
  loadDevelopmentEnv(); // exact loopback database and test Clerk keys only
  verifyOwnedDatabase(); // socket, datadir and ownership marker, before any write
  const {PrismaClient} = require('../src/generated/prisma');
  const prisma = new PrismaClient({log:[]});
  const stateFile = path.join(local,'fixtures-v1.json');
  const lockFile = path.join(local,'fixtures.lock');
  const lock = fs.openSync(lockFile,'wx',0o600);
  try {
    const identity = await prisma.$queryRaw`SELECT DATABASE() AS name, @@port AS port`;
    if (identity[0]?.name !== 'goga_development' || Number(identity[0]?.port) !== 33367) throw new Error('LOCAL_DATABASE_IDENTITY_MISMATCH');
    const state = checkedFile(stateFile) ? JSON.parse(fs.readFileSync(stateFile,'utf8')) : {};
    const owners = await prisma.user.findMany({where:{id:{startsWith:'user_'}},select:{id:true}});
    const before = await counts(prisma);
    const result = await populateFixtures(prisma,{owners,state});
    const temporary = `${stateFile}.tmp`;
    fs.writeFileSync(temporary,JSON.stringify(result.state,null,2),{mode:0o600,flag:'wx'});
    fs.renameSync(temporary,stateFile);
    // Generated sine audio, never a recording or copied private attachment.
    const {createVoiceStorage} = require('../server/voice-storage');
    const {createMediaService} = require('../server/media-policy');
    const chat = require('../server/chat-service').createChatService(prisma);
    const storage = createVoiceStorage();
    const media = createMediaService({prisma,chat,upload:storage.upload,destroy:storage.destroy});
    for (const direct of result.directs.filter(item=>item.otherId===result.people[0].id)) {
      if (await prisma.message.findUnique({where:{senderId_clientMessageId:{senderId:direct.ownerId,clientMessageId:direct.voiceKey}}})) continue;
      const audio = spawnSync(findBinary('ffmpeg'),['-nostdin','-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3','-c:a','pcm_s16le','-f','wav','pipe:1'],{maxBuffer:1024*1024});
      if (audio.status!==0) throw new Error('LOCAL_FIXTURE_AUDIO_GENERATION_FAILED');
      const uploaded = await media.uploadVoice(direct.ownerId,{bytes:audio.stdout,mime:'audio/wav',durationMs:3000,conversationId:direct.conversationId,waveform:Array.from({length:48},(_,i)=>0.2+0.5*Math.abs(Math.sin(i/4)))});
      await chat.sendMessage(direct.ownerId,{conversationId:direct.conversationId,clientMessageId:direct.voiceKey,mediaAssetId:uploaded.mediaAssetId,text:'Generated three-second test tone. [Local demo]'});
    }
    console.info(JSON.stringify({database:'127.0.0.1:33367/goga_development',before,after:await counts(prisma),linkedDevelopmentAccounts:owners.length}));
    console.info('Refresh localhost:3000. Demo users are synthetic fixtures, not Clerk logins. Sign in a second real development account and rerun this command for two-user tests.');
  } finally {
    fs.closeSync(lock); fs.unlinkSync(lockFile); await prisma.$disconnect();
  }
}
if (require.main===module) main().catch(error=>{
  // Never print raw Prisma messages, query text, URLs or profile data.
  const safe = /^(LOCAL_|FIXTURE_|UNSAFE_|CLERK_)/.test(error.message||'') ? error.message : error.code || error.name || 'FAILED';
  console.error(`Local fixture setup failed: ${safe}`); process.exitCode=1;
});
