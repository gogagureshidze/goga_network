import React from "react";
import Post from "./Post";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import { unstable_cache } from "next/cache";

// Cache blocked users for 10 minutes (doesn't change often)
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

    const blockedUserIds = blockedUsers.map((b) => b.blockedId);
    const usersWhoBlockedMeIds = usersWhoBlockedMe.map((b) => b.blockerId);

    return [...blockedUserIds, ...usersWhoBlockedMeIds];
  },
  ["blocked-users"],
  {
    revalidate: 600, // 10 minutes
    tags: ["blocked-users"],
  }
);

// Cache following list for 5 minutes
const getCachedFollowing = unstable_cache(
  async (userId: string) => {
    const following = await prisma.follower.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    return following.map((f) => f.followingId);
  },
  ["following-list"],
  {
    revalidate: 300, // 5 minutes
    tags: ["following-list"],
  }
);

// Cache posts for 2 minutes (more dynamic content)
const getCachedProfilePosts = unstable_cache(
  async (username: string, excludedUserIds: string[]) => {
    return await prisma.post.findMany({
      where: {
        user: { username },
        NOT: { userId: { in: excludedUserIds } },
      },
      include: {
        user: true,
        media: true,
        likes: { select: { userId: true } },
        comments: true,
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20, // Reduced from 50 for better performance
    });
  },
  ["profile-posts"],
  {
    revalidate: 120, // 2 minutes
    tags: ["profile-posts"],
  }
);

const getCachedFeedPosts = unstable_cache(
  async (followingIds: string[], excludedUserIds: string[]) => {
    const [followingPosts, explorePosts] = await Promise.all([
      prisma.post.findMany({
        where: {
          userId: { in: followingIds },
          NOT: { userId: { in: excludedUserIds } },
        },
        include: {
          user: true,
          media: true,
          likes: { select: { userId: true } },
          comments: true,
          _count: { select: { comments: true } },
        },
        take: 20, // Reduced from 30
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.findMany({
        where: {
          userId: { notIn: [...followingIds, ...excludedUserIds] },
        },
        include: {
          user: true,
          media: true,
          likes: { select: { userId: true } },
          comments: true,
          _count: { select: { comments: true } },
        },
        take: 5, // Reduced from 10
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return [...followingPosts, ...explorePosts];
  },
  ["feed-posts"],
  {
    revalidate: 120, // 2 minutes
    tags: ["feed-posts"],
  }
);

async function Feed({
  username,
  userId,
}: {
  username?: string;
  userId?: string; // Optional: passed from ProfilePage to avoid extra queries
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

  // Get blocked users (cached)
  const excludedUserIds = await getCachedBlockedUsers(currentUserId);

  let posts: any[] = [];

  try {
    if (username) {
      // Profile posts (cached)
      posts = await getCachedProfilePosts(username, excludedUserIds);
    } else {
      // Homepage feed (cached)
      const followingIds = await getCachedFollowing(currentUserId);
      posts = await getCachedFeedPosts(followingIds, excludedUserIds);
    }

    // Simplified scoring logic (moved to client-side for better performance)
    const scoredPosts = posts.map((post) => {
      const likes = post.likes?.length || 0;
      const comments = post.comments?.length || 0;
      const ageHours =
        (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);

      // Simplified scoring
      const recencyBoost = ageHours < 24 ? 2 : 0;
      const score = likes + comments + recencyBoost;

      return { ...post, score };
    });

    // Sort by score
    scoredPosts.sort((a, b) => b.score - a.score);

    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-12 p-4">
        {scoredPosts.length > 0 ? (
          scoredPosts.map((post) => <Post key={post.id} post={post} />)
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
