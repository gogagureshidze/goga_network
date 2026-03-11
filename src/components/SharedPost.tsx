"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MessageSquare,
  Calendar,
  MapPin,
  BarChart3,
  ExternalLink,
} from "lucide-react";

interface SharedPostProps {
  postData: {
    id: number;
    desc: string;
    createdAt: string;
    user: {
      id: string;
      username: string;
      avatar: string;
    };
    media?: Array<{ url: string; type: string }>;
    event?: {
      date: string;
      location?: string | null;
    } | null;
    poll?: {
      options: Array<{
        id: number;
        text: string;
        votesCount: number;
      }>;
    } | null;
    _count: {
      likes: number;
      comments: number;
    };
  };
  isOwn: boolean;
}

export default function SharedPost({ postData, isOwn }: SharedPostProps) {
  const hasMedia = postData.media && postData.media.length > 0;
  const isEvent = !!postData.event;
  const isPoll = !!postData.poll;

  // Helper for Event Date
  const eventDate = postData.event ? new Date(postData.event.date) : null;
  const eventMonth = eventDate
    ? eventDate.toLocaleString("default", { month: "short" })
    : "";
  const eventDay = eventDate ? eventDate.getDate() : "";

  return (
    <div
      className={`
        w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 backdrop-blur-xl
        ${
          isOwn
            ? "bg-white/80 dark:bg-slate-800/80 border border-rose-200/50 dark:border-slate-700/50"
            : "bg-white/80 dark:bg-slate-800/80 border border-gray-200/50 dark:border-slate-700/50"
        }
      `}
    >
      {/* Shared Post Header */}
      <div className="px-3 py-2.5 bg-gray-50/50 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-700/50 backdrop-blur-md">
        <Link
          href={`/profile/${postData.user.username}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={postData.user.avatar || "/noAvatar.png"}
            alt={postData.user.username}
            width={28}
            height={28}
            className="rounded-full object-cover ring-1 ring-white/50 dark:ring-slate-700"
          />
          <div className="flex flex-col">
            <p className="font-semibold text-[13px] leading-tight text-gray-900 dark:text-white">
              {postData.user.username}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
              {new Date(postData.createdAt).toLocaleDateString()}
            </p>
          </div>
        </Link>
      </div>

      {/* Post Content */}
      <div className="p-3">
        {/* Description */}
        {postData.desc && (
          <p className="text-[13px] text-gray-800 dark:text-gray-200 mb-3 line-clamp-2 leading-relaxed">
            {postData.desc}
          </p>
        )}

        {/* Media Grid */}
        {hasMedia && (
          <div
            className={`
              grid gap-1.5 rounded-xl overflow-hidden mb-3
              ${postData.media!.length === 1 ? "grid-cols-1" : "grid-cols-2"}
            `}
          >
            {postData.media!.slice(0, 4).map((item, index) => {
              const isVideo =
                item.type.toLowerCase().includes("video") ||
                item.url.match(/\.(mp4|webm|ogg|mov)$/i);
              const isImage = !isVideo;

              return (
                <div
                  key={index}
                  className="relative aspect-square bg-gray-100 dark:bg-slate-800"
                >
                  {isImage ? (
                    <Image
                      src={item.url}
                      alt="Post media"
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        e.currentTarget.src = "/noAvatar.png";
                      }}
                    />
                  ) : (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                      controls
                      preload="metadata"
                    />
                  )}
                  {postData.media!.length > 4 && index === 3 && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-white text-xl font-bold">
                        +{postData.media!.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ✨ GLASSY EVENT */}
        {isEvent && postData.event && (
          <div className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-white/10 bg-gradient-to-br from-blue-500/5 to-cyan-500/10 dark:from-blue-500/10 dark:to-cyan-500/5 backdrop-blur-2xl p-3 mb-3 shadow-sm group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 dark:bg-blue-400/20 blur-[32px] rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-150"></div>

            <div className="relative z-10 flex items-center gap-4">
              <div className="flex flex-col items-center justify-center min-w-[56px] h-[56px] rounded-xl bg-white/60 dark:bg-slate-900/50 border border-white/50 dark:border-white/5 shadow-inner backdrop-blur-md">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">
                  {eventMonth}
                </span>
                <span className="text-xl font-black text-gray-900 dark:text-white leading-none">
                  {eventDay}
                </span>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
                  <Calendar size={14} className="opacity-80" />
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                    Event
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 line-clamp-1">
                  {new Date(postData.event.date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {postData.event.location && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    <MapPin size={12} className="opacity-70" />
                    <span className="truncate max-w-[140px]">
                      {postData.event.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ✨ GLASSY ORANGE POLL */}
        {isPoll && postData.poll && (
          <div className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-white/10 bg-gradient-to-br from-orange-500/5 to-rose-500/10 dark:from-orange-500/10 dark:to-rose-500/5 backdrop-blur-2xl p-4 mb-3 shadow-sm group">
            {/* Ambient Glowing Orbs - Switched to Orange/Rose */}
            <div className="absolute -top-12 -right-4 w-32 h-32 bg-orange-500/20 dark:bg-orange-500/30 blur-[32px] rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-150"></div>
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-rose-400/20 dark:bg-rose-500/20 blur-[32px] rounded-full pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                  <BarChart3 size={16} className="opacity-80" />
                  <span className="text-[11px] font-bold tracking-widest uppercase opacity-90">
                    Poll
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-white/50 dark:bg-slate-900/50 border border-white/30 dark:border-white/10 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-md backdrop-blur-md shadow-inner">
                  {postData.poll.options.length} Options
                </span>
              </div>

              <div className="space-y-2">
                {postData.poll.options.slice(0, 2).map((option) => (
                  <div
                    key={option.id}
                    className="relative overflow-hidden rounded-xl border border-white/50 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-2.5 flex justify-between items-center shadow-sm"
                  >
                    <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200 z-10 truncate pr-2">
                      {option.text}
                    </span>
                    <div className="flex items-center gap-2 z-10 shrink-0">
                      <span className="text-[11px] font-bold text-orange-700 dark:text-orange-300 bg-white/60 dark:bg-slate-800/60 border border-white/30 dark:border-white/5 px-2 py-1 rounded-md shadow-inner">
                        {option.votesCount || 0}
                      </span>
                    </div>
                  </div>
                ))}
                {postData.poll.options.length > 2 && (
                  <p className="text-[11px] font-semibold text-center text-orange-600/70 dark:text-orange-400/70 mt-3 tracking-wide">
                    +{postData.poll.options.length - 2} MORE OPTIONS
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Heart size={14} className="opacity-80" />
              <span className="text-[11px] font-medium">
                {postData._count.likes}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <MessageSquare size={14} className="opacity-80" />
              <span className="text-[11px] font-medium">
                {postData._count.comments}
              </span>
            </div>
          </div>
        </div>

        {/* ✨ NEW GLASSY BUTTON */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/50">
          <Link
            href={`/post/${postData.id}`} // Ensure this points to your actual post route
            onClick={(e) => e.stopPropagation()}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-orange-500/10 to-rose-500/10 dark:from-orange-500/20 dark:to-rose-500/20 px-4 py-2 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(249,115,22,0.15)] border border-orange-500/20 dark:border-orange-400/20"
          >
            {/* Button Hover Glow */}
            <div className="absolute inset-0 bg-white/20 dark:bg-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

            <span className="relative z-10 text-[12px] font-bold text-orange-600 dark:text-orange-400 tracking-wide uppercase">
              View Post
            </span>
            <ExternalLink
              size={14}
              className="relative z-10 text-orange-600 dark:text-orange-400"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
