import React from "react";
import Post from "./Post";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
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
      isPrivate: true, // 🆕 Include privacy status
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
      take: 100,
    });
    return following.map((f) => f.followingId);
  },
  ["following-list"],
  { revalidate: 1800, tags: ["following-list"] }
);

// 🆕 Helper to check if viewer can see profile
async function canViewProfile(
  viewerId: string,
  profileUserId: string,
  profileUsername: string
) {
  // Get the profile user's privacy status
  const profileUser = await prisma.user.findFirst({
    where: { username: profileUsername },
    select: { isPrivate: true },
  });

  // If not private, everyone can see
  if (!profileUser?.isPrivate) return true;

  // If viewing own profile, can see
  if (viewerId === profileUserId) return true;

  // Check if viewer follows the private account
  const isFollowing = await prisma.follower.findFirst({
    where: {
      followerId: viewerId,
      followingId: profileUserId,
    },
  });

  return !!isFollowing;
}

const getCachedProfilePosts = unstable_cache(
  async (username: string, excludedUserIds: string[], viewerId: string) => {
    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { user: { username } },
          {
            tags: {
              some: {
                user: { username },
                deleted: false,
              },
            },
          },
        ],
        ...(excludedUserIds.length > 0 && {
          NOT: { userId: { in: excludedUserIds } },
        }),
      },
      select: postSelectFields,
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return posts.filter((post) => {
      if (post.user.username === username) return true;
      return post.tags && post.tags.length > 0;
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
    // 🆕 Get all private users
    const privateUsers = await prisma.user.findMany({
      where: { isPrivate: true },
      select: { id: true },
    });
    const privateUserIds = privateUsers.map((u) => u.id);

    // 🆕 Filter out private users that current user doesn't follow
    const privateUsersToExclude = privateUserIds.filter(
      (id) => !followingIds.includes(id) && id !== currentUserId
    );

    if (followingIds.length === 0) {
      return await prisma.post.findMany({
        where: {
          ...(excludedUserIds.length > 0
            ? {
                userId: {
                  notIn: [
                    ...excludedUserIds,
                    currentUserId,
                    ...privateUsersToExclude, // 🆕 Exclude private accounts
                  ],
                },
              }
            : {
                userId: {
                  notIn: [currentUserId, ...privateUsersToExclude],
                },
              }),
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
                    ...privateUsersToExclude, // 🆕 Exclude private accounts
                  ],
                },
              }
            : {
                userId: {
                  notIn: [
                    ...followingIds.slice(0, 50),
                    currentUserId,
                    ...privateUsersToExclude, // 🆕 Exclude private accounts
                  ],
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
      // 🆕 Profile view - check if viewer can see this profile
      const profileUser = await prisma.user.findFirst({
        where: { username },
        select: { id: true, isPrivate: true },
      });

      if (!profileUser) {
        return (
          <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-8 p-4">
            <p className="text-center text-gray-500">User not found.</p>
          </div>
        );
      }

      // Check if it's a private account and viewer doesn't follow
      if (profileUser.isPrivate && profileUser.id !== currentUserId) {
        const isFollowing = await prisma.follower.findFirst({
          where: {
            followerId: currentUserId,
            followingId: profileUser.id,
          },
        });

        if (!isFollowing) {
          // 🆕 Show private account message
          return (
            <div className="bg-white shadow-md rounded-lg flex flex-col items-center gap-4 p-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-rose-100 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-orange-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  This Account is Private
                </h3>
                <p className="text-gray-600 max-w-sm">
                  Follow this account to see their photos and videos. ✨
                </p>
              </div>
            </div>
          );
        }
      }

      const excludedUserIds = await getCachedBlockedUsers(currentUserId);
      posts = await getCachedProfilePosts(
        username,
        excludedUserIds,
        currentUserId
      );
    } else {
      // Feed view
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

          if (post.event) {
            const eventDate = new Date(post.event.date);
            const daysUntil =
              (eventDate.getTime() - now) / (1000 * 60 * 60 * 24);
            if (daysUntil > 0 && daysUntil < 7) {
              score += 15;
            }
          }

          if (post.poll) {
            const isExpired = new Date(post.poll.expiresAt) < new Date();
            if (!isExpired) {
              score += 12;
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
