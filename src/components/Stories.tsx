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
        { userId }, // own stories
        {
          user: {
            followers: {
              some: {
                followingId: userId, // stories from users I follow
              },
            },
          },
        },
      ],
    },
    include: {
      user: true,
      likes: {
        select: { userId: true },
      },
      comments: {
        include: {
          user: true,
          likes: {
            select: { userId: true },
          },
          // Include replies to comments
          replies: {
            include: {
              user: true,
              likes: {
                select: { userId: true },
              },
            },
            orderBy: { createdAt: "asc" }, // replies in chronological order
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 bg-white rounded-lg shadow-md overflow-scroll text-sm scrollbar-hide">
      <div className="flex gap-8 w-max">
        <StoryList stories={stories} userId={userId} />
      </div>
    </div>
  );
}
