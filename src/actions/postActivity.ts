"use server";

import prisma from "@/lib/client";
import { auth } from "@clerk/nextjs/server";

export const postActivity = async (postId: number) => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      throw new Error("Post not found");
    }

    const likes = await prisma.like.findMany({
      where: { postId },
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

    return { likes, isOwner: post.userId === userId };
  } catch (error) {
    console.error("Error fetching post activity:", error);
    throw new Error("Failed to fetch post activity");
  }
};
