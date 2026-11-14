const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {NextURL} = require('next/dist/server/web/next-url');
const {NextResponse} = require('next/server');
const {getRelativeURL} = require('next/dist/shared/lib/router/utils/relativize-url');
const {decorateRequest} = require(path.join(path.dirname(require.resolve('@clerk/nextjs/server')), 'utils.js'));

const root = path.resolve(__dirname, '..');
function loadScript(name, mocks, globals = {}) {
  const filename = path.join(root, 'scripts', name);
  const localRequire = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  localRequire.resolve = require.resolve;
  const context = vm.createContext({module:{exports:{}}, require:localRequire, __dirname:path.dirname(filename), process, console, ...globals});
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename});
  return context;
}

function portProbe() {
  const sockets = [];
  const context = loadScript('local-development.js', {'node:net':{
    connect(options) {
      const socket = new EventEmitter();
      socket.options = options;
      socket.destroyCount = 0;
      socket.destroy = () => {socket.destroyCount++;};
      socket.setTimeout = (milliseconds, callback) => {
        assert.equal(milliseconds, 750);
        socket.timeout = callback;
      };
      sockets.push(socket);
      return socket;
    },
  }});
  return {portOpen:context.module.exports.portOpen, sockets};
}

test('web port detection checks both loopbacks concurrently and accepts either listener', async () => {
  for (const openHost of ['127.0.0.1', '::1']) {
    const {portOpen, sockets} = portProbe();
    const result = portOpen(3000);
    assert.deepEqual(sockets.map(socket => socket.options.host), ['127.0.0.1', '::1']);
    for (const socket of sockets) socket.emit(socket.options.host === openHost ? 'connect' : 'error');
    assert.equal(await result, true);
    assert.ok(sockets.every(socket => socket.destroyCount === 1));
  }
});

test('web port detection is bounded when both loopbacks are closed', async () => {
  const {portOpen, sockets} = portProbe();
  const result = portOpen(3000);
  sockets[0].emit('error');
  sockets[1].timeout();
  // A late socket event must not repeat cleanup or change the result.
  sockets[1].emit('error');
  assert.equal(await result, false);
  assert.ok(sockets.every(socket => socket.destroyCount === 1));
});

test('socket and isolated MySQL port probes stay on IPv4', async () => {
  for (const port of [3001, 33367]) {
    const {portOpen, sockets} = portProbe();
    const result = portOpen(port);
    assert.equal(sockets.length, 1);
    assert.equal(sockets[0].options.host, '127.0.0.1');
    assert.equal(sockets[0].options.port, port);
    sockets[0].emit('connect');
    assert.equal(await result, true);
  }
});

function clerkRewrite(initialUrl) {
  // Exercise the installed Next URL normalization and Clerk header decoration.
  // This pure signed-out request needs no credentials, API, server or database.
  const request = new Request(new NextURL(initialUrl).toString());
  request.clerkUrl = new URL(request.url);
  const response = decorateRequest(request, NextResponse.next(), {status:'signed-out', reason:'session-token-missing'}, {}, {}, null);
  assert.equal(response.headers.get('x-middleware-request-x-clerk-auth-status'), 'signed-out');
  const rewrite = response.headers.get('x-middleware-rewrite');
  assert.ok(rewrite);
  return getRelativeURL(rewrite, initialUrl);
}

test('actual web launcher hostname keeps Clerk same-page rewrites internal', async () => {
  const spawned = [];
  const errors = [];
  let preflightCount = 0;
  let disconnectCount = 0;
  const child = new EventEmitter();
  child.kill = () => {};
  loadScript('dev-runner.js', {
    './local-development':{
      root, useSupportedNode(){}, loadDevelopmentEnv:() => ({}),
      portOpen:async port => port === 33367,
      runNode(){throw new Error('Unexpected generation');},
    },
    'node:fs':{existsSync:() => true, readFileSync:() => 'matching schema'},
    'node:child_process':{spawn:(executable, args, options) => {spawned.push({executable, args, options}); return child;}},
    '../src/generated/prisma':{PrismaClient:class {
      async $disconnect(){disconnectCount++;}
    }},
    '../server/db-preflight':{preflightDatabase:async () => {preflightCount++;}},
  }, {
    process:{argv:[process.execPath, 'dev-runner.js', 'web'], execPath:process.execPath, once(){}},
    console:{info(){}, error:message => errors.push(message)},
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, []);
  assert.equal(preflightCount, 1);
  assert.equal(disconnectCount, 1);
  assert.equal(spawned.length, 1);
  const args = spawned[0].args;
  const hostnameIndex = args.indexOf('--hostname');
  assert.ok(hostnameIndex >= 0);
  const configuredHostname = args[hostnameIndex + 1];
  const rewritten = clerkRewrite(`http://${configuredHostname}:3000/chat?view=messages`);
  assert.equal(rewritten, '/chat?view=messages');
  // The former IP binding makes Next treat Clerk's rewrite as an external proxy.
  assert.equal(clerkRewrite('http://127.0.0.1:3000/chat'), 'http://localhost:3000/chat');
});
