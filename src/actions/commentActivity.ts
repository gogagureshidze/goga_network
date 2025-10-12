"use server";

import prisma from "@/lib/client";
import { auth } from "@clerk/nextjs/server";

export const commentActivity = async (commentId: number) => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      throw new Error("Comment not found");
    }

    const likes = await prisma.like.findMany({
      where: { commentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
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
    });

    return { likes, isOwner: comment.userId === userId };
  } catch (error) {
    console.error("Error fetching comment activity:", error);
    throw new Error("Failed to fetch comment activity");
  }
};
