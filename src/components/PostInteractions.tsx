"use client";

import { Heart, MessageSquareText, ExternalLink, Plus } from "lucide-react";
import { useState, useCallback, useRef } from "react";
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

  // Local state for instant updates
  const [currentLikes, setCurrentLikes] = useState<string[]>(normalizedLikes);
  const [isLiking, setIsLiking] = useState(false);
  const [isUnliking, setIsUnliking] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [countAnimation, setCountAnimation] = useState(false);

  // Refs for rate limiting and animation control
  const lastLikeTime = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isLiked = userId ? currentLikes.includes(userId) : false;
  const likeCount = currentLikes.length;

  // EPIC like handler with INSANE animations
  const handleLike = useCallback(() => {
    if (!userId) return;

    // Simple rate limiting - prevent spam (300ms cooldown)
    const now = Date.now();
    if (now - lastLikeTime.current < 300) return;
    lastLikeTime.current = now;

    const wasLiked = isLiked;

    // INSTANT UI update
    const newLikes = wasLiked
      ? currentLikes.filter((id) => id !== userId)
      : [...currentLikes, userId];

    setCurrentLikes(newLikes);
    setCountAnimation(true);

    if (!wasLiked) {
      // LIKING - EXPLOSIVE animations! 💥
      setIsLiking(true);
      setShowSparkles(true);

      // Create the epic floating effects
      createEpicEffects();

      // Clear animations faster - no lag
      setTimeout(() => setIsLiking(false), 400);
      setTimeout(() => setShowSparkles(false), 600);
    } else {
      // UNLIKING - Dramatic bounce out
      setIsUnliking(true);
      setTimeout(() => setIsUnliking(false), 400);
    }

    // Clear count animation
    setTimeout(() => setCountAnimation(false), 400);

    // Background server sync - fire and forget
    switchLike(postId).catch((error) => {
      console.error("Like sync failed:", error);
      // Rollback on error
      setCurrentLikes(
        wasLiked
          ? [...currentLikes, userId]
          : currentLikes.filter((id) => id !== userId)
      );
    });
  }, [userId, isLiked, currentLikes, postId]);

  // Create CLEAN floating hearts + sparkles - simple and smooth
  const createEpicEffects = () => {
    if (!buttonRef.current) return;

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Just 3 hearts - clean and simple
    const heartEmojis = ["❤️", "💕", "💖"];
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement("div");
      heart.innerHTML = heartEmojis[i];

      // Spread them nicely but not crazy
      const angle = i * 120 + (Math.random() - 0.5) * 40;
      const startX =
        centerX + Math.cos((angle * Math.PI) / 180) * (15 + Math.random() * 25);
      const startY =
        centerY + Math.sin((angle * Math.PI) / 180) * (5 + Math.random() * 15);

      heart.style.cssText = `
        position: fixed;
        left: ${startX}px;
        top: ${startY}px;
        font-size: ${16 + Math.random() * 6}px;
        pointer-events: none;
        z-index: 9999;
        animation: floatUp 0.8s ease-out forwards;
        animation-delay: ${i * 0.1}s;
      `;

      document.body.appendChild(heart);
      setTimeout(() => heart.remove(), 900);
    }

    // Just 4 sparkles - clean pattern
    const sparkleEmojis = ["✨", "⭐", "🌟", "💫"];
    for (let i = 0; i < 4; i++) {
      const sparkle = document.createElement("div");
      sparkle.innerHTML = sparkleEmojis[i];

      const floatX = (i % 2 === 0 ? -1 : 1) * (20 + Math.random() * 20);
      const startX = centerX + (Math.random() - 0.5) * 30;
      const startY = centerY + (Math.random() - 0.5) * 15;

      sparkle.style.cssText = `
        position: fixed;
        left: ${startX}px;
        top: ${startY}px;
        font-size: ${10 + Math.random() * 4}px;
        pointer-events: none;
        z-index: 9998;
        --float-x: ${floatX}px;
        animation: sparkleFloat 0.7s ease-out forwards;
        animation-delay: ${i * 0.15}s;
      `;

      document.body.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 800);
    }
  };

  return (
    <>
      {/* EPIC Animation Styles */}
      <style jsx>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.8) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-80px) scale(0.3) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes sparkleFloat {
          0% {
            transform: translateY(0) translateX(0) scale(0.5) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-60px) translateX(var(--float-x)) scale(0.1)
              rotate(180deg);
            opacity: 0;
          }
        }

        @keyframes heartExplode {
          0% {
            transform: scale(1) rotate(0deg);
            filter: hue-rotate(0deg);
          }
          25% {
            transform: scale(1.4) rotate(5deg);
            filter: hue-rotate(90deg);
          }
          50% {
            transform: scale(1.6) rotate(-5deg);
            filter: hue-rotate(180deg);
          }
          75% {
            transform: scale(1.3) rotate(3deg);
            filter: hue-rotate(270deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            filter: hue-rotate(360deg);
          }
        }

        @keyframes shockwave {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8);
          }
          50% {
            transform: scale(1.1);
            box-shadow: 0 0 0 15px rgba(239, 68, 68, 0.4);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 25px rgba(239, 68, 68, 0);
          }
        }

        @keyframes unlikeBounce {
          0%,
          100% {
            transform: scale(1);
          }
          25% {
            transform: scale(0.8) rotate(-10deg);
          }
          50% {
            transform: scale(1.1) rotate(5deg);
          }
          75% {
            transform: scale(0.95) rotate(-2deg);
          }
        }

        @keyframes sparkle {
          0%,
          100% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1) rotate(180deg);
            opacity: 1;
          }
        }

        @keyframes countPop {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.3) rotate(5deg);
            color: #ef4444;
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }

        .heart-explode {
          animation: heartExplode 0.6s ease-out;
        }

        .shockwave-effect {
          animation: shockwave 0.8s ease-out;
        }

        .unlike-bounce {
          animation: unlikeBounce 0.4s ease-out;
        }

        .count-pop {
          animation: countPop 0.4s ease-out;
        }

        .sparkle-effect {
          animation: sparkle 0.6s ease-out forwards;
        }
      `}</style>

      <div className="flex items-center justify-between text-sm my-2">
        <div className="flex gap-4">
          {/* EPIC Like Button with INSANE animations */}
          <div
            className={`relative flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl transition-all duration-500 ${
              isLiked
                ? "bg-gradient-to-r from-red-50 to-pink-50 ring-2 ring-red-200 shadow-lg"
                : "hover:bg-slate-200"
            } ${isLiking ? "shockwave-effect" : ""}`}
          >
            <button
              ref={buttonRef}
              onClick={handleLike}
              disabled={!userId}
              className={`relative transition-all duration-300 ${
                isLiking ? "heart-explode" : ""
              } ${
                isUnliking ? "unlike-bounce" : ""
              } hover:scale-125 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={isLiked ? "Unlike post" : "Like post"}
            >
              <Heart
                className={`transition-all duration-400 ${
                  isLiked
                    ? "text-red-500 fill-red-500 drop-shadow-lg filter brightness-110"
                    : "text-gray-400 hover:text-red-300 hover:scale-110"
                } ${isLiking ? "animate-pulse" : ""}`}
                size={22}
              />

              {/* MASSIVE explosion effect when liking - cleaner */}
              {isLiking && (
                <>
                  <div className="absolute inset-0 rounded-full bg-red-300 animate-ping opacity-50"></div>
                  <div
                    className="absolute inset-0 rounded-full bg-pink-300 animate-ping opacity-30"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                </>
              )}

              {/* Simple sparkles around heart - less cluttered */}
              {showSparkles && (
                <>
                  <div className="absolute -top-2 -left-2 text-yellow-400 sparkle-effect">
                    ✨
                  </div>
                  <div
                    className="absolute -top-2 -right-2 text-pink-400 sparkle-effect"
                    style={{ animationDelay: "0.2s" }}
                  >
                    💫
                  </div>
                  <div
                    className="absolute -bottom-2 -right-2 text-purple-400 sparkle-effect"
                    style={{ animationDelay: "0.4s" }}
                  >
                    🌟
                  </div>
                </>
              )}
            </button>

            <span
              className={`font-bold transition-all duration-300 text-lg ${
                isLiked ? "text-red-600 drop-shadow-sm" : "text-gray-700"
              } ${countAnimation ? "count-pop" : ""}`}
            >
              {likeCount}
              <span className="hidden md:inline cursor-pointer font-normal text-sm ml-1">
                {likeCount === 1 ? "Like" : "Likes"}
              </span>
            </span>

            {/* Fire effect for high likes */}
            {likeCount > 10 && isLiked && (
              <div className="absolute -top-1 -right-1 text-orange-500 animate-bounce">
                🔥
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
            <MessageSquareText
              className="cursor-pointer text-blue-400 hover:text-blue-500 transition-all hover:scale-110"
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
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors">
          <ExternalLink
            className="cursor-pointer text-green-500 hover:text-green-600 transition-all hover:scale-110 hover:rotate-12"
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
    </>
  );
};

export default PostInteractions;
