"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export const switchLike = async (postId: number) => {
  const user = await currentUser();
  const currentUserId = user?.id;
  if (!currentUserId) throw new Error("User is not authenticated!");

  try {
    // First, check if the like exists
    const existingLike = await prisma.like.findFirst({
      where: {
        postId,
        userId: currentUserId,
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
      // Like: Create a new like
      await prisma.like.create({
        data: {
          postId,
          userId: currentUserId,
        },
      });
      isLiked = true;
    }

    // Get all user IDs who liked this post
    const allLikes = await prisma.like.findMany({
      where: {
        postId,
      },
      select: {
        userId: true,
      },
    });

    const likeUserIds = allLikes.map((like) => like.userId);

    // Revalidate the path to update the cache
    revalidatePath("/");

    return {
      success: true,
      isLiked,
      likeUserIds,
      likeCount: likeUserIds.length,
    };
  } catch (err) {
    console.error("Like operation error:", err);
    throw new Error("Something went wrong with the like operation.");
  }
};
