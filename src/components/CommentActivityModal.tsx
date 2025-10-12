"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Heart, X } from "lucide-react";
import { commentActivity } from "../actions/commentActivity";
import Link from "next/link";

type ActivityUser = {
  id: string;
  username: string | null;
  name: string | null;
  surname: string | null;
  avatar: string | null;
};

type CommentActivity = {
  likes: Array<{
    id: number;
    createdAt: Date;
    user: ActivityUser;
  }>;
  isOwner: boolean;
};

interface CommentActivityModalProps {
  commentId: number;
  onClose: () => void;
}

export default function CommentActivityModal({
  commentId,
  onClose,
}: CommentActivityModalProps) {
  const [activity, setActivity] = useState<CommentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await commentActivity(commentId);
        setActivity(data);
      } catch (err) {
        console.error("Failed to fetch comment activity:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load activity"
        );
      } finally {
        setLoading(false);
      }
    };

    if (commentId) {
      fetchActivity();
    }
  }, [commentId]);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(
        (now.getTime() - d.getTime()) / (1000 * 60)
      );
      return diffInMinutes < 1 ? "Just now" : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return d.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        onClick={onClose}
      >
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        onClick={onClose}
      >
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full max-h-96 flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Likes ({activity?.likes.length || 0})
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {!activity?.likes || activity.likes.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No likes yet</p>
            ) : (
              activity.likes.map((like) => (
                <Link
                  key={like.id}
                  href={`/profile/${like.user.username}`}
                  onClick={onClose}
                >
                  <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                    <Image
                      src={like.user.avatar || "/noAvatar.png"}
                      alt={like.user.username || "User"}
                      width={40}
                      height={40}
                      className="rounded-full object-cover w-10 h-10 ring-2 ring-orange-200"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">
                        {like.user.name && like.user.surname
                          ? `${like.user.name} ${like.user.surname}`
                          : like.user.username || "Unknown User"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(like.createdAt)}
                      </p>
                    </div>
                    <Heart size={16} className="text-red-500 fill-red-500" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
