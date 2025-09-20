"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";

export const switchBlock = async (userId: string) => {
  const user = await currentUser();
  const currentUserId = user?.id;
  if (!currentUserId) throw new Error("User not authenticated.");

  try {
    const blocUser = await prisma.block.findFirst({
      where: { blockerId: currentUserId, blockedId: userId },
    });

    if (blocUser) {
      // Unblock
      await prisma.block.delete({ where: { id: blocUser.id } });

      // Revalidate caches
      revalidateTag("blocked-users");
      revalidateTag("user-relationships");
      revalidateTag("profile-posts");
      revalidateTag("feed-posts");

      return { action: "unblocked" };
    } else {
      // Block
      await prisma.block.create({
        data: { blockerId: currentUserId, blockedId: userId },
      });

      // Remove follower/following relationships
      await prisma.follower.deleteMany({
        where: {
          OR: [
            { followerId: currentUserId, followingId: userId },
            { followerId: userId, followingId: currentUserId },
          ],
        },
      });

      // Revalidate caches
      revalidateTag("blocked-users");
      revalidateTag("user-relationships");
      revalidateTag("profile-posts");
      revalidateTag("feed-posts");

      return { action: "blocked" };
    }
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Error switching block status");
  }
};
