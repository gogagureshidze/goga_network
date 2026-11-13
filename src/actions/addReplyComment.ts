// addReplyComment.ts
"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { assertCanViewPost } from "@/lib/social-access";

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
    if (typeof desc !== "string" || !desc.trim() || desc.length > 255) throw new Error("Invalid comment");
    await assertCanViewPost(userId, postId);
    if (parentId !== undefined) {
      const parent = await prisma.comment.findFirst({ where: { id: parentId, postId }, select: { id: true } });
      if (!parent) throw new Error("Parent comment must belong to this post");
    }
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
    // @ts-ignore
    revalidateTag("feed-posts");
    // @ts-ignore
    revalidateTag("profile-posts");

    return createdComment;
  } catch (err) {
    console.error(err);
    throw new Error("Something went wrong");
  }
}
