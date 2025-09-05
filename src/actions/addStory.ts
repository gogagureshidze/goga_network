"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export const addStory = async (img: string) => {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) throw new Error("User is not authenticated!");

  try {
    // Remove previous story
    const existingStory = await prisma.story.findFirst({ where: { userId } });
    if (existingStory)
      await prisma.story.delete({ where: { id: existingStory.id } });

    // Add new story
    const createdStory = await prisma.story.create({
      data: {
        userId,
        img,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      include: { user: true },
    });

    revalidatePath("/"); // optional if using NextJS caching
    return createdStory;
  } catch (err) {
    console.error(err);
    throw err;
  }
};
