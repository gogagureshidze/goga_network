const test = require("node:test");
const assert = require("node:assert/strict");
const loadTs = require("./helpers/load-ts.cjs");

function fixture() {
  const state = {
    user: { id: "bob", username: "bob", isPrivate: false, showActivityStatus: true, lastActiveAt: new Date("2026-01-01T00:00:00Z") },
    following: false, requested: false, outgoingBlock: false, incomingBlock: false,
    failure: null, reads: 0,
  };
  const read = (kind, value) => {
    state.reads++;
    if (state.failure === kind) throw new Error("Database unavailable");
    return value;
  };
  const db = {
    user: { findFirst: async ({ where }) => read("profile", where.username === state.user?.username || where.id === state.user?.id ? { ...state.user } : null) },
    follower: { findFirst: async () => read("following", state.following ? { id: 1 } : null) },
    followRequest: { findFirst: async () => read("request", state.requested ? { id: 1 } : null) },
    block: { findFirst: async ({ where }) => read(where.blockerId === "alice" ? "outgoingBlock" : "incomingBlock", (where.blockerId === "alice" ? state.outgoingBlock : state.incomingBlock) ? { id: 1 } : null) },
  };
  return { state, load: loadTs("src/lib/profile-access.ts", { "@/lib/client": db }).loadProfileAccess };
}

test("profile content authorization immediately reflects privacy and follow changes", async () => {
  const { state, load } = fixture();
  assert.equal((await load("alice", "bob")).canViewContent, true);
  state.user.isPrivate = true;
  assert.equal((await load("alice", "bob")).canViewContent, false);
  state.following = true;
  assert.equal((await load("alice", "bob")).canViewContent, true);
  state.following = false;
  assert.equal((await load("alice", "bob")).canViewContent, false);
  assert.equal(state.reads, 20);
});

test("profile activity client value uses fresh visibility and current timestamp", async () => {
  const { state, load } = fixture();
  assert.equal((await load("alice", "bob")).visibleLastActiveAt, state.user.lastActiveAt);
  state.user.showActivityStatus = false;
  assert.equal((await load("alice", "bob")).visibleLastActiveAt, null);
  state.user.lastActiveAt = new Date("2026-02-01T00:00:00Z");
  state.user.showActivityStatus = true;
  assert.equal((await load("alice", "bob")).visibleLastActiveAt, state.user.lastActiveAt);
});

test("both block directions suppress content; outgoing block preserves the unblock profile", async () => {
  const { state, load } = fixture();
  state.following = true;
  state.outgoingBlock = true;
  const blocked = await load("alice", "bob");
  assert.equal(blocked.relationships.isBlockedByViewer, true);
  assert.equal(blocked.canViewContent, false);
  assert.equal(blocked.visibleLastActiveAt, null);
  state.outgoingBlock = false;
  state.incomingBlock = true;
  assert.equal(await load("alice", "bob"), null);
});

test("every failed profile or relationship lookup fails closed, without a permissive fallback", async () => {
  for (const failure of ["profile", "following", "request", "outgoingBlock", "incomingBlock"]) {
    const { state, load } = fixture();
    state.failure = failure;
    await assert.rejects(load("alice", "bob"), /Database unavailable/);
  }
});

test("anonymous requests fail before database access", async () => {
  const { state, load } = fixture();
  await assert.rejects(load("", "bob"), /Not authenticated/);
  assert.equal(state.reads, 0);
});

test("own renamed profile fallback is bound to authenticated identity", async () => {
  const { state, load } = fixture();
  state.user.isPrivate = true;
  const own = await load("bob", "bob-new", "bob-new");
  assert.equal(own.isOwner, true);
  assert.equal(own.canViewContent, true);
  assert.equal(state.reads, 2);
  assert.equal(await load("alice", "bob-new", "alice"), null);
});
