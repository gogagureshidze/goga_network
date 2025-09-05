"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

async function acceptFollowReq(senderId: string) {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("User not authenticated.");
  }

  try {
    // 1️⃣ Check for existing follow request
    const existingFollowReq = await prisma.followRequest.findFirst({
      where: {
        senderId: senderId,
        receiverId: currentUserId,
      },
    });

    if (!existingFollowReq) {
      throw new Error("Follow request not found.");
    }

    // 2️⃣ Delete the follow request
    await prisma.followRequest.delete({
      where: { id: existingFollowReq.id },
    });

    // 3️⃣ Create mutual following entries
    await prisma.follower.createMany({
      data: [
        { followerId: senderId, followingId: currentUserId }, // sender follows current
        { followerId: currentUserId, followingId: senderId }, // current follows sender
      ],
      skipDuplicates: true, // prevents error if one already exists
    });
        revalidatePath("/requests");

  } catch (error) {
    console.error(error);
    throw new Error("Error accepting follow request.");
  }
}

export default acceptFollowReq;
