const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Webhook } = require('svix');
const loadTs = require('./helpers/load-ts.cjs');
const diagnostics = require('../server/diagnostics');

function fixture() {
  const secret = `whsec_${randomBytes(32).toString('base64')}`;
  const state = { deleted: [], upserts: [], errors: [], failure: null };
  const route = loadTs('src/app/api/webhooks/clerk/route.ts', {
    svix: { Webhook },
    '@/lib/client': { user: {
      deleteMany() { throw new Error('Deletion must use transactional call retirement'); },
      async upsert(input) { state.upserts.push(input); },
    } },
    '@clerk/nextjs/server': { clerkClient: async () => ({ users: { getUser: async id => ({ id, username: 'test-user' }) } }) },
    '@/lib/call-server': { callRooms: () => ({ async deleteAccountUser(id) {
      if (state.failure) throw state.failure;
      state.deleted.push(id);
      return { count: 1 };
    } }) },
    '../../../../../server/diagnostics': diagnostics,
  }, { process: { env: { WEBHOOK_SECRET: secret } }, console: { error: log => state.errors.push(log) } });
  function request(event, { valid = true, signed = true, at = new Date() } = {}) {
    const body = JSON.stringify(event);
    const id = 'msg_local_regression';
    const signature = new Webhook(secret).sign(id, at, body);
    return new Request('http://localhost/api/webhooks/clerk', {
      method: 'POST', body: valid ? body : `${body} `,
      headers: signed ? { 'svix-id': id, 'svix-timestamp': String(Math.floor(at.getTime() / 1000)), 'svix-signature': signature } : {},
    });
  }
  return { state, route, request };
}

test('Clerk deletion rejects absent, tampered and stale signatures without data access', async () => {
  for (const options of [{ signed: false }, { valid: false }, { at: new Date(Date.now() - 3600_000) }]) {
    const { route, state, request } = fixture();
    const response = await route.POST(request({ type: 'user.deleted', data: { id: 'user_local' } }, options));
    assert.equal(response.status, 400);
    assert.equal(state.deleted.length, 0);
    assert.equal(state.upserts.length, 0);
  }
});

test('verified account deletion uses atomic room retirement and permits duplicate delivery', async () => {
  const { route, state, request } = fixture();
  for (let i = 0; i < 2; i++) {
    assert.equal((await route.POST(request({ type: 'user.deleted', data: { id: 'user_local' } }))).status, 200);
  }
  assert.deepEqual(state.deleted, ['user_local', 'user_local']);
});

test('malformed verified account IDs never broaden database deletion', async () => {
  for (const data of [{}, null, { id: '' }, { id: ' ' }, { id: 4 }, { id: 'a'.repeat(192) }]) {
    const { route, state, request } = fixture();
    assert.equal((await route.POST(request({ type: 'user.deleted', data }))).status, 400);
    assert.equal(state.deleted.length, 0);
  }
});

test('failed account transaction returns retryable status and sanitized diagnostics', async () => {
  const { route, state, request } = fixture();
  state.failure = Object.assign(new Error('private-user-payload mysql://private-secret'), { code: 'P2003' });
  const response = await route.POST(request({ type: 'user.deleted', data: { id: 'user_local' } }));
  assert.equal(response.status, 500);
  assert.equal(await response.text(), 'Server error');
  assert.equal(state.deleted.length, 0);
  assert.equal(state.errors.length, 1);
  const diagnostic = JSON.parse(state.errors[0]);
  assert.equal(diagnostic.error.code, 'P2003');
  assert.doesNotMatch(state.errors[0], /private-user|private-secret|user_local/);
});

test('verified profile synchronization retains upsert behavior and ignores unrelated events', async () => {
  const { route, state, request } = fixture();
  for (const type of ['user.created', 'user.updated', 'session.created']) {
    assert.equal((await route.POST(request({ type, data: { id: 'user_local' } }))).status, 200);
  }
  assert.equal(state.upserts.length, 2);
  assert.equal(state.upserts[0].where.id, 'user_local');
  assert.equal(state.deleted.length, 0);
});
