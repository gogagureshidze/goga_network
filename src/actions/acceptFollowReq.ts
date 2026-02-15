"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";

async function acceptFollowReq(senderId: string) {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("User not authenticated.");
  }

  try {
    const existingFollowReq = await prisma.followRequest.findFirst({
      where: {
        senderId: senderId,
        receiverId: currentUserId,
      },
    });

    if (!existingFollowReq) {
      throw new Error("Follow request not found.");
    }

    await prisma.$transaction([
      // Delete the request being accepted
      prisma.followRequest.delete({
        where: { id: existingFollowReq.id },
      }),

      // 👇 Delete reverse request if they also sent you one (mutual request scenario)
      prisma.followRequest.deleteMany({
        where: { senderId: currentUserId, receiverId: senderId },
      }),

      // Create both follow directions
      prisma.follower.createMany({
        data: [
          { followerId: senderId, followingId: currentUserId },
          { followerId: currentUserId, followingId: senderId },
        ],
        skipDuplicates: true,
      }),
    ]);
    // @ts-ignore

    revalidatePath("/requests");
    // @ts-ignore

    revalidateTag("user-relationships");
    // @ts-ignore

    revalidateTag("feed-posts");
    // @ts-ignore

    revalidateTag("user-profile");
  } catch (error) {
    console.error(error);
    throw new Error("Error accepting follow request.");
  }
}

export default acceptFollowReq;
