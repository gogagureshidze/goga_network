import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import FollowersList from "../../components/FollowersList";
import { redirect } from "next/navigation";


// Server-side data fetching function
async function getFollowers() {
  const user = await currentUser();
    if (!user) {
      redirect("/sign-in");
    }
  if (!user) return null;

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

export default async function FollowersPage() {
  const followers = await getFollowers();

  if (!followers) {
    return notFound();
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Suspense fallback={<div>Loading followers...</div>}>
        <FollowersList initialFollowers={followers} />
      </Suspense>
    </div>
  );
}
