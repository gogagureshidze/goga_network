"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Search, UserX, Lock } from "lucide-react";
import {
  getFollowList,
  type FollowListUser,
} from "../actions/followListActions";

type FollowListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: "followers" | "followings";
  userId: string;
  username: string;
  isPrivate: boolean;
  isOwner: boolean;
  isFollowing: boolean;
  count: number;
};

export default function FollowListModal({
  isOpen,
  onClose,
  type,
  userId,
  username,
  isPrivate,
  isOwner,
  isFollowing,
  count,
}: FollowListModalProps) {
  const [users, setUsers] = useState<FollowListUser[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isPrivateBlocked, setIsPrivateBlocked] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Refs to avoid stale closures and race conditions
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSearch = useRef(""); // always holds latest search value
  const isFirstOpen = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Core fetch — always uses ref for search to avoid stale closure
  const fetchPage = useCallback(
    (pageNum: number, searchVal: string, reset: boolean) => {
      startTransition(async () => {
        const result = await getFollowList(userId, type, pageNum, searchVal);
        if (result.blocked) {
          setIsPrivateBlocked(true);
          setUsers([]);
          setHasMore(false);
          return;
        }
        setIsPrivateBlocked(false);
        setUsers((prev) => (reset ? result.users : [...prev, ...result.users]));
        setHasMore(result.hasMore);
        setPage(pageNum);
        // Scroll to top on fresh search/open
        if (reset && listRef.current) listRef.current.scrollTop = 0;
      });
    },
    [userId, type],
  );

  // Open / type-tab change → reset everything and fetch fresh
  useEffect(() => {
    if (!isOpen) return;
    currentSearch.current = "";
    setSearch("");
    setUsers([]);
    setPage(1);
    setHasMore(false);
    setIsPrivateBlocked(false);
    isFirstOpen.current = false;
    fetchPage(1, "", true);
  }, [isOpen, type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search input change → debounce then fetch
  // NOTE: we track search in a ref so fetchPage never has a stale value
  useEffect(() => {
    currentSearch.current = search;
    // Skip if modal isn't open yet
    if (!isOpen) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setUsers([]);
      setPage(1);
      fetchPage(1, search, true);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll — detects when user scrolls near bottom of list
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (isPending || !hasMore) return;
      // Trigger when within 80px of bottom
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
        fetchPage(page + 1, currentSearch.current, false);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, isPending, page, fetchPage]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!isOpen) return null;

  const title = type === "followers" ? "Followers" : "Following";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Panel */}
      <div
        className="relative w-full max-w-sm bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          maxHeight: "75vh",
          animation: "followModalIn 0.22s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-zinc-900 dark:text-white tracking-tight">
              {title}
            </h2>
            <span className="text-[11px] font-semibold bg-orange-500 text-white px-2 py-0.5 rounded-full tabular-nums">
              {count}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Close"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-5 shrink-0" />

        {/* Search */}
        

        {/* Scrollable list */}
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 px-3 pb-3">
          {/* Private blocked */}
          {isPrivateBlocked ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Lock size={24} className="text-zinc-400" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                  This account is private
                </p>
                <p className="text-xs text-zinc-400 max-w-[200px] leading-relaxed">
                  Follow{" "}
                  <span className="text-orange-500 font-semibold">
                    @{username}
                  </span>{" "}
                  to see who they follow
                </p>
              </div>
            </div>
          ) : /* Initial skeleton */
          isPending && users.length === 0 ? (
            <ul className="flex flex-col gap-0.5 pt-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-2 py-2.5 animate-pulse"
                >
                  <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full w-28" />
                    <div className="h-2.5 bg-zinc-100 dark:bg-zinc-700 rounded-full w-20" />
                  </div>
                </li>
              ))}
            </ul>
          ) : /* Empty */
          users.length === 0 && !isPending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <UserX size={24} className="text-zinc-400" />
              </div>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                {search
                  ? `No results for "${search}"`
                  : `No ${title.toLowerCase()} yet`}
              </p>
            </div>
          ) : (
            /* User list */
            <>
              <ul className="flex flex-col gap-0.5 pt-1">
                {users.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/profile/${u.username}`}
                      onClick={onClose}
                      className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors group"
                    >
                      <div className="w-11 h-11 rounded-full shrink-0 overflow-hidden ring-2 ring-zinc-200 dark:ring-zinc-700 group-hover:ring-orange-400 transition-all">
                        <Image
                          src={u.avatar || "/noAvatar.png"}
                          alt={u.username ?? ""}
                          width={44}
                          height={44}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate group-hover:text-orange-500 transition-colors leading-snug">
                          {u.name && u.surname
                            ? `${u.name} ${u.surname}`
                            : u.username}
                        </p>
                        {u.username && (
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                            @{u.username}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Infinite scroll loading indicator */}
              {isPending && users.length > 0 && (
                <div className="flex justify-center py-4">
                  <span className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* End of list indicator */}
              {!hasMore && users.length > 0 && (
                <p className="text-center text-[11px] text-zinc-300 dark:text-zinc-700 py-4">
                  {users.length === count
                    ? `All ${count} loaded`
                    : `${users.length} of ${count}`}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes followModalIn {
          from {
            opacity: 0;
            transform: scale(0.94) translateY(12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
