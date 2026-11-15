const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./helpers/load-ts.cjs');
function fixture() {
  const state = { viewer: 'alice', sharing: true, private: false, blocked: false, following: false, reads: 0, writes: 0, fail: false };
  const actions = loadTs('src/actions/activityActions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: state.viewer }) },
    'next/cache': { updateTag() {}, revalidateTag() {} },
    '@/lib/client': {
      user: { findUnique: async ({ where, select }) => {
        state.reads++;
        assert.equal(where.showActivityStatus, true);
        assert.equal(where.blocks.none.blockedId, state.viewer);
        assert.equal(where.blockedBy.none.blockerId, state.viewer);
        assert.equal(where.OR[0].isPrivate, false);
        assert.equal(where.OR[1].followers.some.followerId, state.viewer);
        assert.deepEqual(Object.keys(select), ['lastActiveAt']);
        if (state.fail) throw new Error('offline');
        return !state.sharing || state.blocked || (state.private && !state.following) ? null : { lastActiveAt: '2026-11-15T12:00:00Z' };
      }, update: async () => { state.writes++; } },
    },
  });
  return { state, actions };
}
test('anonymous activity reads return no data before database access', async () => {
  const { state, actions } = fixture(); state.viewer = null;
  assert.equal(await actions.getUserActivity('bob'), null);
  assert.equal(state.reads, 0);
});
test('activity status hides private, blocked and opted-out users', async () => {
  for (const setting of ['private', 'blocked', 'sharing']) {
    const { state, actions } = fixture(); state[setting] = setting !== 'sharing';
    assert.equal(await actions.getUserActivity('bob'), null, setting);
    assert.equal(state.writes, 0);
  }
});
test('permitted activity reads never mutate data or query third-party sessions', async () => {
  const { state, actions } = fixture(); state.private = true; state.following = true;
  assert.equal((await actions.getUserActivity('bob')).source, 'db');
  assert.equal(state.writes, 0);
  state.fail = true;
  assert.equal(await actions.getUserActivity('bob'), null);
});
