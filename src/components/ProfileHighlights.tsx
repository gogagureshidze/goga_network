"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { getUserHighlights } from "../actions/highlightActions";
import Image from "next/image";
import Link from "next/link";

interface Highlight {
  id: number;
  title: string;
  coverUrl: string | null;
  _count: {
    stories: number;
  };
}

interface ProfileHighlightsProps {
  userId: string;
  isOwner: boolean;
}

const ProfileHighlights = ({ userId, isOwner }: ProfileHighlightsProps) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        setLoading(true);
        setError(false);
        const data = await getUserHighlights(userId);
        setHighlights(data as any);
      } catch (err) {
        console.error("Failed to fetch highlights:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchHighlights();
  }, [userId]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-4 border border-gray-100 dark:border-slate-800">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 min-w-[80px] flex-shrink-0"
            >
              <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-12 h-3 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state - only show to owner
  if (error && isOwner) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-4 border border-gray-100 dark:border-slate-800">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Failed to load highlights
        </p>
      </div>
    );
  }

  // Hide if not owner and no highlights
  if (!isOwner && highlights.length === 0) {
    return null;
  }

  // Empty state for owner
  if (isOwner && highlights.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-6 border border-gray-100 dark:border-slate-800">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
            <Plus className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              No Highlights Yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Create your first highlight to showcase your best stories
            </p>
            <Link
              href="/highlights/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Highlight
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-white/40 dark:bg-slate-950/40 backdrop-blur-2xl rounded-3xl p-6 border border-white/60 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden">
      {/* Subtle animated gradient mesh */}
      <div className="absolute inset-0 opacity-30 dark:opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-300/30 dark:bg-orange-500/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-300/30 dark:bg-rose-500/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-amber-300/30 dark:bg-amber-500/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-gray-700/90 dark:text-white/90 tracking-[0.2em] uppercase">
            Highlights
          </h2>
        </div>

        <div className="relative -mx-3 px-3">
          {/* Fade edges */}

          <div className="flex gap-7 overflow-x-auto pb-4 scrollbar-none px-3">
            {/* Add New Highlight Button */}
            {isOwner && (
              <Link
                href="/highlights/create"
                className="flex flex-col items-center gap-3 min-w-[90px] flex-shrink-0 group cursor-pointer"
                aria-label="Create new highlight"
              >
                <div className="relative">
                  {/* Frosted glass container */}
                  <div className="relative w-20 h-20 rounded-full bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/80 dark:border-white/20 flex items-center justify-center shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] group-hover:bg-white/80 dark:group-hover:bg-white/10 group-hover:border-orange-400/60 dark:group-hover:border-orange-400/40 group-hover:shadow-[0_8px_32px_0_rgba(251,146,60,0.3)] transition-all duration-500 group-hover:scale-105">
                    <Plus className="w-8 h-8 text-gray-400/80 dark:text-white/60 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-all duration-300 group-hover:rotate-90" />
                  </div>
                </div>
                <span className="text-xs text-gray-600/90 dark:text-white/70 text-center font-semibold tracking-wide group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors duration-300">
                  New
                </span>
              </Link>
            )}

            {/* Highlight Items */}
            {highlights.map((highlight, index) => (
              <Link
                key={highlight.id}
                href={`/highlights/${highlight.id}`}
                className="flex flex-col items-center gap-3 min-w-[90px] flex-shrink-0 group cursor-pointer"
                aria-label={`View ${highlight.title} highlight`}
              >
                <div className="relative">
                  {/* Frosted glass ring */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400/0 via-rose-400/0 to-amber-400/0 group-hover:from-orange-400/40 group-hover:via-rose-400/40 group-hover:to-amber-400/40 dark:group-hover:from-orange-500/30 dark:group-hover:via-rose-500/30 dark:group-hover:to-amber-500/30 blur-xl transition-all duration-700" />

                  <div className="relative w-20 h-20 rounded-full p-[3px] bg-gradient-to-br from-white/70 via-white/50 to-white/70 dark:from-white/20 dark:via-white/10 dark:to-white/20 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] group-hover:from-orange-400/70 group-hover:via-rose-400/70 group-hover:to-amber-400/70 dark:group-hover:from-orange-500/40 dark:group-hover:via-rose-500/40 dark:group-hover:to-amber-500/40 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-gray-100/90 to-gray-200/90 dark:from-slate-800/90 dark:to-slate-700/90 backdrop-blur-sm">
                      <Image
                        src={highlight.coverUrl || "/noAvatar.png"}
                        alt={`${highlight.title} highlight cover`}
                        width={80}
                        height={80}
                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700"
                        loading="lazy"
                      />
                      {/* Glossy overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                  </div>

                  {/* Story count badge - ultra glassy */}
                  {highlight._count.stories > 0 && (
                    <div className="absolute -bottom-1.5 -right-1.5 min-w-[26px] h-[26px] px-1.5 bg-white/80 dark:bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border-2 border-white/90 dark:border-white/30 shadow-[0_4px_16px_0_rgba(0,0,0,0.12)] dark:shadow-[0_4px_16px_0_rgba(0,0,0,0.4)] group-hover:scale-110 transition-all duration-300">
                      <span className="text-[11px] font-black bg-gradient-to-br from-orange-500 to-rose-500 dark:from-orange-400 dark:to-rose-400 bg-clip-text text-transparent">
                        {highlight._count.stories > 9
                          ? "9+"
                          : highlight._count.stories}
                      </span>
                    </div>
                  )}
                </div>

                <span className="text-xs text-gray-700/90 dark:text-white/80 text-center font-semibold max-w-[90px] truncate tracking-wide group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors duration-300">
                  {highlight.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ProfileHighlights;
