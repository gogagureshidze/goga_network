"use client";
import { Heart, MessageSquareText, ExternalLink } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { switchLike } from "@/actions/switchLike";

interface PostInteractionsProps {
  postId: number;
  likes: Array<{ userId: string }> | string[]; // Support both formats
  commentNumber?: number;
}

const PostInteractions = ({
  postId,
  likes,
  commentNumber = 0,
}: PostInteractionsProps) => {
  const { user } = useUser(); // Use useUser instead of useAuth
  const userId = user?.id;
  const [isPending, startTransition] = useTransition();

  // Convert likes to simple array format if needed
  const likesArray = Array.isArray(likes)
    ? likes.map((like) => (typeof like === "string" ? like : like.userId))
    : [];

  // Simple state management
  const [currentLikes, setCurrentLikes] = useState<string[]>(likesArray);
  const [isAnimating, setIsAnimating] = useState(false);

  // Update currentLikes when props change (for server updates)
  useEffect(() => {
    const newLikesArray = Array.isArray(likes)
      ? likes.map((like) => (typeof like === "string" ? like : like.userId))
      : [];
    setCurrentLikes(newLikesArray);
  }, [likes]);

  const isLiked = userId ? currentLikes.includes(userId) : false;

  // Debug - remove this after fixing
  console.log("Debug info:", {
    userId,
    currentLikes,
    isLiked,
    originalLikes: likes,
    userExists: !!user,
  });

  const handleLike = async () => {
    if (!userId || isPending) {
      return;
    }

    // Immediate visual feedback
    setIsAnimating(true);

    // Update UI immediately
    const newLikes = isLiked
      ? currentLikes.filter((id) => id !== userId)
      : [...currentLikes, userId];

    setCurrentLikes(newLikes);

    startTransition(async () => {
      try {
        const result = await switchLike(postId);

        if (result.success) {
          // Update with server data to stay in sync
          setCurrentLikes(result.likeUserIds);
        } else {
          // Revert on failure
          setCurrentLikes(likesArray);
        }
      } catch (error) {
        console.error("Failed to like/unlike post:", error);
        // Revert on error
        setCurrentLikes(likesArray);
      } finally {
        setTimeout(() => setIsAnimating(false), 300);
      }
    });
  };

  return (
    <div className="flex items-center justify-between text-sm my-2">
      <div className="flex gap-4">
        {/* Like Button */}
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
          <button
            onClick={handleLike}
            disabled={isPending || !userId}
            className={`transition-transform duration-150 ${
              isAnimating ? "scale-125" : "scale-100"
            } hover:scale-110 active:scale-95`}
          >
            <Heart
              className={`cursor-pointer transition-all duration-200 ${
                isLiked
                  ? "text-red-500 fill-red-500"
                  : "text-gray-400 hover:text-red-300"
              }`}
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
