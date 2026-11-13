const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const key = Buffer.alloc(65, 1); key[0] = 4;
const valid = { endpoint: 'https://fcm.googleapis.com/wp/browser-token', keys: { p256dh: key.toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') } };
const { validatePushSubscription } = loadTs('src/lib/push-policy.ts');

test('push endpoint policy rejects SSRF destinations, credentials and lookalike hosts', () => {
  for (const endpoint of ['http://fcm.googleapis.com/wp/token', 'https://127.0.0.1/private', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/private', 'https://fcm.googleapis.com.attacker.test/push', 'https://user:password@fcm.googleapis.com/wp/token', 'https://fcm.googleapis.com:8443/wp/token', 'https://attacker.example/push']) assert.throws(() => validatePushSubscription({ ...valid, endpoint }));
  assert.equal(validatePushSubscription(valid).endpoint, valid.endpoint);
});

test('push key material is validated before persistence or outbound requests', () => {
  assert.throws(() => validatePushSubscription({ ...valid, keys: { ...valid.keys, auth: 'short' } }));
  assert.throws(() => validatePushSubscription({ ...valid, keys: { ...valid.keys, p256dh: Buffer.alloc(65).toString('base64url') } }));
});

function actions(db, userId = 'alice') {
  return loadTs('src/actions/subscribeAction.ts', { '@/lib/client': db, '@clerk/nextjs/server': { currentUser: async () => userId ? { id: userId } : null } });
}

test('registering another account endpoint cannot transfer its ownership or encryption keys', async () => {
  let writes = 0;
  const db = { pushSubscription: { findUnique: async () => ({ id: 'subscription', userId: 'bob' }), update: async () => { writes++; }, create: async () => { writes++; } } };
  db.$transaction = async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(db); };
  const result = await actions(db).subscribeUser(valid);
  assert.equal(result.success, false);
  assert.equal(writes, 0);
});

test('same-owner refresh updates keys without accepting a new owner identity', async () => {
  let update;
  const db = { pushSubscription: { findUnique: async () => ({ id: 'subscription', userId: 'alice' }), update: async value => { update = value; } } };
  db.$transaction = async fn => fn(db);
  assert.equal((await actions(db).subscribeUser(valid)).success, true);
  assert.equal(update.where.userId, 'alice');
  assert.equal(update.data.userId, undefined);
});

test('anonymous and invalid subscriptions are rejected before database access', async () => {
  assert.equal((await actions({}, null).subscribeUser(valid)).success, false);
  assert.equal((await actions({}).subscribeUser({ ...valid, endpoint: 'https://localhost/private' })).success, false);
});

test('legacy stored endpoints are revalidated before test notification delivery', async () => {
  let deliveries = 0;
  const actions = loadTs('src/actions/switchLike.ts', {
    '@/lib/client': { pushSubscription: { findFirst: async () => ({ ...valid.keys, endpoint: 'https://127.0.0.1/private' }) } },
    '@/lib/social-access': { assertCanViewPost: async () => {} },
    '@clerk/nextjs/server': { currentUser: async () => ({id:'alice'}) },
    'next/cache': { revalidatePath(){}, revalidateTag(){} },
    'web-push': { sendNotification: async () => { deliveries++; } },
  });
  assert.ok((await actions.testNotification()).error);
  assert.equal(deliveries, 0);
});

test('replaying an already-liked intent does not send another push notification', async () => {
  let deliveries = 0;
  const db = {
    like: { findFirst: async () => ({id:1}), findMany: async () => [{userId:'alice'}] },
    post: { findUnique: async () => ({userId:'bob'}) },
    pushSubscription: { findMany: async () => [{...valid.keys, endpoint:valid.endpoint}] },
  };
  db.$transaction = async fn => fn(db);
  const actions = loadTs('src/actions/switchLike.ts', {
    '@/lib/client': db,
    '@/lib/social-access': { assertCanViewPost: async () => {} },
    '@clerk/nextjs/server': { currentUser: async () => ({id:'alice'}) },
    'next/cache': { revalidatePath(){}, revalidateTag(){} },
    'web-push': { sendNotification: async () => { deliveries++; } },
  });
  assert.equal((await actions.switchLike(1, true)).success, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(deliveries, 0);
});
