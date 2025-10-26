"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache"; // 👈 Don't forget this import
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
        user: true,
      },
    });

    await Promise.all([
      revalidateTag("feed-posts"),
      revalidateTag("profile-posts"),
      revalidateTag(`post-${postId}`),
      revalidatePath("/", "layout"),
    ]);

    return createdComment;
  } catch (err) {
    console.log(err);
    throw new Error("Something went wrong!");
  }
};
