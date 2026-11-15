// Explicit local SFU opt-in. No .env, database, Clerk account, or real device.
// See docs/GROUP-CALLS.md. Persistence/authorization are tested separately in MySQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');
const { createCallCredentials } = require('../server/call-credentials');
if (process.env.GOGA_LOCAL_SFU_TEST !== 'true') throw new Error('Explicit GOGA_LOCAL_SFU_TEST=true is required');
if (!process.env.GOGA_RTC_NODE_TEST_MODULE?.startsWith('/')) throw new Error('Set an absolute path to the isolated rtc-node test dependency');
const rtc = require(process.env.GOGA_RTC_NODE_TEST_MODULE);
const env = { NODE_ENV: 'test', ENABLE_GROUP_CALLS: 'true', GROUP_CALL_SECURITY_REVIEWED: 'true',
  LIVEKIT_URL: 'ws://127.0.0.1:17880', LIVEKIT_API_KEY: 'goga-local-test',
  LIVEKIT_API_SECRET: 'goga-local-test-secret-not-for-production-00000000' };
const api = new RoomServiceClient('http://127.0.0.1:17880', env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
const bounded = (promise, label, ms = 15000) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); })]).finally(() => clearTimeout(timer));
};
async function eventually(check, label) {
  for (let i = 0; i < 80; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.fail(label);
}

test('real local LiveKit enforces source grants, three participants and isolated sharing epochs', { timeout: 120000 }, async t => {
  const prefix = `goga-sfu-${randomUUID()}`;
  const names = [0, 1, 2].map(i => `${prefix}-${i}`);
  const connected = [], tracks = [], pumps = [], readers = [];
  const call = { id: prefix, roomName: names[0], transport: 'livekit', mediaVersion: 0, screenVersion: 1,
    participants: ['alice', 'bob', 'carol'].map(userId => ({ userId, status: 'JOINED', deviceId: `${userId}-device`, user: { username: userId } })) };
  let screenRoom = names[1], lease = 'lease-one', owner = 'alice';
  const credentials = createCallCredentials({ env, rooms: {
    authorizeCall: async (userId, _id, deviceId) => {
      assert.ok(call.participants.some(p => p.userId === userId && p.deviceId === deviceId)); return call;
    },
    prepareMediaRoom: async (userId, _id, _device, { media, leaseId }) => {
      if (media === 'screen') assert.equal(leaseId, lease);
      const roomName = media === 'screen' ? screenRoom : call.roomName;
      const prepared = await api.createRoom({ name: roomName, maxParticipants: 3, emptyTimeout: 60, departureTimeout: 30 });
      assert.equal(prepared.maxParticipants, 3);
      return { call, roomName, canPublish: media !== 'screen' || userId === owner, leaseId: media === 'screen' ? lease : null };
    },
  } });
  async function token(userId, media = 'main') {
    return credentials.issueToken(userId, call.id, `${userId}-device`, { media, leaseId: media === 'screen' ? lease : undefined });
  }
  async function join(value) {
    const room = new rtc.Room(); connected.push(room);
    await bounded(room.connect(value.serverUrl, value.token), 'SFU connection'); return room;
  }
  async function publish(room, kind, source) {
    const input = kind === 'audio' ? new rtc.AudioSource(48000, 1) : new rtc.VideoSource(64, 64);
    const track = kind === 'audio' ? rtc.LocalAudioTrack.createAudioTrack('synthetic audio', input) : rtc.LocalVideoTrack.createVideoTrack('synthetic video', input);
    tracks.push(track);
    const result = await bounded(room.localParticipant.publishTrack(track, new rtc.TrackPublishOptions({ source })), 'Track publication', 5000);
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return; busy = true;
      try {
        if (kind === 'audio') {
          const data = new Int16Array(960); for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.sin(i * Math.PI * 2 * 440 / 48000) * 2000);
          await input.captureFrame(new rtc.AudioFrame(data, 48000, 1, 960));
        } else input.captureFrame(new rtc.VideoFrame(new Uint8Array(64 * 64 * 4).fill(100), 64, 64, rtc.VideoBufferType.RGBA));
      } catch { /* teardown closes source; assertions below require received frames */ }
      finally { busy = false; }
    }, kind === 'audio' ? 20 : 100);
    pumps.push(timer); return result;
  }
  async function rejectPublish(room, source) {
    const isAudio = source === rtc.TrackSource.SOURCE_SCREENSHARE_AUDIO;
    const input = isAudio ? new rtc.AudioSource(48000, 1) : new rtc.VideoSource(64, 64);
    const track = isAudio ? rtc.LocalAudioTrack.createAudioTrack('unauthorized screen audio', input) : rtc.LocalVideoTrack.createVideoTrack('unauthorized screen', input);
    tracks.push(track);
    // This SFU silently drops disallowed AddTrack requests; the SDK can wait
    // until its publish timeout. Check the SFU's actual permission and track
    // inventory repeatedly, as well as rejecting any successful publication.
    let published = false;
    const attempt = room.localParticipant.publishTrack(track, new rtc.TrackPublishOptions({ source })).then(() => { published = true; }, () => {});
    for (let i = 0; i < 12; i++) {
      const participant = await api.getParticipant(room.name, room.localParticipant.identity);
      assert.ok(!participant.permission.canPublish || !participant.permission.canPublishSources.includes(source));
      assert.ok(participant.tracks.every(p => p.source !== source), 'The SFU must never publish the prohibited source');
      assert.equal(published, false, 'A disallowed source must not receive a publication acknowledgement');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    void attempt;
  }
  t.after(async () => {
    pumps.forEach(clearInterval);
    await Promise.allSettled(readers.map(reader => reader.cancel()));
    await Promise.allSettled(connected.map(room => bounded(room.disconnect(), 'Disconnect', 5000)));
    await Promise.allSettled(tracks.map(track => track.close()));
    await Promise.allSettled(names.map(name => api.deleteRoom(name)));
    await rtc.dispose();
  });
  const [alice, bob, carol] = await Promise.all(['alice', 'bob', 'carol'].map(async user => join(await token(user))));
  await eventually(() => [alice, bob, carol].every(room => room.remoteParticipants.size === 2), 'All three peers must see each other');
  for (const room of [alice, bob, carol]) {
    await publish(room, 'audio', rtc.TrackSource.SOURCE_MICROPHONE);
    await publish(room, 'video', rtc.TrackSource.SOURCE_CAMERA);
  }
  await eventually(async () => (await api.listParticipants(names[0])).every(p => p.tracks.length === 2), 'Three independent microphones and cameras must publish');
  await eventually(() => [...bob.remoteParticipants.values()].some(p => [...p.trackPublications.values()].filter(p => p.track).length === 2), 'Remote subscriptions must become active');
  const remote = [...bob.remoteParticipants.values()].find(p => p.identity === 'alice');
  for (const [source, Stream] of [[rtc.TrackSource.SOURCE_MICROPHONE, rtc.AudioStream], [rtc.TrackSource.SOURCE_CAMERA, rtc.VideoStream]]) {
    const publication = [...remote.trackPublications.values()].find(p => p.source === source);
    await eventually(() => !!publication?.track, 'Remote source must subscribe');
    const reader = new Stream(publication.track).getReader(); readers.push(reader);
    assert.equal((await bounded(reader.read(), 'Decoded remote media', 5000)).done, false);
  }
  t.diagnostic('Three synthetic peers published; another peer decoded real audio and video frames.');
  await rejectPublish(alice, rtc.TrackSource.SOURCE_SCREENSHARE);
  await rejectPublish(alice, rtc.TrackSource.SOURCE_SCREENSHARE_AUDIO);
  const oldHolderToken = await token('alice', 'screen');
  const shareAlice = await join(oldHolderToken), shareBob = await join(await token('bob', 'screen'));
  await publish(shareAlice, 'video', rtc.TrackSource.SOURCE_SCREENSHARE);
  await publish(shareAlice, 'audio', rtc.TrackSource.SOURCE_SCREENSHARE_AUDIO);
  await rejectPublish(shareBob, rtc.TrackSource.SOURCE_SCREENSHARE);
  await rejectPublish(shareBob, rtc.TrackSource.SOURCE_SCREENSHARE_AUDIO);
  await eventually(() => [...shareBob.remoteParticipants.values()].some(p => [...p.trackPublications.values()].filter(p => p.track).length === 2), 'Screen video and tab audio must both reach subscriber');
  assert.equal((await api.listParticipants(names[0])).length, 3, 'Screen session does not replace main media');
  // Self-hosting does NOT revoke cached JWTs. Isolation must remain effective even
  // when the old token recreates the retired room, rather than claiming revocation.
  await api.deleteRoom(names[1]);
  screenRoom = names[2]; lease = 'lease-two'; owner = 'bob'; call.screenVersion++;
  await join(await token('bob', 'screen'));
  await join(await token('carol', 'screen'));
  const stale = await join(oldHolderToken);
  assert.equal(stale.name, names[1]);
  assert.deepEqual((await api.listParticipants(names[2])).map(p => p.identity).sort(), ['bob', 'carol']);
  t.diagnostic('A retained old publisher token reaches only its retired room; the new sharing epoch has no old publisher.');
  const fourth = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, { identity: 'fourth', ttl: 30 });
  fourth.addGrant({ room: names[0], roomJoin: true, canPublish: false, canSubscribe: true });
  await assert.rejects(join({ serverUrl: env.LIVEKIT_URL, token: await fourth.toJwt() }), error => !/timed out/.test(error.message));
});
