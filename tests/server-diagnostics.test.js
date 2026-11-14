const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { preflightDatabase, REQUIRED_SCHEMA, NULLABLE_COLUMNS, DatabasePreflightError } = require('../server/db-preflight');
const { safeErrorDetails, reportException, clientDiagnostic } = require('../server/diagnostics');
const { main, configuredHost } = require('../socket-server');

function schemaFixture() {
  const columns = Object.entries(REQUIRED_SCHEMA).flatMap(([tableName, fields]) => fields.map(columnName => ({ tableName, columnName, isNullable: NULLABLE_COLUMNS.has(`${tableName}.${columnName}`) ? 'YES' : 'NO' })));
  const prisma = Object.fromEntries(Object.keys(REQUIRED_SCHEMA).map(model => [model[0].toLowerCase() + model.slice(1), { findMany: async () => [] }]));
  prisma.$queryRaw = async strings => {
    assert.match(strings.join(''), /information_schema\.COLUMNS/);
    assert.doesNotMatch(strings.join(''), /INSERT|DELETE|UPDATE|ALTER|DROP/);
    return columns;
  };
  return { prisma, columns };
}

test('diagnostics keep known Prisma metadata and frames without messages, values, credentials or database names', () => {
  const error = Object.assign(new Error('mysql://admin:TOPSECRET@database.internal/private_db SELECT text = PRIVATE_MESSAGE'), {
    name: 'PrismaClientKnownRequestError', code: 'P2021',
    meta: { modelName: 'CallSession', table: '`private_db`.`CallSession`', column: 'CallSession.deviceId', message: 'Bearer SECRET_TOKEN', query: 'PRIVATE_SQL' },
    stack: 'Error: mysql://admin:TOPSECRET@database.internal/private_db\n at PRIVATE_TOKEN (/srv/private-user/app/server/rooms.js:84:9)\n at attacker (https://evil/SECRET.js:1:1)\n at method (/srv/private-user/app/server/socket-app.js:172:3)',
  });
  const records = [];
  const reference = reportException({ error: text => records.push(JSON.parse(text)) }, 'socket.event_failed', error, { socketEvent: 'listConversations', token: 'PRIVATE_TOKEN' });
  const text = JSON.stringify(records);
  for (const forbidden of ['TOPSECRET', 'private_db', 'PRIVATE_MESSAGE', 'PRIVATE_TOKEN', 'SECRET_TOKEN', 'PRIVATE_SQL', 'private-user', 'database.internal', 'mysql://']) assert.equal(text.includes(forbidden), false, forbidden);
  assert.equal(records[0].error.code, 'P2021');
  assert.equal(records[0].error.table, 'CallSession');
  assert.equal(records[0].error.model, 'CallSession');
  assert.deepEqual(records[0].error.frames.map(frame => frame.file), ['server/rooms.js', 'server/socket-app.js']);
  assert.equal(reference.diagnosticCode, 'DB_SCHEMA_NOT_READY');
  const client = clientDiagnostic(reference);
  assert.equal(client.code, 'UNAVAILABLE');
  assert.equal('table' in client, false);
  assert.equal(safeErrorDetails({ name: 'SECRET', code: 'TOKEN', meta: { table: 'secret' } }).name, 'Error');
});

test('read-only preflight verifies required tables, fields and nullable group compatibility', async () => {
  const { prisma, columns } = schemaFixture();
  assert.equal((await preflightDatabase(prisma)).tablesChecked, Object.keys(REQUIRED_SCHEMA).length);
  columns.splice(columns.findIndex(column => column.tableName === 'Message' && column.columnName === 'clientMessageId'), 1);
  columns.find(column => column.tableName === 'Conversation' && column.columnName === 'user1Id').isNullable = 'NO';
  for (let index = columns.length - 1; index >= 0; index--) if (columns[index].tableName === 'WatchParty') columns.splice(index, 1);
  await assert.rejects(preflightDatabase(prisma), error => {
    assert.equal(error.code, 'DB_SCHEMA_NOT_READY');
    assert.deepEqual(error.checks.sort(), ['Conversation.user1Id', 'Message.clientMessageId', 'WatchParty']);
    return true;
  });
});

test('preflight reports stale generated clients before querying and has a bounded deadline', async () => {
  const { prisma } = schemaFixture();
  let queried = false;
  delete prisma.callSession;
  prisma.$queryRaw = async () => { queried = true; return []; };
  await assert.rejects(preflightDatabase(prisma), { code: 'DB_CLIENT_OUTDATED' });
  assert.equal(queried, false);
  prisma.callSession = { findMany() {} };
  prisma.$queryRaw = () => new Promise(() => {});
  await assert.rejects(preflightDatabase(prisma, { timeoutMs: 5 }), { code: 'DB_PREFLIGHT_TIMEOUT' });
});

test('failed startup preflight disconnects without creating listeners, rooms or sweep timers', async () => {
  let disconnects = 0, apps = 0, rooms = 0;
  const logs = [];
  class FakePrisma { async $disconnect() { disconnects++; } }
  await assert.rejects(main({ env: { CLERK_JWT_KEY: 'test-only-key' }, developmentGuard() {}, PrismaClientConstructor: FakePrisma,
    preflight: async () => { throw new DatabasePreflightError('DB_SCHEMA_NOT_READY', ['CallSession']); },
    socketFactory: () => { apps++; }, roomFactory: () => { rooms++; },
    logger: { error: value => logs.push(JSON.parse(value)) }, signalSource: new EventEmitter(),
  }), { code: 'DB_SCHEMA_NOT_READY' });
  assert.equal(disconnects, 1); assert.equal(apps, 0); assert.equal(rooms, 0);
  assert.equal(logs[0].phase, 'database-preflight');
  assert.deepEqual(logs[0].error.checks, ['CallSession']);
});

test('bootstrap validates literal host and listens on loopback only after successful preflight', async () => {
  assert.equal(configuredHost({}), '127.0.0.1');
  assert.equal(configuredHost({ SOCKET_HOST: '::1' }), '::1');
  assert.equal(configuredHost({ SOCKET_HOST: '0.0.0.0' }), '0.0.0.0');
  for (const host of ['localhost', 'https://127.0.0.1', '127.0.0.1:3001', '127.0.0.1\n', 'example.com']) assert.throws(() => configuredHost({ SOCKET_HOST: host }));
  const steps = [];
  class FakePrisma { async $disconnect() { steps.push('disconnect'); } }
  const started = await main({ env: { CLERK_JWT_KEY: 'test-only-key' }, developmentGuard() {}, PrismaClientConstructor: FakePrisma,
    preflight: async () => { steps.push('preflight'); return { tablesChecked: 12 }; },
    roomFactory: () => { steps.push('rooms'); return {}; }, roomRegistrar: () => () => {},
    socketFactory: () => ({ listen: async (port, host) => { assert.equal(port, 3001); assert.equal(host, '127.0.0.1'); steps.push('listen'); }, close: async () => steps.push('close') }),
    logger: { info() {}, error() {} }, signalSource: new EventEmitter(),
  });
  assert.deepEqual(steps, ['preflight', 'rooms', 'listen']);
  await started.shutdown('SIGTERM');
  assert.deepEqual(steps.slice(-2), ['close', 'disconnect']);
});
