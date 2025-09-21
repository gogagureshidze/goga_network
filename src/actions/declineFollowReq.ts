"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";

async function acceptFollowReq(userId: string) {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    throw new Error("User not authenticated.");
  }

  try {
    const existingFollowReq = await prisma.followRequest.findFirst({
      where: {
        senderId: userId,
        receiverId: currentUserId,
      },
    });
    if (existingFollowReq) {
      await prisma.followRequest.delete({
        where: {
          id: existingFollowReq.id,
        },
      });
    }
    revalidateTag("user-relationships"); // refresh profile buttons
    revalidateTag("feed-posts");
    revalidateTag("user-profile");
    revalidatePath("/requests");
  } catch (error) {
    console.log(error);
    throw new Error("Error Something Went Wrong!w");
  }
}

export default acceptFollowReq;
