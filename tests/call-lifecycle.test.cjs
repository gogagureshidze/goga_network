const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
const { createCallLifecycle } = loadTs('src/lib/call-lifecycle.ts');

test('hangup and revocation invalidate delayed call replies and broadcasts', () => {
  const guard = createCallLifecycle();
  const request = guard.ticket();
  assert.equal(guard.valid(request, 'call-a'), true);
  guard.close('call-a');
  assert.equal(guard.valid(request, 'call-a'), false);
  assert.equal(guard.accepts('call-a'), false);
  assert.equal(guard.valid(guard.ticket(), 'call-b'), true);
});

test('account or socket replacement invalidates replies from the previous session', () => {
  const guard = createCallLifecycle();
  const previous = guard.ticket();
  guard.reset();
  assert.equal(guard.valid(previous, 'old-call'), false);
  assert.equal(guard.valid(guard.ticket(), 'new-call'), true);
});
