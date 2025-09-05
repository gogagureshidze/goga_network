"use client";

import { switchBlock } from "@/actions/block";
import { switchFollow } from "@/actions/switchFollow";
import { CalendarHeart } from "lucide-react";
import { useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";

function UserInfoCardInteraction({
  formatedDate,
  isUserBlocked,
  isFollowing,
  isFollowingSent,
  userId,
}: {
  currentUserId: string | undefined;
  formatedDate: string;
  isUserBlocked: boolean;
  isFollowing: boolean;
  isFollowingSent: boolean;
  userId: string;
}) {
  const [userState, setUserState] = useState({
    following: isFollowing,
    blocked: isUserBlocked,
    followRequestSent: isFollowingSent,
  });
  const router = useRouter();

  const follow = async () => {
    switchOptimisticFollow("follow");
    try {
      await switchFollow(userId);
      setUserState((prev) => {
        if (prev.following) {
          // Unfollowing a user
          return {
            ...prev,
            following: false,
            followRequestSent: false,
          };
        } else if (prev.followRequestSent) {
          // Canceling a follow request
          return {
            ...prev,
            followRequestSent: false,
          };
        } else {
          // Sending a follow request
          return {
            ...prev,
            followRequestSent: true,
          };
        }
      });
    } catch (error) {
      console.error("Error with follow action:", error);
      // Revert state if there's an error
      setUserState({
        following: isFollowing,
        blocked: isUserBlocked,
        followRequestSent: isFollowingSent,
      });
    }
  };

  const block = async () => {
    switchOptimisticFollow("block");
    try {
      await switchBlock(userId);
      setUserState((prev) => ({
        ...prev,
        blocked: !prev.blocked,
      }));
router.refresh();
    } catch (error) {
      console.error("Error blocking user:", error);
      // Revert state if there's an error
      setUserState({
        following: isFollowing,
        blocked: isUserBlocked,
        followRequestSent: isFollowingSent,
      });
    }
  };

  const [optimisticFollow, switchOptimisticFollow] = useOptimistic(
    userState,
    (state, value: "follow" | "block") => {
      if (value === "follow") {
        if (state.following) {
          // Optimistically show "Follow" when unfollowing
          return {
            ...state,
            following: false,
            followRequestSent: false,
          };
        } else if (state.followRequestSent) {
          // Optimistically show "Follow" when canceling request
          return {
            ...state,
            followRequestSent: false,
          };
        } else {
          // Optimistically show "Follow Request Sent"
          return {
            ...state,
            followRequestSent: true,
          };
        }
      } else {
        // Optimistic update for blocking
        return {
          ...state,
          blocked: !state.blocked,
        };
      }
    }
  );

  return (
    <>
      <form action={follow} className="mb-2">
        <button className="w-[100%] bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-all duration-200">
          {optimisticFollow.following
            ? "Unfollow"
            : optimisticFollow.followRequestSent
            ? "Follow Request Sent"
            : "Follow"}
        </button>
      </form>
      <div className="flex items-center justify-between">
        <form action={block}>
          <button>
            <span className="text-red-600 self-end text-xs cursor-pointer hover:underline">
              {optimisticFollow.blocked ? "Unblock User!" : "Block User!"}
            </span>
          </button>
        </form>
        <div>
          <div className="flex gap-1 items-center">
            <CalendarHeart className="text-rose-400" />
            <span className="text-xs">Joined {formatedDate}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default UserInfoCardInteraction;
