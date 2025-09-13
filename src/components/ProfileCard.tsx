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
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-6">
      <div className="h-20 relative">
        <Image
          className="rounded-md object-cover"
          fill
          alt="Background aesthetic"
          src={user.cover || "/noCover.png"}
        />
        <Image
          className="rounded-full w-12 h-12 absolute object-cover left-0 right-0 m-auto -bottom-6 ring-1 ring-white z-10"
          width={48}
          height={48}
          alt="Profile picture"
          src={usr?.imageUrl || "/noAvatar.png"}
        />
      </div>

      <div className="h-20 flex flex-col gap-2 items-center my-2">
        <span className="font-semibold">
          {user.name && user.surname
            ? user.name + " " + user.surname
            : usr?.username}
        </span>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {followerUsers.map((f) => (
              <Image
                key={f.id}
                className="rounded-full object-cover w-6 h-6 border border-white"
                width={24}
                height={24}
                alt={f.username || "Follower"}
                src={f.avatar || "/noAvatar.png"}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {user._count.followings} Followers
          </span>
        </div>

        <Link href={`/profile/${username}`}>
          <button className="bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-2 py-2 rounded-lg shadow-sm transition-all duration-200">
            My Profile
          </button>
        </Link>
      </div>
    </div>
  );
}

export default ProfileCard;
