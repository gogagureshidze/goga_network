"use client";

import { useState, useEffect, useRef, useCallback, createContext } from "react";
import Post from "./Post";
import { fetchPosts } from "../actions/loadActions";

// Context to pass comment toggle state down to Post components
export const CommentContext = createContext<{
  openComments: Set<number>;
  toggleComments: (postId: number) => void;
}>({
  openComments: new Set(),
  toggleComments: () => {},
});

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

type PostType = any;

interface PostListProps {
  initialPosts: PostType[];
  username?: string;
  hasMorePosts: boolean;
}

const POSTS_PER_PAGE = 10;

export default function PostList({
  initialPosts,
  username,
  hasMorePosts: initialHasMore,
}: PostListProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(2);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());

  const toggleComments = useCallback((postId: number) => {
    setOpenComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  }, []);

  const loaderRef = useRef<HTMLDivElement>(null);
  const loadingLock = useRef(false);

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

      if (newPosts.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load more posts:", error);
    } finally {
      loadingLock.current = false;
      setIsLoading(false);
    }
  }, [page, username, hasMore]);

  useEffect(() => {
    const loaderObserver = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loadingLock.current) {
          loadMorePosts();
        }
      },
      { rootMargin: "500px" }
    );

    const loader = loaderRef.current;
    if (loader) {
      loaderObserver.observe(loader);
    }

    return () => {
      if (loader) {
        loaderObserver.unobserve(loader);
      }
    };
  }, [hasMore, loadMorePosts]);

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No posts yet.</p>
        {!username && (
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            Follow some users to see their posts!
          </p>
        )}
      </div>
    );
  }

  return (
    <CommentContext.Provider value={{ openComments, toggleComments }}>
      <div className="space-y-4">
        {posts.map((post) => (
          <Post key={post.id} post={post} />
        ))}
      </div>

      <div
        ref={loaderRef}
        className="h-10 w-full flex justify-center items-center"
      >
        {isLoading && <Spinner />}
      </div>

      {!hasMore && !isLoading && (
        <div className="text-center py-4">
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            ~ You've reached the end ~
          </p>
        </div>
      )}
    </CommentContext.Provider>
  );
}
