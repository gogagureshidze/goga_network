"use client";

import { switchBlock } from "@/actions/block";
import { switchFollow } from "@/actions/switchFollow";
import { CalendarHeart } from "lucide-react";
import { useOptimistic } from "react";
import { useRouter } from "next/navigation";

type UserInfoCardInteractionProps = {
  currentUserId?: string;
  formatedDate: string;
  isUserBlocked: boolean;
  isFollowing: boolean;
  isFollowingSent: boolean;
  userId: string;
  isBlockedByViewer?: boolean;
};

function UserInfoCardInteraction({
  formatedDate,
  isUserBlocked,
  isFollowing,
  isFollowingSent,
  userId,
  isBlockedByViewer = false,
}: UserInfoCardInteractionProps) {
  const router = useRouter();

  const [optimisticFollow, switchOptimisticFollow] = useOptimistic(
    {
      following: isFollowing,
      blocked: isUserBlocked,
      followRequestSent: isFollowingSent,
    },
    (state, value: "follow" | "block") => {
      if (value === "follow") {
        if (state.following) {
          return { ...state, following: false, followRequestSent: false };
        } else if (state.followRequestSent) {
          return { ...state, followRequestSent: false };
        } else {
          return { ...state, followRequestSent: true };
        }
      } else {
        return { ...state, blocked: !state.blocked };
      }
    }
  );

  const follow = async () => {
    switchOptimisticFollow("follow");
    try {
      await switchFollow(userId);
    } catch (error) {
      console.error("Error with follow action:", error);
      switchOptimisticFollow("follow"); // revert
    }
  };

  const block = async () => {
    switchOptimisticFollow("block");
    try {
      await switchBlock(userId);
      router.refresh(); // optional
    } catch (error) {
      console.error("Error blocking user:", error);
      switchOptimisticFollow("block"); // revert
    }
  };

  return (
    <div className="space-y-2">
      {/* Follow button disappears immediately when blocked */}
      {!optimisticFollow.blocked && !isBlockedByViewer && (
        <button
          onClick={follow}
          className="w-full bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-all duration-200"
        >
          {optimisticFollow.following
            ? "Unfollow"
            : optimisticFollow.followRequestSent
            ? "Follow Request Sent"
            : "Follow"}
        </button>
      )}

      <div className="flex items-center justify-between">
        <button onClick={block}>
          <span className="text-red-600 self-end text-xs cursor-pointer hover:underline">
            {optimisticFollow.blocked ? "Unblock User!" : "Block User!"}
          </span>
        </button>

        <div className="flex gap-1 items-center">
          <CalendarHeart className="text-rose-400" />
          <span className="text-xs">Joined {formatedDate}</span>
        </div>
      </div>
    </div>
  );
}

export default UserInfoCardInteraction;
