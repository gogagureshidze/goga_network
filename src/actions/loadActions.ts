// lib/actions.ts
"use server";
import prisma from "@/lib/client";

import { currentUser } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";

// --- START: Code Moved from Feed.tsx ---

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
  comments: {
    select: {
      id: true,
      desc: true,
      createdAt: true,
      userId: true,
      user: {
        select: {
          avatar: true,
          username: true,
        },
      },
    },
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
      take: 100, // You might want to remove or increase this limit
    });
    return following.map((f) => f.followingId);
  },
  ["following-list"],
  { revalidate: 1800, tags: ["following-list"] }
);

// --- END: Code Moved from Feed.tsx ---

const POSTS_PER_PAGE = 10; // How many posts to fetch at a time

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
    // 'page' is 1-based. (page 1 - 1) * 10 = 0. (page 2 - 1) * 10 = 10.
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
    
      // Filter for tagged posts (same logic as your original)
      return posts.filter(
        (post) => post.user.username === username || post.tags?.length > 0
      );
    }

    // --- Main User Feed (Simplified for pagination) ---
    const followingIds = await getCachedFollowing(currentUserId);

    // Get private users the current user doesn't follow
    const privateUsers = await prisma.user.findMany({
      where: { isPrivate: true, NOT: { id: { in: followingIds } } },
      select: { id: true },
    });
    const privateUsersToExclude = privateUsers
      .map((u) => u.id)
      .filter((id) => id !== currentUserId);

    const posts = await prisma.post.findMany({
      where: {
        userId: {
          notIn: [currentUserId, ...excludedUserIds, ...privateUsersToExclude],
        },
        // Optionally, prioritize posts from users you follow
        ...(followingIds.length > 0 && {
          OR: [
            { userId: { in: followingIds } },
            { user: { isPrivate: false } }, // Or any public post
          ],
        }),
      },
      select: postSelectFields,
      orderBy: { createdAt: "desc" },
      take: POSTS_PER_PAGE,
      skip: skipAmount,
    });

    return posts;
  } catch (error) {
    console.error("Error fetching posts:", error);
    return []; // Return empty on error
  }
}
