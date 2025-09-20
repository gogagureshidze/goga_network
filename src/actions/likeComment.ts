"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";

export async function likeComment(commentId: number) {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User not authenticated");
  }

  try {
    const existingLike = await prisma.like.findFirst({
      where: {
        commentId,
        userId,
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
          commentId,
          userId,
        },
      });
    }
          revalidateTag("feed-posts");
                revalidateTag("profile-posts");
    
    revalidatePath('/')
  } catch (error) {
    console.error("Error liking comment:", error);
    throw error;
  }
}
