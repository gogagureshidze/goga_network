"use client";

import { Heart, MessageSquareText, ExternalLink } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { switchLike } from "@/actions/switchLike";

interface PostInteractionsProps {
  postId: number;
  likes: Array<{ userId: string }> | string[];
  commentNumber?: number;
}

// Rate limiting hook
function useRateLimit(maxCalls: number, timeWindow: number) {
  const callsRef = useRef<number[]>([]);

  return useCallback(() => {
    const now = Date.now();
    const cutoff = now - timeWindow;

    callsRef.current = callsRef.current.filter((time) => time > cutoff);

    if (callsRef.current.length >= maxCalls) {
      return false;
    }

    callsRef.current.push(now);
    return true;
  }, [maxCalls, timeWindow]);
}

const PostInteractions = ({
  postId,
  likes,
  commentNumber = 0,
}: PostInteractionsProps) => {
  const { user } = useUser();
  const userId = user?.id;

  // Rate limiting - prevent spam clicking
  const canLike = useRateLimit(10, 5000); // 10 likes per 5 seconds

  // Convert likes to simple array format
  const normalizedLikes = Array.isArray(likes)
    ? likes.map((like) => (typeof like === "string" ? like : like.userId))
    : [];

  // Local state for instant updates
  const [currentLikes, setCurrentLikes] = useState<string[]>(normalizedLikes);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Sync with server data when props change (handles page refreshes)
  useEffect(() => {
    const newLikesArray = Array.isArray(likes)
      ? likes.map((like) => (typeof like === "string" ? like : like.userId))
      : [];
    setCurrentLikes(newLikesArray);
  }, [likes]);

  const isLiked = userId ? currentLikes.includes(userId) : false;

  const handleLike = useCallback(async () => {
    if (!userId || isPending || !canLike()) {
      return;
    }

    const wasLiked = isLiked;
    const originalLikes = [...currentLikes];

    // Instant UI update
    setIsAnimating(true);
    setIsPending(true);

    const newLikes = wasLiked
      ? currentLikes.filter((id) => id !== userId)
      : [...currentLikes, userId];

    setCurrentLikes(newLikes);

    try {
      // Fire background request - don't await to keep UI snappy
      switchLike(postId)
        .then((result) => {
          if (result.success) {
            // Update with server data to stay in sync
            setCurrentLikes(result.likeUserIds);
          } else {
            // Rollback on server failure
            setCurrentLikes(originalLikes);
          }
        })
        .catch((error) => {
          console.error("Failed to like/unlike post:", error);
          // Rollback on error
          setCurrentLikes(originalLikes);
        })
        .finally(() => {
          setIsPending(false);
        });
    } catch (error) {
      console.error("Like error:", error);
      setCurrentLikes(originalLikes);
      setIsPending(false);
    }

    // Clear animation quickly for responsive feel
    setTimeout(() => setIsAnimating(false), 200);
  }, [userId, isPending, canLike, isLiked, currentLikes, postId]);

  return (
    <div className="flex items-center justify-between text-sm my-2">
      <div className="flex gap-4">
        {/* Like Button */}
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
          <button
            onClick={handleLike}
            disabled={!userId}
            className={`transition-all duration-150 ${
              isAnimating ? "scale-125" : "scale-100"
            } hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={isLiked ? "Unlike post" : "Like post"}
          >
            <Heart
              className={`transition-all duration-200 ${
                isLiked
                  ? "text-red-500 fill-red-500"
                  : "text-gray-400 hover:text-red-300"
              } ${isPending ? "opacity-70" : ""}`}
              size={20}
            />
          </button>
          <span className="text-gray-700 font-medium">
            {currentLikes.length}
            <span className="hidden md:inline cursor-pointer font-normal">
              {currentLikes.length === 1 ? " Like" : " Likes"}
            </span>
          </span>
        </div>

        {/* Comments */}
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
          <MessageSquareText
            className="cursor-pointer text-blue-400 hover:text-blue-500 transition-colors"
            size={18}
          />
          <span className="text-gray-700 font-medium">
            {commentNumber}
            <span className="hidden md:inline cursor-pointer font-normal">
              {commentNumber === 1 ? " Comment" : " Comments"}
            </span>
          </span>
        </div>
      </div>

      {/* Share */}
      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
        <ExternalLink
          className="cursor-pointer text-green-500 hover:text-green-600 transition-colors"
          size={18}
        />
        <span className="text-gray-700 font-medium">
          0
          <span className="hidden md:inline cursor-pointer font-normal">
            {" "}
            Shares
          </span>
        </span>
      </div>
    </div>
  );
};

export default PostInteractions;
