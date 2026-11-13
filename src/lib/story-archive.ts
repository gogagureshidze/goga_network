import "server-only";
import prisma from "@/lib/client";
import type { Prisma } from "@/generated/prisma";

const snapshotInclude = {
  likes: { include: { user: { select: { id: true, username: true, avatar: true } } } },
  views: { include: { user: { select: { id: true, username: true, avatar: true } } } },
  comments: { include: { user: { select: { id: true, username: true, avatar: true } }, likes: { select: { id: true } } } },
} satisfies Prisma.StoryInclude;

/** Copy, relink highlights, and remove the source in the same transaction. */
export async function archiveStorySnapshot(storyId: number, ownerId?: string, expiredBefore?: Date) {
  if (!Number.isSafeInteger(storyId) || storyId < 1) throw new Error("Invalid story");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        try {
          // An identity update acquires the source row lock before reading any
          // interactions, serializing manual, scheduled, and duplicate requests.
          await tx.story.update({ where: { id: storyId, ...(ownerId ? { userId: ownerId } : {}), ...(expiredBefore ? { expiresAt: { lte: expiredBefore } } : {}) }, data: { id: storyId } });
        } catch (reason) {
          if ((reason as { code?: string }).code !== "P2025") throw reason;
          const existing = await tx.archivedStory.findFirst({ where: { originalStoryId: storyId, ...(ownerId ? { userId: ownerId } : {}) }, select: { id: true } });
          return existing ? { id: existing.id, created: false } : null;
        }
        const story = await tx.story.findUnique({ where: { id: storyId }, include: snapshotInclude });
        if (!story) return null;
        let archive = await tx.archivedStory.findFirst({ where: { originalStoryId: storyId, userId: story.userId }, select: { id: true } });
        const created = !archive;
        if (!archive) archive = await tx.archivedStory.create({ data: {
          originalStoryId: story.id, img: story.img, createdAt: story.createdAt, expiresAt: story.expiresAt,
          showLikes: story.showLikes, userId: story.userId, likesCount: story.likes.length, viewsCount: story.views.length, commentsCount: story.comments.length,
          likes: { create: story.likes.map((like) => ({ userId: like.user.id, username: like.user.username, userAvatar: like.user.avatar, createdAt: like.createdAt })) },
          views: { create: story.views.map((view) => ({ userId: view.user.id, username: view.user.username, userAvatar: view.user.avatar, createdAt: view.createdAt })) },
          comments: { create: story.comments.map((comment) => ({ desc: comment.desc, userId: comment.user.id, username: comment.user.username, userAvatar: comment.user.avatar, createdAt: comment.createdAt, likesCount: comment.likes.length })) },
        }, select: { id: true } });
        // Preserve published highlights: deleting a source with its old FK
        // would otherwise cascade-delete the highlight entry.
        await tx.highlightStory.updateMany({ where: { storyId }, data: { storyId: null, archivedStoryId: archive.id } });
        await tx.story.delete({ where: { id: storyId } });
        return { id: archive.id, created };
      }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
    } catch (reason) {
      if ((reason as { code?: string }).code !== "P2034" || attempt === 2) throw reason;
    }
  }
  throw new Error("Story archive could not complete");
}

/** Trusted server maintenance may omit ownerId; public actions always scope it. */
export async function archiveExpiredStoryBatch({ ownerId, limit = 25 }: { ownerId?: string; limit?: number } = {}) {
  const now = new Date();
  const take = Number.isSafeInteger(limit) ? Math.min(100, Math.max(1, limit)) : 25;
  const stories = await prisma.story.findMany({ where: { ...(ownerId ? { userId: ownerId } : {}), expiresAt: { lte: now } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], select: { id: true }, take });
  let count = 0;
  for (const story of stories) if ((await archiveStorySnapshot(story.id, ownerId, now))?.created) count += 1;
  return { success: true, count };
}
