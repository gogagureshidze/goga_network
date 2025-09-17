"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function likeStoryComment(commentId: number, isLiking: boolean) {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
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
    console.error("FULL ERROR:", error); // 🔥 log full error
    throw error; // rethrow to see full stack in console
  }
}



// This function adds a new comment to a story.
export const addStoryComment = async (storyId: number, desc: string) => {
  const user = await currentUser();
  if (!user) throw new Error("User not authenticated.");

  if (!desc.trim()) throw new Error("Comment cannot be empty.");

  try {
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
      select: { userId: true },
    });

    if (!comment) {
      throw new Error("Comment not found.");
    }
    
    // 2️⃣ Ensure the user is the owner of the comment
    if (comment.userId !== userId) {
      throw new Error("Unauthorized: You can only delete your own comments.");
    }

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
