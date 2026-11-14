const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { ChatError, object, positiveId } = require('./chat-service');
const { reportException, clientDiagnostic, diagnosticCode } = require('./diagnostics');

const DEFAULT_LIMITS = {
  message: [60, 60_000], mutation: [60, 60_000], typing: [30, 10_000],
  invitation: [15, 60_000], read: [120, 60_000], signal: [180, 60_000],
  auth: [6, 60_000], join: [60, 60_000],
};
const userRoom = id => id; // Existing receiveMessage room contract.
const conversationRoom = id => `conversation:${id}`;

function createRateLimiter({ now = Date.now, limits = DEFAULT_LIMITS } = {}) {
  const buckets = new Map();
  return {
    consume(userId, category) {
      const [limit, windowMs] = limits[category] || limits.mutation;
      const key = `${category}:${userId}`;
      const timestamp = now();
      let bucket = buckets.get(key);
      if (!bucket || timestamp >= bucket.until) {
        if (!bucket && buckets.size >= 10000) throw new ChatError('UNAVAILABLE', 'Try again shortly', 503);
        bucket = { count: 0, until: timestamp + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count++;
      if (bucket.count > limit) {
        const error = new ChatError('RATE_LIMITED', 'Too many requests. Try again shortly.', 429);
        error.retryAfterMs = bucket.until - timestamp;
        throw error;
      }
    },
    sweep() { for (const [key, bucket] of buckets) if (bucket.until <= now()) buckets.delete(key); },
  };
}

function createSocketApp({ chat, verifyToken, allowedOrigins, registerRoomEvents, logger = console, now = Date.now,
  limits = DEFAULT_LIMITS, ready = async () => true, onMembershipRevoked, sweepRooms, closeRooms }) {
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.length) throw new Error('At least one socket origin is required');
  const origins = new Set(allowedOrigins);
  const metrics = { connections: 0, rejected: 0, events: 0, failures: 0, messageLatencyMs: 0, messages: 0 };
  const log = (level, event, detail = {}) => logger[level]?.(JSON.stringify({ timestamp: new Date(now()).toISOString(), event, ...detail }));
  const httpServer = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET' || !['/health', '/ready'].includes(req.url)) {
      res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return;
    }
    let healthy = true;
    if (req.url === '/ready') {
      let timer;
      try { healthy = await Promise.race([ready(), new Promise(resolve => { timer = setTimeout(() => resolve(false), 3000); })]); }
      catch (error) { healthy = false; reportException(logger, 'server.readiness_failed', error, { phase: 'readiness' }); }
      finally { clearTimeout(timer); }
    }
    res.writeHead(healthy ? 200 : 503);
    res.end(JSON.stringify({ status: healthy ? 'ok' : 'unavailable' }));
  });
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    allowRequest: (req, callback) => callback(null, !req.headers.origin || origins.has(req.headers.origin)),
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 25_000, pingTimeout: 20_000, connectTimeout: 10_000,
    transports: ['websocket', 'polling'],
    // Recovery is explicit: clients refetch durable data and reauthorize every room on reconnect.
  });
  const online = new Map();
  const postTyping = new Map();
  const chatTyping = new Map();
  const inFlight = new Map();
  const limiter = createRateLimiter({ now, limits });
  let closing = false;

  async function authenticate(token) {
    if (typeof token !== 'string' || token.length > 16384 || !token) throw new ChatError('UNAUTHENTICATED', 'Sign in to connect', 401);
    const claims = await verifyToken(token);
    if (!claims || typeof claims.sub !== 'string' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now()) throw new ChatError('UNAUTHENTICATED', 'Session expired', 401);
    return claims;
  }
  io.use(async (socket, next) => {
    try {
      const claims = await authenticate(socket.handshake.auth?.token);
      const profile = await chat.getProfile(claims.sub);
      // Per-identity cap prevents accidental tab/reconnect storms from exhausting the small VPS.
      if ((online.get(claims.sub)?.size || 0) >= 12) throw new ChatError('RATE_LIMITED', 'Too many active connections', 429);
      socket.data.userId = claims.sub;
      socket.data.expiresAt = claims.exp * 1000;
      socket.data.profile = profile;
      next();
    } catch (cause) {
      metrics.rejected++;
      const databaseFailure = diagnosticCode(cause).startsWith('DB_');
      const reference = databaseFailure ? reportException(logger, 'socket.authentication_dependency_failed', cause, { phase: 'authentication' }) : null;
      const error = new Error(reference ? 'Connection service is unavailable. Try again shortly.' : 'Authentication required');
      error.data = reference ? clientDiagnostic(reference) : { code: 'UNAUTHENTICATED' };
      next(error);
    }
  });

  async function emitToConversation(conversationId, event, payload, excludeSocketId) {
    // Send to freshly authorized identities, not stale rooms left over from a block/removal.
    const recipients = await chat.getDeliveryRecipients(conversationId);
    const sockets = recipients.flatMap(id => [...(online.get(id) || [])]);
    for (const socketId of sockets) {
      if (socketId !== excludeSocketId) io.to(socketId).emit(event, payload);
    }
  }

  async function emitMessage(message) {
    await chat.authorizeConversation(message.senderId, message.conversationId);
    const recipients = await chat.getDeliveryRecipients(message.conversationId);
    for (const id of recipients) io.to(userRoom(id)).emit('receiveMessage', message);
  }

  async function emitPostTyping(postId) {
    const entries = postTyping.get(postId) || new Map();
    const names = [...new Set([...entries.values()].map(entry => entry.username))];
    for (const socket of io.sockets.sockets.values()) {
      if (!socket.rooms.has(`post-${postId}`)) continue;
      try { await chat.authorizePost(socket.data.userId, postId); socket.emit('typingUpdate', { postId, typingUsers: names }); }
      catch (error) { if (error.code === 'FORBIDDEN') socket.leave(`post-${postId}`); else throw error; }
    }
  }

  function deleteTyping(map, key, socketId) {
    const entries = map.get(key);
    if (!entries?.delete(socketId)) return false;
    if (!entries.size) map.delete(key);
    return true;
  }

  io.on('connection', socket => {
    const { userId, profile } = socket.data;
    if (!online.has(userId)) online.set(userId, new Set());
    online.get(userId).add(socket.id);
    socket.join(userRoom(userId));
    metrics.connections++;
    io.emit('onlineCount', online.size);
    log('info', 'socket.connected', { activeUsers: online.size, activeSockets: io.engine.clientsCount });
    let expiryTimer;
    const armExpiry = () => {
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => {
        socket.emit('sessionExpired', { code: 'UNAUTHENTICATED' });
        socket.disconnect(true);
      }, Math.max(1, socket.data.expiresAt - now()));
      expiryTimer.unref?.();
    };
    armExpiry();

    function handle(event, category, handler) {
      socket.on(event, async (data, ack) => {
        const started = now();
        let acquired = false;
        try {
          if (closing) throw new ChatError('UNAVAILABLE', 'Server is restarting', 503);
          if (event !== 'auth:refresh' && socket.data.expiresAt <= now()) throw new ChatError('UNAUTHENTICATED', 'Session expired', 401);
          limiter.consume(userId, category);
          if ((inFlight.get(userId) || 0) >= 8) throw new ChatError('RATE_LIMITED', 'Wait for pending requests to finish', 429);
          inFlight.set(userId, (inFlight.get(userId) || 0) + 1); acquired = true;
          object(data);
          const result = await handler(data);
          metrics.events++;
          if (event === 'sendMessage') { metrics.messages++; metrics.messageLatencyMs += now() - started; }
          if (typeof ack === 'function') ack({ ok: true, ...result });
        } catch (error) {
          metrics.failures++;
          const known = error instanceof ChatError || (typeof error.code === 'string' && ['FORBIDDEN', 'INVALID_INPUT', 'CONFLICT', 'NOT_FOUND', 'RATE_LIMITED', 'UNAVAILABLE'].includes(error.code));
          const failure = known
            ? { code: error.code, message: error.message, ...(error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {}) }
            : clientDiagnostic(reportException(logger, 'socket.event_failed', error, { socketEvent: event }));
          if (known) log('info', 'socket.event_rejected', { socketEvent: event, code: failure.code });
          if (typeof ack === 'function') ack({ ok: false, error: failure });
          else socket.emit('messageError', { ...failure, error: failure.message });
        } finally {
          if (acquired) {
            const count = (inFlight.get(userId) || 1) - 1;
            if (count) inFlight.set(userId, count); else inFlight.delete(userId);
          }
        }
      });
    }

    handle('auth:refresh', 'auth', async ({ token }) => {
      const claims = await authenticate(token);
      if (claims.sub !== userId) throw new ChatError('UNAUTHENTICATED', 'Session changed', 401);
      socket.data.expiresAt = claims.exp * 1000;
      armExpiry();
      return {};
    });
    handle('sendMessage', 'message', async data => {
      const message = await chat.sendMessage(userId, data);
      await emitMessage(message);
      return { message };
    });
    handle('notifyMessage', 'message', async data => {
      const message = await chat.notifyMessage(userId, data);
      await emitMessage(message);
      return { message };
    });
    handle('joinConversation', 'join', async ({ conversationId }) => {
      const conversation = await chat.authorizeConversation(userId, conversationId);
      if (socket.rooms.size > 80) throw new ChatError('RATE_LIMITED', 'Too many joined rooms', 429);
      await socket.join(conversationRoom(conversationId));
      return { conversationId, presence: await chat.visiblePresence(conversation.participantIds.filter(id => online.has(id))) };
    });
    handle('leaveConversationRoom', 'join', async ({ conversationId }) => {
      positiveId(conversationId, 'conversation');
      await socket.leave(conversationRoom(conversationId));
      deleteTyping(chatTyping, conversationId, socket.id);
      return {};
    });
    handle('getMessages', 'read', async data => chat.getMessages(userId, data));
    handle('listConversations', 'read', async () => ({ conversations: await chat.listConversations(userId) }));
    handle('getPresence', 'read', async ({ conversationId }) => {
      const conversation = await chat.authorizeConversation(userId, conversationId);
      return { presence: await chat.visiblePresence(conversation.participantIds.filter(id => online.has(id))) };
    });
    handle('chatTyping', 'typing', async ({ conversationId, isTyping }) => {
      await chat.authorizeConversation(userId, conversationId);
      if (typeof isTyping !== 'boolean') throw new ChatError('INVALID_INPUT', 'Invalid typing state');
      if (!chatTyping.has(conversationId)) chatTyping.set(conversationId, new Map());
      if (isTyping) chatTyping.get(conversationId).set(socket.id, { userId, timestamp: now() });
      else deleteTyping(chatTyping, conversationId, socket.id);
      const active = [...(chatTyping.get(conversationId)?.values() || [])].some(entry => entry.userId === userId);
      await emitToConversation(conversationId, 'chatTyping', { conversationId, userId, isTyping: active }, socket.id);
      return {};
    });
    handle('markRead', 'read', async data => {
      const result = await chat.markRead(userId, data);
      await emitToConversation(result.conversationId, 'messagesRead', result);
      return result;
    });
    for (const event of ['editMessage', 'deleteMessage', 'reactMessage']) handle(event, 'mutation', async data => {
      const message = await chat[event](userId, data);
      await emitToConversation(message.conversationId, 'messageUpdated', message);
      return { message };
    });
    handle('createGroup', 'invitation', async data => {
      const conversation = await chat.createGroup(userId, data);
      for (const member of conversation.members) io.to(userRoom(member.userId)).emit('conversationsChanged', { conversationId: conversation.id });
      return { conversation };
    });
    handle('inviteMember', 'invitation', async data => {
      const member = await chat.inviteMember(userId, data);
      io.to(userRoom(member.userId)).emit('conversationsChanged', { conversationId: member.conversationId });
      return { member };
    });
    handle('respondInvite', 'invitation', async data => {
      const member = await chat.respondInvite(userId, data);
      io.to(userRoom(userId)).emit('conversationsChanged', { conversationId: data.conversationId });
      if (data.accept) await emitToConversation(data.conversationId, 'conversationsChanged', { conversationId: data.conversationId });
      return { member };
    });
    handle('updateMember', 'invitation', async data => {
      const member = await chat.updateMember(userId, data);
      if (data.remove) {
        await onMembershipRevoked?.(data.conversationId, data.memberId);
        io.in(userRoom(data.memberId)).socketsLeave(conversationRoom(data.conversationId));
        io.to(userRoom(data.memberId)).emit('conversationRemoved', { conversationId: data.conversationId });
      }
      await emitToConversation(data.conversationId, 'conversationsChanged', { conversationId: data.conversationId });
      return { member };
    });
    handle('leaveGroup', 'invitation', async data => {
      const result = await chat.leaveConversation(userId, data);
      await onMembershipRevoked?.(data.conversationId, userId);
      io.in(userRoom(userId)).socketsLeave(conversationRoom(data.conversationId));
      io.to(userRoom(userId)).emit('conversationRemoved', { conversationId: data.conversationId });
      await emitToConversation(data.conversationId, 'conversationsChanged', { conversationId: data.conversationId });
      return result;
    });
    handle('joinPost', 'join', async ({ postId }) => {
      await chat.authorizePost(userId, postId);
      if (socket.rooms.size > 80) throw new ChatError('RATE_LIMITED', 'Too many joined rooms', 429);
      await socket.join(`post-${postId}`);
      await emitPostTyping(postId);
      return {};
    });
    handle('leavePost', 'join', async ({ postId }) => {
      positiveId(postId, 'post');
      await socket.leave(`post-${postId}`);
      if (deleteTyping(postTyping, postId, socket.id)) await emitPostTyping(postId);
      return {};
    });
    handle('userTyping', 'typing', async ({ postId, isTyping }) => {
      await chat.authorizePost(userId, postId);
      if (!socket.rooms.has(`post-${postId}`) || typeof isTyping !== 'boolean') throw new ChatError('FORBIDDEN', 'Join the post first', 403);
      if (!postTyping.has(postId)) postTyping.set(postId, new Map());
      if (isTyping) postTyping.get(postId).set(socket.id, { userId, username: profile.username || 'Member', timestamp: now() });
      else deleteTyping(postTyping, postId, socket.id);
      await emitPostTyping(postId);
      return {};
    });
    handle('commentSubmitted', 'typing', async ({ postId }) => {
      await chat.authorizePost(userId, postId);
      if (deleteTyping(postTyping, postId, socket.id)) await emitPostTyping(postId);
      return {};
    });
    registerRoomEvents?.({ socket, io, chat, handle, userRoom, conversationRoom, emitToConversation, logger });
    socket.on('error', error => reportException(logger, 'socket.transport_error', error, { phase: 'transport' }));
    socket.on('disconnect', () => {
      clearTimeout(expiryTimer);
      online.get(userId)?.delete(socket.id);
      if (!online.get(userId)?.size) { online.delete(userId); }
      io.emit('onlineCount', online.size);
      for (const postId of postTyping.keys()) if (deleteTyping(postTyping, postId, socket.id)) emitPostTyping(postId).catch(error => reportException(logger, 'socket.typing_cleanup_failed', error, { phase: 'cleanup' }));
      for (const conversationId of chatTyping.keys()) if (deleteTyping(chatTyping, conversationId, socket.id)) {
        const stillTyping = [...(chatTyping.get(conversationId)?.values() || [])].some(entry => entry.userId === userId);
        if (!stillTyping) emitToConversation(conversationId, 'chatTyping', { conversationId, userId, isTyping: false }).catch(error => reportException(logger, 'socket.typing_cleanup_failed', error, { phase: 'cleanup' }));
      }
      log('info', 'socket.disconnected', { activeUsers: online.size, activeSockets: io.engine.clientsCount });
    });
  });
  const cleanup = setInterval(() => {
    limiter.sweep();
    Promise.resolve().then(() => sweepRooms?.()).catch(error => reportException(logger, 'rooms.sweep_failed', error, { phase: 'sweep' }));
    for (const [postId, entries] of postTyping) {
      let changed = false;
      for (const [socketId, entry] of entries) if (now() - entry.timestamp > 7000) changed = deleteTyping(postTyping, postId, socketId) || changed;
      if (changed) emitPostTyping(postId).catch(error => reportException(logger, 'socket.typing_cleanup_failed', error, { phase: 'cleanup' }));
    }
    for (const [conversationId, entries] of chatTyping) for (const [socketId, entry] of entries) if (now() - entry.timestamp > 7000) {
      deleteTyping(chatTyping, conversationId, socketId);
      if (![...(chatTyping.get(conversationId)?.values() || [])].some(other => other.userId === entry.userId)) {
        emitToConversation(conversationId, 'chatTyping', { conversationId, userId: entry.userId, isTyping: false }).catch(error => reportException(logger, 'socket.typing_cleanup_failed', error, { phase: 'cleanup' }));
      }
    }
  }, 5000);
  cleanup.unref();
  const diagnostics = setInterval(() => log('info', 'socket.metrics', { ...metrics,
    activeUsers: online.size, activeSockets: io.engine.clientsCount,
    meanMessageLatencyMs: metrics.messages ? Math.round(metrics.messageLatencyMs / metrics.messages) : 0,
  }), 60_000);
  diagnostics.unref();

  return {
    io, httpServer, metrics,
    listen(port = 3001, host = '0.0.0.0') { return new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(port, host, () => { httpServer.off('error', reject); resolve(httpServer.address()); }); }); },
    async close() {
      closing = true;
      clearInterval(cleanup); clearInterval(diagnostics);
      await closeRooms?.();
      await new Promise(resolve => io.close(resolve));
      httpServer.closeAllConnections?.();
    },
  };
}
module.exports = { createSocketApp, createRateLimiter, DEFAULT_LIMITS, userRoom, conversationRoom };
