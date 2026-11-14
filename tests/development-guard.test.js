const test = require('node:test');
const assert = require('node:assert/strict');
const { assertLocalDatabase } = require('../server/development-guard');

const developmentUrl = 'mysql://development_user:synthetic_private_password@127.0.0.1:33367/goga_development';

test('local database guard permits only the explicit isolated development database by default', () => {
  const url = assertLocalDatabase({ DATABASE_URL: developmentUrl });
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '33367');
  assert.equal(url.pathname, '/goga_development');
  const pooled = assertLocalDatabase({ DATABASE_URL: `${developmentUrl}?connection_limit=2&pool_timeout=5&connect_timeout=5` });
  assert.equal(pooled.searchParams.get('connection_limit'), '2');
});

test('validation database requires an explicit caller opt-in', () => {
  const DATABASE_URL = developmentUrl.replace('/goga_development', '/goga_validation');
  assert.throws(() => assertLocalDatabase({ DATABASE_URL }), /UNSAFE_DEVELOPMENT_DATABASE/);
  assert.equal(assertLocalDatabase({ DATABASE_URL }, { allowValidation: true }).pathname, '/goga_validation');
  assert.throws(() => assertLocalDatabase({ DATABASE_URL: developmentUrl.replace('/goga_development', '/goga_production') }, { allowValidation: true }), /UNSAFE_DEVELOPMENT_DATABASE/);
});

test('local database guard rejects remote targets, alternate hosts, ports, protocols and database paths', () => {
  const unsafe = [
    developmentUrl.replace('127.0.0.1', 'production.example.test'),
    developmentUrl.replace('127.0.0.1', 'localhost'),
    developmentUrl.replace('127.0.0.1', '[::1]'),
    developmentUrl.replace('127.0.0.1', '127.1'),
    developmentUrl.replace(':33367', ':3306'),
    developmentUrl.replace(':33367', ''),
    developmentUrl.replace('mysql:', 'postgresql:'),
    developmentUrl.replace('/goga_development', '/mysql'),
    developmentUrl.replace('/goga_development', '/goga_development/'),
    developmentUrl.replace('/goga_development', '/goga%5Fdevelopment'),
  ];
  for (const DATABASE_URL of unsafe) {
    assert.throws(() => assertLocalDatabase({ DATABASE_URL }), /UNSAFE_DEVELOPMENT_DATABASE/);
  }
});

test('local database guard rejects connection overrides even when the URL host appears safe', () => {
  for (const query of ['socket=/tmp/mysql.sock', 'socketPath=/tmp/mysql.sock', 'host=production.example.test', 'port=3306', 'database=production', 'sslaccept=strict', '%73ocket=/tmp/mysql.sock', 'connection_limit=2&socket=/tmp/mysql.sock']) {
    assert.throws(() => assertLocalDatabase({ DATABASE_URL: `${developmentUrl}?${query}` }), /UNSAFE_DEVELOPMENT_DATABASE/);
  }
});

test('local database guard errors never include configured credentials or remote host details', () => {
  for (const DATABASE_URL of [undefined, '', 'synthetic_private_password is not a URL', developmentUrl.replace('127.0.0.1', 'private-db.example.test'), `${developmentUrl}?socket=/sensitive/socket/path`]) {
    assert.throws(() => assertLocalDatabase({ DATABASE_URL }), error => {
      assert.match(error.message, /^(LOCAL_DATABASE_REQUIRED|UNSAFE_DEVELOPMENT_DATABASE):/);
      assert.doesNotMatch(error.message, /development_user|synthetic_private_password|private-db\.example\.test|sensitive|mysql:\/\//);
      return true;
    });
  }
});
