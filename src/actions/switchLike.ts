"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

export const switchLike = async (postId: number) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("User is not authenticated!");
  }

  try {
    const existingLike = await prisma.like.findFirst({
      where: {
        userId: currentUserId,
        postId: postId,
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: {
          id: existingLike.id,
        },
      });
    } else {
      // Like
      await prisma.like.create({
        data: {
          postId: postId,
          userId: currentUserId,
        },
      });
    }

    // Get updated like user IDs for optimistic update sync
    const allLikes = await prisma.like.findMany({
      where: {
        postId: postId,
      },
      select: {
        userId: true,
      },
    });

    const likeUserIds = allLikes.map((like) => like.userId);

    // REMOVED revalidatePath - optimistic updates handle UI!

    return {
      success: true,
      likeUserIds,
      likeCount: likeUserIds.length,
    };
  } catch (err) {
    console.error("Like operation error:", err);
    throw new Error("Like operation failed");
  }
};
