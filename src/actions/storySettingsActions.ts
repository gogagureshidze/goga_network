"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { archiveExpiredStoryBatch, archiveStorySnapshot } from "@/lib/story-archive";


// Public server actions may process only the authenticated owner's stories.
export async function checkAndArchiveExpiredStories() {
  const user = await currentUser();
  if (!user?.id) return { success: false, count: 0 };
  try { return await archiveExpiredStoryBatch({ ownerId: user.id, limit: 25 }); }
  catch { console.error("story.archive_batch_failed"); return { success: false, count: 0 }; }
}

// Toggle allow story comments
export async function toggleAllowStoryComments() {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { allowStoryComments: true },
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        allowStoryComments: !dbUser?.allowStoryComments,
      },
    });

    revalidatePath("/");
    return {
      success: true,
      allowStoryComments: updated.allowStoryComments,
    };
  } catch (error) {
    console.error("story.comments_setting_failed");
    throw error;
  }
}

// Toggle show story likes
export async function toggleShowStoryLikes() {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { showStoryLikes: true },
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        showStoryLikes: !dbUser?.showStoryLikes,
      },
    });

    revalidatePath("/");
    return {
      success: true,
      showStoryLikes: updated.showStoryLikes,
    };
  } catch (error) {
    console.error("story.likes_setting_failed");
    throw error;
  }
}

// Manual retries return the existing archive without duplicating snapshots.
export async function archiveStory(storyId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");
  const archive = await archiveStorySnapshot(storyId, user.id);
  if (!archive) throw new Error("Story unavailable");
  revalidatePath("/");
  return { success: true, archivedStoryId: archive.id };
}

// Get user's archived stories
export async function getArchivedStories() {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const archivedStories = await prisma.archivedStory.findMany({
      where: { userId: user.id },
      include: {
        likes: true,
        views: true,
        comments: true,
      },
      orderBy: { archivedAt: "desc" },
    });

    return archivedStories;
  } catch (error) {
    console.error("story.archives_read_failed");
    throw error;
  }
}

// Repost an archived story
export async function repostArchivedStory(archivedStoryId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");
  if (!Number.isSafeInteger(archivedStoryId) || archivedStoryId < 1) throw new Error("Invalid archive");

  try {
    const archivedStory = await prisma.archivedStory.findUnique({
      where: { id: archivedStoryId },
    });

    if (!archivedStory) throw new Error("Archived story not found");
    if (archivedStory.userId !== user.id) throw new Error("Not authorized");

    const newStory = await prisma.$transaction(async (tx) => {
      await tx.archivedStory.update({ where: { id: archivedStoryId, userId: user.id }, data: { id: archivedStoryId } });
      const story = await tx.story.create({
        data: {
          userId: user.id,
          img: archivedStory.img,
          showLikes: archivedStory.showLikes,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        include: { user: true, likes: true, views: true, comments: { include: { user: true, likes: true } } },
      });
      await tx.highlightStory.updateMany({ where: { archivedStoryId }, data: { archivedStoryId: null, storyId: story.id } });
      await tx.archivedStory.delete({ where: { id: archivedStoryId } });
      return story;
    }, { isolationLevel: "Serializable" });

    revalidatePath("/");
    return { success: true, story: newStory };
  } catch (error) {
    console.error("story.repost_failed");
    throw error;
  }
}

// Delete an archived story permanently
export async function deleteArchivedStory(archivedStoryId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");
  if (!Number.isSafeInteger(archivedStoryId) || archivedStoryId < 1) throw new Error("Invalid archive");

  try {
    const archivedStory = await prisma.archivedStory.findUnique({
      where: { id: archivedStoryId },
      select: { userId: true },
    });

    if (!archivedStory) throw new Error("Archived story not found");
    if (archivedStory.userId !== user.id) throw new Error("Not authorized");

    await prisma.archivedStory.delete({
      where: { id: archivedStoryId },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("story.archive_delete_failed");
    throw error;
  }
}

// Legacy action contract retained, now authenticated and owner-scoped. A trusted
// scheduler imports archiveExpiredStoryBatch from the server-only module.
export async function autoArchiveExpiredStories() {
  return checkAndArchiveExpiredStories();
}
