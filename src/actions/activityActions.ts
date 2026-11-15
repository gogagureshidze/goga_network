"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { revalidateTag, updateTag } from "next/cache";

let lastRevalidatedAt: number | null = null;

export async function updateLastActive() {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false };
    await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
    const now = Date.now();
    if (!lastRevalidatedAt || now - lastRevalidatedAt > 2 * 60 * 1000) {
      revalidateTag("user-profile", "max");
      lastRevalidatedAt = now;
    }
    return { success: true };
  } catch {
    return { success: false };
  }
}

// Retained for older clients. Current settings use the authenticated socket
// setter so every active device receives the privacy change immediately.
export async function toggleActivityStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { showActivityStatus: true } });
  if (!user) throw new Error("User not found");
  const updatedUser = await prisma.user.update({ where: { id: userId }, data: { showActivityStatus: !user.showActivityStatus }, select: { showActivityStatus: true } });
  updateTag("user-profile");
  updateTag("feed-posts");
  return { success: true, showActivityStatus: updatedUser.showActivityStatus };
}

export async function refreshActivityPrivacy() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  updateTag("user-profile");
  updateTag("feed-posts");
}

/** No third-party session fallback: activity reads must remain read-only and private. */
export async function getUserActivity(userId: string) {
  try {
    const { userId: viewerId } = await auth();
    if (!viewerId || typeof userId !== "string" || !userId || userId.length > 191) return null;
    // Evaluate visibility, relationships and timestamp in one database read so
    // no stale flag survives a second awaited permission lookup.
    const user = await prisma.user.findUnique({
      where: { id: userId, showActivityStatus: true,
        ...(viewerId === userId ? {} : {
          blocks: { none: { blockedId: viewerId } },
          blockedBy: { none: { blockerId: viewerId } },
          OR: [{ isPrivate: false }, { followers: { some: { followerId: viewerId } } }],
        }),
      },
      select: { lastActiveAt: true },
    });
    if (!user?.lastActiveAt) return null;
    return { lastActiveAt: user.lastActiveAt, source: "db" };
  } catch {
    return null;
  }
}
