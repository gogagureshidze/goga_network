const test = require("node:test");
const assert = require("node:assert/strict");
const loadTs = require("./helpers/load-ts.cjs");

const cache = { revalidatePath() {}, revalidateTag() {}, unstable_cache: (fn) => fn };
function mocks(db, userId = "alice") {
  return {
    "@/lib/client": db,
    "@clerk/nextjs/server": { auth: async () => ({ userId }), currentUser: async () => userId ? ({ id: userId }) : null },
    "next/cache": cache,
  };
}
const publicContent = {
  user: { findUnique: async () => ({ isPrivate: false }) },
  block: { findFirst: async () => null },
  post: { findUnique: async () => ({ userId: "bob" }) },
};

test("poll creation and voting reject anonymous and forged actors before database access", async () => {
  for (const userId of [null, "alice"]) {
    const actions = loadTs("src/actions/pollActions.ts", mocks({}, userId));
    assert.ok((await actions.createPollPost({ userId: "bob", question: "Test?", options: ["A", "B"] })).error);
    assert.ok((await actions.castPollVote({ userId: "bob", pollId: 1, optionId: 2 })).error);
  }
});

test("poll vote rejects an option belonging to another poll", async () => {
  let writes = 0;
  const db = { ...publicContent,
    poll: { findUnique: async () => ({ postId: 1, expiresAt: new Date(Date.now() + 60_000) }) },
    pollOption: { findFirst: async ({ where }) => { assert.equal(where.pollId, 4); return null; } },
    pollVote: { create: async () => { writes++; } },
  };
  db.$transaction = async (fn, options) => { assert.equal(options.isolationLevel, "Serializable"); return fn(db); };
  const actions = loadTs("src/actions/pollActions.ts", mocks(db));
  assert.ok((await actions.castPollVote({ userId: "alice", pollId: 4, optionId: 5 })).error);
  assert.equal(writes, 0);
});

test("valid vote persists authenticated user in a serializable transaction", async () => {
  let writes = 0;
  const db = { ...publicContent,
    poll: { findUnique: async () => ({ postId: 1, expiresAt: new Date(Date.now() + 60_000) }) },
    pollOption: { findFirst: async () => ({ id: 5 }) },
    pollVote: { findFirst: async () => null, create: async ({ data }) => { writes++; assert.equal(data.userId, "alice"); return { id: 9 }; } },
  };
  db.$transaction = async (fn) => fn(db);
  const actions = loadTs("src/actions/pollActions.ts", mocks(db));
  assert.equal((await actions.castPollVote({ userId: "alice", pollId: 4, optionId: 5 })).vote.id, 9);
  assert.equal(writes, 1);
});

test("story comment deletion denies unrelated users and permits commenter or story owner", async () => {
  for (const actor of ["mallory", "alice", "bob"]) {
    let deleted = 0;
    const db = { storyComment: {
      findUnique: async () => ({ userId: "alice", story: { userId: "bob" } }),
      delete: async () => { deleted++; },
    } };
    const actions = loadTs("src/actions/StoryActions.ts", mocks(db, actor));
    if (actor === "mallory") await assert.rejects(actions.deleteStoryComment(1), /Unauthorized/);
    else await actions.deleteStoryComment(1);
    assert.equal(deleted, actor === "mallory" ? 0 : 1);
  }
});

test("story view cannot impersonate another account or an anonymous caller", async () => {
  for (const actor of [null, "alice"]) {
    const actions = loadTs("src/actions/StoryActions.ts", mocks({}, actor));
    await assert.rejects(actions.recordStoryView(1, "bob"), /Unauthorized/);
  }
});

test("highlight reorder cannot modify a row outside the owned highlight", async () => {
  const actions = loadTs("src/actions/highlightActions.ts", mocks({
    highlight: { findUnique: async () => ({ userId: "alice" }) },
    highlightStory: { findMany: async () => [] },
  }));
  await assert.rejects(actions.reorderHighlightStories(1, [{ id: 99, order: 0 }]), /belong to this highlight/);
});

test("highlight append cannot publish someone else's archived story", async () => {
  const actions = loadTs("src/actions/highlightActions.ts", mocks({
    highlight: { findUnique: async () => ({ userId: "alice" }) },
    archivedStory: { findMany: async ({ where }) => { assert.equal(where.userId, "alice"); return []; } },
  }));
  await assert.rejects(actions.addStoriesToHighlight(1, [99]), /your own stories/);
});

test("content access enforces private account membership and both block directions", async () => {
  for (const [isPrivate, follows, blocked, allowed] of [[false, false, false, true], [true, false, false, false], [true, true, false, true], [false, true, true, false]]) {
    const access = loadTs("src/lib/social-access.ts", mocks({
      user: { findUnique: async () => ({ isPrivate }) },
      block: { findFirst: async ({ where }) => { assert.equal(where.OR.length, 2); assert.equal(where.OR[0].blockedId, "bob"); assert.equal(where.OR[1].blockerId, "bob"); return blocked ? { id: 1 } : null; } },
      follower: { findUnique: async () => follows ? { id: 1 } : null },
    }));
    if (allowed) await access.assertCanViewUserContent("alice", "bob");
    else await assert.rejects(access.assertCanViewUserContent("alice", "bob"), /Content unavailable/);
  }
});

test("unpublished archives remain owner-only even when the account is public", async () => {
  const access = loadTs("src/lib/social-access.ts", mocks({
    ...publicContent,
    archivedStory: { findUnique: async () => ({ userId: "bob", highlightStories: [] }) },
  }));
  await assert.rejects(access.assertCanViewStory("alice", 1, true), /Content unavailable/);
  assert.equal((await access.assertCanViewStory("bob", 1, true)).userId, "bob");
});

test("comment reply cannot reference a different post", async () => {
  const actions = loadTs("src/actions/addReplyComment.ts", mocks({
    ...publicContent,
    comment: { findFirst: async ({ where }) => { assert.equal(where.postId, 1); return null; } },
  }));
  await assert.rejects(actions.addReplyComment(1, "Hello", 9), /Something went wrong/);
});

test("caption fetch rejects local URLs, credentials, untrusted hosts and other cloud accounts", () => {
  const { validateCaptionMediaUrl } = loadTs("src/lib/caption-media.ts");
  for (const url of ["http://127.0.0.1/", "https://res.cloudinary.com.evil.test/a", "https://user:pass@res.cloudinary.com/drlvgvx1l/image/upload/a.jpg", "https://res.cloudinary.com/other/image/upload/a.jpg", "https://res.cloudinary.com/drlvgvx1l/image/fetch/a.jpg"]) {
    assert.throws(() => validateCaptionMediaUrl(url));
  }
  assert.equal(validateCaptionMediaUrl("https://res.cloudinary.com/drlvgvx1l/image/upload/a.jpg").hostname, "res.cloudinary.com");
});

test("caption image uses verified content type, bounded response and no redirect following", async () => {
  const media = loadTs("src/lib/caption-media.ts", {}, { fetch: async (_url, options) => {
    assert.equal(options.redirect, "error");
    assert.ok(options.signal);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
  } });
  assert.equal((await media.fetchCaptionImage("https://res.cloudinary.com/drlvgvx1l/image/upload/a.png")).data, "AQID");
  const oversized = loadTs("src/lib/caption-media.ts", {}, { fetch: async () => new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers: { "content-type": "image/png" } }) });
  await assert.rejects(oversized.fetchCaptionImage("https://res.cloudinary.com/drlvgvx1l/image/upload/a.png"), /exceeds/);
});

test("caption generation requires a session before network or paid model calls", async () => {
  const actions = loadTs("src/actions/generateDesc.ts", {
    ...mocks({}, null),
    "@google/generative-ai": { GoogleGenerativeAI: class { getGenerativeModel() { throw new Error("Unexpected paid request"); } } },
  });
  assert.equal((await actions.generateDescription([])).error, "Not authenticated");
});

test('highlight response redacts hidden likes in both context and nested story data', async () => {
  for (const archived of [false, true]) {
    for (const globalLikes of [false, true]) {
      const story = { showLikes: !globalLikes, likes: [{ userId: 'alice' }], comments: [], views: [{userId:'eve'}] };
      const highlight = { id: 1, userId: 'bob', user: {showStoryLikes: globalLikes}, stories: [{ story: archived ? null : story, archivedStory: archived ? story : null }] };
      const db = { ...publicContent, user: {findUnique: async () => ({isPrivate:false})}, highlight: {findUnique: async () => highlight}, highlightView: {upsert:async()=>({})} };
      const actions = loadTs('src/actions/highlightActions.ts', mocks(db));
      const result = await actions.getHighlightDetails(1);
      const value = result.stories[0];
      assert.equal(value.context.isLiked, true);
      assert.equal(value.context.likesList.length, 0);
      assert.equal((value.story || value.archivedStory).likes.length, 0);
      assert.equal((value.story || value.archivedStory).views.length, 0);
    }
  }
});

test('feed and single-post actions omit hidden activity timestamps from client payloads', async () => {
  const db = { ...publicContent, post: {
    findMany: async () => [{id:1,user:{showActivityStatus:false,lastActiveAt:new Date()}}],
    findUnique: async () => ({id:1,userId:'bob',user:{showActivityStatus:false,lastActiveAt:new Date()}}),
  }};
  const actions = loadTs('src/actions/loadActions.ts', mocks(db));
  assert.equal((await actions.fetchPosts({page:1}))[0].user.lastActiveAt, null);
  assert.equal((await actions.fetchSinglePost(1)).user.lastActiveAt, null);
});
