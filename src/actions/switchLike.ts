"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";

// Add a simple in-memory lock to prevent race conditions
const likeLocks = new Map<string, Promise<any>>();

export const switchLike = async (postId: number, shouldLike?: boolean) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    return {
      success: false,
      error: "User is not authenticated",
      likeUserIds: [],
      likeCount: 0,
    };
  }

  const lockKey = `${currentUserId}-${postId}`;

  // Wait for any existing operation to complete
  if (likeLocks.has(lockKey)) {
    try {
      await likeLocks.get(lockKey);
    } catch {
      console.log("Previous like operation failed, proceeding with new one");
    }
  }

  // Create a new promise for this operation
  const operationPromise = performLikeOperation(
    currentUserId,
    postId,
    shouldLike
  );
  likeLocks.set(lockKey, operationPromise);

  try {
    const result = await operationPromise;
    return result;
  } finally {
    // Clean up the lock
    likeLocks.delete(lockKey);
  }
};

async function performLikeOperation(
  currentUserId: string,
  postId: number,
  shouldLike?: boolean
) {
  try {
    // Use a transaction with serializable isolation to prevent race conditions
    const result = await prisma.$transaction(
      async (tx) => {
        // Get current like state with lock
        const existingLike = await tx.like.findFirst({
          where: {
            userId: currentUserId,
            postId: postId,
          },
        });

        const currentlyLiked = !!existingLike;

        // Determine target state
        let targetLikeState: boolean;
        if (shouldLike !== undefined) {
          targetLikeState = shouldLike;
        } else {
          targetLikeState = !currentlyLiked;
        }

        // Skip if already in target state
        if (currentlyLiked === targetLikeState) {
          const allLikes = await tx.like.findMany({
            where: { postId },
            select: { userId: true },
          });

          return {
            isLiked: currentlyLiked,
            likeUserIds: allLikes.map((like) => like.userId),
            likeCount: allLikes.length,
          };
        }

        // Perform the operation
        if (targetLikeState) {
          // Like - use upsert to handle potential race conditions
          await tx.like.upsert({
            where: {
              userId_postId: {
                userId: currentUserId,
                postId: postId,
              },
            },
            create: {
              userId: currentUserId,
              postId: postId,
            },
            update: {},
          });
        } else {
          if (existingLike) {
            await tx.like.delete({
              where: {
                id: existingLike.id,
              },
            });
          }
        }

        // Get final state
        const finalLikes = await tx.like.findMany({
          where: { postId },
          select: { userId: true },
        });

        return {
          isLiked: targetLikeState,
          likeUserIds: finalLikes.map((like) => like.userId),
          likeCount: finalLikes.length,
        };
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000, // 5 seconds
        timeout: 10000, // 10 seconds
      }
    );

    // Revalidate caches after successful transaction
    // Use Promise.all to revalidate in parallel
    await Promise.all([
      revalidateTag("feed-posts"),
      revalidateTag("profile-posts"),
      revalidateTag(`post-${postId}`),
      revalidatePath("/", "layout"),
    ]);

    return {
      success: true,
      ...result,
    };
  } catch (err: any) {
    console.error("Like operation error:", err);

    // Handle specific Prisma errors
    if (err.code === "P2034") {
      // Transaction conflict - retry might help
      return {
        success: false,
        error: "Operation conflict, please try again",
        likeUserIds: [],
        likeCount: 0,
      };
    }

    // Try to get current state for recovery
    try {
      const currentLikes = await prisma.like.findMany({
        where: { postId },
        select: { userId: true },
      });

      return {
        success: false,
        error: err.message || "Like operation failed",
        likeUserIds: currentLikes.map((like) => like.userId),
        likeCount: currentLikes.length,
        isLiked: currentLikes.some((like) => like.userId === currentUserId),
      };
    } catch (fallbackErr) {
      return {
        success: false,
        error: "Database error",
        likeUserIds: [],
        likeCount: 0,
        isLiked: false,
      };
    }
  }
}

// Optional: Add a function to get like status for multiple posts efficiently
export const getLikeStatuses = async (postIds: number[]) => {
  const user = await currentUser();
  if (!user?.id) return {};

  try {
    const likes = await prisma.like.findMany({
      where: {
        userId: user.id,
        postId: { in: postIds },
      },
      select: { postId: true },
    });

    return likes.reduce((acc, like) => {
      if (like.postId !== null) {
        acc[like.postId] = true;
      }
      return acc;
    }, {} as Record<number, boolean>);
  } catch (error) {
    console.error("Error fetching like statuses:", error);
    return {};
  }
};
