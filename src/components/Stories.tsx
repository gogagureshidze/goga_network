"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import StoryList from "./StoryList";

export default async function Stories() {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) return null;

  // Fetch stories visible to this user (self + followed users)
  const stories = await prisma.story.findMany({
    where: {
      expiresAt: { gt: new Date() },
      OR: [
        { userId },
        {
          user: {
            followers: {
              some: {
                followingId: userId,
              },
            },
          },
        },
      ],
    },
    include: {
      user: true,
      likes: {
        select: {
          id: true,
          createdAt: true,
          postId: true,
          userId: true,
          commentId: true,
          storyId: true,
          storyCommentId: true,
        },
      },
      comments: {
        include: {
          user: true,
          likes: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 bg-white rounded-lg shadow-md overflow-scroll text-sm scrollbar-hide">
      <div className="flex gap-8 w-max">
        <StoryList
          stories={stories.map(({ comments, ...rest }) => ({
            ...rest,
            comments: comments.map((c) => ({
              ...c,
              likes: c.likes.map((l) => ({ userId: l.userId })), // match type
            })),
          }))}
          userId={userId}
        />
      </div>
    </div>
  );
}
