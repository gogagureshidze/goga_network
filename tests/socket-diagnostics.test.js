const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { once } = require('node:events');
const { createSocketApp } = require('../server/socket-app');

function schemaError() {
  return Object.assign(new Error('SELECT id from mysql://root:SECRET_PASSWORD@private.example/private_database'), {
    name: 'PrismaClientKnownRequestError', code: 'P2022', meta: { modelName: 'Conversation', column: 'Conversation.kind' },
  });
}
async function fixture(t, chat) {
  const records = [];
  const app = createSocketApp({ chat, allowedOrigins: ['http://localhost:3000'],
    verifyToken: async () => ({ sub: 'alice', exp: Date.now() / 1000 + 120 }),
    logger: { info() {}, error: text => records.push(JSON.parse(text)) },
  });
  const address = await app.listen(0, '127.0.0.1');
  const client = connect(`http://127.0.0.1:${address.port}`, { auth: { token: 'test-token' }, transports: ['websocket'], reconnection: false });
  t.after(async () => { client.disconnect(); await app.close(); });
  return { app, client, records };
}

test('a real socket acknowledgement carries a safe diagnostic reference while server logs classify the Prisma failure', async t => {
  const { client, records } = await fixture(t, { getProfile: async () => ({ id: 'alice' }), listConversations: async () => { throw schemaError(); } });
  await once(client, 'connect');
  const result = await client.timeout(1000).emitWithAck('listConversations', {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'UNAVAILABLE');
  assert.equal(result.error.diagnosticCode, 'DB_SCHEMA_NOT_READY');
  assert.ok(result.error.diagnosticId);
  const log = records.find(record => record.event === 'socket.event_failed');
  assert.equal(log.error.code, 'P2022');
  assert.equal(log.error.model, 'Conversation');
  assert.equal(log.error.column, 'kind');
  assert.equal(log.diagnosticId, result.error.diagnosticId);
  const serialized = JSON.stringify({ result, records });
  for (const forbidden of ['SECRET_PASSWORD', 'private.example', 'private_database', 'SELECT', 'test-token']) assert.equal(serialized.includes(forbidden), false);
});

test('database failures during socket account lookup report service unavailability instead of false sign-in failures', async t => {
  const { client, records } = await fixture(t, { getProfile: async () => { throw Object.assign(new Error('secret database endpoint'), { code: 'P1001', name: 'PrismaClientInitializationError' }); } });
  const [error] = await once(client, 'connect_error');
  assert.equal(error.data.code, 'UNAVAILABLE');
  assert.equal(error.data.diagnosticCode, 'DB_UNAVAILABLE');
  assert.equal(records[0].event, 'socket.authentication_dependency_failed');
  assert.equal(records[0].error.code, 'P1001');
  assert.equal(JSON.stringify(records).includes('secret database endpoint'), false);
});
