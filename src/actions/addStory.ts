"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export const addStory = async (img: string, showLikes: boolean) => {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) throw new Error("User is not authenticated!");

  try {
    // We are no longer deleting the previous story.
    // The server will now simply create a new story for the user.
    const createdStory = await prisma.story.create({
      data: {
        userId,
        img,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        showLikes,
      },
      include: { user: true },
    });

    revalidatePath("/");
    return createdStory;
  } catch (err) {
    console.error(err);
    throw err;
  }
};
