const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkedFile, checkedDirectory, readOwnerMarker } = require('../scripts/dev-setup');
const { assertLocalDatabase } = require('../server/development-guard');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'goga-development-safety-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('local setup rejects symlinked environment and ownership files without touching their targets', t => {
  const root = fixture(t);
  const original = path.join(root, '.env');
  fs.writeFileSync(original, 'synthetic-original-do-not-modify');
  for (const name of ['.env.local', 'mysql-owner.json']) {
    const linked = path.join(root, name);
    fs.symlinkSync(original, linked);
    assert.throws(() => checkedFile(linked), /regular file/);
    assert.equal(fs.readFileSync(original, 'utf8'), 'synthetic-original-do-not-modify');
  }
  assert.equal(checkedFile(original), true);
  assert.equal(checkedFile(path.join(root, 'not-created')), false);
  assert.throws(() => checkedFile(root), /regular file/);
});

test('local setup rejects symlinked data directories and symlinked parent paths', t => {
  const root = fixture(t);
  const actual = path.join(root, 'actual'); fs.mkdirSync(actual);
  fs.mkdirSync(path.join(actual, 'mysql'));
  const alias = path.join(root, 'alias'); fs.symlinkSync(actual, alias);
  assert.throws(() => checkedDirectory(alias), /symlinks/);
  assert.throws(() => checkedDirectory(path.join(alias, 'mysql')), /symlinks/);
  assert.equal(checkedDirectory(actual), true);
  assert.equal(checkedDirectory(path.join(root, 'missing')), false);
});

test('ownership marker requires this project, expected port and generated credential format', t => {
  const root = fixture(t), local = path.join(root, '.local'); fs.mkdirSync(local);
  const file = path.join(local, 'mysql-owner.json');
  const valid = { root, port: 33367, password: 'a'.repeat(48) };
  assert.throws(() => readOwnerMarker(root, local), /ownership was not established/);
  fs.writeFileSync(file, JSON.stringify(valid));
  assert.deepEqual(readOwnerMarker(root, local), valid);
  for (const marker of [{ ...valid, root: '/other-project' }, { ...valid, port: 3306 }, { ...valid, password: 'invalid' }]) {
    fs.writeFileSync(file, JSON.stringify(marker));
    assert.throws(() => readOwnerMarker(root, local), /marker is invalid/);
  }
  fs.writeFileSync(file, 'synthetic-sensitive-value malformed json');
  assert.throws(() => readOwnerMarker(root, local), error => /unreadable or invalid/.test(error.message) && !error.message.includes('synthetic-sensitive'));
});

test('development database guard rejects remote hosts, wrong schema and Unix socket overrides', () => {
  assert.equal(assertLocalDatabase({ DATABASE_URL: 'mysql://test@127.0.0.1:33367/goga_development?connection_limit=3&connect_timeout=5' }).hostname, '127.0.0.1');
  for (const url of ['mysql://test@production.invalid:33367/goga_development', 'mysql://test@127.0.0.1:3306/goga_development',
    'mysql://test@127.0.0.1:33367/production', 'mysql://test@127.0.0.1:33367/goga_development?socket=/tmp/mysql.sock']) {
    assert.throws(() => assertLocalDatabase({ DATABASE_URL: url }), /UNSAFE_DEVELOPMENT_DATABASE/);
  }
});
