import Image from "next/image";
import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import Link from "next/link";

async function ProfileCard() {
  const usr = await currentUser();
  const username = usr?.username;
  const userId = usr?.id || "";
  if (!userId) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id: userId },
    include: {
      _count: {
        select: {
          followings: true, // count
        },
      },
      followings: {
        select: {
          follower: {
            // 👈 join follower user details
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  // Extract followers' avatars and filter out duplicates
  const uniqueFollowersMap = new Map();
  user.followings.forEach((f) => {
    uniqueFollowersMap.set(f.follower.id, f.follower);
  });
  let followerUsers = Array.from(uniqueFollowersMap.values());

  // If more than 3, randomize and pick 3
  if (followerUsers.length > 3) {
    followerUsers = followerUsers.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-900/50 text-sm flex flex-col gap-6 border border-gray-100 dark:border-gray-700 transition-colors">
      <div className="h-20 relative">
        <Image
          className="rounded-md object-cover"
          fill
          alt="Background aesthetic"
          src={user.cover || "/noCover.png"}
        />
        <Image
          className="rounded-full w-12 h-12 absolute object-cover left-0 right-0 m-auto -bottom-6 ring-2 ring-white dark:ring-gray-700 z-10 transition-all"
          width={48}
          height={48}
          alt="Profile picture"
          src={usr?.imageUrl || "/noAvatar.png"}
        />
      </div>

      <div className="h-20 flex flex-col gap-2 items-center my-2">
        <span className="font-semibold text-gray-900 dark:text-gray-100 transition-colors">
          {user.name && user.surname
            ? user.name + " " + user.surname
            : usr?.username}
        </span>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {followerUsers.map((f) => (
              <Image
                key={f.id}
                className="rounded-full object-cover w-6 h-6 border-2 border-white dark:border-gray-700 transition-all"
                width={24}
                height={24}
                alt={f.username || "Follower"}
                src={f.avatar || "/noAvatar.png"}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors">
            {user._count.followings} Followers
          </span>
        </div>

        <Link href={`/profile/${username}`}>
          <button className="bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500 dark:from-orange-500 dark:to-rose-500 dark:hover:from-orange-600 dark:hover:to-rose-600 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg dark:shadow-orange-900/50 transition-all duration-200">
            My Profile
          </button>
        </Link>
      </div>
    </div>
  );
}

export default ProfileCard;
