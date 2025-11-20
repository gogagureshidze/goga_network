"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Heart, X } from "lucide-react";
import { postActivity } from "../actions/postActivity";
import Link from "next/link";
import ModalPortal from "./ModalPortalWrapper";

type ActivityUser = {
  id: string;
  username: string | null;
  name: string | null;
  surname: string | null;
  avatar: string | null;
};

type PostActivity = {
  likes: Array<{
    id: number;
    createdAt: Date;
    user: ActivityUser;
  }>;
  isOwner: boolean;
};

interface PostActivityModalProps {
  postId: number;
  onClose: () => void;
}

export default function PostActivityModal({
  postId,
  onClose,
}: PostActivityModalProps) {
  const [activity, setActivity] = useState<PostActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await postActivity(postId);
        setActivity(data);
      } catch (err) {
        console.error("Failed to fetch post activity:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load activity"
        );
      } finally {
        setLoading(false);
      }
    };

    if (postId) {
      fetchActivity();
    }
  }, [postId]);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffInMs = now.getTime() - d.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays === 1) return `Yesterday`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return d.toLocaleDateString();
  };

  const modalContent = (
    <>
      {/* Loading State */}
      {loading && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70"
          onClick={onClose}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70"
          onClick={onClose}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Error
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 p-4 transition-opacity duration-300"
          onClick={onClose}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[70vh] flex flex-col shadow-xl transition-colors duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Likes ({activity?.likes.length || 0})
              </h3>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {!activity?.likes || activity.likes.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No likes yet
                  </p>
                ) : (
                  activity.likes.map((like) => (
                    <Link
                      key={like.id}
                      href={`/profile/${like.user.username}`}
                      onClick={onClose}
                      className="block p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Image
                          src={like.user.avatar || "/noAvatar.png"}
                          alt={like.user.username || "User"}
                          width={40}
                          height={40}
                          className="rounded-full object-cover w-10 h-10 ring-2 ring-orange-200 dark:ring-gray-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {like.user.name && like.user.surname
                              ? `${like.user.name} ${like.user.surname}`
                              : like.user.username || "Unknown User"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(like.createdAt)}
                          </p>
                        </div>
                        <Heart
                          size={16}
                          className="text-red-500 fill-red-500 flex-shrink-0"
                        />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return <ModalPortal>{modalContent}</ModalPortal>;
}
