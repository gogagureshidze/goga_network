// lib/actions.ts
"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";

const postSelectFields = {
  id: true,
  desc: true,
  createdAt: true,
  userId: true,
  user: {
    select: {
      id: true,
      username: true,
      avatar: true,
      name: true,
      surname: true,
      isPrivate: true,
      lastActiveAt: true,
      showActivityStatus: true,
    },
  },
  media: {
    select: {
      id: true,
      url: true,
      safeUrl: true,
      type: true,
    },
  },
  event: {
    select: {
      id: true,
      date: true,
      endDate: true,
      location: true,
      latitude: true,
      longitude: true,
    },
  },
  poll: {
    select: {
      id: true,
      expiresAt: true,
      options: {
        select: {
          id: true,
          text: true,
          _count: {
            select: {
              votes: true,
            },
          },
          votes: {
            select: {
              userId: true,
              user: {
                select: {
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
        orderBy: {
          id: "asc" as const,
        },
      },
    },
  },
  tags: {
    where: {
      deleted: false,
    },
    include: {
      user: {
        select: {
          username: true,
        },
      },
    },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
    },
  },
  likes: {
    select: { userId: true },
  },
};

const getCachedBlockedUsers = unstable_cache(
  async (userId: string) => {
    const [blockedUsers, usersWhoBlockedMe] = await Promise.all([
      prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      }),
      prisma.block.findMany({
        where: { blockedId: userId },
        select: { blockerId: true },
      }),
    ]);

    return [
      ...blockedUsers.map((b) => b.blockedId),
      ...usersWhoBlockedMe.map((b) => b.blockerId),
    ];
  },
  ["blocked-users"],
  { revalidate: 3600, tags: ["blocked-users"] }
);

const getCachedFollowing = unstable_cache(
  async (userId: string) => {
    const following = await prisma.follower.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    return following.map((f) => f.followingId);
  },
  ["following-list"],
  { revalidate: 1800, tags: ["following-list"] }
);

const POSTS_PER_PAGE = 10;

export async function fetchPosts({
  page,
  username,
}: {
  page: number;
  username?: string;
}) {
  const user = await currentUser();
  if (!user) return [];

  const currentUserId = user.id;

  try {
    const excludedUserIds = await getCachedBlockedUsers(currentUserId);
    const skipAmount = (page - 1) * POSTS_PER_PAGE;

    // --- Profile Page Feed ---
    if (username) {
      const posts = await prisma.post.findMany({
        where: {
          OR: [
            { user: { is: { username } } },
            { tags: { some: { user: { is: { username } }, deleted: false } } },
          ],
          NOT: {
            ...(excludedUserIds.length > 0 && {
              userId: { in: excludedUserIds },
            }),
          },
        },
        select: postSelectFields,
        orderBy: { createdAt: "desc" },
        take: POSTS_PER_PAGE,
        skip: skipAmount,
      });

      return posts.filter(
        (post) => post.user.username === username || post.tags?.length > 0
      );
    }

    // --- Main User Feed (FIXED) ---
    const followingIds = await getCachedFollowing(currentUserId);

    // Get private users that current user doesn't follow
    const privateUsers = await prisma.user.findMany({
      where: {
        isPrivate: true,
        NOT: {
          id: { in: [...followingIds, currentUserId] },
        },
      },
      select: { id: true },
    });
    const privateUsersToExclude = privateUsers.map((u) => u.id);

    // ALL users to exclude (blocked + private unfollowed)
    const allExcludedIds = [
      currentUserId,
      ...excludedUserIds,
      ...privateUsersToExclude,
    ];

    // SIMPLE, CLEAN QUERY - no conflicting conditions
    const posts = await prisma.post.findMany({
      where: {
        userId: {
          notIn: allExcludedIds,
        },
        // That's it. No OR conditions that conflict with notIn.
      },
      select: postSelectFields,
      orderBy: { createdAt: "desc" },
      take: POSTS_PER_PAGE,
      skip: skipAmount,
    });

    return posts;
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
}
