import React from "react";
import Post from "./Post";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { unstable_cache } from "next/cache";

// Cache blocked users for 30 minutes
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
  { revalidate: 1800, tags: ["blocked-users"] }
);

// Cache following list for 15 minutes
const getCachedFollowing = unstable_cache(
  async (userId: string) => {
    const following = await prisma.follower.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    return following.map((f) => f.followingId);
  },
  ["following-list"],
  { revalidate: 900, tags: ["following-list"] }
);

// Optimized profile posts with minimal data
const getCachedProfilePosts = unstable_cache(
  async (username: string, excludedUserIds: string[]) => {
    return await prisma.post.findMany({
      where: {
        user: { username },
        ...(excludedUserIds.length > 0 && {
          NOT: { userId: { in: excludedUserIds } },
        }),
      },
      select: {
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
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: {
          select: { userId: true },
          take: 3, // Only get first few likes
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15, // Reduced from 20
    });
  },
  ["profile-posts"],
  { revalidate: 300, tags: ["profile-posts"] }
);

// Optimized feed posts
const getCachedFeedPosts = unstable_cache(
  async (
    followingIds: string[],
    excludedUserIds: string[],
    currentUserId: string
  ) => {
    if (followingIds.length === 0) {
      // Only explore posts if no following
      return await prisma.post.findMany({
        where: {
          ...(excludedUserIds.length > 0
            ? { userId: { notIn: [...excludedUserIds, currentUserId] } }
            : { userId: { not: currentUserId } }),
        },
        select: {
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
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            select: { userId: true },
            take: 3,
          },
        },
        take: 12,
        orderBy: { createdAt: "desc" },
      });
    }

    const [followingPosts, explorePosts] = await Promise.all([
      prisma.post.findMany({
        where: {
          userId: { in: followingIds },
          ...(excludedUserIds.length > 0 && {
            NOT: { userId: { in: excludedUserIds } },
          }),
        },
        select: {
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
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            select: { userId: true },
            take: 3,
          },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.findMany({
        where: {
          ...(excludedUserIds.length > 0
            ? {
                userId: {
                  notIn: [...followingIds, ...excludedUserIds, currentUserId],
                },
              }
            : { userId: { notIn: [...followingIds, currentUserId] } }),
        },
        select: {
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
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
          likes: {
            select: { userId: true },
            take: 3,
          },
        },
        take: 3,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return [...followingPosts, ...explorePosts];
  },
  ["feed-posts"],
  { revalidate: 180, tags: ["feed-posts"] }
);

async function Feed({
  username,
  userId,
}: {
  username?: string;
  userId?: string;
}) {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-12 p-4">
        <p className="text-center text-gray-500">
          Please log in to see your feed.
        </p>
      </div>
    );
  }

  let posts: any[] = [];

  try {
    // Get blocked users first (cached)
    const excludedUserIds = await getCachedBlockedUsers(currentUserId);

    if (username) {
      // Profile posts
      posts = await getCachedProfilePosts(username, excludedUserIds);
    } else {
      // Feed posts
      const followingIds = await getCachedFollowing(currentUserId);
      posts = await getCachedFeedPosts(
        followingIds,
        excludedUserIds,
        currentUserId
      );
    }

    // Simple scoring for feed only (not profile)
    if (!username && posts.length > 0) {
      const now = Date.now();

      posts = posts
        .map((post) => {
          const likes = post._count?.likes || 0;
          const comments = post._count?.comments || 0;
          const ageHours = (now - new Date(post.createdAt).getTime()) / 3600000;

          let score = likes + comments * 2;
          if (ageHours < 2) score += 10;
          else if (ageHours < 12) score += 5;
          else if (ageHours < 24) score += 2;

          return { ...post, score };
        })
        .sort((a, b) => b.score - a.score);
    }

    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-12 p-4">
        {posts.length > 0 ? (
          posts.map((post) => <Post key={post.id} post={post} />)
        ) : (
          <p className="text-center text-gray-500">No posts found.</p>
        )}
      </div>
    );
  } catch (error) {
    console.error("Feed error:", error);
    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-12 p-4">
        <p className="text-center text-gray-500">
          Unable to load posts. Please try again later.
        </p>
      </div>
    );
  }
}

export default Feed;
