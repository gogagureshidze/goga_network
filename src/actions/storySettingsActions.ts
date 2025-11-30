"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";


// Check and auto-archive expired stories on-the-fly
export async function checkAndArchiveExpiredStories() {
  
  try {
    const expiredStories = await prisma.story.findMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
      include: {
        likes: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        views: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            likes: true,
          },
        },
      },
    });

    for (const story of expiredStories) {
      await prisma.archivedStory.create({
        data: {
          originalStoryId: story.id,
          img: story.img,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
          showLikes: story.showLikes,
          userId: story.userId,
          likesCount: story.likes.length,
          viewsCount: story.views.length,
          commentsCount: story.comments.length,
          likes: {
            create: story.likes.map((like) => ({
              userId: like.user.id,
              username: like.user.username,
              userAvatar: like.user.avatar,
              createdAt: like.createdAt,
            })),
          },
          views: {
            create: story.views.map((view) => ({
              userId: view.user.id,
              username: view.user.username,
              userAvatar: view.user.avatar,
              createdAt: view.createdAt,
            })),
          },
          comments: {
            create: story.comments.map((comment) => ({
              desc: comment.desc,
              userId: comment.user.id,
              username: comment.user.username,
              userAvatar: comment.user.avatar,
              createdAt: comment.createdAt,
              likesCount: comment.likes.length,
            })),
          },
        },
      });

      await prisma.story.delete({
        where: { id: story.id },
      });
    }

    return { success: true, count: expiredStories.length };
  } catch (error) {
    console.error("Failed to auto-archive stories:", error);
    return { success: false, count: 0 };
  }
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
    console.error("Failed to toggle story comments:", error);
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
    console.error("Failed to toggle story likes:", error);
    throw error;
  }
}

// Archive a story manually
export async function archiveStory(storyId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    // Get the story with all its data
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: {
        likes: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        views: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            likes: true,
          },
        },
      },
    });

    if (!story) throw new Error("Story not found");
    if (story.userId !== user.id) throw new Error("Not authorized");

    // Create archived story with snapshot data
    const archivedStory = await prisma.archivedStory.create({
      data: {
        originalStoryId: story.id,
        img: story.img,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        showLikes: story.showLikes,
        userId: story.userId,
        likesCount: story.likes.length,
        viewsCount: story.views.length,
        commentsCount: story.comments.length,
        // Archive likes
        likes: {
          create: story.likes.map((like) => ({
            userId: like.user.id,
            username: like.user.username,
            userAvatar: like.user.avatar,
            createdAt: like.createdAt,
          })),
        },
        // Archive views
        views: {
          create: story.views.map((view) => ({
            userId: view.user.id,
            username: view.user.username,
            userAvatar: view.user.avatar,
            createdAt: view.createdAt,
          })),
        },
        // Archive comments
        comments: {
          create: story.comments.map((comment) => ({
            desc: comment.desc,
            userId: comment.user.id,
            username: comment.user.username,
            userAvatar: comment.user.avatar,
            createdAt: comment.createdAt,
            likesCount: comment.likes.length,
          })),
        },
      },
    });

    // Delete the original story
    await prisma.story.delete({
      where: { id: storyId },
    });

    revalidatePath("/");
    return { success: true, archivedStoryId: archivedStory.id };
  } catch (error) {
    console.error("Failed to archive story:", error);
    throw error;
  }
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
    console.error("Failed to fetch archived stories:", error);
    throw error;
  }
}

// Repost an archived story
// Repost an archived story
export async function repostArchivedStory(archivedStoryId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const archivedStory = await prisma.archivedStory.findUnique({
      where: { id: archivedStoryId },
    });

    if (!archivedStory) throw new Error("Archived story not found");
    if (archivedStory.userId !== user.id) throw new Error("Not authorized");

    // Create new story from archived data
    const newStory = await prisma.story.create({
      data: {
        userId: user.id,
        img: archivedStory.img,
        showLikes: archivedStory.showLikes,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      },
      include: {
        user: true,
        likes: true,
        views: true,
        comments: {
          include: {
            user: true,
            likes: true,
          },
        },
      },
    });

    // Delete the archived story after reposting
    await prisma.archivedStory.delete({
      where: { id: archivedStoryId },
    });

    revalidatePath("/");
    return { success: true, story: newStory };
  } catch (error) {
    console.error("Failed to repost archived story:", error);
    throw error;
  }
}

// Delete an archived story permanently
export async function deleteArchivedStory(archivedStoryId: number) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

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
    console.error("Failed to delete archived story:", error);
    throw error;
  }
}

// Auto-archive expired stories (to be called by a cron job)
export async function autoArchiveExpiredStories() {
  try {
    const expiredStories = await prisma.story.findMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
      include: {
        likes: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        views: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            likes: true,
          },
        },
      },
    });

    for (const story of expiredStories) {
      // Create archived version
      await prisma.archivedStory.create({
        data: {
          originalStoryId: story.id,
          img: story.img,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
          showLikes: story.showLikes,
          userId: story.userId,
          likesCount: story.likes.length,
          viewsCount: story.views.length,
          commentsCount: story.comments.length,
          likes: {
            create: story.likes.map((like) => ({
              userId: like.user.id,
              username: like.user.username,
              userAvatar: like.user.avatar,
              createdAt: like.createdAt,
            })),
          },
          views: {
            create: story.views.map((view) => ({
              userId: view.user.id,
              username: view.user.username,
              userAvatar: view.user.avatar,
              createdAt: view.createdAt,
            })),
          },
          comments: {
            create: story.comments.map((comment) => ({
              desc: comment.desc,
              userId: comment.user.id,
              username: comment.user.username,
              userAvatar: comment.user.avatar,
              createdAt: comment.createdAt,
              likesCount: comment.likes.length,
            })),
          },
        },
      });

      // Delete the expired story
      await prisma.story.delete({
        where: { id: story.id },
      });
    }

    console.log(`Auto-archived ${expiredStories.length} expired stories`);
    return { success: true, count: expiredStories.length };
  } catch (error) {
    console.error("Failed to auto-archive stories:", error);
    throw error;
  }
}
