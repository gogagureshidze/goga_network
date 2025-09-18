"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export const switchLike = async (postId: number) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    // Use upsert/delete pattern to avoid race conditions
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId: currentUserId,
          postId: postId,
        },
      },
    });

    let isLiked: boolean;

    if (existingLike) {
      // Unlike: Delete the existing like
      await prisma.like.delete({
        where: {
          id: existingLike.id,
        },
      });
      isLiked = false;
    } else {
      // Like: Create a new like using upsert to prevent duplicates
      await prisma.like.upsert({
        where: {
          userId_postId: {
            userId: currentUserId,
            postId: postId,
          },
        },
        create: {
          postId: postId,
          userId: currentUserId,
        },
        update: {}, // No-op if already exists
      });
      isLiked = true;
    }

    // Get updated like count and user IDs in a single query
    const allLikes = await prisma.like.findMany({
      where: {
        postId: postId,
      },
      select: {
        userId: true,
      },
    });

    const likeUserIds = allLikes.map((like) => like.userId);

    // Skip revalidatePath for better performance - let optimistic updates handle UI
    // Uncomment only if you need server-side rendering to be updated immediately
    // revalidatePath("/");

    return {
      success: true,
      isLiked,
      likeUserIds,
      likeCount: likeUserIds.length,
    };
  } catch (err) {
    console.error("Like operation error:", err);

    // Return more specific error information
    if (err instanceof Error) {
      throw new Error(`Like operation failed: ${err.message}`);
    }

    throw new Error("Something went wrong with the like operation.");
  }
};
