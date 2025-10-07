"use client";

import { Heart, MessageSquareText, ExternalLink } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { switchLike } from "@/actions/switchLike";

interface PostInteractionsProps {
  postId: number;
  likes: Array<{ userId: string }> | string[];
  commentNumber?: number;
}

const PostInteractions = ({
  postId,
  likes,
  commentNumber = 0,
}: PostInteractionsProps) => {
  const { user } = useUser();
  const userId = user?.id;

  // Convert likes to simple array format
  const normalizedLikes = Array.isArray(likes)
    ? likes.map((like) => (typeof like === "string" ? like : like.userId))
    : [];

  // State management
  const [currentLikes, setCurrentLikes] = useState<string[]>(normalizedLikes);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pendingLike, setPendingLike] = useState<boolean | null>(null);

  // Animation states
  const [showSparkles, setShowSparkles] = useState(false);
  const [countAnimation, setCountAnimation] = useState(false);

  // Refs for request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestQueueRef = useRef<boolean | null>(null);
  const isProcessingRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update likes when props change (for navigation consistency)
  useEffect(() => {
    setCurrentLikes(normalizedLikes);
  }, [likes]);

  const isLiked = userId ? currentLikes.includes(userId) : false;
  const likeCount = currentLikes.length;

  // Process the like request with proper queue management
  const processLikeRequest = async (shouldLike: boolean) => {
    if (!userId || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const originalLikes = [...currentLikes];

    try {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      console.log(
        `Processing ${shouldLike ? "like" : "unlike"} for post ${postId}`
      );

      const result = await switchLike(postId, shouldLike);

      if (result.success) {
        // Update with server state
        setCurrentLikes(result.likeUserIds);
        setPendingLike(null);
      } else {
        // Rollback on error
        console.error("Like operation failed:", result.error);
        setCurrentLikes(originalLikes);
        setPendingLike(null);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Like request error:", error);
        setCurrentLikes(originalLikes);
        setPendingLike(null);
      }
    } finally {
      isProcessingRef.current = false;
      abortControllerRef.current = null;

      // Process any queued request
      if (requestQueueRef.current !== null) {
        const nextRequest = requestQueueRef.current;
        requestQueueRef.current = null;
        processLikeRequest(nextRequest);
      }
    }
  };

  // Handle like with proper debouncing and queue management
  const handleLike = useCallback(() => {
    if (!userId) return;

    const targetLikeState = !isLiked;

    // Update UI immediately
    const optimisticLikes = targetLikeState
      ? [...currentLikes, userId]
      : currentLikes.filter((id) => id !== userId);

    setCurrentLikes(optimisticLikes);
    setPendingLike(targetLikeState);

    // Trigger animations
    setCountAnimation(true);
    if (targetLikeState) {
      setIsAnimating(true);
      setShowSparkles(true);
      createHeartEffects();
      setTimeout(() => {
        setIsAnimating(false);
        setShowSparkles(false);
      }, 600);
    }
    setTimeout(() => setCountAnimation(false), 300);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If currently processing, queue this request
    if (isProcessingRef.current) {
      requestQueueRef.current = targetLikeState;
      return;
    }

    // Debounce the server request (300ms delay)
    debounceTimerRef.current = setTimeout(() => {
      processLikeRequest(targetLikeState);
    }, 300);
  }, [userId, isLiked, currentLikes, postId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Create floating heart effects (simplified)
  const createHeartEffects = () => {
    if (!buttonRef.current) return;

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Create 2-3 floating hearts
    const hearts = ["❤️", "💕", "💖"];
    const numHearts = 2 + Math.floor(Math.random() * 2);

    for (let i = 0; i < numHearts; i++) {
      const heart = document.createElement("div");
      heart.innerHTML = hearts[Math.floor(Math.random() * hearts.length)];

      const angle = (i * 360) / numHearts + (Math.random() - 0.5) * 30;
      const distance = 20 + Math.random() * 20;
      const startX = centerX + Math.cos((angle * Math.PI) / 180) * distance;
      const startY = centerY + Math.sin((angle * Math.PI) / 180) * distance;

      heart.style.cssText = `
        position: fixed;
        left: ${startX}px;
        top: ${startY}px;
        font-size: ${18 + Math.random() * 8}px;
        pointer-events: none;
        z-index: 9999;
        animation: floatUp 0.8s ease-out forwards;
        opacity: 0;
        animation-delay: ${i * 0.1}s;
      `;

      document.body.appendChild(heart);
      setTimeout(() => heart.remove(), 1000);
    }
  };

  return (
    <>
      <style jsx>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translateY(-60px) scale(0.8);
            opacity: 0;
          }
        }

        @keyframes heartPulse {
          0% {
            transform: scale(1);
          }
          25% {
            transform: scale(1.3);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes countBounce {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }

        .heart-pulse {
          animation: heartPulse 0.4s ease-out;
        }

        .count-bounce {
          animation: countBounce 0.3s ease-out;
        }
      `}</style>

      <div className="flex items-center justify-between text-sm my-2">
        <div className="flex gap-4">
          {/* Like Button */}
          <div
            className={`
            relative flex items-center gap-2 px-3 py-1.5 rounded-xl 
            transition-all duration-200 select-none
            ${
              isLiked
                ? "bg-red-50 ring-1 ring-red-200"
                : "bg-slate-100 hover:bg-slate-200"
            }
            ${pendingLike !== null ? "opacity-90" : ""}
          `}
          >
            <button
              ref={buttonRef}
              onClick={handleLike}
              disabled={!userId}
              className="relative transition-transform duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isLiked ? "Unlike post" : "Like post"}
            >
              <Heart
                className={`
                  transition-all duration-200
                  ${
                    isLiked
                      ? "text-red-500 fill-red-500"
                      : "text-gray-500 hover:text-red-400"
                  }
                  ${isAnimating ? "heart-pulse" : ""}
                `}
                size={20}
              />

              {/* Pulse effect on like */}
              {isAnimating && (
                <div className="absolute inset-0 -m-2 rounded-full bg-red-400 animate-ping opacity-30" />
              )}

              {/* Sparkles */}
              {showSparkles && (
                <>
                  <span className="absolute -top-1 -right-1 text-xs animate-pulse">
                    ✨
                  </span>
                  <span
                    className="absolute -bottom-1 -left-1 text-xs animate-pulse"
                    style={{ animationDelay: "0.1s" }}
                  >
                    💫
                  </span>
                </>
              )}
            </button>

            <span
              className={`
              font-medium transition-all duration-200
              ${isLiked ? "text-red-600" : "text-gray-700"}
              ${countAnimation ? "count-bounce" : ""}
            `}
            >
              {likeCount}
              <span className="hidden sm:inline ml-1 font-normal text-xs">
                {likeCount === 1 ? "Like" : "Likes"}
              </span>
            </span>

            {/* Loading indicator for pending state */}
            {pendingLike !== null && (
              <div className="absolute -right-1 -top-1">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
            <MessageSquareText className="text-blue-500" size={18} />
            <span className="text-gray-700 font-medium">
              {commentNumber}
              <span className="hidden sm:inline ml-1 font-normal text-xs">
                {commentNumber === 1 ? "Comment" : "Comments"}
              </span>
            </span>
          </div>
        </div>

        {/* Share */}
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
          <ExternalLink className="text-green-500" size={18} />
          <span className="text-gray-700 font-medium">
            0
            <span className="hidden sm:inline ml-1 font-normal text-xs">
              {" "}
              Shares
            </span>
          </span>
        </div>
      </div>
    </>
  );
};

export default PostInteractions;
