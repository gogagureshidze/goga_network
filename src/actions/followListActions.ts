"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

const PAGE_SIZE = 20;

export type FollowListUser = {
  id: string;
  username: string | null;
  avatar: string | null;
  name: string | null;
  surname: string | null;
};

export type FollowListResult =
  | { blocked: true; users?: never; hasMore?: never }
  | { blocked: false; users: FollowListUser[]; hasMore: boolean };

export async function getFollowList(
  targetUserId: string,
  type: "followers" | "followings",
  page: number = 1,
  search: string = "",
): Promise<FollowListResult> {
  try {
    const loggedInUser = await currentUser();
    if (!loggedInUser) return { blocked: false, users: [], hasMore: false };

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { isPrivate: true },
    });

    if (!targetUser) return { blocked: false, users: [], hasMore: false };

    const isOwner = loggedInUser.id === targetUserId;

    // Check if viewer follows the target (only needed for private accounts)
    const isFollowing = isOwner
      ? true
      : !!(await prisma.follower.findFirst({
          where: {
            followerId: loggedInUser.id,
            followingId: targetUserId,
          },
          select: { id: true },
        }));

    // 🔒 Private account: hide followings from non-followers
    // Followers list stays public (Instagram-style)
    if (
      type === "followings" &&
      targetUser.isPrivate &&
      !isOwner &&
      !isFollowing
    ) {
      return { blocked: true };
    }

    const skip = (page - 1) * PAGE_SIZE;

    const searchFilter =
      search.trim().length > 0
        ? {
            OR: [
              {
                username: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              { name: { contains: search, mode: "insensitive" as const } },
              {
                surname: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {};

    if (type === "followers") {
      const [rows, total] = await Promise.all([
        prisma.follower.findMany({
          where: { followingId: targetUserId, follower: searchFilter },
          select: {
            follower: {
              select: {
                id: true,
                username: true,
                avatar: true,
                name: true,
                surname: true,
              },
            },
          },
          skip,
          take: PAGE_SIZE,
          orderBy: { createdAt: "desc" },
        }),
        prisma.follower.count({
          where: { followingId: targetUserId, follower: searchFilter },
        }),
      ]);

      return {
        blocked: false,
        users: rows.map((r) => r.follower),
        hasMore: skip + rows.length < total,
      };
    } else {
      const [rows, total] = await Promise.all([
        prisma.follower.findMany({
          where: { followerId: targetUserId, following: searchFilter },
          select: {
            following: {
              select: {
                id: true,
                username: true,
                avatar: true,
                name: true,
                surname: true,
              },
            },
          },
          skip,
          take: PAGE_SIZE,
          orderBy: { createdAt: "desc" },
        }),
        prisma.follower.count({
          where: { followerId: targetUserId, following: searchFilter },
        }),
      ]);

      return {
        blocked: false,
        users: rows.map((r) => r.following),
        hasMore: skip + rows.length < total,
      };
    }
  } catch (err) {
    console.error("[getFollowList]", err);
    return { blocked: false, users: [], hasMore: false };
  }
}
