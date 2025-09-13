'use server'
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export const likeStory = async (storyId: number, isLiking: boolean) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User not authenticated.");
  }

  try {
    if (isLiking) {
      // Create a new like record for the story
      await prisma.like.create({
        data: {
          userId: userId,
          storyId: storyId,
        },
      });
    } else {
      // Delete the like record for the story
      const likeRecord = await prisma.like.findFirst({
        where: {
          userId: userId,
          storyId: storyId,
        },
      });

      if (likeRecord) {
        await prisma.like.delete({
          where: {
            id: likeRecord.id,
          },
        });
      }
    }

    // Revalidate the path to update the UI
    revalidatePath("/");
  } catch (err) {
    console.error("Failed to like/unlike story:", err);
    throw err;
  }
};