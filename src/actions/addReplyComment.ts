// addReplyComment.ts
"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";

export async function addReplyComment(
  postId: number,
  desc: string,
  parentId?: number
) {
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
        parentId,
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

    revalidateTag("feed-posts");
    revalidateTag("profile-posts");

    return createdComment;
  } catch (err) {
    console.error(err);
    throw new Error("Something went wrong");
  }
}
