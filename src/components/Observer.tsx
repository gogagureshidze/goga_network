"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInView } from "react-intersection-observer";
import Post from "./Post";
import { fetchPosts } from "../actions/loadActions";
import OnlineUsers from "./OnlineUsers";
import WeatherToggleWrapper from "./WeatherToggleWrapper";

const Spinner = () => (
  <svg
    className="w-6 h-6 text-gray-400 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

type PostType = { id: number } & any;
const POSTS_PER_PAGE = 10;
const ESTIMATED_POST_HEIGHT = 750;
const ESTIMATED_WIDGET_HEIGHT = 200;

interface PostListProps {
  initialPosts: PostType[];
  username?: string;
  hasMorePosts: boolean;
  userName?: string;
  showOnMobile?: boolean;
}

export default function PostList({
  initialPosts,
  username,
  hasMorePosts: initialHasMore,
  userName,
  showOnMobile = false,
}: PostListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(2);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [hiddenPosts, setHiddenPosts] = useState<Set<number>>(new Set());

  const loadingLock = useRef(false);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  );

  const parentRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) setScrollElement(node);
  }, []);

  const { ref: loaderRef, inView } = useInView({
    threshold: 0,
    rootMargin: "500px",
  });

  const loadMorePosts = useCallback(async () => {
    if (loadingLock.current || !hasMore) return;
    loadingLock.current = true;
    setIsLoading(true);

    try {
      const newPosts = await fetchPosts({ page, username });
      if (newPosts.length > 0) {
        setPosts((prevPosts) => [...prevPosts, ...newPosts]);
        setPage((prevPage) => prevPage + 1);
      }
      if (newPosts.length < POSTS_PER_PAGE) setHasMore(false);
    } catch (error) {
      console.error("Failed to load more posts:", error);
    } finally {
      loadingLock.current = false;
      setIsLoading(false);
    }
  }, [page, username, hasMore]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) loadMorePosts();
  }, [inView, hasMore, isLoading, loadMorePosts]);

  const toggleComments = useCallback((postId: number) => {
    setOpenComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) newSet.delete(postId);
      else newSet.add(postId);
      return newSet;
    });
  }, []);

  const widgetCount = showOnMobile ? 2 : 1;
  const totalItems = widgetCount + posts.length + (hasMore ? 1 : 0);

  const rowVirtualizer = useVirtualizer({
    count: totalItems,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      if (index < widgetCount) return ESTIMATED_WIDGET_HEIGHT;
      if (index === totalItems - 1 && hasMore) return 100;
      return ESTIMATED_POST_HEIGHT;
    },
    overscan: 5,
  });

  const removePost = useCallback((postId: number) => {
    // Just hide it visually, keep it in the array
    setHiddenPosts((prev) => new Set(prev).add(postId));
  }, []);

  if (posts.length === 0 && !hasMore) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No posts yet.</p>
      </div>
    );
  }

  if (!scrollElement) {
    return (
      <div
        ref={parentRefCallback}
        className="w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
        style={{ height: "calc(100vh - 200px)", overflowY: "auto" }}
      >
        <div className="h-20 w-full flex justify-center items-center">
          <Spinner />
        </div>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRefCallback}
      className="w-full rounded-lg bg-rose-50 dark:bg-gray-900"
      style={{ height: "calc(100vh - 200px)", overflowY: "auto" }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const index = virtualItem.index;

          if (showOnMobile && index === 0) {
            return (
              <div
                key="online-users"
                ref={rowVirtualizer.measureElement}
                data-index={index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                  paddingBottom: "16px",
                }}
              >
                <OnlineUsers />
              </div>
            );
          }

          if (index === (showOnMobile ? 1 : 0)) {
            return (
              <div
                key="weather-toggle"
                ref={rowVirtualizer.measureElement}
                data-index={index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                  paddingBottom: "16px",
                }}
              >
                <WeatherToggleWrapper userName={userName} />
              </div>
            );
          }

          const isLoaderRow = index === totalItems - 1 && hasMore;

          if (isLoaderRow) {
            return (
              <div
                key="loader"
                ref={loaderRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `100px`,
                  transform: `translateY(${virtualItem.start}px)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Spinner />
              </div>
            );
          }

          const postIndex = index - widgetCount;
          const post = posts[postIndex];
          if (!post) return null;

          const isHidden = hiddenPosts.has(post.id);

          return (
            <div
              key={post.id}
              ref={rowVirtualizer.measureElement}
              data-index={index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                paddingBottom: "16px",
                opacity: isHidden ? 0 : 1,
                transform: isHidden
                  ? `translateY(${virtualItem.start}px) scale(0.95)`
                  : `translateY(${virtualItem.start}px) scale(1)`,
                transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
                pointerEvents: isHidden ? "none" : "auto",
              }}
            >
              <Post
                post={post}
                isCommentsOpen={openComments.has(post.id)}
                toggleComments={toggleComments}
                removePost={removePost}
              />
            </div>
          );
        })}

        {!isLoading && !hasMore && (
          <div
            className="text-center py-12"
            style={{
              position: "absolute",
              top: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              paddingTop: "40px",
              paddingBottom: "40px",
            }}
          >
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-rose-100 to-pink-100 dark:from-rose-950 dark:to-pink-950 border border-rose-200 dark:border-rose-800">
              <span className="text-2xl">✨</span>
              <p className="text-rose-600 dark:text-rose-400 font-medium">
                That's all, folks!
              </p>
              <span className="text-2xl">✨</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
