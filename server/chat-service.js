/** Database-backed messaging policy. All identities come from verified sessions. */
const { randomUUID } = require('node:crypto');

class ChatError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const fail = (code, message, status) => { throw new ChatError(code, message, status); };
const positiveId = (value, name = 'id') => {
  if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_INPUT', `Invalid ${name}`);
  return value;
};
const userIdValue = (value) => {
  if (typeof value !== 'string' || value.length < 1 || value.length > 191) fail('INVALID_INPUT', 'Invalid user');
  return value;
};
const object = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', 'Expected an object');
  return value;
};
const boundedText = (value, max, name) => {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max) fail('INVALID_INPUT', `Invalid ${name}`);
  return value.trim();
};
const messageInclude = {
  sender: { select: { username: true, avatar: true } },
  reactions: { select: { userId: true, emoji: true } },
  replyTo: { select: { id: true, text: true, senderId: true, deletedAt: true } },
};
const forbidden = () => fail('FORBIDDEN', 'Conversation is unavailable', 403);

function createChatService(prisma, { mediaCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME } = {}) {
  async function getProfile(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, avatar: true, showActivityStatus: true } });
    if (!user) fail('UNAUTHENTICATED', 'Account is unavailable', 401);
    return user;
  }

  async function visiblePresence(userIds) {
    if (!userIds.length) return [];
    const users = await prisma.user.findMany({ where: { id: { in: userIds }, showActivityStatus: true }, select: { id: true } });
    return users.map(user => user.id);
  }

  async function sanitizeMessageReads(userId, messages) {
    const shares = new Map();
    for (const message of messages) {
      if (message.mediaType !== 'shared_post' || !message.mediaUrl) continue;
      try { const data = JSON.parse(message.mediaUrl); shares.set(message.id, Number.isSafeInteger(data.postId) ? data.postId : null); }
      catch { shares.set(message.id, null); }
    }
    if (!shares.size) return messages;
    const postIds = [...new Set([...shares.values()].filter(Boolean))];
    const posts = await prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, userId: true, user: { select: { isPrivate: true } } } });
    const authors = [...new Set(posts.map(post => post.userId))];
    const [blocks, follows] = await Promise.all([
      prisma.block.findMany({ where: { OR: [{ blockerId: userId, blockedId: { in: authors } }, { blockedId: userId, blockerId: { in: authors } }] }, select: { blockerId: true, blockedId: true } }),
      prisma.follower.findMany({ where: { followerId: userId, followingId: { in: authors } }, select: { followingId: true } }),
    ]);
    const blocked = new Set(blocks.map(block => block.blockerId === userId ? block.blockedId : block.blockerId));
    const followed = new Set(follows.map(follow => follow.followingId));
    const visible = new Set(posts.filter(post => post.userId === userId || (!blocked.has(post.userId) && (!post.user.isPrivate || followed.has(post.userId)))).map(post => post.id));
    return messages.map(message => shares.has(message.id) && !visible.has(shares.get(message.id))
      ? { ...message, text: 'This shared post is no longer available.', mediaUrl: null }
      : message);
  }

  async function assertUnblocked(userId, others, db = prisma) {
    const ids = [...new Set(others)].filter(id => id && id !== userId);
    if (!ids.length) return;
    const block = await db.block.findFirst({ where: { OR: [
      { blockerId: userId, blockedId: { in: ids } }, { blockedId: userId, blockerId: { in: ids } },
    ] }, select: { id: true } });
    if (block) forbidden();
  }

  async function assertCanContact(userId, receiverId) {
    userIdValue(receiverId);
    if (userId === receiverId) fail('INVALID_INPUT', 'Choose another person');
    await assertUnblocked(userId, [receiverId]);
    const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, isPrivate: true } });
    if (!receiver) forbidden();
    if (receiver.isPrivate) {
      const follower = await prisma.follower.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: receiverId } }, select: { id: true } });
      if (!follower) forbidden();
    }
  }

  async function authorizeConversation(userId, conversationId, db = prisma) {
    positiveId(conversationId, 'conversation');
    const conversation = await db.conversation.findUnique({ where: { id: conversationId }, include: {
      members: { where: { status: 'ACTIVE' }, select: { userId: true, role: true, status: true, lastReadMessageId: true } },
    } });
    if (!conversation) forbidden();
    const participantIds = conversation.kind === 'GROUP'
      ? conversation.members.map(m => m.userId)
      : [conversation.user1Id, conversation.user2Id].filter(Boolean);
    if (!participantIds.includes(userId)) forbidden();
    // A new block takes effect immediately, including already joined sockets.
    await assertUnblocked(userId, participantIds, db);
    return { ...conversation, participantIds };
  }

  // Internal delivery helper. Callers must authorize the initiating event first.
  async function getDeliveryRecipients(conversationId) {
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } } });
    if (!conversation) return [];
    const ids = conversation.kind === 'GROUP' ? conversation.members.map(m => m.userId) : [conversation.user1Id, conversation.user2Id].filter(Boolean);
    const blocks = await prisma.block.findMany({ where: { blockerId: { in: ids }, blockedId: { in: ids } }, select: { blockerId: true, blockedId: true } });
    const excluded = new Set(blocks.flatMap(block => [block.blockerId, block.blockedId]));
    return ids.filter(id => !excluded.has(id));
  }

  async function getOrCreateDirect(userId, receiverId) {
    await assertCanContact(userId, receiverId);
    let conversation = await prisma.conversation.findFirst({ where: { kind: 'DIRECT', OR: [
      { user1Id: userId, user2Id: receiverId }, { user1Id: receiverId, user2Id: userId },
    ] }, orderBy: { id: 'asc' } });
    if (!conversation) {
      // Canonical ordering prevents two simultaneous first sends from creating both orientations.
      const [user1Id, user2Id] = [userId, receiverId].sort();
      conversation = await prisma.conversation.upsert({ where: { user1Id_user2Id: { user1Id, user2Id } },
        create: { user1Id, user2Id, kind: 'DIRECT' }, update: {} });
    }
    return authorizeConversation(userId, conversation.id);
  }

  async function authorizePost(userId, postId) {
    positiveId(postId, 'post');
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { user: { select: { id: true, isPrivate: true } } } });
    if (!post) fail('FORBIDDEN', 'Post is unavailable', 403);
    if (post.userId !== userId) await assertCanContact(userId, post.userId);
    return post;
  }

  async function sendMessage(userId, input) {
    object(input);
    if (input.senderId && input.senderId !== userId) forbidden();
    const conversation = input.conversationId
      ? await authorizeConversation(userId, input.conversationId)
      : await getOrCreateDirect(userId, input.receiverId);
    const receiverId = conversation.kind === 'GROUP' ? null : conversation.participantIds.find(id => id !== userId);
    if (input.receiverId && input.receiverId !== receiverId) forbidden();
    if (receiverId) await assertCanContact(userId, receiverId);
    const clientMessageId = input.clientMessageId === undefined ? randomUUID() : input.clientMessageId;
    if (typeof clientMessageId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(clientMessageId)) fail('INVALID_INPUT', 'Invalid message key');
    const previous = await prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: userId, clientMessageId } }, include: messageInclude });
    if (previous) {
      if (previous.conversationId !== conversation.id) fail('CONFLICT', 'Message key already used', 409);
      return previous;
    }
    const text = input.text == null || input.text === '' ? null : boundedText(input.text, 4000, 'message');
    let mediaUrl = null, mediaType = null, mediaAssetId = null, durationMs = null, waveform = undefined;
    if (input.mediaAssetId) {
      if (typeof input.mediaAssetId !== 'string' || input.mediaAssetId.length > 64) fail('INVALID_INPUT', 'Invalid media');
      const asset = await prisma.mediaAsset.findUnique({ where: { id: input.mediaAssetId } });
      if (!asset || asset.ownerId !== userId || asset.conversationId !== conversation.id || new Date(asset.expiresAt) < new Date()) forbidden();
      mediaAssetId = asset.id;
      mediaType = 'voice';
      mediaUrl = `/api/chat/media/${asset.id}`;
      durationMs = asset.durationMs;
      waveform = asset.waveform || undefined;
    } else if (input.mediaUrl || input.mediaType) {
      if (!['image', 'video', 'shared_post'].includes(input.mediaType) || typeof input.mediaUrl !== 'string' || input.mediaUrl.length > 16000) fail('INVALID_INPUT', 'Invalid media');
      mediaType = input.mediaType;
      mediaUrl = input.mediaUrl;
      if (mediaType === 'shared_post') {
        // New snapshots must be authored by the server action. Existing persisted shares use notifyMessage.
        fail('INVALID_INPUT', 'Share posts using the share action');
      } else {
        let url;
        try { url = new URL(mediaUrl); } catch { fail('INVALID_INPUT', 'Invalid media URL'); }
        if (!mediaCloudName || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(`/${mediaCloudName}/`)) fail('INVALID_INPUT', 'Unsupported media source');
      }
    }
    if (!text && !mediaUrl) fail('INVALID_INPUT', 'Message cannot be empty');
    const replyToId = input.replyToId == null ? null : positiveId(input.replyToId, 'reply');
    if (replyToId) {
      const reply = await prisma.message.findUnique({ where: { id: replyToId }, select: { conversationId: true, deletedAt: true } });
      if (!reply || reply.conversationId !== conversation.id || reply.deletedAt) forbidden();
    }
    try {
      return await prisma.$transaction(async tx => {
        // Membership mutations lock this same parent first, preventing a removed member
        // from persisting a send after a concurrent group removal commits.
        await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
        await authorizeConversation(userId, conversation.id, tx);
        if (mediaAssetId) {
          const currentAsset = await tx.mediaAsset.findUnique({ where: { id: mediaAssetId } });
          if (!currentAsset || new Date(currentAsset.expiresAt) <= new Date()) forbidden();
        }
        const message = await tx.message.create({ data: {
          conversationId: conversation.id, senderId: userId, receiverId, text, clientMessageId,
          mediaUrl, mediaType, mediaAssetId, durationMs, ...(waveform ? { waveform } : {}), replyToId,
        }, include: messageInclude });
        if (mediaAssetId) await tx.mediaAsset.update({ where: { id: mediaAssetId }, data: { expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } });
        return message;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        const existing = await prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId: userId, clientMessageId } }, include: messageInclude });
        if (existing && existing.conversationId === conversation.id) return existing;
        fail('CONFLICT', 'Media or message already used', 409);
      }
      throw error;
    }
  }

  async function getMessage(userId, messageId) {
    positiveId(messageId, 'message');
    const message = await prisma.message.findUnique({ where: { id: messageId }, include: messageInclude });
    if (!message) forbidden();
    await authorizeConversation(userId, message.conversationId);
    return (await sanitizeMessageReads(userId, [message]))[0];
  }

  async function notifyMessage(userId, { messageId }) {
    const message = await getMessage(userId, messageId);
    if (message.senderId !== userId) forbidden();
    // A persisted private-post snapshot must never be forwarded after visibility changes.
    if (message.mediaType === 'shared_post' && message.mediaUrl) {
      let share;
      try { share = JSON.parse(message.mediaUrl); } catch { forbidden(); }
      const conversation = await authorizeConversation(userId, message.conversationId);
      for (const participant of conversation.participantIds) await authorizePost(participant, share.postId);
    }
    return message;
  }

  async function getMessages(userId, input) {
    object(input);
    const conversation = input.conversationId
      ? await authorizeConversation(userId, input.conversationId)
      : await getOrCreateDirect(userId, input.receiverId);
    const limit = input.limit === undefined ? 30 : positiveId(input.limit, 'limit');
    if (limit > 100) fail('INVALID_INPUT', 'Limit exceeds 100');
    const before = input.before == null ? null : positiveId(input.before, 'cursor');
    const messages = await prisma.message.findMany({ where: { conversationId: conversation.id, ...(before ? { id: { lt: before } } : {}) }, include: messageInclude, orderBy: { id: 'desc' }, take: limit + 1 });
    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();
    return { conversationId: conversation.id, messages: await sanitizeMessageReads(userId, messages.reverse()), hasMore };
  }

  async function editMessage(userId, { messageId, text }) {
    const message = await getMessage(userId, messageId);
    if (message.senderId !== userId || message.deletedAt || message.mediaType === 'shared_post') forbidden();
    return prisma.message.update({ where: { id: message.id }, data: { text: boundedText(text, 4000, 'message'), editedAt: new Date() }, include: messageInclude });
  }

  async function deleteMessage(userId, { messageId }) {
    const message = await getMessage(userId, messageId);
    if (message.senderId !== userId) forbidden();
    return prisma.$transaction(async tx => {
      await tx.messageReaction.deleteMany({ where: { messageId: message.id } });
      if (message.mediaAssetId) await tx.mediaAsset.update({ where: { id: message.mediaAssetId }, data: { expiresAt: new Date() } });
      return tx.message.update({ where: { id: message.id }, data: { text: null, mediaUrl: null, mediaType: null, waveform: [], durationMs: null, deletedAt: message.deletedAt || new Date() }, include: messageInclude });
    });
  }

  async function reactMessage(userId, { messageId, emoji, remove = false }) {
    const message = await getMessage(userId, messageId);
    if (message.deletedAt) forbidden();
    if (!['👍', '❤️', '😂', '😮', '😢', '🎉'].includes(emoji) || typeof remove !== 'boolean') fail('INVALID_INPUT', 'Unsupported reaction');
    if (remove) await prisma.messageReaction.deleteMany({ where: { messageId, userId, emoji } });
    else await prisma.messageReaction.upsert({ where: { messageId_userId_emoji: { messageId, userId, emoji } }, create: { messageId, userId, emoji }, update: {} });
    return getMessage(userId, messageId);
  }

  async function markRead(userId, { conversationId, messageId }) {
    const conversation = await authorizeConversation(userId, conversationId);
    const message = await getMessage(userId, messageId);
    if (message.conversationId !== conversation.id) forbidden();
    if (conversation.kind === 'GROUP') {
      await prisma.conversationMember.updateMany({ where: { conversationId, userId, status: 'ACTIVE', OR: [{ lastReadMessageId: null }, { lastReadMessageId: { lt: messageId } }] }, data: { lastReadMessageId: messageId } });
    } else {
      await prisma.message.updateMany({ where: { conversationId, receiverId: userId, id: { lte: messageId }, isRead: false }, data: { isRead: true } });
    }
    return { conversationId, userId, messageId };
  }

  async function listConversations(userId) {
    const conversations = await prisma.conversation.findMany({ where: { OR: [
      { kind: 'DIRECT', OR: [{ user1Id: userId }, { user2Id: userId }] },
      { kind: 'GROUP', members: { some: { userId, status: { in: ['ACTIVE', 'INVITED'] } } } },
    ] }, include: { user1: { select: { id: true, username: true, avatar: true } }, user2: { select: { id: true, username: true, avatar: true } }, members: { include: { user: { select: { id: true, username: true, avatar: true } } } }, messages: { orderBy: { id: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' }, take: 100 });
    const blocks = await prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } });
    const blockedIds = new Set(blocks.map(b => b.blockerId === userId ? b.blockedId : b.blockerId));
    const visible = conversations.filter(c => ![c.user1Id, c.user2Id, ...c.members.filter(m => m.status === 'ACTIVE').map(m => m.userId)].some(id => blockedIds.has(id)));
    const previews = new Map((await sanitizeMessageReads(userId, visible.flatMap(c => c.messages))).map(message => [message.id, message]));
    return visible.map(c => {
      const invited = c.members.some(m => m.userId === userId && m.status === 'INVITED');
      return { ...c, messages: invited ? [] : c.messages.map(message => previews.get(message.id)) };
    });
  }

  async function createGroup(userId, { name, memberIds = [] }) {
    const title = boundedText(name, 100, 'group name');
    if (!Array.isArray(memberIds) || memberIds.length > 49) fail('INVALID_INPUT', 'Groups support up to 50 people');
    const ids = [...new Set(memberIds.map(userIdValue))].filter(id => id !== userId);
    for (const id of ids) await assertCanContact(userId, id);
    return prisma.conversation.create({ data: { kind: 'GROUP', name: title, ownerId: userId, members: { create: [
      { userId, role: 'OWNER', status: 'ACTIVE' }, ...ids.map(id => ({ userId: id, role: 'MEMBER', status: 'INVITED' })),
    ] } }, include: { members: true } });
  }

  async function requireModerator(userId, conversationId) {
    const conversation = await authorizeConversation(userId, conversationId);
    if (conversation.kind !== 'GROUP' || !conversation.members.some(m => m.userId === userId && ['OWNER', 'ADMIN'].includes(m.role))) forbidden();
    return conversation;
  }

  async function inviteMember(userId, { conversationId, memberId }) {
    await requireModerator(userId, conversationId);
    await assertCanContact(userId, memberId);
    return prisma.$transaction(async tx => {
      // Lock the parent row so concurrent invitations cannot exceed the participant cap.
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      const actor = await tx.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!actor || actor.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(actor.role)) forbidden();
      const count = await tx.conversationMember.count({ where: { conversationId } });
      const existing = await tx.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: memberId } } });
      if (existing) return existing;
      if (count >= 50) fail('INVALID_INPUT', 'Group is full');
      return tx.conversationMember.create({ data: { conversationId, userId: memberId, status: 'INVITED', role: 'MEMBER' } });
    });
  }

  async function respondInvite(userId, { conversationId, accept }) {
    positiveId(conversationId, 'conversation');
    if (typeof accept !== 'boolean') fail('INVALID_INPUT', 'Invalid invitation response');
    const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } }, include: { conversation: { include: { members: { where: { status: 'ACTIVE' } } } } } });
    if (!member || member.status !== 'INVITED') forbidden();
    await assertUnblocked(userId, member.conversation.members.map(m => m.userId));
    if (!accept) return prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId } } });
    return prisma.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { status: 'ACTIVE', joinedAt: new Date() } });
  }

  async function updateMember(userId, { conversationId, memberId, role, remove = false }) {
    await requireModerator(userId, conversationId);
    userIdValue(memberId);
    return prisma.$transaction(async tx => {
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      const actor = await tx.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      const target = await tx.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: memberId } } });
      if (!actor || actor.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(actor.role) || !target || target.role === 'OWNER' || memberId === userId || (target.role === 'ADMIN' && actor.role !== 'OWNER')) forbidden();
      if (remove === true) return tx.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: memberId } } });
      if (actor.role !== 'OWNER' || !['ADMIN', 'MEMBER'].includes(role)) forbidden();
      return tx.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: memberId } }, data: { role } });
    });
  }

  async function leaveConversation(userId, { conversationId }) {
    const conversation = await authorizeConversation(userId, conversationId);
    if (conversation.kind !== 'GROUP') fail('INVALID_INPUT', 'Only groups can be left');
    return prisma.$transaction(async tx => {
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      const current = await tx.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!current) forbidden();
      if (current.role === 'OWNER') {
        const successor = await tx.conversationMember.findFirst({ where: { conversationId, userId: { not: userId }, status: 'ACTIVE' }, orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }] });
        if (!successor) {
          // Keep historical rows; revoke all invitations and leave the empty group inaccessible.
          await tx.conversationMember.deleteMany({ where: { conversationId } });
          await tx.conversation.update({ where: { id: conversationId }, data: { ownerId: null } });
          return { conversationId };
        }
        await tx.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: successor.userId } }, data: { role: 'OWNER' } });
        await tx.conversation.update({ where: { id: conversationId }, data: { ownerId: successor.userId } });
      }
      await tx.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId } } });
      return { conversationId };
    });
  }

  return { getProfile, visiblePresence, getDeliveryRecipients, assertUnblocked, assertCanContact, authorizeConversation, getOrCreateDirect, authorizePost,
    sendMessage, getMessage, notifyMessage, getMessages, editMessage, deleteMessage, reactMessage, markRead,
    listConversations, createGroup, inviteMember, respondInvite, updateMember, leaveConversation };
}
module.exports = { createChatService, ChatError, positiveId, object, messageInclude };
