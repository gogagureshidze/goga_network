"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { UserMinus, UserX, Search } from "lucide-react";
import { removeFollowing } from "@/actions/removeFollowing";
import { switchBlock } from "@/actions/block";

type Follower = {
  id: string;
  username: string | null;
  avatar: string | null;
  name?: string | null;
};

const FollowersList = ({
  initialFollowers,
}: {
  initialFollowers: Follower[];
}) => {
  const [followers, setFollowers] = useState(initialFollowers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Filter followers for search
  const filteredFollowers = followers.filter((f) =>
    f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveFollower = async (id: string) => {
    // Optimistically remove follower from UI
    setFollowers((prev) => prev.filter((f) => f.id !== id));

    // Run server action
    startTransition(async () => {
      try {
        await removeFollowing(id);
      } catch (err) {
        console.error(err);
        // Rollback UI in case of error
        setFollowers(initialFollowers);
      }
    });
  };

  const handleBlockFollower = async (id: string) => {
    // Optimistically remove follower from UI
    setFollowers((prev) => prev.filter((f) => f.id !== id));

    startTransition(async () => {
      try {
        await switchBlock(id);
      } catch (err) {
        console.error(err);
        setFollowers(initialFollowers);
      }
    });
  };

  return (
    <div className="w-full min-h-screen bg-rose-50 flex flex-col items-center py-8 px-4 sm:px-6 lg:py-12">
      <div className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 lg:p-10">
        <h2 className="text-3xl sm:text-4xl lg:text-4xl font-extrabold text-gray-800 mb-6 text-center">
          Your Followers
        </h2>

        {/* Search Bar */}
        <div className="relative mb-8">
          <input
            type="text"
            placeholder="Search followers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-6 py-3 border border-gray-200 rounded-full focus:ring-4 focus:ring-orange-200 focus:border-orange-500 transition-all duration-300 shadow-inner text-base sm:text-lg lg:text-lg"
          />
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={24}
          />
        </div>

        {/* Followers List */}
        <div className="space-y-6">
          {filteredFollowers.length > 0 ? (
            filteredFollowers.map((f) => (
              <div
                key={f.id}
                className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 lg:p-5 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl hover:z-10"
              >
                <Link
                  href={`/profile/${f.username}`}
                  className="flex items-center gap-4 mb-4 sm:mb-0 w-full sm:w-auto"
                >
                  <Image
                    src={f.avatar || "/noAvatar.png"}
                    alt={f.username || "User"}
                    width={56}
                    height={56}
                    className="rounded-full w-14 h-14 lg:w-14 lg:h-14 border-4 border-orange-300 object-cover"
                  />
                  <span className="font-bold text-lg sm:text-[14px] lg:text-[16px] text-gray-800">
                    {f.username}
                  </span>
                </Link>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleRemoveFollower(f.id)}
                    disabled={isPending}
                    className="flex items-center gap-2 px-3 py-2 bg-rose-100 text-rose-800 rounded-full font-semibold text-sm transition-all duration-300 hover:bg-rose-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1 hover:shadow-md"
                    title="Remove Follower"
                  >
                    <UserMinus size={16} />
                    <span>Remove</span>
                  </button>
                  <button
                    onClick={() => handleBlockFollower(f.id)}
                    disabled={isPending}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-full font-semibold text-sm transition-all duration-300 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1 hover:shadow-md"
                    title="Block User"
                  >
                    <UserX size={18} />
                    <span>Block</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 text-base sm:text-xl py-10">
              No followers found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersList;
