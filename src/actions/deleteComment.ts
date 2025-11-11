"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";

export const deleteComment = async (commentId: number) => {
  const user = await currentUser();
  if (!user?.id) throw new Error("Not authenticated");

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== user.id) throw new Error("Unauthorized");

    await prisma.$transaction([
      prisma.comment.deleteMany({ where: { parentId: commentId } }),
      prisma.comment.delete({ where: { id: commentId } }),
    ]);

    revalidateTag("feed-posts");
    revalidateTag("profile-posts");
  } catch (err) {
    console.error(err);
    throw new Error("Failed to delete");
  }
};
