"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";

export const deleteComment = async (commentId: number) => {
const user = await currentUser();
const userId = user?.id;
  if (!userId) {
    throw new Error("User not authenticated.");
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new Error("Comment not found.");
    }

    if (comment.userId !== userId) {
      throw new Error(
        "Unauthorized access. You can only delete your own comments."
      );
    }

    // Use a transaction to delete the comment and all its replies
    await prisma.$transaction([
      prisma.comment.deleteMany({
        where: { parentId: commentId },
      }),
      prisma.comment.delete({
        where: { id: commentId },
      }),
    ]);
      revalidateTag("feed-posts");
            revalidateTag("profile-posts");

    revalidatePath("/");
    
  } catch (err) {
    console.error(err);
    throw new Error("Something went wrong while deleting the comment.");
  }
};
