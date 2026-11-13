"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";

export const switchBlock = async (userId: string) => {
  const user = await currentUser();
  const currentUserId = user?.id;
  if (!currentUserId) throw new Error("User not authenticated.");
  if (!userId || userId === currentUserId) throw new Error("Invalid user");

  try {
    const blocUser = await prisma.block.findFirst({
      where: { blockerId: currentUserId, blockedId: userId },
    });

    if (blocUser) {
      // Unblock
      await prisma.block.delete({ where: { id: blocUser.id } });

      // Revalidate caches
      // @ts-ignore
      revalidateTag("blocked-users");
      // @ts-ignore
      revalidateTag("user-relationships");
      // @ts-ignore
      revalidateTag("profile-posts");
      // @ts-ignore
      revalidateTag("feed-posts");
      // @ts-ignore
      revalidateTag("user-profile");

      return { action: "unblocked" };
    } else {
      // Block
      await prisma.$transaction([
        prisma.block.upsert({
          where: { blockerId_blockedId: { blockerId: currentUserId, blockedId: userId } },
          create: { blockerId: currentUserId, blockedId: userId }, update: {},
        }),
        prisma.follower.deleteMany({
        where: {
          OR: [
            { followerId: currentUserId, followingId: userId },
            { followerId: userId, followingId: currentUserId },
          ],
        },
        }),
        prisma.followRequest.deleteMany({ where: { OR: [
          { senderId: currentUserId, receiverId: userId },
          { senderId: userId, receiverId: currentUserId },
        ] } }),
      ]);
      // @ts-ignore
      revalidateTag("blocked-users");
      // @ts-ignore

      revalidateTag("user-relationships");
      // @ts-ignore
      revalidateTag("profile-posts");
      // @ts-ignore
      revalidateTag("feed-posts");
      // @ts-ignore
      revalidateTag("user-profile");

      return { action: "blocked" };
    }
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Error switching block status");
  }
};
