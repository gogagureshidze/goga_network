import prisma from "@/lib/client";
import type { Prisma } from "@/generated/prisma";

// Check the current database state: privacy decisions must not use stale caches.
export async function assertCanViewUserContent(viewerId: string | null | undefined, ownerId: string) {
  if (!viewerId) throw new Error("Not authenticated");
  if (viewerId === ownerId) return;

  const [owner, block] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { isPrivate: true } }),
    prisma.block.findFirst({
      where: { OR: [{ blockerId: viewerId, blockedId: ownerId }, { blockerId: ownerId, blockedId: viewerId }] },
      select: { id: true },
    }),
  ]);
  if (!owner || block) throw new Error("Content unavailable");
  if (owner.isPrivate) {
    const follows = await prisma.follower.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
      select: { id: true },
    });
    if (!follows) throw new Error("Content unavailable");
  }
}

export async function assertCanViewPost(viewerId: string | null | undefined, postId: number) {
  if (!Number.isSafeInteger(postId) || postId < 1) throw new Error("Invalid post");
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
  if (!post) throw new Error("Content unavailable");
  await assertCanViewUserContent(viewerId, post.userId);
}

export async function assertCanViewStory(viewerId: string | null | undefined, storyId: number, archived = false) {
  if (!Number.isSafeInteger(storyId) || storyId < 1) throw new Error("Invalid story");
  let story: { userId: string } | null;
  if (archived) {
    const archive = await prisma.archivedStory.findUnique({ where: { id: storyId }, select: { userId: true, highlightStories: { take: 1, select: { id: true } } } });
    // Archives remain private unless their owner has published them in a highlight.
    if (archive && archive.userId !== viewerId && !archive.highlightStories.length) throw new Error("Content unavailable");
    story = archive;
  } else {
    story = await prisma.story.findUnique({ where: { id: storyId }, select: { userId: true } });
  }
  if (!story) throw new Error("Content unavailable");
  await assertCanViewUserContent(viewerId, story.userId);
  return story;
}

export function visiblePostWhere(viewerId: string): Prisma.PostWhereInput {
  return {
    user: { is: {
      OR: [{ id: viewerId }, { isPrivate: false }, { followings: { some: { followerId: viewerId } } }],
      blocks: { none: { blockedId: viewerId } },
      blockedBy: { none: { blockerId: viewerId } },
    } },
  };
}
