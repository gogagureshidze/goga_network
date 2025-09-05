"use server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

export const removeFollowing = async (followerId: string) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("User not authenticated.");
  }

  try {
    const following = await prisma.follower.findFirst({
      where: {
        followerId: currentUserId,
        followingId: followerId,
      },
    });

    if (following) {
      // Delete both the "follower" and "following" relationships
      await prisma.follower.deleteMany({
        where: {
          OR: [
            { followerId: currentUserId, followingId: followerId },
            { followerId: followerId, followingId: currentUserId },
          ],
        },
      });

      // Revalidate the followers page to show the updated list
      revalidatePath("/profile/followers");

      return { action: "unfollowed" };
    }
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Error removing follower");
  }
};
