"use server";

import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";

export async function getFollowers() {
  try {
    const user = await currentUser();
    if (!user) {
      console.log("No authenticated user");
      return []; // don't redirect, just return empty
    }

    const dbUser = await prisma.user.findFirst({
      where: { id: user.id },
      include: {
        followers: {
          include: { following: true },
        },
        blocks: {
          select: { blockedId: true },
        },
      },
    });

    if (!dbUser) {
      console.log(`User not found in DB for id: ${user.id}`);
      return [];
    }

    const blockedUserIds = new Set(dbUser.blocks.map((b) => b.blockedId));

    const filteredFollowers = dbUser.followers
      .filter((f) => !blockedUserIds.has(f.following.id))
      .map((f) => ({
        id: f.following.id,
        username: f.following.username || "Unknown User",
        avatar: f.following.avatar || "/noAvatar.png",
      }));

    console.log(
      `Followers fetched for ${user.id}: ${filteredFollowers.length}`
    );

    return filteredFollowers;
  } catch (err) {
    console.error("getFollowers error:", err);
    return [];
  }
}
