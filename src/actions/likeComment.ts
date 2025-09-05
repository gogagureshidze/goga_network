"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

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
      // If like exists, remove it (unlike)
      await prisma.like.delete({
        where: {
          id: existingLike.id,
        },
      });
    } else {
      // If like doesn't exist, create it (like)
      await prisma.like.create({
        data: {
          commentId,
          userId,
        },
      });
    }

    revalidatePath("/");
  } catch (error) {
    console.error("Error liking comment:", error);
    throw error;
  }
}
