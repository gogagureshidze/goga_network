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
    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check current state
      const existingLike = await tx.like.findFirst({
        where: {
          userId: currentUserId,
          postId: postId,
        },
      });

      let isLiked: boolean;

      if (existingLike) {
        // Unlike - delete the like
        await tx.like.delete({
          where: {
            id: existingLike.id,
          },
        });
        isLiked = false;
      } else {
        // Like - create new like with upsert to prevent duplicates
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
          update: {}, // No-op if exists
        });
        isLiked = true;
      }

      // Get final state from database
      const finalLikes = await tx.like.findMany({
        where: {
          postId: postId,
        },
        select: {
          userId: true,
        },
      });

      return {
        isLiked,
        likeUserIds: finalLikes.map((like) => like.userId),
        likeCount: finalLikes.length,
      };
    });

    // Force revalidation to ensure consistency
    revalidatePath("/");

    return {
      success: true,
      ...result,
    };
  } catch (err) {
    console.error("Like operation error:", err);

    // Return current state on error
    try {
      const currentLikes = await prisma.like.findMany({
        where: { postId: postId },
        select: { userId: true },
      });

      return {
        success: false,
        error: err || "Like operation failed",
        likeUserIds: currentLikes.map((like) => like.userId),
        likeCount: currentLikes.length,
      };
    } catch (fallbackErr) {
      return {
        success: false,
        error: "Database error",
        likeUserIds: [],
        likeCount: 0,
      };
    }
  }
};
