import React from "react";
import Post from "./Post";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";

async function Feed({ username }: { username?: string }) {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    return (
      <div className="bg-rose-50 shadow-md rounded-lg flex flex-col gap-12 p-4">
        <p className="text-center text-gray-500">
          Please log in to see your feed.
        </p>
      </div>
    );
  }

  // Get IDs of users the current user has blocked
  const blockedUsers = await prisma.block.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  const blockedUserIds = blockedUsers.map((b) => b.blockedId);

  // Get IDs of users who have blocked the current user
  const usersWhoBlockedMe = await prisma.block.findMany({
    where: { blockedId: userId },
    select: { blockerId: true },
  });
  const usersWhoBlockedMeIds = usersWhoBlockedMe.map((b) => b.blockerId);

  // Combine both lists to create a comprehensive list of excluded users
  const excludedUserIds = [...blockedUserIds, ...usersWhoBlockedMeIds];

  let posts: any[] = [];

  if (username) {
    // This part handles the user's own profile or a public profile
    posts = await prisma.post.findMany({
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
      take: 50,
    });
  } else {
    // This part handles the main homepage feed
    const following = await prisma.follower.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    const followingPosts = await prisma.post.findMany({
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
      take: 30,
      orderBy: { createdAt: "desc" },
    });

    const explorePosts = await prisma.post.findMany({
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
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    posts = [...followingPosts, ...explorePosts];
  }

  // Scoring logic remains the same
  const scoredPosts = posts.map((post) => {
    const likes = post.likes?.length || 0;
    const comments = post.comments?.length || 0;

    const ageHours =
      (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);

    const recencyBoost = ageHours < 1 ? 10 : ageHours < 24 ? 5 : 0;

    const score = likes * 2 + comments * 3 + recencyBoost;

    return { ...post, score };
  });

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
}

export default Feed;
