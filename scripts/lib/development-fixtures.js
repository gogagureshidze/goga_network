const {createHash} = require('node:crypto');
const {createChatService} = require('../../server/chat-service');

const COUNTS = ['user', 'post', 'follower', 'story', 'comment', 'conversation', 'conversationMember', 'message', 'mediaAsset', 'watchParty'];
async function counts(prisma) {
  return Object.fromEntries(await Promise.all(COUNTS.map(async model => [model, await prisma[model].count()])));
}

// This module receives an already guarded local client. The CLI verifies both
// the exact URL and owned MySQL datadir before calling it. No Clerk API is used.
async function populateFixtures(prisma, {owners, state = {}, prefix = 'goga_demo_v1', now = new Date()} = {}) {
  if (!owners?.length) throw new Error('LOCAL_ACCOUNT_REQUIRED: sign in to localhost once, then rerun dev:fixtures.');
  const next = {...state};
  const people = ['maya', 'noah', 'leo'].map((name, index) => ({
    id: `${prefix}_${name}`, username: `demo_${name}`, name: ['Maya', 'Noah', 'Leo'][index],
    surname: 'Demo', avatar: '/noAvatar.png', cover: '/noCover.png',
    description: 'Synthetic local development profile. This is not a real account and cannot sign in.',
    city: ['Tbilisi', 'London', 'Lisbon'][index], showActivityStatus: false,
  }));
  // The local state stores primary keys, so rerunning preserves edited text and
  // renamed groups. A missing fixture can be recreated; no row is deleted.
  await prisma.$transaction(async tx => {
    async function remember(model, key, find, create, belongs) {
      if (next[key]) {
        const existing = await tx[model].findUnique({where:{id:next[key]}});
        if (existing) {
          if (!belongs(existing)) throw new Error('FIXTURE_STATE_MISMATCH: no existing content was overwritten.');
          return existing;
        }
      }
      const row = await tx[model].findFirst({where:find}) || await tx[model].create({data:create});
      next[key] = row.id;
      return row;
    }
    for (const person of people) {
      const existing = await tx.user.findUnique({where:{id:person.id}});
      if (existing && existing.description !== person.description) throw new Error('FIXTURE_ID_COLLISION');
      if (!existing && await tx.user.findFirst({where:{username:person.username,id:{not:person.id}}})) throw new Error('FIXTURE_USERNAME_COLLISION');
      if (!existing) await tx.user.create({data:person});
    }
    const descriptions = [
      'Welcome to the local Goga community. All people and conversations labeled Demo are synthetic.',
      'A weekend walk, a warm coffee and a good conversation. What made you smile today?',
      'Design notebook: small details make a social app feel welcoming.',
      'What should we try together next? Vote in this demo poll.',
      'Local community meetup: bring your ideas for better group conversations.',
      'A little color for the feed. This image is a bundled local placeholder.',
      'Testing long conversations: replies, reactions and read receipts should stay in sync.',
      'A reminder to take a break and get outside between coding sessions.',
      'Watch parties synchronize playback. They do not relay a movie through the chat server.',
      'The demo room is ready for a voice-note playback check.',
      'Pagination check: there are more than ten demo posts in this feed.',
      'Sharing a project update with the community. What are you building?',
      'One small improvement every day adds up.',
      'Try opening a demo profile, adding a comment or reacting to a post.',
    ];
    for (let index = 0; index < descriptions.length; index++) {
      const author = people[index % people.length];
      const desc = `[Local demo ${index + 1}] ${descriptions[index]}`;
      const post = await remember('post', `post:${index}`, {userId:author.id, desc}, {
        userId:author.id, desc, createdAt:new Date(now.getTime() - index * 3600000),
        ...(index === 3 ? {poll:{create:{expiresAt:new Date(now.getTime() + 7 * 86400000), options:{create:[{text:'A watch party'}, {text:'A voice conversation'}, {text:'A photo challenge'}]}}}} : {}),
        ...(index === 4 ? {event:{create:{date:new Date(now.getTime() + 3 * 86400000), location:'Local demo community room'}}} : {}),
        ...(index === 5 ? {media:{create:{url:'/noCover.png', type:'photo'}}} : {}),
      }, row => row.userId === author.id);
      // Repair only the original demo placeholder's pre-release discriminator.
      if (index === 5) await tx.media.updateMany({where:{postId:post.id,url:'/noCover.png',type:'image'},data:{type:'photo'}});
      if (index < 4) {
        const commenter = people[(index + 1) % people.length];
        await remember('comment', `comment:${index}`, {postId:post.id, userId:commenter.id, desc:'Looking forward to trying this! [Local demo]'}, {postId:post.id, userId:commenter.id, desc:'Looking forward to trying this! [Local demo]'}, row => row.postId === post.id && row.userId === commenter.id);
        await tx.like.upsert({where:{userId_postId:{userId:commenter.id,postId:post.id}},update:{},create:{userId:commenter.id,postId:post.id}});
      }
    }
    for (const person of people.slice(0,2)) {
      const story = await remember('story', `story:${person.id}`, {userId:person.id,img:'/noCover.png'}, {userId:person.id,img:'/noCover.png',expiresAt:new Date(now.getTime()+86400000)}, row=>row.userId===person.id);
      // Demo stories deliberately refresh on an explicit fixture run.
      if (story.expiresAt <= now) await tx.story.update({where:{id:story.id},data:{createdAt:now,expiresAt:new Date(now.getTime()+86400000)}});
    }
    for (const owner of owners) {
      if (!await tx.user.findUnique({where:{id:owner.id}})) throw new Error('LOCAL_ACCOUNT_NOT_FOUND');
      for (const person of people) for (const [followerId,followingId] of [[owner.id,person.id],[person.id,owner.id]]) {
        await tx.follower.upsert({where:{followerId_followingId:{followerId,followingId}},update:{},create:{followerId,followingId}});
      }
      await remember('post', `own-post:${owner.id}`, {userId:owner.id,desc:'My local development notebook. This is synthetic content for testing edits and comments. [Local demo]'}, {userId:owner.id,desc:'My local development notebook. This is synthetic content for testing edits and comments. [Local demo]'}, row=>row.userId===owner.id);
      await remember('conversation', `group:${owner.id}`, {ownerId:owner.id,kind:'GROUP',name:'Local Demo Lounge'}, {
        kind:'GROUP',ownerId:owner.id,name:'Local Demo Lounge',members:{create:[
          {userId:owner.id,role:'OWNER'}, {userId:people[0].id,role:'ADMIN'}, {userId:people[1].id,role:'MEMBER'},
        ]},
      }, row=>row.ownerId===owner.id && row.kind==='GROUP');
      await remember('conversation', `invite:${owner.id}`, {ownerId:people[2].id,kind:'GROUP',name:`Demo invitation ${createHash('sha256').update(owner.id).digest('hex').slice(0,6)}`}, {
        kind:'GROUP',ownerId:people[2].id,name:`Demo invitation ${createHash('sha256').update(owner.id).digest('hex').slice(0,6)}`,members:{create:[{userId:people[2].id,role:'OWNER'}, {userId:owner.id,status:'INVITED'}]},
      }, row=>row.ownerId===people[2].id && row.kind==='GROUP');
    }
  }, {timeout:20000});
  const chat = createChatService(prisma);
  const directs = [];
  for (const owner of owners) {
    const hash = createHash('sha256').update(owner.id).digest('hex').slice(0,16);
    for (const [index, person] of people.entries()) {
      const direct = await chat.getOrCreateDirect(owner.id, person.id);
      directs.push({ownerId:owner.id,otherId:person.id,conversationId:direct.id,voiceKey:`${prefix}-${hash}-voice-${index}`});
      const lines = index === 0 ? 36 : 5;
      for (let i=0;i<lines;i++) {
        const senderId = i % 2 ? owner.id : person.id;
        await chat.sendMessage(senderId,{conversationId:direct.id,clientMessageId:`${prefix}-${hash}-${index}-${i}`,
          text:i===0 ? `Hello! I am ${person.name}, a synthetic local fixture. I cannot log in or answer a live call. Use a second real development account for that.`
            : i===1 ? 'This saved demo conversation is linked to my real development account.'
            : `[Local demo ${i+1}] ${i%3===0 ? 'Try replying, editing your own message, or adding a reaction.' : 'Conversation history should remain here after a reload.'}`,
        });
      }
    }
    const groupId = next[`group:${owner.id}`];
    // If the user deliberately left/changed access, preserve it on reruns.
    const member = await prisma.conversationMember.findUnique({where:{conversationId_userId:{conversationId:groupId,userId:owner.id}}});
    if (member?.status === 'ACTIVE') for (let i=0;i<5;i++) await chat.sendMessage(owner.id,{conversationId:groupId,clientMessageId:`${prefix}-${hash}-group-${i}`,text:[
      'Welcome to the Local Demo Lounge. These are synthetic local fixtures.',
      'Record a voice note here, preview it, then send it.',
      'Watch together sample: http://localhost:3000/local-test/watch.mp4',
      'This original test-pattern clip is authorized for local playback testing.',
      'Group calling stays disabled until the self-hosted media server passes capacity tests.',
    ][i]});
  }
  return {state:next,people,directs};
}
module.exports = {populateFixtures,counts};
