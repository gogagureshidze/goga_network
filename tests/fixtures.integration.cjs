const test = require('node:test');
const assert = require('node:assert/strict');
const {randomBytes} = require('node:crypto');
const {PrismaClient} = require('../src/generated/prisma');
const {disposableDatabaseUrl} = require('./helpers/runtime-harness.cjs');
const {populateFixtures,counts} = require('../scripts/lib/development-fixtures');
const {createChatService} = require('../server/chat-service');
const prisma = new PrismaClient({datasources:{db:{url:disposableDatabaseUrl(process.env.GOGA_TEST_DATABASE_URL)}}});

test('local fixtures preserve profiles, edits and row counts while supplying visible feed and authorized chat history', async () => {
  const prefix = `test${randomBytes(4).toString('hex')}`;
  const ownerId = `${prefix}_signed_in`, outsiderId = `${prefix}_outsider`;
  const ids = [ownerId,outsiderId,...['maya','noah','leo'].map(name=>`${prefix}_${name}`)];
  try {
    await prisma.user.createMany({data:[{id:ownerId,username:`${prefix}_owner`,description:'Preserve my profile'},{id:outsiderId,username:`${prefix}_outsider`}]});
    const fixture = await populateFixtures(prisma,{owners:[{id:ownerId}],prefix});
    assert.equal((await prisma.user.findUnique({where:{id:ownerId}})).description,'Preserve my profile');
    assert.equal(await prisma.post.count({where:{userId:{in:ids}}}),15);
    assert.equal((await prisma.media.findFirst({where:{postId:fixture.state['post:5']}})).type,'photo');
    assert.equal(await prisma.follower.count({where:{followerId:ownerId}}),3);
    assert.equal(await prisma.story.count({where:{userId:{in:ids},expiresAt:{gt:new Date()}}}),2);
    const chat = createChatService(prisma);
    const conversations = await chat.listConversations(ownerId);
    assert.equal(conversations.length,5);
    const direct = fixture.directs[0];
    const history = await chat.getMessages(ownerId,{conversationId:direct.conversationId,limit:30});
    assert.equal(history.messages.length,30); assert.equal(history.hasMore,true);
    assert.equal((await chat.getMessages(ownerId,{conversationId:direct.conversationId,limit:30,before:history.messages[0].id})).messages.length,6);
    await assert.rejects(chat.getMessages(outsiderId,{conversationId:direct.conversationId}),{code:'FORBIDDEN'});
    await assert.rejects(chat.getMessages(ownerId,{conversationId:fixture.state[`invite:${ownerId}`]}),{code:'FORBIDDEN'});
    await prisma.post.update({where:{id:fixture.state['post:0']},data:{desc:'An edited demo post must not be overwritten'}});
    await prisma.conversation.update({where:{id:fixture.state[`group:${ownerId}`]},data:{name:'Renamed local group'}});
    const before = await counts(prisma);
    await populateFixtures(prisma,{owners:[{id:ownerId}],prefix,state:fixture.state});
    assert.deepEqual(await counts(prisma),before);
    assert.equal((await prisma.post.findUnique({where:{id:fixture.state['post:0']}})).desc,'An edited demo post must not be overwritten');
    assert.equal((await prisma.conversation.findUnique({where:{id:fixture.state[`group:${ownerId}`]}})).name,'Renamed local group');
    assert.equal((await chat.authorizeConversation(ownerId,fixture.state[`group:${ownerId}`])).members.find(m=>m.userId===ownerId).role,'OWNER');
  } finally {
    await prisma.conversation.deleteMany({where:{OR:[{user1Id:{in:ids}},{user2Id:{in:ids}},{ownerId:{in:ids}}]}});
    await prisma.user.deleteMany({where:{id:{in:ids}}});
    await prisma.$disconnect();
  }
});
