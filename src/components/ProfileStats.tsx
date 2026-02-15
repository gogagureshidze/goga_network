"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const FollowListModal = dynamic(() => import("./FollowListModal"), {
  ssr: false,
});

type ProfileStatsProps = {
  postsCount: number;
  followersCount: number;
  followingsCount: number;
  userId: string;
  username: string;
  isPrivate: boolean;
  isOwner: boolean;
  isFollowing: boolean;
};

export default function ProfileStats({
  postsCount,
  followersCount,
  followingsCount,
  userId,
  username,
  isPrivate,
  isOwner,
  isFollowing,
}: ProfileStatsProps) {
  const [modal, setModal] = useState<"followers" | "followings" | null>(null);

  return (
    <>
      <div className="flex items-center justify-center gap-12 mb-4">
        {/* Posts — not clickable */}
        <div className="flex flex-col items-center">
          <span className="font-medium text-orange-400">{postsCount}</span>
          <span className="text-sm">Posts</span>
        </div>

        {/* Followers — always clickable */}
        <button
          onClick={() => setModal("followers")}
          className="flex flex-col items-center group hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span className="font-medium text-orange-400 group-hover:text-orange-500 transition-colors">
            {followersCount}
          </span>
          <span className="text-sm group-hover:underline underline-offset-2">
            Followers
          </span>
        </button>

        {/* Followings — clickable; shows lock screen if private + not following */}
        <button
          onClick={() => setModal("followings")}
          className="flex flex-col items-center group hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span className="font-medium text-orange-400 group-hover:text-orange-500 transition-colors">
            {followingsCount}
          </span>
          <span className="text-sm group-hover:underline underline-offset-2">
            Following
          </span>
        </button>
      </div>

      {modal && (
        <FollowListModal
          isOpen={true}
          onClose={() => setModal(null)}
          type={modal}
          userId={userId}
          username={username}
          isPrivate={isPrivate}
          isOwner={isOwner}
          isFollowing={isFollowing}
          count={modal === "followers" ? followersCount : followingsCount}
        />
      )}
    </>
  );
}
