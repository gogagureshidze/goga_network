// createComment.ts
"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/client";

export const addComment = async (postId: number, desc: string) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User is not authenticated!");
  }

  try {
    const createdComment = await prisma.comment.create({
      data: {
        desc,
        userId,
        postId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
      },
    });
    // @ts-ignore
    revalidateTag("feed-posts");
    // @ts-ignore
    revalidateTag("profile-posts");

    return createdComment;
  } catch (err) {
    console.log(err);
    throw new Error("Something went wrong!");
  }
};
