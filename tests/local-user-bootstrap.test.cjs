const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const loadTs = require('./helpers/load-ts.cjs');
const { assertLocalDatabase } = require('../server/development-guard');

const localEnv = {
  NODE_ENV: 'development', GOGA_LOCAL_DEVELOPMENT: 'true',
  DATABASE_URL: 'mysql://local-test:local-test@127.0.0.1:33367/goga_development',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture', CLERK_SECRET_KEY: 'sk_test_fixture',
};
const verifiedProfile = { id: 'user_verified', username: 'verified', firstName: 'Local', lastName: 'Person', imageUrl: '/verified-avatar.png' };
function setup({ env = localEnv, profile = verifiedProfile, initial = [], beforeUpsert } = {}) {
  const rows = new Map(initial.map(user => [user.id, { ...user }]));
  const operations = [];
  let clerkReads = 0;
  const prisma = { user: {
    async findUnique(args) { operations.push(['findUnique', args]); return rows.get(args.where.id) || null; },
    async findFirst(args) { operations.push(['findFirst', args]); return [...rows.values()].find(user => user.username === args.where.username && user.id !== args.where.id.not) || null; },
    async upsert(args) {
      operations.push(['upsert', args]);
      beforeUpsert?.(rows);
      const existing = rows.get(args.where.id);
      if (existing) Object.assign(existing, args.update);
      else rows.set(args.create.id, { ...args.create });
      return rows.get(args.where.id);
    },
  } };
  const loaded = loadTs('src/lib/local-user-bootstrap.ts', {
    'server-only': {}, 'node:crypto': crypto, '@/lib/client': prisma,
    '@clerk/nextjs/server': { currentUser: async () => { clerkReads += 1; return profile; } },
    '../../server/development-guard': { assertLocalDatabase },
  }, { process: { env: { ...env } } });
  return { ensure: loaded.ensureLocalDevelopmentUser, operations, rows, clerkReads: () => clerkReads };
}

test('bootstrap is inert in production, without explicit local mode, and for anonymous requests', async () => {
  for (const [env, userId] of [
    [{ ...localEnv, NODE_ENV: 'production', DATABASE_URL: 'mysql://remote.example/production' }, 'user_verified'],
    [{ ...localEnv, GOGA_LOCAL_DEVELOPMENT: undefined }, 'user_verified'],
    [localEnv, null],
  ]) {
    const fixture = setup({ env });
    await fixture.ensure(userId);
    assert.equal(fixture.operations.length, 0);
    assert.equal(fixture.clerkReads(), 0);
  }
});

test('bootstrap rejects unsafe targets and live Clerk keys before database access', async () => {
  for (const env of [
    { ...localEnv, DATABASE_URL: 'mysql://remote.example/goga_development' },
    { ...localEnv, DATABASE_URL: 'mysql://127.0.0.1:33367/production' },
    { ...localEnv, DATABASE_URL: 'mysql://127.0.0.1:33367/goga_development?socket=/tmp/other-mysql.sock' },
    { ...localEnv, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_fixture' },
    { ...localEnv, CLERK_SECRET_KEY: 'sk_live_fixture' },
  ]) {
    const fixture = setup({ env });
    await assert.rejects(fixture.ensure('user_verified'));
    assert.equal(fixture.operations.length, 0);
    assert.equal(fixture.clerkReads(), 0);
  }
});

test('missing or mismatched currentUser never creates a local account', async () => {
  for (const profile of [null, { ...verifiedProfile, id: 'user_different_session' }]) {
    const fixture = setup({ profile });
    await assert.rejects(fixture.ensure('user_verified'), /SESSION_MISMATCH/);
    assert.equal(fixture.rows.size, 0);
    assert.equal(fixture.operations.filter(([operation]) => operation === 'upsert').length, 0);
  }
});

test('a verified development profile creates only its matching account', async () => {
  const fixture = setup();
  await fixture.ensure('user_verified');
  assert.equal(fixture.rows.size, 1);
  assert.deepEqual(fixture.rows.get('user_verified'), {
    id: 'user_verified', username: 'verified', name: 'Local', surname: 'Person', avatar: '/verified-avatar.png', cover: '/noCover.png',
  });
  assert.equal(fixture.clerkReads(), 1);
});

test('existing local profile is preserved without another Clerk request', async () => {
  const existing = { id: 'user_verified', username: 'custom-local', name: 'Locally edited', avatar: '/custom.png' };
  const fixture = setup({ initial: [existing] });
  await fixture.ensure('user_verified');
  assert.deepEqual(fixture.rows.get('user_verified'), existing);
  assert.equal(fixture.clerkReads(), 0);
  assert.equal(fixture.operations.length, 1);
});

test('colliding and missing usernames receive a deterministic account-specific fallback', async () => {
  const occupied = { id: 'existing-owner', username: 'verified' };
  const fixture = setup({ initial: [occupied] });
  await fixture.ensure('user_verified');
  const expectedSuffix = crypto.createHash('sha256').update('user_verified').digest('hex').slice(0, 16);
  assert.equal(fixture.rows.get('user_verified').username, `verified_${expectedSuffix}`);
  assert.deepEqual(fixture.rows.get('existing-owner'), occupied);
  const missing = setup({ profile: { ...verifiedProfile, username: null } });
  await missing.ensure('user_verified');
  assert.equal(missing.rows.get('user_verified').username, `local_${expectedSuffix}`);
});

test('same-account races are idempotent and never overwrite a concurrently created profile', async () => {
  const fixture = setup();
  await Promise.all([fixture.ensure('user_verified'), fixture.ensure('user_verified')]);
  assert.equal(fixture.rows.size, 1);
  for (const [, args] of fixture.operations.filter(([operation]) => operation === 'upsert')) assert.equal(Object.keys(args.update).length, 0);
  const concurrent = { id: 'user_verified', username: 'webhook-created', avatar: '/webhook.png' };
  const raced = setup({ beforeUpsert: rows => rows.set(concurrent.id, { ...concurrent }) });
  await raced.ensure('user_verified');
  assert.deepEqual(raced.rows.get('user_verified'), concurrent);
});
