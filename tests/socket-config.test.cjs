const test = require('node:test');
const assert = require('node:assert/strict');
const { configuredHost, configuredOrigins } = require('../socket-server');
test('socket listener defaults to loopback and permits only explicit address binding', () => {
  assert.equal(configuredHost({}), '127.0.0.1');
  assert.equal(configuredHost({SOCKET_HOST:'::1'}), '::1');
  assert.equal(configuredHost({SOCKET_HOST:'0.0.0.0'}), '0.0.0.0');
  assert.throws(()=>configuredHost({SOCKET_HOST:'untrusted.example'}));
});
test('production socket origins require exact HTTPS origins', () => {
  assert.throws(()=>configuredOrigins({NODE_ENV:'production'}));
  for (const origin of ['*', 'http://goga.network', 'https://goga.network/path']) {
    assert.throws(()=>configuredOrigins({NODE_ENV:'production',SOCKET_ALLOWED_ORIGINS:origin}));
  }
  assert.deepEqual(configuredOrigins({NODE_ENV:'production',SOCKET_ALLOWED_ORIGINS:'https://goga.network'}), ['https://goga.network']);
});
