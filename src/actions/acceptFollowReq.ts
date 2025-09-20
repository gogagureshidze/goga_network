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
        { followerId: senderId, followingId: currentUserId },
        { followerId: currentUserId, followingId: senderId },
      ],
      skipDuplicates: true,
    });

    // 4️⃣ Revalidate UI
    revalidatePath("/requests"); // refresh requests page
    revalidateTag("user-relationships"); // refresh profile buttons
    revalidateTag("feed-posts");
    revalidateTag("user-profile"); // refresh feed to show new posts
  } catch (error) {
    console.error(error);
    throw new Error("Error accepting follow request.");
  }
}

export default acceptFollowReq;
