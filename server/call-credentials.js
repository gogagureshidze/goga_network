const { createHash, createHmac, randomBytes } = require('node:crypto');
const { AccessToken, TrackSource } = require('livekit-server-sdk');
const { ChatError } = require('./chat-service');

function getLiveKitUrl(env = process.env) {
  let url;
  try { url = new URL(env.LIVEKIT_URL); } catch { throw new ChatError('UNAVAILABLE', 'Media server is not configured', 503); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'wss:' && !(env.NODE_ENV !== 'production' && local && url.protocol === 'ws:'))) throw new ChatError('UNAVAILABLE', 'A secure media server URL is required', 503);
  return url.href.replace(/\/$/, '');
}

function createCallCredentials({ rooms, env = process.env, now = Date.now, Token = AccessToken }) {
  const requests = new Map();
  function consume(userId) {
    if (typeof userId !== 'string' || !userId) throw new ChatError('UNAUTHENTICATED', 'Sign in required', 401);
    const time = now();
    for (const [key, value] of requests) if (value.until <= time) requests.delete(key);
    let bucket = requests.get(userId);
    if (!bucket) {
      if (requests.size >= 10_000) throw new ChatError('UNAVAILABLE', 'Try again shortly', 503);
      bucket = { count: 0, until: time + 60_000 }; requests.set(userId, bucket);
    }
    if (++bucket.count > 30) throw new ChatError('RATE_LIMITED', 'Too many credential requests', 429);
  }
  async function authorize(userId, callId, deviceId) {
    consume(userId);
    if (typeof deviceId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(deviceId)) throw new ChatError('INVALID_INPUT', 'Device identifier required');
    const call = await rooms.authorizeCall(userId, callId, deviceId);
    // Defense in depth: also enforce binding when a service adapter is supplied.
    const participant = call.participants.find(member => member.userId === userId);
    if (participant?.status !== 'JOINED' || participant.deviceId !== deviceId) throw new ChatError('FORBIDDEN', 'Call unavailable', 403);
    return call;
  }
  /** @param {{media?: 'main'|'screen', leaseId?: string}} [options] */
  async function issueToken(userId, callId, deviceId, options = {}) {
    const { media = 'main', leaseId } = options;
    const call = await authorize(userId, callId, deviceId);
    if (env.ENABLE_GROUP_CALLS !== 'true' || env.GROUP_CALL_SECURITY_REVIEWED !== 'true' || call.transport !== 'livekit' || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) throw new ChatError('UNAVAILABLE', 'Group calling is not enabled', 503);
    const serverUrl = getLiveKitUrl(env);
    const prepared = await rooms.prepareMediaRoom(userId, callId, deviceId, { media, leaseId });
    const token = new Token(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, { identity: userId,
      name: prepared.call.participants.find(member => member.userId === userId)?.user?.username || 'Participant', ttl: 30 });
    token.addGrant({ room: prepared.roomName, roomJoin: true, canSubscribe: true, canPublish: prepared.canPublish,
      canPublishSources: !prepared.canPublish ? [] : media === 'screen'
        ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [TrackSource.MICROPHONE, TrackSource.CAMERA],
      canPublishData: false, canUpdateOwnMetadata: false, roomAdmin: false, roomCreate: false, roomList: false, roomRecord: false, ingressAdmin: false });
    return { token: await token.toJwt(), serverUrl, expiresAt: now() + 30_000, roomName: prepared.roomName,
      mediaVersion: prepared.call.mediaVersion, screenVersion: prepared.call.screenVersion, leaseId: prepared.leaseId,
      canPublish: prepared.canPublish, media };
  }
  function urls(value, kind) {
    const values = (value || '').split(',').map(url => url.trim()).filter(Boolean);
    if (values.length > 8 || values.some(url => url.length > 256 || !(kind === 'stun'
      ? /^stuns?:[a-zA-Z0-9.[\]:-]+$/
      : /^turns?:[a-zA-Z0-9.[\]:-]+(?:\?transport=(?:udp|tcp))?$/).test(url))) throw new ChatError('UNAVAILABLE', 'ICE server configuration is invalid', 503);
    return values;
  }
  async function issueIce(userId, callId, deviceId) {
    const call = await authorize(userId, callId, deviceId);
    if (call.transport !== 'p2p') throw new ChatError('INVALID_INPUT', 'Use the media server for this call');
    const stunUrls = urls(env.RTC_STUN_URLS, 'stun');
    const turnUrls = urls(env.TURN_URLS, 'turn');
    const expiresAt = now() + 5 * 60_000;
    const iceServers = stunUrls.length ? [{ urls: stunUrls }] : [];
    if (turnUrls.length) {
      if (!env.TURN_SHARED_SECRET || env.TURN_SHARED_SECRET.length < 16) throw new ChatError('UNAVAILABLE', 'TURN credentials are not configured', 503);
      const identity = createHash('sha256').update(userId).digest('hex').slice(0, 16);
      const username = `${Math.floor(expiresAt / 1000)}:${identity}:${randomBytes(8).toString('hex')}`;
      const credential = createHmac('sha1', env.TURN_SHARED_SECRET).update(username).digest('base64');
      iceServers.push({ urls: turnUrls, username, credential });
    }
    return { iceServers, expiresAt, relayAvailable: turnUrls.length > 0 };
  }
  return { issueToken, issueIce };
}

module.exports = { createCallCredentials, getLiveKitUrl };
