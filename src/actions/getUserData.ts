// actions/getUserData.ts

"use server"; // Mark this as a server-only file

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

export const getUserData = async () => {
    const user = await currentUser()
    const userId = user?.id;
  if (!userId) {
    return null;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
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
        bioPattern: true,
        isPrivate: true,
      },
    });

    if (dbUser) {
      // Return a plain object, safe for client components
      return {
        ...dbUser,
        username: dbUser.username ?? undefined,
        name: dbUser.name ?? undefined,
        surname: dbUser.surname ?? undefined,
        avatar: dbUser.avatar ?? undefined,
        cover: dbUser.cover ?? undefined,
        description: dbUser.description ?? undefined,
        city: dbUser.city ?? undefined,
        school: dbUser.school ?? undefined,
        work: dbUser.work ?? undefined,
        website: dbUser.website ?? undefined,
        bioPattern: dbUser.bioPattern ?? undefined,
      };
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch user data in Server Action", err);
    return null;
  }
};
