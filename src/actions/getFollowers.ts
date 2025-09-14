"use server";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// This function is a server action with added logging
export async function getFollowers() {
  const user = await currentUser();
  if (!user) {
    console.log("No authenticated user found. Redirecting to sign-in.");
    redirect("/sign-in");
  }

  console.log(`Searching for user with ID: ${user.id}`);

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

  if (!dbUser) {
    console.log(`User not found in the database for ID: ${user.id}`);
    return null;
  }

  console.log(
    `Found user, fetching followers. Number of raw followers: ${dbUser.followers.length}`
  );

  // Filter out any users who are blocked by the current user
  const blockedUserIds = new Set(dbUser.blocks.map((block) => block.blockedId));
  const filteredFollowers = dbUser.followers
    .filter((f) => !blockedUserIds.has(f.following.id))
    .map((f) => ({
      id: f.following.id,
      username: f.following.username,
      avatar: f.following.avatar,
    }));

  console.log(
    `Final number of filtered followers: ${filteredFollowers.length}`
  );
  return filteredFollowers;
}
