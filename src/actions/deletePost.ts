"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";

export const deletePost = async (postId: number) => {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) throw new Error("User is not authenticated!");

  try {
    // 1️⃣ Check if the user is the original author
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) throw new Error("Post not found.");

    if (post.userId === userId) {
      // ✅ Original author deletes post completely
      await prisma.post.delete({
        where: { id: postId },
      });
    } else {
      // 📝 Tagged user deletes post only from their profile (soft delete)
      await prisma.postTag.updateMany({
        where: { postId, userId },
        data: { deleted: true },
      });
    }

    // 👇 Bust the caches
    revalidateTag("feed-posts");
    revalidateTag("profile-posts");
  } catch (error) {
    console.error("Failed to delete post:", error);
    throw new Error("Failed to delete post. Please try again.");
  }
};
