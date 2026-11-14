const test = require('node:test');
const assert = require('node:assert/strict');
const { disposableDatabaseUrl, syntheticSessions } = require('./helpers/runtime-harness.cjs');

test('runtime database guard denies remote, wrong database and socket override targets', () => {
  assert.equal(disposableDatabaseUrl('mysql://test@127.0.0.1:33367/goga_validation'), 'mysql://test@127.0.0.1:33367/goga_validation');
  for (const url of [undefined, 'mysql://test@localhost:33367/goga_validation', 'mysql://test@127.0.0.1:3306/goga_validation',
    'mysql://test@production.invalid:33367/goga_validation', 'mysql://test@127.0.0.1:33367/production',
    'mysql://test@127.0.0.1:33367/goga_validation?socket=/tmp/mysql.sock',
    'postgres://test@127.0.0.1:33367/goga_validation']) assert.throws(() => disposableDatabaseUrl(url));
});

test('runtime sessions use real Clerk SDK signature, expiration and authorized party checks', async () => {
  const sessions = syntheticSessions('http://localhost:3000');
  const token = sessions.token('synthetic-alice');
  assert.equal((await sessions.verify(token)).sub, 'synthetic-alice');
  const [header, payload, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), sub: 'synthetic-bob' })).toString('base64url');
  await assert.rejects(sessions.verify(`${header}.${forged}.${signature}`));
  await assert.rejects(sessions.verify(sessions.token('synthetic-alice', { exp: Math.floor(Date.now() / 1000) - 120 })));
  await assert.rejects(sessions.verify(sessions.token('synthetic-alice', { azp: 'https://other.invalid' })));
});
