"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

export const switchFollow = async (userId: string) => {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("Error getting current user");
  }

  try {
    const existingFollow = await prisma.follower.findFirst({
      where: {
        followerId: currentUserId,
        followingId: userId,
      },
    });

    if (existingFollow) {
      // 🔹 Unfollow: remove both directions
      await prisma.follower.deleteMany({
        where: {
          OR: [
            {
              followerId: currentUserId,
              followingId: userId,
            },
            {
              followerId: userId,
              followingId: currentUserId,
            },
          ],
        },
      });

      return { action: "unfollowed" };
    } else {
      // 🔹 Try to follow
      const existingFollowRequest = await prisma.followRequest.findFirst({
        where: {
          senderId: currentUserId,
          receiverId: userId,
        },
      });

      if (existingFollowRequest) {
        // Cancel follow request
        await prisma.followRequest.delete({
          where: {
            id: existingFollowRequest.id,
          },
        });
        return { action: "request-cancelled" };
      } else {
        // Create new follow request
        await prisma.followRequest.create({
          data: {
            senderId: currentUserId,
            receiverId: userId,
          },
        });
        return { action: "requested" };
      }
    }
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Error switching follow status");
  }
};
