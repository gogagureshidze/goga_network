"use client";

import { HandHeart, MessageSquareText, ExternalLink } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { switchLike } from "@/actions/switchLike";

const PostInteractions = ({
  postId,
  likes,
  commentNumber,
}: {
  postId: number;
  likes: string[];
  commentNumber?: number;
}) => {
  const { userId } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [optimisticLikes, switchOptimisticLikes] = useOptimistic(
    likes,
    (state, currentUserId: string) => {
      const hasLiked = state.includes(currentUserId);
      if (hasLiked) {
        return state.filter((id) => id !== currentUserId);
      } else {
        return [...state, currentUserId];
      }
    }
  );

  const handleLike = async () => {
    if (!userId) return;

    // Use useTransition to wrap the optimistic update.
    // This allows the UI to update instantly while the server action runs.
    startTransition(() => {
      switchOptimisticLikes(userId);
    });

    try {
      // The server action will handle the database update and revalidation.
      await switchLike(postId);
    } catch (error) {
      console.error("Failed to like/unlike post:", error);
    }
  };

  const isLiked = userId ? optimisticLikes.includes(userId) : false;

  return (
    <div className="flex items-center justify-between text-sm my-2">
      <div className="flex gap-4">
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
          <button onClick={handleLike} disabled={isPending}>
            <HandHeart
              className={`cursor-pointer ${
                isLiked ? "text-red-500" : "text-gray-400"
              }`}
            />
          </button>
          <span className="text-gray-700">
            {optimisticLikes.length}
            <span className="hidden md:inline cursor-pointer"> | Likes </span>
          </span>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
          <MessageSquareText className="cursor-pointer text-blue-400" />
          <span className="text-gray-700">
            {commentNumber || 0}
            <span className="hidden md:inline cursor-pointer">
              {" "}
              | Comments{" "}
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
        <ExternalLink className="cursor-pointer text-green-500" />
        <span className="text-gray-700">
          0<span className="hidden md:inline cursor-pointer"> | Shares</span>
        </span>
      </div>
    </div>
  );
};

export default PostInteractions;
