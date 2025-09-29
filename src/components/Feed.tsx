import React from "react";
import Post from "./Post";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { unstable_cache } from "next/cache";

// Post selection fields with event AND poll
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
                // ✅ Add this to get voter info
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

// Aggressive caching for stable data
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
      take: 100,
    });
    return following.map((f) => f.followingId);
  },
  ["following-list"],
  { revalidate: 1800, tags: ["following-list"] }
);

const getCachedProfilePosts = unstable_cache(
  async (username: string, excludedUserIds: string[]) => {
    return await prisma.post.findMany({
      where: {
        user: { username },
        ...(excludedUserIds.length > 0 && {
          NOT: { userId: { in: excludedUserIds } },
        }),
      },
      select: postSelectFields,
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  },
  ["profile-posts"],
  { revalidate: 600, tags: ["profile-posts"] }
);

const getCachedFeedPosts = unstable_cache(
  async (
    followingIds: string[],
    excludedUserIds: string[],
    currentUserId: string
  ) => {
    if (followingIds.length === 0) {
      return await prisma.post.findMany({
        where: {
          ...(excludedUserIds.length > 0
            ? { userId: { notIn: [...excludedUserIds, currentUserId] } }
            : { userId: { not: currentUserId } }),
        },
        select: postSelectFields,
        take: 8,
        orderBy: { createdAt: "desc" },
      });
    }

    const queryPromise = Promise.all([
      prisma.post.findMany({
        where: {
          userId: { in: followingIds.slice(0, 50) },
          ...(excludedUserIds.length > 0 && {
            NOT: { userId: { in: excludedUserIds } },
          }),
        },
        select: postSelectFields,
        take: 8,
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.findMany({
        where: {
          ...(excludedUserIds.length > 0
            ? {
                userId: {
                  notIn: [
                    ...followingIds.slice(0, 50),
                    ...excludedUserIds,
                    currentUserId,
                  ],
                },
              }
            : {
                userId: {
                  notIn: [...followingIds.slice(0, 50), currentUserId],
                },
              }),
        },
        select: postSelectFields,
        take: 3,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout")), 5000)
    );

    try {
      const [followingPosts, explorePosts] = (await Promise.race([
        queryPromise,
        timeoutPromise,
      ])) as any;

      return [...followingPosts, ...explorePosts];
    } catch (error) {
      console.error("Query timeout, returning empty array");
      return [];
    }
  },
  ["feed-posts"],
  { revalidate: 300, tags: ["feed-posts"] }
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
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-8 p-4">
        <p className="text-center text-gray-500">
          Please log in to see your feed.
        </p>
      </div>
    );
  }

  try {
    let posts: any[] = [];

    if (username) {
      const excludedUserIds = await getCachedBlockedUsers(currentUserId);
      posts = await getCachedProfilePosts(username, excludedUserIds);
    } else {
      const [followingIds, excludedUserIds] = await Promise.all([
        getCachedFollowing(currentUserId),
        getCachedBlockedUsers(currentUserId),
      ]);

      posts = await getCachedFeedPosts(
        followingIds,
        excludedUserIds,
        currentUserId
      );
    }

    // Simple scoring for feed only
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

          // Boost event posts that are upcoming
          if (post.event) {
            const eventDate = new Date(post.event.date);
            const daysUntil =
              (eventDate.getTime() - now) / (1000 * 60 * 60 * 24);
            if (daysUntil > 0 && daysUntil < 7) {
              score += 15; // Boost events happening soon
            }
          }

          // Boost active polls
          if (post.poll) {
            const isExpired = new Date(post.poll.expiresAt) < new Date();
            if (!isExpired) {
              score += 12; // Boost active polls
            }
          }

          return { ...post, score };
        })
        .sort((a, b) => b.score - a.score);
    }

    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-8 p-4">
        {posts.length > 0 ? (
          posts.map((post) => <Post key={post.id} post={post} />)
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No posts yet.</p>
            {!username && (
              <p className="text-gray-400 text-sm mt-2">
                Follow some users to see their posts!
              </p>
            )}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("Feed error:", error);
    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-8 p-4">
        <div className="text-center py-8">
          <p className="text-gray-500">Something went wrong.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-500 text-sm mt-2 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default Feed;
