'use server'
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// This function is a server action
export async function getFollowers() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: user.id },
    include: {
      followers: {
        include: { following: true }, // get user info of followers
      },
      blocks: {
        select: {
          blockedId: true,
        },
      },
    },
  });

  if (!dbUser) return null;

  // Filter out any users who are blocked by the current user
  const blockedUserIds = new Set(dbUser.blocks.map((block) => block.blockedId));
  const filteredFollowers = dbUser.followers
    .filter((f) => !blockedUserIds.has(f.following.id))
    .map((f) => ({
      id: f.following.id,
      username: f.following.username,
      avatar: f.following.avatar,
    }));

  return filteredFollowers;
}
