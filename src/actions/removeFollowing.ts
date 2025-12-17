"use server";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

export const removeFollowing = async (followerId: string) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) throw new Error("User not authenticated.");

  try {
    const following = await prisma.follower.findFirst({
      where: { followerId: currentUserId, followingId: followerId },
    });

    if (following) {
      await prisma.follower.deleteMany({
        where: {
          OR: [
            { followerId: currentUserId, followingId: followerId },
            { followerId: followerId, followingId: currentUserId },
          ],
        },
      });

      // Revalidate relevant caches
      // @ts-ignore
      revalidateTag("user-relationships"); // for buttons/UI
      // @ts-ignore
      revalidateTag("feed-posts"); // to update feed immediately

      return { action: "unfollowed" };
    }
  } catch (error) {
    console.error("Error removing follower:", error);
    throw new Error("Error removing follower");
  }
};
