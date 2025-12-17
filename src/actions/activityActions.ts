"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";


let lastRevalidatedAt: number | null = null;

export async function updateLastActive() {
  try {
    const user = await currentUser();
    if (!user) return { success: false };

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;

    // Only revalidate if 2 minutes have passed
    if (!lastRevalidatedAt || now - lastRevalidatedAt > twoMinutes) {
      // @ts-ignore
      revalidateTag("user-profile");
      lastRevalidatedAt = now;
      console.log(
        "✅ Revalidated user-profile tag to check last active update."
      );
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating last active:", error);
    return { success: false };
  }
}



// Toggle activity status visibility
// ✅ THIS is the correct place for revalidations.
// This action is only called when the user *explicitly* clicks the toggle.

export async function toggleActivityStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { showActivityStatus: true },
  });

  if (!currentUser) throw new Error("User not found");

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { showActivityStatus: !currentUser.showActivityStatus },
    select: { showActivityStatus: true },
  });
  // @ts-ignore
  revalidateTag("user-profile");
  // @ts-ignore
  revalidateTag("feed-posts");

  return {
    success: true,
    showActivityStatus: updatedUser.showActivityStatus,
  };
}

// Get user activity with Clerk fallback
// This is a GET operation, so no revalidations needed.
export async function getUserActivity(userId: string) {
  try {
    // First try to get from our database
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        lastActiveAt: true,
        showActivityStatus: true,
      },
    });

    // If user has hidden status, respect it.
    if (!dbUser || !dbUser.showActivityStatus) {
      return null;
    }

    // If our DB has recent activity, use it
    if (dbUser.lastActiveAt) {
      const timeDiff = Date.now() - new Date(dbUser.lastActiveAt).getTime();
      if (timeDiff < 3600000) {
        // Less than 1 hour old
        return {
          lastActiveAt: dbUser.lastActiveAt,
          source: "db",
        };
      }
    }

    // Fallback to Clerk sessions as backup
    try {
      // Fetching from Clerk should be rate-limited, but this logic is okay
      // as it only runs if the DB data is stale.
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);

      if (clerkUser?.lastActiveAt) {
        // Update our DB with Clerk's fresher data
        await prisma.user.update({
          where: { id: userId },
          data: { lastActiveAt: new Date(clerkUser.lastActiveAt) },
        });

        return {
          lastActiveAt: new Date(clerkUser.lastActiveAt),
          source: "clerk",
        };
      }
    } catch (clerkError) {
      console.log("Clerk fallback failed, using DB data:", clerkError);
      // Fallthrough to return DB data if Clerk fails
    }

    // Return whatever we have from DB (even if stale)
    return dbUser.lastActiveAt
      ? {
          lastActiveAt: dbUser.lastActiveAt,
          source: "db-stale",
        }
      : null;
  } catch (error) {
    console.error("Error getting user activity:", error);
    return null;
  }
}
