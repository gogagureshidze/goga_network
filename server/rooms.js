const { randomUUID } = require('node:crypto');
const { ChatError, positiveId, object } = require('./chat-service');

const callInclude = { conversation: { select: { kind: true } }, participants: { include: { user: { select: { id: true, username: true, avatar: true } } } } };
const activeStatuses = ['RINGING', 'ACTIVE'];
const denied = () => { throw new ChatError('FORBIDDEN', 'Room is unavailable', 403); };
const invalid = message => { throw new ChatError('INVALID_INPUT', message); };
const roomId = value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) invalid('Invalid room'); return value; };
const device = value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) invalid('A valid device identifier is required'); return value; };
const versionValue = value => { if (!Number.isSafeInteger(value) || value < 0) invalid('Invalid playback version'); return value; };

function createRoomService({ prisma, chat, now = Date.now, livekit, env = process.env }) {
  const groupLimit = Math.min(4, Math.max(2, Number(env.GROUP_CALL_MAX_PARTICIPANTS) || 4));
  const maxDuration = Math.min(4 * 60 * 60_000, Math.max(60_000, Number(env.CALL_MAX_DURATION_MS) || 2 * 60 * 60_000));
  const watchHosts = new Set((env.WATCH_ALLOWED_HOSTS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
  const watchMembers = new Map(); // party -> socket -> user; authoritative playback is persisted.
  const callConnections = new Map(); // call/user/device -> currently connected sockets.
  const disconnectTimers = new Map();
  let publish = async () => {};
  let revoke = async () => {};
  let sweeping = false;
  let callCursor = null;
  let partyCursor = null;
  const timestamp = () => new Date(now());
  const callView = call => ({ ...call, transport: call.conversation?.kind === 'GROUP' ? 'livekit' : 'p2p', serverTime: now() });
  const partyView = party => ({ ...party, serverTime: now(), participants: [...new Set([...(watchMembers.get(party.id)?.values() || [])])] });
  const groupEnabled = () => env.ENABLE_GROUP_CALLS === 'true' && env.GROUP_CALL_SECURITY_REVIEWED === 'true' && !!livekit;
  const connectionKey = (callId, userId, deviceId) => JSON.stringify([callId, userId, deviceId]);
  async function lockConversation(tx, userId, conversationId) {
    await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: timestamp() } });
    return chat.authorizeConversation(userId, conversationId, tx);
  }

  async function readCall(id) {
    const call = await prisma.callSession.findUnique({ where: { id: roomId(id) }, include: callInclude });
    if (!call) denied();
    return call;
  }
  async function getCall(userId, id) {
    const call = await readCall(id);
    await chat.authorizeConversation(userId, call.conversationId);
    if (!call.participants.some(member => member.userId === userId)) denied();
    return callView(call);
  }
  async function authorizeCall(userId, id, deviceId) {
    const call = await getCall(userId, id);
    const member = call.participants.find(member => member.userId === userId);
    if (!activeStatuses.includes(call.status) || new Date(call.expiresAt).getTime() <= now() || member?.status !== 'JOINED') denied();
    if (deviceId !== undefined && member.deviceId && member.deviceId !== device(deviceId)) denied();
    if (call.transport === 'livekit' && !groupEnabled()) throw new ChatError('UNAVAILABLE', 'Group calling is disabled', 503);
    return call;
  }
  async function initiate(userId, input) {
    object(input);
    if (!['AUDIO', 'VIDEO'].includes(input.kind)) invalid('Choose an audio or video call');
    const deviceId = device(input.deviceId);
    const conversation = input.conversationId
      ? await chat.authorizeConversation(userId, input.conversationId)
      : await chat.getOrCreateDirect(userId, input.receiverId);
    if (conversation.kind === 'GROUP' && !groupEnabled()) throw new ChatError('UNAVAILABLE', 'Group calling requires the configured media server', 503);
    if (conversation.kind === 'GROUP' && conversation.participantIds.length > groupLimit) invalid(`Group calls are limited to ${groupLimit} members on this server`);
    if (conversation.participantIds.length < 2) invalid('Invite another member first');
    const call = await prisma.$transaction(async tx => {
      // Serialize competing initiations on the durable conversation row.
      const currentConversation = await lockConversation(tx, userId, conversation.id);
      if (currentConversation.kind === 'GROUP' && currentConversation.participantIds.length > groupLimit) invalid(`Group calls are limited to ${groupLimit} members on this server`);
      if (currentConversation.participantIds.length < 2) invalid('Invite another member first');
      const existing = await tx.callSession.findFirst({ where: { conversationId: conversation.id, status: { in: activeStatuses }, expiresAt: { gt: timestamp() } } });
      if (existing) throw new ChatError('CONFLICT', 'This conversation already has a call', 409);
      return tx.callSession.create({ data: {
        id: randomUUID(), conversationId: conversation.id, initiatorId: userId, kind: input.kind,
        roomName: `goga-${randomUUID()}`, status: 'RINGING', expiresAt: new Date(now() + 45_000),
        participants: { create: currentConversation.participantIds.map(id => ({ userId: id, status: id === userId ? 'JOINED' : 'INVITED', joinedAt: id === userId ? timestamp() : null, deviceId: id === userId ? deviceId : null })) },
      }, include: callInclude });
    });
    return callView(call);
  }
  async function lockCall(tx, call) {
    // Same row lock also coordinates respond/leave/expiry in concurrent requests.
    await tx.callSession.update({ where: { id: call.id }, data: { roomName: call.roomName } });
    return tx.callSession.findUnique({ where: { id: call.id }, include: callInclude });
  }
  async function respond(userId, input) {
    object(input);
    if (typeof input.accept !== 'boolean') invalid('Invalid response');
    const call = await getCall(userId, input.callId);
    const deviceId = device(input.deviceId);
    if (call.transport === 'livekit' && !groupEnabled()) throw new ChatError('UNAVAILABLE', 'Group calling is disabled', 503);
    const result = await prisma.$transaction(async tx => {
      await lockConversation(tx, userId, call.conversationId);
      const current = await lockCall(tx, call);
      if (!activeStatuses.includes(current.status) || new Date(current.expiresAt).getTime() <= now()) denied();
      const participant = current.participants.find(member => member.userId === userId);
      if (!participant || !['INVITED', 'JOINED'].includes(participant.status)) denied();
      if (participant.status === 'JOINED') {
        if (participant.deviceId !== deviceId) throw new ChatError('CONFLICT', 'This call is active on another device', 409);
        if (!input.accept) denied();
        return current;
      }
      await tx.callParticipant.update({ where: { callId_userId: { callId: call.id, userId } }, data: input.accept
        ? { status: 'JOINED', joinedAt: timestamp(), leftAt: null, deviceId }
        : { status: 'REJECTED', leftAt: timestamp(), deviceId: null } });
      if (input.accept) {
        await tx.callSession.update({ where: { id: call.id }, data: { status: 'ACTIVE', startedAt: current.startedAt || timestamp(), expiresAt: current.startedAt ? current.expiresAt : new Date(now() + maxDuration) } });
      } else if (call.transport === 'p2p' || !current.participants.some(member => member.userId !== userId && member.status === 'INVITED')) {
        const joinedCount = current.participants.filter(member => member.status === 'JOINED').length;
        if (joinedCount < 2) await endInTransaction(tx, current, 'ENDED');
      }
      return tx.callSession.findUnique({ where: { id: call.id }, include: callInclude });
    });
    if (!activeStatuses.includes(result.status)) await closeMediaRoom(result);
    return callView(result);
  }
  async function endInTransaction(tx, call, status) {
    await tx.callParticipant.updateMany({ where: { callId: call.id, status: { in: ['JOINED', 'INVITED'] } }, data: { status: 'LEFT', leftAt: timestamp() } });
    await tx.callSession.update({ where: { id: call.id }, data: { status, endedAt: timestamp() } });
  }
  async function mediaOperation(operation) {
    try { await operation(); }
    catch (error) {
      // Removal/room deletion is idempotent when LiveKit already cleaned it up.
      if (error.status !== 404 && error.statusCode !== 404 && error.code !== 'not_found') throw error;
    }
  }
  async function closeMediaRoom(call) {
    if (!activeStatuses.includes(call.status) && call.conversation?.kind === 'GROUP' && livekit) await mediaOperation(() => livekit.deleteRoom(call.roomName));
  }
  async function leave(userId, input) {
    object(input);
    const call = await getCall(userId, input.callId);
    const member = call.participants.find(member => member.userId === userId);
    if (member?.deviceId && member.deviceId !== device(input.deviceId)) denied();
    return leaveInternal(call, userId);
  }
  async function leaveInternal(call, userId) {
    const result = await prisma.$transaction(async tx => {
      await tx.conversation.update({ where: { id: call.conversationId }, data: { updatedAt: timestamp() } });
      const current = await lockCall(tx, call);
      if (!activeStatuses.includes(current.status)) return current;
      await tx.callParticipant.updateMany({ where: { callId: call.id, userId, status: { in: ['JOINED', 'INVITED'] } }, data: { status: 'LEFT', leftAt: timestamp() } });
      const remaining = current.participants.filter(member => member.userId !== userId && member.status === 'JOINED');
      if (call.conversation?.kind !== 'GROUP' || !remaining.length || (current.status === 'RINGING' && current.initiatorId === userId)) await endInTransaction(tx, current, 'ENDED');
      return tx.callSession.findUnique({ where: { id: call.id }, include: callInclude });
    });
    if (call.conversation?.kind === 'GROUP' && livekit) {
      if (activeStatuses.includes(result.status)) await mediaOperation(() => livekit.removeParticipant(call.roomName, userId));
      else await closeMediaRoom(result);
    }
    return callView(result);
  }
  async function validateSignal(userId, input) {
    object(input);
    const call = await authorizeCall(userId, input.callId, device(input.deviceId));
    if (call.transport !== 'p2p') invalid('Use the media server for group calls');
    if (input.toUserId === userId || typeof input.toUserId !== 'string') invalid('Invalid recipient');
    const recipient = call.participants.find(member => member.userId === input.toUserId && member.status === 'JOINED');
    if (!recipient) denied();
    await chat.authorizeConversation(input.toUserId, call.conversationId);
    const payload = { callId: call.id, fromUserId: userId, fromDeviceId: input.deviceId, toDeviceId: recipient.deviceId };
    if (input.ready === true) payload.ready = true;
    if (input.description !== undefined) {
      object(input.description);
      const { type, sdp } = input.description;
      if (!['offer', 'answer'].includes(type) || typeof sdp !== 'string' || sdp.length > 48_000) invalid('Invalid session description');
      if ((type === 'offer') !== (userId === call.initiatorId)) denied();
      payload.description = { type, sdp };
    }
    if (input.candidate !== undefined) {
      object(input.candidate);
      const { candidate, sdpMid, sdpMLineIndex } = input.candidate;
      if (typeof candidate !== 'string' || candidate.length > 4000 || (sdpMid != null && (typeof sdpMid !== 'string' || sdpMid.length > 64)) || (sdpMLineIndex != null && (!Number.isSafeInteger(sdpMLineIndex) || sdpMLineIndex < 0 || sdpMLineIndex > 100))) invalid('Invalid ICE candidate');
      payload.candidate = { candidate, sdpMid: sdpMid ?? null, sdpMLineIndex: sdpMLineIndex ?? null };
    }
    if (!payload.ready && !payload.description && !payload.candidate) invalid('Empty signal');
    return { call, payload, toUserId: input.toUserId };
  }
  function validateSource(sourceUrl) {
    if (typeof sourceUrl !== 'string' || sourceUrl.length > 2048) invalid('Invalid media URL');
    let url;
    try { url = new URL(sourceUrl); } catch { invalid('Invalid media URL'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !watchHosts.has(url.hostname.toLowerCase())) invalid('Use an approved HTTPS media host');
    if (!/\.(mp4|webm|ogg|ogv)(?:$)/i.test(url.pathname)) invalid('Use a direct supported video file');
    return url.href;
  }
  async function createWatch(userId, input) {
    object(input);
    if (input.authorized !== true) invalid('Confirm you are authorized to share this media');
    const conversation = await chat.authorizeConversation(userId, input.conversationId);
    const sourceUrl = validateSource(input.sourceUrl);
    const title = input.title === undefined ? 'Watch party' : input.title;
    if (typeof title !== 'string' || !title.trim() || title.length > 100) invalid('Invalid title');
    const party = await prisma.$transaction(async tx => {
      await lockConversation(tx, userId, conversation.id);
      const existing = await tx.watchParty.findFirst({ where: { conversationId: conversation.id, endedAt: null } });
      if (existing) throw new ChatError('CONFLICT', 'This conversation already has a watch party', 409);
      return tx.watchParty.create({ data: { conversationId: conversation.id, hostId: userId, sourceUrl, title: title.trim(), updatedAt: timestamp() } });
    });
    return partyView(party);
  }
  async function getWatch(userId, partyId) {
    const party = await prisma.watchParty.findUnique({ where: { id: roomId(partyId) } });
    if (!party || party.endedAt) denied();
    await chat.authorizeConversation(userId, party.conversationId);
    return partyView(party);
  }
  function projectedPosition(party) {
    return Math.max(0, party.position + (party.playing ? Math.max(0, now() - new Date(party.updatedAt).getTime()) / 1000 : 0));
  }
  async function controlWatch(userId, input) {
    object(input);
    const initial = await getWatch(userId, input.partyId);
    const version = versionValue(input.version);
    const result = await prisma.$transaction(async tx => {
    await lockConversation(tx, userId, initial.conversationId);
    const party = await tx.watchParty.findUnique({ where: { id: initial.id } });
    if (!party || party.endedAt) denied();
    const host = party.hostId === userId;
    const data = { updatedAt: timestamp(), version: { increment: 1 } };
    const action = input.action;
    if (['play', 'pause', 'seek'].includes(action)) {
      if (!host && !party.collaborative) denied();
      if (input.position !== undefined && (typeof input.position !== 'number' || !Number.isFinite(input.position) || input.position < 0 || input.position > 24 * 60 * 60)) invalid('Invalid playback position');
      if (action === 'seek' && input.position === undefined) invalid('Seek position required');
      data.position = input.position ?? projectedPosition(party);
      data.playing = action === 'play' ? true : action === 'pause' ? false : party.playing;
    } else if (action === 'collaborative') {
      if (!host) denied();
      if (typeof input.collaborative !== 'boolean') invalid('Invalid collaboration setting');
      data.collaborative = input.collaborative;
      data.position = projectedPosition(party);
    } else if (action === 'host') {
      if (!host || typeof input.hostId !== 'string') denied();
      await chat.authorizeConversation(input.hostId, party.conversationId, tx);
      data.hostId = input.hostId;
      data.position = projectedPosition(party);
    } else invalid('Invalid playback action');
    const changed = await tx.watchParty.updateMany({ where: { id: party.id, version, endedAt: null, hostId: party.hostId }, data });
    if (!changed.count) throw new ChatError('CONFLICT', 'Playback changed; refresh the room state', 409);
    return tx.watchParty.findUnique({ where: { id: party.id } });
    });
    return partyView(result);
  }
  async function endWatch(userId, input) {
    const initial = await getWatch(userId, input.partyId);
    const result = await prisma.$transaction(async tx => {
      await lockConversation(tx, userId, initial.conversationId);
      const party = await tx.watchParty.findUnique({ where: { id: initial.id } });
      if (!party || party.endedAt || party.hostId !== userId) denied();
      const changed = await tx.watchParty.updateMany({ where: { id: party.id, version: versionValue(input.version), endedAt: null, hostId: userId }, data: { endedAt: timestamp(), playing: false, position: projectedPosition(party), updatedAt: timestamp(), version: { increment: 1 } } });
      if (!changed.count) throw new ChatError('CONFLICT', 'Playback changed; refresh the room state', 409);
      return tx.watchParty.findUnique({ where: { id: party.id } });
    });
    watchMembers.delete(initial.id);
    return partyView(result);
  }
  async function sync(userId, conversationId) {
    await chat.authorizeConversation(userId, positiveId(conversationId, 'conversation'));
    const [call, party] = await Promise.all([
      prisma.callSession.findFirst({ where: { conversationId, status: { in: activeStatuses }, expiresAt: { gt: timestamp() }, participants: { some: { userId } } }, orderBy: { createdAt: 'desc' }, include: callInclude }),
      prisma.watchParty.findFirst({ where: { conversationId, endedAt: null }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { call: call ? callView(call) : null, party: party ? partyView(party) : null };
  }
  async function joinWatch(userId, partyId, socketId) {
    const party = await getWatch(userId, partyId);
    if ([...watchMembers.values()].filter(members => members.has(socketId)).length >= 4 && !watchMembers.get(party.id)?.has(socketId)) throw new ChatError('RATE_LIMITED', 'Leave an existing watch room first', 429);
    if (!watchMembers.has(party.id)) watchMembers.set(party.id, new Map());
    const members = watchMembers.get(party.id);
    if (members.size >= 64 && !members.has(socketId)) throw new ChatError('RATE_LIMITED', 'Watch room is full', 429);
    members.set(socketId, userId);
    return partyView(party);
  }
  async function leaveWatch(userId, partyId, socketId) {
    roomId(partyId);
    const members = watchMembers.get(partyId);
    // Removing only this socket's own presence is safe even after access was revoked.
    if (members?.get(socketId) === userId) members.delete(socketId);
    if (members && !members.size) watchMembers.delete(partyId);
    const party = await prisma.watchParty.findUnique({ where: { id: partyId } });
    if (party && !party.endedAt) await publish(party.conversationId, 'watchUpdated', { party: partyView(party) });
    return {};
  }
  async function attachCall(userId, callId, deviceId, socketId) {
    const call = await authorizeCall(userId, callId, deviceId);
    const key = connectionKey(callId, userId, deviceId);
    clearTimeout(disconnectTimers.get(key)); disconnectTimers.delete(key);
    if (!callConnections.has(key)) callConnections.set(key, new Set());
    callConnections.get(key).add(socketId);
    return call;
  }
  async function disconnected(socketId) {
    for (const [partyId, members] of watchMembers) {
      if (!members.delete(socketId)) continue;
      if (!members.size) watchMembers.delete(partyId);
      const party = await prisma.watchParty.findUnique({ where: { id: partyId } });
      if (party && !party.endedAt) await publish(party.conversationId, 'watchUpdated', { party: partyView(party) });
    }
    for (const [key, sockets] of callConnections) {
      if (!sockets.delete(socketId) || sockets.size) continue;
      callConnections.delete(key);
      const [callId, userId, deviceId] = JSON.parse(key);
      const timer = setTimeout(async () => {
        disconnectTimers.delete(key);
        try {
          const call = await readCall(callId);
          const member = call.participants.find(member => member.userId === userId);
          if (member?.status === 'JOINED' && member.deviceId === deviceId && !callConnections.has(key)) {
            const result = await leaveInternal(call, userId);
            await publish(result.conversationId, 'callUpdated', { call: result });
          }
        } catch { /* The periodic sweeper still expires durable abandoned sessions. */ }
      }, 20_000);
      timer.unref?.(); disconnectTimers.set(key, timer);
    }
  }
  async function onMembershipRevoked(conversationId, userId) {
    const calls = await prisma.callSession.findMany({ where: { conversationId, status: { in: activeStatuses }, participants: { some: { userId, status: { in: ['JOINED', 'INVITED'] } } } }, include: callInclude });
    const changedCalls = [];
    for (const call of calls) {
      // Revocation must reach the removed endpoint even though normal delivery
      // deliberately excludes identities whose conversation access was revoked.
      await revoke(userId, { callId: call.id, conversationId });
      const result = await leaveInternal(call, userId); changedCalls.push(result);
      await publish(conversationId, 'callUpdated', { call: result });
    }
    const parties = await prisma.watchParty.findMany({ where: { conversationId, endedAt: null } });
    const recipients = await chat.getDeliveryRecipients(conversationId);
    const changedParties = [];
    for (const party of parties) {
      const members = watchMembers.get(party.id);
      for (const [socketId, memberId] of members || []) if (memberId === userId) members.delete(socketId);
      if (party.hostId === userId) {
        const successor = recipients.filter(id => id !== userId).sort()[0];
        const data = successor ? { hostId: successor, position: projectedPosition(party), updatedAt: timestamp(), version: { increment: 1 } }
          : { endedAt: timestamp(), playing: false, updatedAt: timestamp(), version: { increment: 1 } };
        await prisma.watchParty.updateMany({ where: { id: party.id, version: party.version, hostId: userId, endedAt: null }, data });
      }
      const result = partyView(await prisma.watchParty.findUnique({ where: { id: party.id } }));
      changedParties.push(result); await publish(conversationId, 'watchUpdated', { party: result });
    }
    return { calls: changedCalls, parties: changedParties };
  }
  async function sweep() {
    if (sweeping) return;
    sweeping = true;
    try {
      const calls = await prisma.callSession.findMany({ where: { status: { in: activeStatuses } }, include: callInclude, take: 100, orderBy: { id: 'asc' }, ...(callCursor ? { cursor: { id: callCursor }, skip: 1 } : {}) });
      callCursor = calls.length === 100 ? calls[calls.length - 1].id : null;
      for (const call of calls) {
        if (new Date(call.expiresAt).getTime() <= now()) {
          const result = await prisma.$transaction(async tx => {
            const current = await lockCall(tx, call);
            if (activeStatuses.includes(current.status) && new Date(current.expiresAt).getTime() <= now()) await endInTransaction(tx, current, current.status === 'RINGING' ? 'MISSED' : 'ENDED');
            return tx.callSession.findUnique({ where: { id: call.id }, include: callInclude });
          });
          await closeMediaRoom(result);
          await publish(call.conversationId, 'callUpdated', { call: callView(result) });
          continue;
        }
        for (const member of call.participants.filter(member => ['JOINED', 'INVITED'].includes(member.status))) {
          try { await chat.authorizeConversation(member.userId, call.conversationId); }
          catch (error) { if (error.code === 'FORBIDDEN') await onMembershipRevoked(call.conversationId, member.userId); else throw error; }
        }
      }
      const parties = await prisma.watchParty.findMany({ where: { endedAt: null }, take: 100, orderBy: { id: 'asc' }, ...(partyCursor ? { cursor: { id: partyCursor }, skip: 1 } : {}) });
      partyCursor = parties.length === 100 ? parties[parties.length - 1].id : null;
      for (const party of parties) {
        try { await chat.authorizeConversation(party.hostId, party.conversationId); }
        catch (error) {
          if (error.code === 'FORBIDDEN') { await onMembershipRevoked(party.conversationId, party.hostId); continue; }
          throw error;
        }
        const participants = watchMembers.get(party.id);
        if (!participants?.size) continue;
        const authorized = new Set(await chat.getDeliveryRecipients(party.conversationId));
        let changed = false;
        for (const [socketId, userId] of participants) if (!authorized.has(userId)) { participants.delete(socketId); changed = true; }
        if (changed) await publish(party.conversationId, 'watchUpdated', { party: partyView(party) });
      }
    } finally { sweeping = false; }
  }
  function close() { for (const timer of disconnectTimers.values()) clearTimeout(timer); disconnectTimers.clear(); callConnections.clear(); watchMembers.clear(); }
  return { initiate, respond, leave, getCall, authorizeCall, validateSignal, createWatch, getWatch, controlWatch, endWatch, sync, joinWatch, leaveWatch, attachCall, disconnected, onMembershipRevoked, sweep, close,
    setPublisher(fn) { publish = fn; }, setRevoker(fn) { revoke = fn; } };
}

function createRoomRegistrar(service) {
  return ({ socket, io, handle, userRoom, emitToConversation }) => {
    const userId = socket.data.userId;
    service.setPublisher(emitToConversation);
    service.setRevoker((revokedUserId, payload) => io.to(userRoom(revokedUserId)).emit('callRevoked', payload));
    const callUpdated = async call => { await emitToConversation(call.conversationId, 'callUpdated', { call }); return { call }; };
    const watchUpdated = async party => { await emitToConversation(party.conversationId, 'watchUpdated', { party }); return { party }; };
    handle('call:start', 'invitation', async input => {
      const call = await service.initiate(userId, input);
      await service.attachCall(userId, call.id, input.deviceId, socket.id);
      return callUpdated(call);
    });
    handle('call:respond', 'invitation', async input => {
      const call = await service.respond(userId, input);
      if (input.accept) await service.attachCall(userId, call.id, input.deviceId, socket.id);
      return callUpdated(call);
    });
    handle('call:leave', 'mutation', async input => callUpdated(await service.leave(userId, input)));
    handle('call:state', 'read', async input => {
      const call = await service.getCall(userId, input.callId);
      const participant = call.participants.find(member => member.userId === userId);
      if (participant?.status === 'JOINED' && input.deviceId === participant.deviceId && activeStatuses.includes(call.status)) await service.attachCall(userId, call.id, input.deviceId, socket.id);
      return { call };
    });
    handle('call:signal', 'signal', async input => {
      const { payload, toUserId } = await service.validateSignal(userId, input);
      io.to(userRoom(toUserId)).emit('callSignal', payload);
      return {};
    });
    handle('watch:create', 'invitation', async input => {
      const party = await service.createWatch(userId, input);
      return watchUpdated(await service.joinWatch(userId, party.id, socket.id));
    });
    handle('watch:join', 'join', async input => watchUpdated(await service.joinWatch(userId, input.partyId, socket.id)));
    handle('watch:leave', 'join', async input => service.leaveWatch(userId, input.partyId, socket.id));
    handle('watch:control', 'mutation', async input => watchUpdated(await service.controlWatch(userId, input)));
    handle('watch:end', 'mutation', async input => watchUpdated(await service.endWatch(userId, input)));
    handle('session:sync', 'read', async input => service.sync(userId, input.conversationId));
    socket.on('disconnect', () => { service.disconnected(socket.id).catch(() => {}); });
  };
}

module.exports = { createRoomService, createRoomRegistrar };
