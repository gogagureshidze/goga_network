"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export const deletePost = async (postId: number) => {
  const user = await currentUser();
  const userId = user?.id;
if (!userId) throw new Error("User is not authenticated!");

try {
  await prisma.post.delete({
    where: {
      id: postId,
      userId,
    },
  });
  revalidatePath("/");
  return { success: true };
} catch (error) {
  console.error("Failed to delete post:", error);
  throw new Error("Failed to delete post. Please try again.");
}
};
