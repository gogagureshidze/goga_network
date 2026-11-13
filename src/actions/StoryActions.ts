"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { assertCanViewStory } from "@/lib/social-access";

export async function likeStoryComment(commentId: number, isLiking: boolean) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const comment = await prisma.storyComment.findUnique({ where: { id: commentId }, select: { storyId: true } });
    if (!comment) throw new Error("Comment not found");
    await assertCanViewStory(user.id, comment.storyId);
    if (isLiking) {
      await prisma.like.upsert({
        where: {
          userId_storyCommentId: { userId: user.id, storyCommentId: commentId },
        },
        create: { storyCommentId: commentId, userId: user.id },
        update: {},
      });
    } else {
      await prisma.like.delete({
        where: {
          userId_storyCommentId: { userId: user.id, storyCommentId: commentId },
        },
      });
    }
    revalidatePath('/')
    return { success: true };
  } catch (error: any) {
    console.error("story.comment_like_failed");
    throw error;
  }
}



// This function adds a new comment to a story.
export const addStoryComment = async (storyId: number, desc: string) => {
  const user = await currentUser();
  if (!user) throw new Error("User not authenticated.");

  if (typeof desc !== "string" || !desc.trim() || desc.length > 255) throw new Error("Comment must contain 1–255 characters.");

  try {
    const story = await assertCanViewStory(user.id, storyId);
    const owner = await prisma.user.findUnique({ where: { id: story.userId }, select: { allowStoryComments: true } });
    if (!owner?.allowStoryComments) throw new Error("Story comments are disabled");
    const newComment = await prisma.storyComment.create({
      data: {
        desc,
        storyId,
        userId: user.id,
      },
      include: {
        user: true,
        likes: {
          select: { userId: true },
        },
      },
    });

    const commentWithIds = {
      ...newComment,
      storyId,
      userId: user.id,
    };

    revalidatePath("/");
    return commentWithIds;
  } catch (err) {
    console.error("Failed to add story comment:", err);
    throw err;
  }
};

// Function to delete a story comment
// Function to delete a story comment
export const deleteStoryComment = async (commentId: number) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User not authenticated.");
  }

  try {
    // 1️⃣ Find and check comment ownership in one go
    const comment = await prisma.storyComment.findUnique({
      where: { id: commentId },
      select: { userId: true, story: { select: { userId: true } } },
    });

    if (!comment) {
      throw new Error("Comment not found.");
    }
    if (comment.userId !== userId && comment.story.userId !== userId) throw new Error("Unauthorized");
    

    // 3️⃣ Delete the comment
    await prisma.storyComment.delete({
      where: { id: commentId },
    });

    revalidatePath("/");
  } catch (err) {
    console.error("Failed to delete story comment:", err);
    throw err;
  }
};
// Function to get comments for a specific story
export const getStoryComments = async (storyId: number) => {
  try {
    const user = await currentUser();
    await assertCanViewStory(user?.id, storyId);
    const comments = await prisma.storyComment.findMany({
      where: {
        storyId: storyId,
      },
      include: {
        user: true,
        likes: {
          select: { userId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return comments;
  } catch (err) {
    console.error("Failed to get story comments:", err);
    throw err;
  }
};

// Record story view

export async function recordStoryView(storyId: number, userId: string) {
  const user = await currentUser();
  if (!user || user.id !== userId) throw new Error("Unauthorized");
  await assertCanViewStory(user.id, storyId);
  return prisma.storyView.upsert({
    where: { storyId_userId: { storyId, userId } },
    update: {},
    create: { storyId, userId },
  });
}


// ✨ NEW: Get story activity (views and likes)
export async function getStoryActivity(storyId: number) {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) throw new Error("Not authenticated");

  try {
    // Check if user owns the story
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { userId: true },
    });

    if (!story || story.userId !== userId) {
      throw new Error("You can only view activity for your own stories");
    }

    // Get story views
    const views = await prisma.storyView.findMany({
      where: { storyId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            surname: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get story likes
    const likes = await prisma.like.findMany({
      where: { storyId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            surname: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { views, likes };
  } catch (err) {
    console.error("Failed to get story activity:", err);
    throw err;
  }
}

// ✨ NEW: Delete story
export async function deleteStory(storyId: number) {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) throw new Error("Not authenticated");

  try {
    // Check if user owns the story
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { userId: true },
    });

    if (!story || story.userId !== userId) {
      throw new Error("You can only delete your own stories");
    }

    // Delete the story (cascade will handle related records)
    await prisma.story.delete({
      where: { id: storyId },
    });

    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete story:", err);
    throw err;
  }
}
