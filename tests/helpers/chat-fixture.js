/** In-memory Prisma-shaped test double. It never reads DATABASE_URL. */
function createFixture() {
  const state = {
    users: [
      { id: 'alice', username: 'Alice', isPrivate: false, showActivityStatus: true },
      { id: 'bob', username: 'Bob', isPrivate: false, showActivityStatus: true },
      { id: 'eve', username: 'Eve', isPrivate: false, showActivityStatus: false },
    ], conversations: [], members: [], messages: [], reactions: [], blocks: [], followers: [], assets: [],
    posts: [{ id: 1, userId: 'alice' }],
  };
  let messageId = 0, conversationId = 0;
  const clone = value => structuredClone(value);
  function matches(row, where = {}) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR') return value.some(item => matches(row, item));
      if (key === 'AND') return value.every(item => matches(row, item));
      if (key.includes('_')) return matches(row, value);
      if (value && typeof value === 'object') return Object.entries(value).every(([operator, operand]) => {
        if (operator === 'in') return operand.includes(row[key]);
        if (operator === 'lt') return row[key] < operand;
        if (operator === 'lte') return row[key] <= operand;
        if (operator === 'not') return row[key] !== operand;
        return false;
      });
      return row[key] === value;
    });
  }
  const messageRelations = row => row ? { ...clone(row), reactions: clone(state.reactions.filter(r => r.messageId === row.id)), replyTo: clone(state.messages.find(m => m.id === row.replyToId) || null) } : null;
  const conversationRelations = (row, args) => row ? { ...clone(row), members: clone(state.members.filter(member => member.conversationId === row.id && matches(member, args?.include?.members?.where))) } : null;
  const prisma = {
    user: { findUnique: async ({ where }) => clone(state.users.find(row => matches(row, where)) || null), findMany: async ({ where }) => clone(state.users.filter(row => matches(row, where))) },
    block: { findFirst: async ({ where }) => clone(state.blocks.find(row => matches(row, where)) || null), findMany: async ({ where }) => clone(state.blocks.filter(row => matches(row, where))) },
    follower: { findUnique: async ({ where }) => clone(state.followers.find(row => matches(row, where)) || null), findMany: async ({ where }) => clone(state.followers.filter(row => matches(row, where))) },
    post: { findMany: async ({ where }) => state.posts.filter(row => matches(row, where)).map(post => ({ ...post, user: clone(state.users.find(u => u.id === post.userId)) })), findUnique: async ({ where }) => { const post = state.posts.find(row => matches(row, where)); return post ? { ...post, user: clone(state.users.find(u => u.id === post.userId)) } : null; } },
    mediaAsset: { findUnique: async ({ where }) => clone(state.assets.find(row => matches(row, where)) || null), update: async ({ where, data }) => { const row = state.assets.find(row => matches(row, where)); Object.assign(row, data); return clone(row); } },
    conversation: {
      findUnique: async args => conversationRelations(state.conversations.find(row => matches(row, args.where)), args),
      findFirst: async args => conversationRelations(state.conversations.find(row => matches(row, args.where)), args),
      upsert: async ({ where, create }) => {
        const existing = state.conversations.find(row => matches(row, where));
        if (existing) return clone(existing);
        const row = { id: ++conversationId, createdAt: new Date(), updatedAt: new Date(), ...create };
        state.conversations.push(row); return clone(row);
      },
      create: async ({ data }) => {
        const { members, ...fields } = data;
        const row = { id: ++conversationId, createdAt: new Date(), updatedAt: new Date(), ...fields };
        state.conversations.push(row);
        for (const member of members?.create || []) state.members.push({ conversationId: row.id, joinedAt: new Date(), lastReadMessageId: null, ...member });
        return conversationRelations(row);
      },
      update: async ({ where, data }) => { const row = state.conversations.find(row => matches(row, where)); Object.assign(row, data); return clone(row); },
    },
    message: {
      findUnique: async ({ where }) => messageRelations(state.messages.find(row => matches(row, where))),
      findMany: async ({ where, take }) => state.messages.filter(row => matches(row, where)).sort((a,b) => b.id - a.id).slice(0, take).map(messageRelations),
      create: async ({ data }) => {
        if (state.messages.some(row => row.senderId === data.senderId && row.clientMessageId === data.clientMessageId)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        const row = { id: ++messageId, createdAt: new Date(), isRead: false, deletedAt: null, ...data };
        state.messages.push(row); return messageRelations(row);
      },
      update: async ({ where, data }) => { const row = state.messages.find(row => matches(row, where)); Object.assign(row, data); return messageRelations(row); },
      updateMany: async ({ where, data }) => { const rows = state.messages.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
    },
    messageReaction: {
      upsert: async ({ where, create }) => { const existing = state.reactions.find(row => matches(row, where)); if (existing) return clone(existing); state.reactions.push(create); return clone(create); },
      deleteMany: async ({ where }) => { state.reactions = state.reactions.filter(row => !matches(row, where)); },
    },
    conversationMember: {
      findUnique: async args => {
        const member = state.members.find(row => matches(row, args.where));
        if (!member) return null;
        return args.include?.conversation ? { ...clone(member), conversation: conversationRelations(state.conversations.find(c => c.id === member.conversationId), args.include.conversation) } : clone(member);
      },
      count: async ({ where }) => state.members.filter(row => matches(row, where)).length,
      create: async ({ data }) => { state.members.push({ ...data, joinedAt: new Date(), lastReadMessageId: null }); return clone(data); },
      update: async ({ where, data }) => { const row = state.members.find(row => matches(row, where)); Object.assign(row, data); return clone(row); },
      updateMany: async ({ where, data }) => { const rows = state.members.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
      delete: async ({ where }) => { const row = state.members.find(row => matches(row, where)); state.members = state.members.filter(row => !matches(row, where)); return clone(row); },
    },
  };
  prisma.$transaction = async fn => fn(prisma);
  return { prisma, state };
}
module.exports = { createFixture };
