"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// This function handles liking and unliking a story.
export const likeStory = async (storyId: number, isLiking: boolean) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User not authenticated.");
  }

  try {
    if (isLiking) {
      // Create a new like record for the story
      await prisma.like.create({
        data: {
          userId: userId,
          storyId: storyId,
        },
      });
    } else {
      // Delete the like record for the story
      const likeRecord = await prisma.like.findFirst({
        where: {
          userId: userId,
          storyId: storyId,
        },
      });

      if (likeRecord) {
        await prisma.like.delete({
          where: {
            id: likeRecord.id,
          },
        });
      }
    }

    // Revalidate the path to update the UI
    revalidatePath("/");
  } catch (err) {
    console.error("Failed to like/unlike story:", err);
    throw err;
  }
};

// This function handles liking and unliking a comment on a story.
export const likeStoryComment = async (
  commentId: number,
  isLiking: boolean
) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User not authenticated.");
  }

  try {
    if (isLiking) {
      // Create a new like record for the comment
      await prisma.like.create({
        data: {
          userId: userId,
          commentId: commentId,
        },
      });
    } else {
      // Find the like record first by userId and commentId
      const likeRecord = await prisma.like.findFirst({
        where: {
          userId: userId,
          commentId: commentId,
        },
      });

      if (likeRecord) {
        await prisma.like.delete({
          where: {
            id: likeRecord.id,
          },
        });
      }
    }

    // Revalidate the path to update the UI
    revalidatePath("/");
  } catch (err) {
    console.error("Failed to like/unlike story comment:", err);
    throw err;
  }
};

// This function adds a new comment to a story.
export const addStoryComment = async (storyId: number, desc: string) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User not authenticated.");
  }

  if (!desc.trim()) {
    throw new Error("Comment cannot be empty.");
  }

  try {
    const newComment = await prisma.storyComment.create({
      data: {
        desc: desc.trim(),
        userId: userId,
        storyId: storyId,
      },
      include: {
        user: true,
        likes: {
          select: { userId: true },
        },
        replies: {
          include: {
            user: true,
            likes: {
              select: { userId: true },
            },
          },
        },
      },
    });

    // Revalidate the path to update the UI
    revalidatePath("/");
    return newComment;
  } catch (err) {
    console.error("Failed to add story comment:", err);
    throw err;
  }
};

// NEW: This function adds a reply to a story comment
export const addStoryCommentReply = async (commentId: number, desc: string) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User not authenticated.");
  }

  if (!desc.trim()) {
    throw new Error("Reply cannot be empty.");
  }

  try {
    // First, get the original comment to find the storyId
    const parentComment = await prisma.storyComment.findUnique({
      where: { id: commentId },
      select: { storyId: true },
    });

    if (!parentComment) {
      throw new Error("Parent comment not found.");
    }

    const newReply = await prisma.storyComment.create({
      data: {
        desc: desc.trim(),
        userId: userId,
        storyId: parentComment.storyId,
        parentId: commentId, // This makes it a reply
      },
      include: {
        user: true,
        likes: {
          select: { userId: true },
        },
      },
    });

    // Revalidate the path to update the UI
    revalidatePath("/");
    return newReply;
  } catch (err) {
    console.error("Failed to add story comment reply:", err);
    throw err;
  }
};

// Optional: Function to delete a story comment or reply
export const deleteStoryComment = async (commentId: number) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User not authenticated.");
  }

  try {
    // Check if user owns the comment
    const comment = await prisma.storyComment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      throw new Error("Comment not found.");
    }

    if (comment.userId !== userId) {
      throw new Error("You can only delete your own comments.");
    }

    // Delete the comment (this will also delete all replies due to cascade)
    await prisma.storyComment.delete({
      where: { id: commentId },
    });

    revalidatePath("/");
  } catch (err) {
    console.error("Failed to delete story comment:", err);
    throw err;
  }
};

// Optional: Function to get comments with replies for a specific story
export const getStoryComments = async (storyId: number) => {
  try {
    const comments = await prisma.storyComment.findMany({
      where: {
        storyId: storyId,
        parentId: null, // Only get top-level comments
      },
      include: {
        user: true,
        likes: {
          select: { userId: true },
        },
        replies: {
          include: {
            user: true,
            likes: {
              select: { userId: true },
            },
          },
          orderBy: { createdAt: "asc" },
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
