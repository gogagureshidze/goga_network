"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

export async function getUserData() {
  const user = await currentUser();
  if (!user?.id) return null;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        name: true,
        surname: true,
        avatar: true,
        cover: true,
        description: true,
        city: true,
        school: true,
        work: true,
        website: true,
        showActivityStatus: true,
        bioPattern: true,
        isPrivate: true,
        allowStoryComments: true,
        showStoryLikes: true,
      },
    });

    return dbUser;
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    return null;
  }
}
