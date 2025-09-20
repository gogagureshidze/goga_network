"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";

export const switchFollow = async (userId: string) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("Error getting current user");
  }

  try {
    // 🔹 Check if already following
    const existingFollow = await prisma.follower.findFirst({
      where: { followerId: currentUserId, followingId: userId },
    });

    if (existingFollow) {
      // 🔹 Unfollow: remove both directions (mutual follow system)
      await prisma.follower.deleteMany({
        where: {
          OR: [
            { followerId: currentUserId, followingId: userId },
            { followerId: userId, followingId: currentUserId },
          ],
        },
      });

      // 🔹 Revalidate caches immediately
      revalidateTag("user-relationships");
      revalidateTag("feed-posts");
      revalidateTag("profile-posts");
      revalidateTag("user-profile");

      return { action: "unfollowed" };
    } else {
      // 🔹 Not following: check if a follow request exists
      const existingFollowRequest = await prisma.followRequest.findFirst({
        where: { senderId: currentUserId, receiverId: userId },
      });

      if (existingFollowRequest) {
        // Cancel pending follow request
        await prisma.followRequest.delete({
          where: { id: existingFollowRequest.id },
        });

        revalidateTag("user-relationships");

        return { action: "request-cancelled" };
      } else {
        // Create new follow request
        await prisma.followRequest.create({
          data: { senderId: currentUserId, receiverId: userId },
        });

        revalidateTag("user-relationships");

        return { action: "requested" };
      }
    }
  } catch (error) {
    console.error("Error in switchFollow:", error);
    throw new Error("Error switching follow status");
  }
};
