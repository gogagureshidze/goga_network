"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import {
  Archive,
  Eye,
  Heart,
  MessageSquare,
  Trash2,
  RotateCcw,
  Loader2,
  X,
} from "lucide-react";
import {
  getArchivedStories,
  repostArchivedStory,
  deleteArchivedStory,
} from "../../actions/storySettingsActions";
import { useRouter } from "next/navigation";

type ArchivedStoryType = {
  id: number;
  img: string;
  createdAt: Date;
  archivedAt: Date;
  showLikes: boolean;
  likesCount: number;
  viewsCount: number;
  commentsCount: number;
  likes: {
    id: number;
    userId: string;
    username: string | null;
    userAvatar: string | null;
    createdAt: Date;
  }[];
  views: {
    id: number;
    userId: string;
    username: string | null;
    userAvatar: string | null;
    createdAt: Date;
  }[];
  comments: {
    id: number;
    desc: string;
    userId: string;
    username: string | null;
    userAvatar: string | null;
    createdAt: Date;
    likesCount: number;
  }[];
};

const isVideo = (url: string) => {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
  return videoExtensions.some((ext) => url.toLowerCase().includes(ext));
};

export default function StoryArchivePage() {
  const [archivedStories, setArchivedStories] = useState<ArchivedStoryType[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<ArchivedStoryType | null>(
    null
  );
  const [showActivity, setShowActivity] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"views" | "likes" | "comments">(
    "views"
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRepostConfirm, setShowRepostConfirm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadArchivedStories();
  }, []);

  const loadArchivedStories = async () => {
    try {
      setIsLoading(true);
      const stories = await getArchivedStories();
      setArchivedStories(stories as any);
    } catch (error) {
      console.error("Failed to load archived stories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepost = async (storyId: number) => {
    startTransition(async () => {
      try {
        await repostArchivedStory(storyId);
        setShowRepostConfirm(false);
        setSelectedStory(null);
        await loadArchivedStories();
      } catch (error) {
        console.error("Failed to repost story:", error);
        alert("Failed to repost story. Please try again.");
      }
    });
  };

  const handleDelete = async (storyId: number) => {
    startTransition(async () => {
      try {
        await deleteArchivedStory(storyId);
        setShowDeleteConfirm(false);
        setSelectedStory(null);
        await loadArchivedStories();
      } catch (error) {
        console.error("Failed to delete story:", error);
        alert("Failed to delete story. Please try again.");
      }
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-rose-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-orange-500" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading archived stories...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rose-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 flex items-center gap-2"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Archive
              className="text-orange-500 dark:text-orange-400"
              size={32}
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-800 to-orange-400 dark:from-white dark:to-white bg-clip-text text-transparent">
              Story Archive
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            View your archived stories. Stories are automatically archived after
            24 hours.
          </p>
        </div>

        {/* Empty State */}
        {archivedStories.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
            <Archive
              className="mx-auto mb-4 text-gray-400 dark:text-gray-500"
              size={64}
            />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Archived Stories
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your stories will appear here after they expire or when you
              archive them manually.
            </p>
          </div>
        )}

        {/* Archive Grid */}
        {archivedStories.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {archivedStories.map((story) => (
              <div
                key={story.id}
                className="group relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer bg-gray-100 dark:bg-gray-800 border-2 border-transparent hover:border-orange-500 dark:hover:border-orange-400 transition-all"
                onClick={() => {
                  setSelectedStory(story);
                  setShowActivity(false);
                }}
              >
                {isVideo(story.img) ? (
                  <video
                    src={story.img}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <Image
                    src={story.img}
                    alt="Archived story"
                    fill
                    className="object-cover"
                  />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <p className="text-xs font-medium mb-2">
                      Archived {formatDate(story.archivedAt)}
                    </p>
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Eye size={14} />
                        {story.viewsCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={14} />
                        {story.likesCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} />
                        {story.commentsCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Video indicator */}
                {isVideo(story.img) && (
                  <div className="absolute top-2 right-2 bg-black bg-opacity-70 rounded-full p-1.5">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Story Detail Modal */}
        {selectedStory && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
            onClick={() => {
              setSelectedStory(null);
              setShowActivity(false);
            }}
          >
            <div
              className="relative max-w-4xl w-full max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl overflow-hidden flex flex-col md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Story Preview */}
              <div className="relative flex-1 bg-black flex items-center justify-center">
                {isVideo(selectedStory.img) ? (
                  <video
                    src={selectedStory.img}
                    controls
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <Image
                    src={selectedStory.img}
                    alt="Archived story"
                    width={400}
                    height={711}
                    className="max-w-full max-h-full object-contain"
                  />
                )}

                {/* Close button */}
                <button
                  onClick={() => {
                    setSelectedStory(null);
                    setShowActivity(false);
                  }}
                  className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Actions & Info Panel */}
              <div className="w-full md:w-80 flex flex-col bg-white dark:bg-gray-800">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Posted {formatDate(selectedStory.createdAt)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Archived {formatDate(selectedStory.archivedAt)}
                  </p>
                </div>

                {/* Stats */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedStory.viewsCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Views
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedStory.likesCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Likes
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedStory.commentsCount}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Comments
                      </p>
                    </div>
                  </div>
                </div>

                {/* Toggle Activity */}
                <button
                  onClick={() => setShowActivity(!showActivity)}
                  className="p-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {showActivity ? "Hide Activity" : "View Activity"}
                  </span>
                  <Eye className="text-gray-400 dark:text-gray-500" size={20} />
                </button>

                {/* Activity Details */}
                {showActivity && (
                  <div className="flex-1 overflow-y-auto">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setActiveTab("views")}
                        className={`flex-1 p-3 text-sm font-medium transition-colors ${
                          activeTab === "views"
                            ? "text-orange-500 border-b-2 border-orange-500"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        }`}
                      >
                        Views ({selectedStory.views.length})
                      </button>
                      <button
                        onClick={() => setActiveTab("likes")}
                        className={`flex-1 p-3 text-sm font-medium transition-colors ${
                          activeTab === "likes"
                            ? "text-orange-500 border-b-2 border-orange-500"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        }`}
                      >
                        Likes ({selectedStory.likes.length})
                      </button>
                      <button
                        onClick={() => setActiveTab("comments")}
                        className={`flex-1 p-3 text-sm font-medium transition-colors ${
                          activeTab === "comments"
                            ? "text-orange-500 border-b-2 border-orange-500"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        }`}
                      >
                        Comments ({selectedStory.comments.length})
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-4 space-y-3">
                      {activeTab === "views" &&
                        selectedStory.views.map((view) => (
                          <div
                            key={view.id}
                            className="flex items-center gap-3"
                          >
                            <Image
                              src={view.userAvatar || "/noAvatar.png"}
                              alt={view.username || "User"}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900 dark:text-white">
                                {view.username || "Anonymous"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(view.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}

                      {activeTab === "likes" &&
                        selectedStory.likes.map((like) => (
                          <div
                            key={like.id}
                            className="flex items-center gap-3"
                          >
                            <Image
                              src={like.userAvatar || "/noAvatar.png"}
                              alt={like.username || "User"}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900 dark:text-white">
                                {like.username || "Anonymous"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(like.createdAt)}
                              </p>
                            </div>
                            <Heart
                              size={16}
                              className="text-red-500 fill-red-500"
                            />
                          </div>
                        ))}

                      {activeTab === "comments" &&
                        selectedStory.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="flex items-start gap-3"
                          >
                            <Image
                              src={comment.userAvatar || "/noAvatar.png"}
                              alt={comment.username || "User"}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900 dark:text-white">
                                {comment.username || "Anonymous"}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                {comment.desc}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatDate(comment.createdAt)}
                                </p>
                                {comment.likesCount > 0 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    · {comment.likesCount}{" "}
                                    {comment.likesCount === 1
                                      ? "like"
                                      : "likes"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <button
                    onClick={() => setShowRepostConfirm(true)}
                    className="w-full p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={18} />
                    Repost to Stories
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} />
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Repost Confirmation */}
        {showRepostConfirm && selectedStory && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4"
            onClick={() => setShowRepostConfirm(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg text-orange-600 dark:text-orange-400 font-semibold mb-4">
                Repost Story?
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                This story will be posted again and visible for 24 hours.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRepostConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRepost(selectedStory.id)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-md font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Reposting...
                    </>
                  ) : (
                    "Repost"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && selectedStory && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg text-red-500 font-semibold mb-4">
                Delete Story Forever?
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                This action cannot be undone. The story and all its activity
                will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(selectedStory.id)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
