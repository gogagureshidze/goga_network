"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Eye, Heart, X } from "lucide-react";
import { getStoryActivity } from "../actions/StoryActions";
import Link from "next/link";

type ActivityUser = {
  id: string;
  username: string | null;
  name: string | null;
  surname: string | null;
  avatar: string | null;
};

type StoryActivity = {
  views: Array<{
    id: number;
    createdAt: Date;
    user: ActivityUser;
  }>;
  likes: Array<{
    id: number;
    createdAt: Date;
    user: ActivityUser;
  }>;
};

interface StoryActivityModalProps {
  storyId: number;
  onClose: () => void;
}

export default function StoryActivityModal({
  storyId,
  onClose,
}: StoryActivityModalProps) {
  const [activity, setActivity] = useState<StoryActivity | null>(null);
  const [activeTab, setActiveTab] = useState<"views" | "likes">("views");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log("Fetching activity for story ID:", storyId);

        const data = await getStoryActivity(storyId);
        console.log("Fetched activity data:", data);

        setActivity(data);
      } catch (err) {
        console.error("Failed to fetch story activity:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load activity"
        );
      } finally {
        setLoading(false);
      }
    };

    if (storyId) {
      fetchActivity();
    }
  }, [storyId]);

  // Format date for display
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
        <div className="bg-gray-900 text-white rounded-lg p-6 max-w-sm w-full mx-4 border border-gray-700">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-700 rounded"></div>
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
        <div className="bg-gray-900 text-white rounded-lg p-6 max-w-sm w-full mx-4 border border-gray-700">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Error</h3>
            <p className="text-gray-300 mb-4">{error}</p>
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
        className="bg-gray-900 text-white rounded-lg max-w-md w-full max-h-96 flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Story Activity</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab("views")}
            className={`flex-1 p-3 text-sm font-medium transition-colors ${
              activeTab === "views"
                ? "text-orange-400 border-b-2 border-orange-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Eye size={16} />
              Views ({activity?.views.length || 0})
            </div>
          </button>
          <button
            onClick={() => setActiveTab("likes")}
            className={`flex-1 p-3 text-sm font-medium transition-colors ${
              activeTab === "likes"
                ? "text-red-500 border-b-2 border-red-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Heart size={16} />
              Likes ({activity?.likes.length || 0})
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "views" && (
            <div className="space-y-3">
              {!activity?.views || activity.views.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No views yet</p>
              ) : (
                activity.views.map((view) => (
                  <>
                    <Link href={`/profile/${view.user.username}`}>
                      <div
                        key={view.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <Image
                          src={view.user.avatar || "/noAvatar.png"}
                          alt={view.user.username || "User"}
                          width={40}
                          height={40}
                          className="rounded-full object-cover  w-12 h-12 border-2 border-orange-400"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-white">
                            {view.user.name && view.user.surname
                              ? `${view.user.name} ${view.user.surname}`
                              : view.user.username || "Unknown User"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(view.createdAt)}
                          </p>
                        </div>
                        <Eye size={16} className="text-gray-500" />
                      </div>
                    </Link>
                  </>
                ))
              )}
            </div>
          )}

          {activeTab === "likes" && (
            <div className="space-y-3">
              {!activity?.likes || activity.likes.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No likes yet</p>
              ) : (
                activity.likes.map((like) => (
                  <>
                    <Link href={`/profile/${like.user.username}`}>
                      <div
                        key={like.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <Image
                          src={like.user.avatar || "/noAvatar.png"}
                          alt={like.user.username || "User"}
                          width={40}
                          height={40}
                          className="rounded-full object-cover w-12 h-12 border-2 border-orange-400"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-white">
                            {like.user.name && like.user.surname
                              ? `${like.user.name} ${like.user.surname}`
                              : like.user.username || "Unknown User"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDate(like.createdAt)}
                          </p>
                        </div>
                        <Heart
                          size={16}
                          className="text-red-500 fill-red-500"
                        />
                      </div>
                    </Link>
                  </>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
