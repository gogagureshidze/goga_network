"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { fetchSinglePost } from "@/actions/loadActions";
import Post from "./Post";

interface PostModalProps {
  postId: number;
  onClose: () => void;
}

export default function PostModal({ postId, onClose }: PostModalProps) {
  const [mounted, setMounted] = useState(false);
  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Fetch fresh post data every time modal opens
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSinglePost(postId);
      if (!data) setError("Post not found or has been deleted.");
      else setPost(data);
    } catch {
      setError("Failed to load post. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const noopId = useCallback((_id: number) => {}, []);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-xl max-h-[90dvh] flex flex-col rounded-2xl shadow-2xl bg-white dark:bg-gray-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
            Post
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="text-orange-500 animate-spin" />
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <X size={24} className="text-red-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {error}
              </p>
              <button
                onClick={load}
                className="text-sm text-orange-500 hover:text-orange-600 font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {post && !isLoading && (
            <div className="[&>div]:shadow-none [&>div]:border-0 [&>div]:rounded-none [&>div]:mb-0">
              <Post
                post={post}
                isCommentsOpen={false}
                toggleComments={noopId}
                removePost={noopId}
                onPollVoteSuccess={noopId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
