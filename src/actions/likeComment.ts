"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";

// In-memory lock to prevent race conditions
const likeLocks = new Map<string, Promise<any>>();

export async function likeComment(commentId: number, shouldLike?: boolean) {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    return {
      success: false,
      error: "User not authenticated",
      likeUserIds: [],
      likeCount: 0,
    };
  }

  const lockKey = `${userId}-${commentId}`;

  // Wait for any existing operation to complete
  if (likeLocks.has(lockKey)) {
    try {
      await likeLocks.get(lockKey);
    } catch {
      console.log("Previous like operation failed, proceeding with new one");
    }
  }

  // Create a new promise for this operation
  const operationPromise = performCommentLikeOperation(
    userId,
    commentId,
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
}

async function performCommentLikeOperation(
  userId: string,
  commentId: number,
  shouldLike?: boolean
) {
  try {
    // Use a transaction with serializable isolation
    const result = await prisma.$transaction(
      async (tx) => {
        // Get current like state
        const existingLike = await tx.like.findFirst({
          where: {
            userId: userId,
            commentId: commentId,
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
            where: { commentId },
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
              userId_commentId: {
                userId: userId,
                commentId: commentId,
              },
            },
            create: {
              userId: userId,
              commentId: commentId,
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
          where: { commentId },
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
        maxWait: 5000,
        timeout: 10000,
      }
    );

    // Revalidate caches
    await Promise.all([
      revalidateTag("feed-posts"),
      revalidateTag("profile-posts"),
      revalidatePath("/"),
    ]);

    return {
      success: true,
      ...result,
    };
  } catch (err: any) {
    console.error("Comment like operation error:", err);

    if (err.code === "P2034") {
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
        where: { commentId },
        select: { userId: true },
      });

      return {
        success: false,
        error: err.message || "Like operation failed",
        likeUserIds: currentLikes.map((like) => like.userId),
        likeCount: currentLikes.length,
        isLiked: currentLikes.some((like) => like.userId === userId),
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
