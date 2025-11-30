"use client";

import { addStory } from "@/actions/addStory";
import { likeStory } from "../actions/likeStory";
import { deleteStoryComment } from "../actions/StoryActions";
import {
  addStoryComment,
  likeStoryComment,
  recordStoryView,
  deleteStory,
} from "../actions/StoryActions";
import { Story, User, Like } from "@/generated/prisma";
import { CldUploadWidget } from "next-cloudinary";
import Image from "next/image";
import {
  useOptimistic,
  useState,
  useTransition,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useUser } from "@clerk/nextjs";
import { Heart, MoreVertical, Eye, Trash2, Loader2 } from "lucide-react";
import StoryActivityModal from "./StoryActivityModal";
import Link from "next/link";
import { useUserContext } from "@/contexts/UserContext";

 
type StoryWithUser = Story & {
  user: User;
  likes: Like[];
  comments?: {
    id: number;
    desc: string;
    userId: string;
    user: User;
    likes: { userId: string }[];
  }[];
  showLikes?: boolean;
};

type UserStoryGroup = { user: User; stories: StoryWithUser[] };

type OptimisticAction =
  | { type: "ADD_STORIES"; stories: StoryWithUser[] }
  | { type: "TOGGLE_STORY_LIKE"; storyId: number; isLiking: boolean }
  | {
      type: "TOGGLE_COMMENT_LIKE";
      storyId: number;
      commentId: number;
      isLiking: boolean;
    }
  | {
      type: "ADD_COMMENT";
      storyId: number;
      comment: NonNullable<StoryWithUser["comments"]>[number];
    }
  | {
      type: "REPLACE_COMMENT";
      storyId: number;
      tempId: number;
      comment: NonNullable<StoryWithUser["comments"]>[number];
    }
  | { type: "DELETE_COMMENT"; storyId: number; commentId: number }
  | { type: "DELETE_STORY"; storyId: number };

// Debounce utility
// function useDebounce<T extends (...args: any[]) => any>(
//   callback: T,
//   delay: number
// ): (...args: Parameters<T>) => void {
//   const timeoutRef = useRef<NodeJS.Timeout | null>(null);

//   return useCallback(
//     (...args: Parameters<T>) => {
//       if (timeoutRef.current) {
//         clearTimeout(timeoutRef.current);
//       }
//       timeoutRef.current = setTimeout(() => callback(...args), delay);
//     },
//     [callback, delay]
//   );
// }

// Rate limiting utility
function useRateLimit(maxCalls: number, timeWindow: number) {
  const callsRef = useRef<number[]>([]);

  return useCallback(() => {
    const now = Date.now();
    const cutoff = now - timeWindow;

    callsRef.current = callsRef.current.filter((time) => time > cutoff);

    if (callsRef.current.length >= maxCalls) {
      return false;
    }

    callsRef.current.push(now);
    return true;
  }, [maxCalls, timeWindow]);
}

const isStoryVideo = (story: { img: string }) => {
  if (!story.img) return false;
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
  return videoExtensions.some((ext) => story.img.toLowerCase().includes(ext));
};

export default function StoryList({
  stories,
  userId,
}: {
  stories: StoryWithUser[];
  userId: string;
}) {
  const [pendingActions, setPendingActions] = useState<{
    likingStories: Set<number>;
    likingComments: Set<number>;
    deletingComments: Set<number>;
    addingComments: Set<number>;
  }>({
    likingStories: new Set(),
    likingComments: new Set(),
    deletingComments: new Set(),
    addingComments: new Set(),
  });
  const [media, setMedia] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const { user, isLoaded } = useUser();
  const [activeUserStoryId, setActiveUserStoryId] = useState<string | null>(
    null
  );

   const {
     userData,
     refreshUser,
     isLoading: isContextLoading,
   } = useUserContext();
  const [commentMap, setCommentMap] = useState<{ [key: string]: string }>({});
  const [isMuted, setIsMuted] = useState(true);
  const [isInputActive, setIsInputActive] = useState(false);
  const [showLikes, setShowLikes] = useState(userData?.showStoryLikes ?? true);

  const [showStoryMenu, setShowStoryMenu] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>(
    {}
  );

  const [mediaLoading, setMediaLoading] = useState(true);

  const canLikeStory = useRateLimit(10, 5000);
  const canLikeComment = useRateLimit(20, 10000);
  const canAddComment = useRateLimit(5, 10000);

  const groupStories = useCallback((storiesArray: StoryWithUser[]) => {
    const grouped: { [key: string]: UserStoryGroup } = {};
    storiesArray.forEach((story) => {
      const uId = story.user.id;
      if (!grouped[uId]) grouped[uId] = { user: story.user, stories: [] };
      grouped[uId].stories.push(story);
    });
    return Object.values(grouped);
  }, []);

  const [optimisticStories, dispatch] = useOptimistic(
    useMemo(() => groupStories(stories), [stories, groupStories]),
    (state, action: OptimisticAction) => {
      try {
        const userGroupIndex = state.findIndex(
          (group) => group.user.id === userId
        );

        switch (action.type) {
          case "ADD_COMMENT":
            return state.map((group) => {
              if (!group.stories.find((s) => s.id === action.storyId))
                return group;
              return {
                ...group,
                stories: group.stories.map((story) =>
                  story.id === action.storyId
                    ? {
                        ...story,
                        comments: [action.comment, ...(story.comments || [])],
                      }
                    : story
                ),
              };
            });

          case "REPLACE_COMMENT":
            return state.map((group) => {
              if (!group.stories.find((s) => s.id === action.storyId))
                return group;
              return {
                ...group,
                stories: group.stories.map((story) =>
                  story.id === action.storyId
                    ? {
                        ...story,
                        comments: (story.comments || []).map((comment) =>
                          comment.id === action.tempId
                            ? action.comment
                            : comment
                        ),
                      }
                    : story
                ),
              };
            });

          case "ADD_STORIES":
            if (userGroupIndex !== -1) {
              const newState = [...state];
              newState[userGroupIndex] = {
                ...newState[userGroupIndex],
                stories: [
                  ...action.stories,
                  ...newState[userGroupIndex].stories,
                ],
              };
              return newState;
            } else {
              const newUserGroup: UserStoryGroup = {
                user: {
                  id: userId,
                  isPrivate:
                    (user?.publicMetadata?.isPrivate as boolean) ?? false,
                  username: user?.username || "Sending...",
                  avatar: user?.imageUrl || "/noAvatar.png",
                  cover: user?.imageUrl || "/noCover.png",
                  description: null,
                  name: user?.firstName || null,
                  surname: user?.lastName || null,
                  city: null,
                  work: null,
                  school: null,
                  website: null,
                  bioPattern: null,
                  createdAt: new Date(),
                  lastActiveAt: new Date(),
                  showActivityStatus:
                    (user?.publicMetadata?.showActivityStatus as boolean) ??
                    true,
                  allowStoryComments:
                    (user?.publicMetadata?.allowStoryComments as boolean) ?? true,
                  showStoryLikes:
                    (user?.publicMetadata?.showStoryLikes as boolean) ?? true,
                },
                stories: action.stories,
              };
              return [newUserGroup, ...state];
            }

          case "TOGGLE_STORY_LIKE":
            return state.map((group) => ({
              ...group,
              stories: group.stories.map((story) =>
                story.id === action.storyId
                  ? {
                      ...story,
                      likes: action.isLiking
                        ? [
                            ...story.likes,
                            {
                              id: -Date.now(),
                              createdAt: new Date(),
                              postId: null,
                              userId,
                              commentId: null,
                              storyId: story.id,
                              storyCommentId: null,
                            },
                          ]
                        : story.likes.filter((like) => like.userId !== userId),
                    }
                  : story
              ),
            }));

          case "TOGGLE_COMMENT_LIKE":
            return state.map((group) => ({
              ...group,
              stories: group.stories.map((story) =>
                story.id !== action.storyId
                  ? story
                  : {
                      ...story,
                      comments: (story.comments || []).map((comment) => {
                        if (comment.id !== action.commentId) return comment;
                        return {
                          ...comment,
                          likes: action.isLiking
                            ? [...comment.likes, { userId }]
                            : comment.likes.filter((l) => l.userId !== userId),
                        };
                      }),
                    }
              ),
            }));

          case "DELETE_STORY":
            return state
              .map((group) => ({
                ...group,
                stories: group.stories.filter(
                  (story) => story.id !== action.storyId
                ),
              }))
              .filter((group) => group.stories.length > 0);

          case "DELETE_COMMENT":
            return state.map((group) => ({
              ...group,
              stories: group.stories.map((story) =>
                story.id !== action.storyId
                  ? story
                  : {
                      ...story,
                      comments: (story.comments || []).filter(
                        (c) => c.id !== action.commentId
                      ),
                    }
              ),
            }));

          default:
            return state;
        }
      } catch (error) {
        console.error("Optimistic update error:", error);
        return state;
      }
    }
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const lastTrackedRef = useRef<number | null>(null);

  const updatePendingAction = useCallback(
    (
      actionType: keyof typeof pendingActions,
      id: number,
      isAdding: boolean
    ) => {
      setPendingActions((prev) => {
        const newSet = new Set(prev[actionType]);
        if (isAdding) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return { ...prev, [actionType]: newSet };
      });
    },
    []
  );

  const handleAddStory = async () => {
    if (media.length === 0 || isPending) return;

    const newOptimisticStories: StoryWithUser[] = media.map((item, idx) => ({
      id: -(Date.now() + idx),
      img: item.secure_url,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      userId,
      showLikes,
      user: {
        id: userId,
        username: user?.username || "Sending...",
        avatar: user?.imageUrl || "/noAvatar.png",
        cover: user?.imageUrl || "/noCover.png",
        description: null,
        name: user?.firstName || null,
        surname: user?.lastName || null,
        city: null,
        work: null,
        school: null,
        website: null,
        bioPattern: null,
        isPrivate: (user?.publicMetadata?.isPrivate as boolean) ?? false,
        showActivityStatus:
          (user?.publicMetadata?.showActivityStatus as boolean) ?? true,
        allowStoryComments:
          (user?.publicMetadata?.allowStoryComments as boolean) ?? true,
        showStoryLikes:
          (user?.publicMetadata?.showStoryLikes as boolean) ?? true,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      },
      likes: [],
    }));

    startTransition(async () => {
      try {
        dispatch({ type: "ADD_STORIES", stories: newOptimisticStories });
        setMedia([]);

        await Promise.all(
          media.map((item) => addStory(item.secure_url, showLikes))
        );
      } catch (err) {
        console.error("Failed to add stories:", err);
      }
    });
  };

  const handleDeleteComment = useCallback(
    async (commentId: number) => {
      if (pendingActions.deletingComments.has(commentId)) return;

      const activeGroup = optimisticStories.find(
        (group) => group.user.id === activeUserStoryId
      );
      const currentStory = activeGroup?.stories[activeIndex];
      if (!currentStory) return;

      const originalComment = currentStory.comments?.find(
        (c) => c.id === commentId
      );
      if (!originalComment) return;

      dispatch({
        type: "DELETE_COMMENT",
        storyId: currentStory.id,
        commentId,
      });
      updatePendingAction("deletingComments", commentId, true);

      try {
        await deleteStoryComment(commentId);
      } catch (error: any) {
        console.error("Failed to delete comment:", error);

        dispatch({
          type: "ADD_COMMENT",
          storyId: currentStory.id,
          comment: originalComment,
        });

        alert(error.message || "Failed to delete comment. Please try again.");
      } finally {
        updatePendingAction("deletingComments", commentId, false);
      }
    },
    [
      pendingActions.deletingComments,
      optimisticStories,
      activeUserStoryId,
      activeIndex,
      dispatch,
      updatePendingAction,
    ]
  );

  const handleAddComment = useCallback(
    async (storyId: number) => {
      const commentText = commentMap[storyId]?.trim();
      if (!commentText || pendingActions.addingComments.has(storyId)) return;

      if (!canAddComment()) {
        alert("Please wait before adding another comment");
        return;
      }

      if (commentText.length > 500) {
        alert("Comment is too long (max 500 characters)");
        return;
      }

      const tempId = -Date.now();
      const optimisticComment = {
        id: tempId,
        desc: commentText,
        storyId,
        userId,
        user: {
          id: userId,
          username: user?.username || null,
          avatar: user?.imageUrl || "/noAvatar.png",
          name: user?.firstName || null,
          surname: user?.lastName || null,
          createdAt: new Date(),
          description: null,
          cover: null,
          city: null,
          work: null,
          school: null,
          website: null,
          bioPattern: null,
          isPrivate: (user?.publicMetadata?.isPrivate as boolean) ?? false,
          lastActiveAt: new Date(),
          showActivityStatus:
            (user?.publicMetadata?.showActivityStatus as boolean) ?? true,
          allowStoryComments:
            (user?.publicMetadata?.allowStoryComments as boolean) ?? true,
          showStoryLikes:
            (user?.publicMetadata?.showStoryLikes as boolean) ?? true,
        },
        likes: [],
      };

      updatePendingAction("addingComments", storyId, true);

      try {
        dispatch({ type: "ADD_COMMENT", storyId, comment: optimisticComment });
        setCommentMap((prev) => ({ ...prev, [storyId]: "" }));
        setIsInputActive(false);

        const savedComment = await addStoryComment(storyId, commentText);
        dispatch({
          type: "REPLACE_COMMENT",
          storyId,
          tempId,
          comment: {
            ...savedComment,
            user: optimisticComment.user,
            likes: savedComment.likes ?? [],
          },
        });
      } catch (err) {
        console.error("Failed to add comment:", err);
        dispatch({
          type: "DELETE_COMMENT",
          storyId,
          commentId: tempId,
        });
        setCommentMap((prev) => ({ ...prev, [storyId]: commentText }));
        alert("Failed to add comment. Please try again.");
      } finally {
        updatePendingAction("addingComments", storyId, false);
      }
    },
    [
      commentMap,
      pendingActions.addingComments,
      canAddComment,
      userId,
      user,
      updatePendingAction,
      dispatch,
    ]
  );

  const goNextStory = useCallback(() => {
    const activeGroup = optimisticStories.find(
      (group) => group.user.id === activeUserStoryId
    );
    if (!activeGroup) return;

    if (activeIndex < activeGroup.stories.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      setActiveUserStoryId(null);
      setActiveIndex(0);
    }
  }, [activeIndex, activeUserStoryId, optimisticStories]);

  const goPrevStory = useCallback(() => {
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  }, [activeIndex]);

  const handleLikeStory = useCallback(
    async (storyId: number) => {
      if (pendingActions.likingStories.has(storyId) || !canLikeStory()) {
        return;
      }

      const activeGroup = optimisticStories.find(
        (group) => group.user.id === activeUserStoryId
      );
      const currentStory = activeGroup?.stories.find((s) => s.id === storyId);
      if (!currentStory) return;

      const isCurrentlyLiked = currentStory.likes.some(
        (like) => like.userId === userId
      );
      const isLiking = !isCurrentlyLiked;

      dispatch({ type: "TOGGLE_STORY_LIKE", storyId, isLiking });
      updatePendingAction("likingStories", storyId, true);

      try {
        likeStory(storyId, isLiking).catch((error) => {
          console.error("Background like failed:", error);
          dispatch({ type: "TOGGLE_STORY_LIKE", storyId, isLiking: !isLiking });
        });
      } finally {
        setTimeout(() => {
          updatePendingAction("likingStories", storyId, false);
        }, 100);
      }
    },
    [
      pendingActions.likingStories,
      canLikeStory,
      optimisticStories,
      activeUserStoryId,
      userId,
      dispatch,
      updatePendingAction,
    ]
  );

  const handleLikeComment = useCallback(
    async (storyId: number, commentId: number) => {
      if (
        commentId < 0 ||
        pendingActions.likingComments.has(commentId) ||
        !canLikeComment()
      ) {
        return;
      }

      const activeGroup = optimisticStories.find(
        (group) => group.user.id === activeUserStoryId
      );
      const currentStory = activeGroup?.stories.find((s) => s.id === storyId);
      const currentComment = currentStory?.comments?.find(
        (c) => c.id === commentId
      );

      if (!currentComment) return;

      const isCurrentlyLiked = currentComment.likes.some(
        (like) => like.userId === userId
      );
      const isLiking = !isCurrentlyLiked;

      dispatch({
        type: "TOGGLE_COMMENT_LIKE",
        storyId,
        commentId,
        isLiking,
      });
      updatePendingAction("likingComments", commentId, true);

      try {
        likeStoryComment(commentId, isLiking).catch((error) => {
          console.error("Background comment like failed:", error);
          dispatch({
            type: "TOGGLE_COMMENT_LIKE",
            storyId,
            commentId,
            isLiking: !isLiking,
          });
        });
      } finally {
        setTimeout(() => {
          updatePendingAction("likingComments", commentId, false);
        }, 100);
      }
    },
    [
      pendingActions.likingComments,
      canLikeComment,
      optimisticStories,
      activeUserStoryId,
      userId,
      dispatch,
      updatePendingAction,
    ]
  );

  const handleStoryBubbleClick = useCallback(
    async (uId: string) => {
      setActiveUserStoryId(uId);
      setActiveIndex(0);
      startTimeRef.current = Date.now();

      const activeGroup = optimisticStories.find(
        (group) => group.user.id === uId
      );
      if (activeGroup && activeGroup.stories.length > 0 && uId !== userId) {
        try {
          await recordStoryView(activeGroup.stories[0].id, userId);
        } catch (err) {
          console.error("Failed to record story view:", err);
        }
      }
    },
    [optimisticStories, userId]
  );

  const handleDeleteStory = useCallback(
    async (storyId: number) => {
      startTransition(async () => {
        try {
          dispatch({ type: "DELETE_STORY", storyId });
          await deleteStory(storyId);
          setActiveUserStoryId(null);
          setShowDeleteConfirm(false);
          setShowStoryMenu(false);
        } catch (err) {
          console.error("Failed to delete story:", err);
          alert("Failed to delete story. Please try again.");
        }
      });
    },
    [dispatch]
  );

  const getStoryDuration = (story: { img: string }) => {
    return isStoryVideo(story) ? 60000 : 10000;
  };

  useEffect(() => {
    if (!activeUserStoryId) return;

    const shouldPause = isInputActive || showActivityModal || showDeleteConfirm;
    if (shouldPause) return;

    const activeGroup = optimisticStories.find(
      (group) => group.user.id === activeUserStoryId
    );
    const currentStory = activeGroup?.stories[activeIndex];
    if (!currentStory) return;

    const storyDuration = getStoryDuration(currentStory);

    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(Math.min((elapsed / storyDuration) * 100, 100));

      if (elapsed >= storyDuration) {
        startTimeRef.current = Date.now();
        goNextStory();
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    activeUserStoryId,
    activeIndex,
    isInputActive,
    showActivityModal,
    showDeleteConfirm,
    goNextStory,
    optimisticStories,
  ]);

  useEffect(() => {
    setProgress(0);
    startTimeRef.current = Date.now();
  }, [activeIndex, activeUserStoryId]);

  useEffect(() => {
    if (!activeUserStoryId) return;

    const activeGroup = optimisticStories.find(
      (group) => group.user.id === activeUserStoryId
    );
    const currentStory = activeGroup?.stories[activeIndex];
    if (!currentStory) return;
    if (currentStory.userId === userId) return;
    if (lastTrackedRef.current === currentStory.id) return;

    lastTrackedRef.current = currentStory.id;

    recordStoryView(currentStory.id, userId).catch((err) => {
      console.error("Failed to record story view:", err);
    });
  }, [activeUserStoryId, activeIndex, optimisticStories, userId]);

  if (!isLoaded || !user) return null;

  const activeGroup = optimisticStories.find(
    (group) => group.user.id === activeUserStoryId
  );
  const currentStory = activeGroup?.stories[activeIndex];
  const hasLiked =
    currentStory?.likes.some((like) => like.userId === userId) || false;
  const isOwner = currentStory?.userId === userId;
  const storyOwnerAllowsComments = activeGroup?.user.allowStoryComments ?? true;

  return (
    <>
      {/* Upload widget */}
      {media.length === 0 && (
        <CldUploadWidget
          uploadPreset="social"
          onSuccess={(result, { widget }) => {
            const normalizeUrl = (url: string) =>
              url.replace("/upload/", "/upload/f_auto,q_auto/");

            if (Array.isArray(result.info)) {
              setMedia(
                result.info.map((i: any) => ({
                  ...i,
                  secure_url: normalizeUrl(i.secure_url),
                }))
              );
            } else {
              const info = result.info as any;
              setMedia([
                { ...info, secure_url: normalizeUrl(info.secure_url) },
              ]);
            }
            widget.close();
          }}
          options={{
            multiple: false,
            resourceType: "auto", // auto-detects image or video
            clientAllowedFormats: ["jpg", "jpeg", "png", "mp4", "mov"],
          }}
        >
          {({ open }) => (
            <div
              className="flex flex-col items-center gap-2 cursor-pointer relative"
              onClick={() => open()}
            >
              {/* Add Story Button - Themed Gradient Border */}
              <div className="p-[3px] rounded-full bg-gradient-to-tr from-orange-300 via-pink-200 to-red-800 dark:from-gray-600 dark:via-gray-700 dark:to-gray-800 transition-colors duration-300">
                <Image
                  src={user.imageUrl || "/noAvatar.png"}
                  alt="Add Story"
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover bg-white dark:bg-gray-700 transition-colors duration-300" // Added dark bg for image container
                />
              </div>
              <span className="font-medium text-xs text-gray-800 dark:text-gray-300 transition-colors duration-300">
                Add a Story
              </span>
              {/* Plus Icon - Themed */}
              <div className="absolute -bottom-1 -right-1 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full p-1 transition-colors duration-300">
                <div className="bg-orange-400 dark:bg-orange-500 rounded-full w-5 h-5 flex items-center justify-center transition-colors duration-300">
                  <span className="text-white text-xl -mt-0">+</span>
                </div>
              </div>
            </div>
          )}
        </CldUploadWidget>
      )}
      {/* Preview Modal */}
      {/* Enhanced Preview Modal - Themed */}
      {media.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setMedia([])}
        >
          <div
            className="relative flex flex-col bg-gradient-to-br from-rose-50 via-orange-50 to-rose-100 dark:bg-gradient-to-br dark:from-gray-800 dark:via-gray-800 dark:to-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-orange-200 dark:border-gray-700 transition-colors duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gradient background - Themed */}
            <div className="bg-gradient-to-r from-orange-400 to-rose-800 dark:bg-gradient-to-r dark:from-gray-700 dark:to-gray-800 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-1">Story Preview</h3>
                  <p className="text-orange-100 dark:text-gray-300 text-sm opacity-90">
                    Item ready to share
                  </p>
                </div>
                <button
                  onClick={() => setMedia([])}
                  className="p-2 rounded-full hover:bg-white hover:bg-opacity-20 dark:hover:bg-gray-600 transition-all duration-200 group"
                >
                  <svg
                    className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Media Grid Container - Themed */}
            <div className="flex-1 p-6 overflow-y-auto flex justify-center dark:bg-gray-900 transition-colors duration-300">
              <div className="grid grid-flow-row auto-rows-auto gap-4 justify-items-center">
                {media.map((item, index) => (
                  <div
                    key={item.public_id}
                    className="relative group w-full max-w-xs bg-gradient-to-br from-orange-100 to-rose-100 dark:bg-gradient-to-br dark:from-gray-700 dark:to-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-orange-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-gray-600 "
                  >
                    {/* Loading state - Themed */}
                    {imageLoading[index] !== false && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-rose-100 dark:bg-gradient-to-br dark:from-gray-700 dark:to-gray-800 z-10">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-3 border-orange-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs text-orange-700 dark:text-gray-400 font-medium">
                            Loading...
                          </span>
                        </div>
                      </div>
                    )}

                    {item.resource_type === "video" ? (
                      <video
                        src={item.secure_url}
                        className="w-full h-auto max-h-[70vh] object-contain"
                        muted
                        controls
                        preload="metadata"
                        onLoadStart={() =>
                          setImageLoading((prev) => ({
                            ...prev,
                            [index]: true,
                          }))
                        }
                        onLoadedData={() =>
                          setImageLoading((prev) => ({
                            ...prev,
                            [index]: false,
                          }))
                        }
                        onError={() =>
                          setImageLoading((prev) => ({
                            ...prev,
                            [index]: false,
                          }))
                        }
                      />
                    ) : (
                      <Image
                        src={item.secure_url}
                        alt={`Story Preview ${index + 1}`}
                        width={300} // max width for image
                        height={500} // height to maintain ratio
                        className="w-full h-auto object-contain"
                        onLoadingComplete={() =>
                          setImageLoading((prev) => ({
                            ...prev,
                            [index]: false,
                          }))
                        }
                        onLoadStart={() =>
                          setImageLoading((prev) => ({
                            ...prev,
                            [index]: true,
                          }))
                        }
                        onError={() =>
                          setImageLoading((prev) => ({
                            ...prev,
                            [index]: false,
                          }))
                        }
                      />
                    )}

                    {/* Media type indicator - Works fine */}
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-70 rounded-full text-white text-xs font-medium">
                      {item.resource_type === "video" ? "Video" : "Photo"}
                    </div>

                    {/* Remove button - Themed */}
                    <button
                      onClick={() =>
                        setMedia((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="absolute -top-0 -right-0 w-8 h-8 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 dark:bg-gradient-to-r dark:from-gray-600 dark:to-gray-700 dark:hover:from-gray-700 dark:hover:to-gray-700 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 border-2 border-white dark:border-gray-800 group z-20"
                      title="Remove this item"
                    >
                      <svg
                        className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    {/* Hover overlay - Works fine */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="text-white text-xs font-medium truncate">
                          Item {index + 1}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings Section with custom switch - Themed */}
            <div className="px-6 py-6 dark:bg-gray-900 border-t border-orange-200 dark:border-gray-700 transition-colors duration-300">
              <div className="flex items-center justify-between gap-4 ">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-r from-orange-400 to-rose-600 dark:bg-gradient-to-r dark:from-gray-600 dark:to-gray-700 rounded-lg">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="text-gray-800 dark:text-white font-semibold text-sm">
                      Show likes to others?
                    </span>
                    <p className="text-gray-600 dark:text-gray-400 text-xs hidden sm:block">
                      Others can see who how many people liked your story
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 ">
                  <div className="scale-[0.3] sm:scale-50 md:scale-60 -mr-6 sm:-mr-4">
                    {/* Simplified Custom Switch for Dark Mode (Original uses hex codes) */}
                    <div
                      className={`w-48 aspect-video rounded-xl transition-colors duration-300 border-4 border-[#121331] dark:border-gray-600 ${
                        showLikes
                          ? "bg-[#3a3347] dark:bg-gray-400"
                          : "bg-[#ebe6ef] dark:bg-gray-600"
                      }`}
                    >
                      <div className="flex h-full w-full px-2 items-center gap-x-2">
                        <div className="w-6 h-6 flex-shrink-0 rounded-full border-4 border-[#121331] dark:border-gray-600" />
                        <label
                          htmlFor="likes-switch"
                          className={`w-full h-10 border-4 border-[#121331] dark:border-gray-600 rounded cursor-pointer transition-transform duration-300 ${
                            showLikes ? "scale-x-[-1]" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            id="likes-switch"
                            className="hidden"
                            checked={showLikes}
                            onChange={() => setShowLikes(!showLikes)}
                          />
                          {/* Simplified background for dark mode, original used complex SVG-like divs */}
                          <div
                            className={`w-full h-full relative ${
                              showLikes
                                ? "bg-orange-500 dark:bg-gray-500"
                                : "bg-gray-300 dark:bg-gray-700"
                            }`}
                          >
                            {/* You might need a simpler visual indicator here for dark mode if the SVG style breaks */}
                            <div
                              className={`absolute top-1 left-1 w-8 h-8 rounded bg-white dark:bg-gray-300 transition-transform duration-300 ${
                                showLikes
                                  ? "translate-x-[calc(100%-36px)]"
                                  : "translate-x-0"
                              }`}
                            ></div>
                          </div>
                        </label>
                        <div className="w-6 h-1 flex-shrink-0 bg-[#121331] dark:bg-gray-600 rounded-full" />
                      </div>
                    </div>
                  </div>

                  {/* Switch state indicator - Themed */}
                  <div className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 text-right mr-10">
                    {showLikes ? (
                      <span className="flex items-center gap-1">
                        <span className="text-green-600">➤</span>
                        <span className="hidden sm:inline">Likes visible</span>
                        <span className="sm:hidden">Visible</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className="text-red-600">○</span>
                        <span className="hidden sm:inline">Likes hidden</span>
                        <span className="sm:hidden">Hidden</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons with enhanced styling - Themed */}
            <div className="p-6 bg-gradient-to-r from-rose-50 to-orange-50 dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-900 border-t border-orange-200 dark:border-gray-700 transition-colors duration-300">
              <div className="flex gap-3">
                <button
                  onClick={() => setMedia([])}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 dark:from-gray-700 dark:to-gray-600 dark:hover:from-gray-600 dark:hover:to-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] border border-gray-300 dark:border-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStory}
                  disabled={isPending}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-400 to-rose-600 hover:from-orange-500 hover:to-rose-700 dark:from-gray-600 dark:to-gray-700 dark:hover:from-gray-700 dark:hover:to-gray-700 disabled:from-gray-400 disabled:to-gray-500 dark:disabled:from-gray-700 dark:disabled:to-gray-700 text-white rounded-xl font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2 border border-orange-500 dark:border-gray-600"
                >
                  {isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      <span>Share Stories</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeUserStoryId !== null && activeGroup && currentStory && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
          onClick={() => setActiveUserStoryId(null)}
        >
          <div
            className="relative w-full h-full max-w-[400px] max-h-[800px] flex flex-col justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading spinner */}
            {mediaLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                <div className="relative">
                  {/* Animated spinner */}
                  <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                  {/* Pulsing circle behind */}
                  <div className="absolute inset-0 w-16 h-16 border-4 border-rose-300 rounded-full animate-pulse opacity-20"></div>
                </div>
              </div>
            )}

            {isStoryVideo(currentStory) ? (
              <video
                src={currentStory.img}
                autoPlay
                playsInline
                muted={isMuted}
                className={`absolute inset-0 w-full h-full object-contain rounded-lg transition-opacity duration-300 ${
                  mediaLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoadStart={() => setMediaLoading(true)}
                onCanPlay={() => setMediaLoading(false)}
                onEnded={() => {
                  if (!isInputActive) {
                    goNextStory();
                  }
                }}
                onLoadedMetadata={(e) => {
                  const video = e.target as HTMLVideoElement;
                  if (video.duration > 60) {
                    // Handle long videos
                  }
                }}
              />
            ) : (
              <Image
                src={currentStory.img}
                alt="Story"
                fill
                style={{ objectFit: "contain" }}
                className={`rounded-lg transition-opacity duration-300 ${
                  mediaLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoadingComplete={() => setMediaLoading(false)}
                onLoadStart={() => setMediaLoading(true)}
              />
            )}

            {/* Video mute/unmute button */}
            {isStoryVideo(currentStory) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="absolute bottom-32 right-4 z-40 bg-black bg-opacity-50 p-2 rounded-full"
              >
                {isMuted ? "🔇" : "🔊"}
              </button>
            )}

            {/* Top bar with progress and user info */}
            <div className="absolute top-0 left-0 w-full p-2 flex flex-col gap-2 z-20">
              <div className="flex gap-1">
                {activeGroup.stories.map((_, idx) => (
                  <div
                    key={idx}
                    className="flex-1 h-1 bg-white bg-opacity-50 rounded-full"
                  >
                    <div
                      className="h-1 bg-white transition-all duration-300 rounded-full"
                      style={{
                        width:
                          idx === activeIndex
                            ? `${progress}%`
                            : idx < activeIndex
                            ? "100%"
                            : "0%",
                      }}
                    />
                  </div>
                ))}
              </div>
              <Link href={`/profile/${activeGroup.user.username}`}>
                <div className="flex items-center gap-2">
                  <Image
                    src={activeGroup.user.avatar || "/noAvatar.png"}
                    alt="User avatar"
                    width={32}
                    height={32}
                    className="rounded-full object-cover w-8 h-8 border-2 border-white"
                  />
                  <span className="text-white text-sm font-semibold">
                    {activeGroup.user.name || activeGroup.user.username}
                  </span>
                </div>
              </Link>
            </div>

            {/* Comments section */}
            {storyOwnerAllowsComments && (
              <>
                <div className="absolute bottom-16 left-4 right-4 z-30 max-h-48 overflow-y-auto flex flex-col gap-2 px-2 py-1">
                  {currentStory.comments && currentStory.comments.length > 0 ? (
                    currentStory.comments.map((c) => {
                      const hasLikedByAuthor =
                        c.likes.some((l) => l.userId === activeGroup.user.id) ||
                        false;
                      const isDeleting = pendingActions.deletingComments.has(
                        c.id
                      );
                      const isLikingComment = pendingActions.likingComments.has(
                        c.id
                      );

                      return (
                        <div
                          key={c.id}
                          className={`flex items-start gap-2 p-2 rounded-lg bg-black bg-opacity-40 hover:bg-opacity-60 transition-colors ${
                            isDeleting ? "opacity-50" : ""
                          }`}
                        >
                          <Link href={`/profile/${c.user.username}`}>
                            <Image
                              src={c.user.avatar || "/noAvatar.png"}
                              alt={c.user.username || "User"}
                              width={32}
                              height={32}
                              className="rounded-full object-cover w-8 h-8"
                            />
                          </Link>
                          <div className="flex-1">
                            <span className="text-white font-semibold text-sm">
                              {c.user.name || c.user.username}
                            </span>
                            <p className="text-white text-sm">{c.desc}</p>
                            {hasLikedByAuthor && (
                              <div className="flex items-center text-xs text-gray-300 gap-1 mt-1">
                                <Heart
                                  size={12}
                                  className="text-red-500 fill-red-500"
                                />
                                <span>Liked by author</span>
                              </div>
                            )}
                          </div>

                          {/* Comment like button for story owner */}
                          {userId === activeGroup.user.id && c.id > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLikeComment(currentStory.id, c.id);
                              }}
                              disabled={isLikingComment}
                              className="disabled:opacity-50"
                            >
                              {isLikingComment ? (
                                <Loader2
                                  size={16}
                                  className="animate-spin text-white"
                                />
                              ) : (
                                <Heart
                                  size={16}
                                  className={`transition-colors duration-200 ${
                                    c.likes.some((l) => l.userId === userId)
                                      ? "text-red-500 fill-red-500"
                                      : "text-white"
                                  }`}
                                />
                              )}
                            </button>
                          )}

                          {/* Delete button for comment owner or story owner */}
                          {(userId === activeGroup.user.id ||
                            userId === c.user.id) &&
                            c.id > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteComment(c.id);
                                }}
                                disabled={isDeleting}
                                className="ml-2 text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  "Delete"
                                )}
                              </button>
                            )}
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-white text-sm opacity-70">
                      No comments yet...
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Bottom actions */}
            <div className="absolute bottom-4 left-4 right-4 z-40 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLikeStory(currentStory.id);
                }}
                disabled={pendingActions.likingStories.has(currentStory.id)}
                className="flex items-center gap-1 bg-black bg-opacity-50 rounded-full p-2 hover:scale-110 transition-transform disabled:opacity-50"
              >
                {pendingActions.likingStories.has(currentStory.id) ? (
                  <Loader2 size={24} className="animate-spin text-white" />
                ) : (
                  <Heart
                    size={24}
                    className={`transition-colors duration-200 ${
                      hasLiked ? "text-red-500 fill-red-500" : "text-white"
                    }`}
                  />
                )}
                {(currentStory.showLikes || userId === currentStory.userId) && (
                  <span className="text-white font-semibold">
                    {currentStory.likes.length}
                  </span>
                )}
              </button>
              {storyOwnerAllowsComments && (
                <>
                  <input
                    type="text"
                    value={commentMap[currentStory.id] || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 500) {
                        setCommentMap((prev) => ({
                          ...prev,
                          [currentStory.id]: value,
                        }));
                      }
                    }}
                    onFocus={() => setIsInputActive(true)}
                    onBlur={() => setIsInputActive(false)}
                    placeholder="Add a comment..."
                    className="flex-1 rounded-full px-3 py-1 text-sm outline-none bg-black bg-opacity-40 text-white placeholder-gray-300"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment(currentStory.id);
                      }
                    }}
                    disabled={pendingActions.addingComments.has(
                      currentStory.id
                    )}
                  />
                  {commentMap[currentStory.id]?.trim() && (
                    <button
                      onClick={() => handleAddComment(currentStory.id)}
                      disabled={pendingActions.addingComments.has(
                        currentStory.id
                      )}
                      className="bg-blue-500 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50"
                    >
                      {pendingActions.addingComments.has(currentStory.id) ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        "➔"
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => setActiveUserStoryId(null)}
              className="absolute top-4 right-4 z-40 text-white text-2xl font-bold"
            >
              ✕
            </button>

            {/* Story menu button - only show for story owner */}
            {isOwner && (
              <div className="absolute top-4 right-16 z-40">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStoryMenu(!showStoryMenu);
                  }}
                  className="text-white p-2 hover:bg-black hover:bg-opacity-30 rounded-full transition-colors"
                >
                  <MoreVertical size={20} />
                </button>

                {/* Menu dropdown */}
                {showStoryMenu && (
                  <div className="absolute right-0 top-12 bg-slate-900 rounded-lg shadow-lg py-2 min-w-48">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActivityModal(true);
                        setShowStoryMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      <Eye size={16} />
                      See story activity
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                        setShowStoryMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-950"
                    >
                      <Trash2 size={16} />
                      Delete story
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation areas */}
          <div className="absolute inset-0 flex justify-between items-center z-10">
            <div
              className="flex-1 h-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                goPrevStory();
              }}
            />
            <div
              className="flex-1 h-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                goNextStory();
              }}
            />
          </div>
        </div>
      )}
      {/* Story Activity Modal */}
      {showActivityModal && currentStory && (
        <StoryActivityModal
          storyId={currentStory.id}
          onClose={() => setShowActivityModal(false)}
        />
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && currentStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-5"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-black rounded-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg text-red-500 font-semibold mb-4">
              Delete Story?
            </h3>
            <p className="text-slate-300 mb-6">
              This action cannot be undone. Your story will be permanently
              deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded-md font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteStory(currentStory.id)}
                disabled={isPending}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
      {/* Story bubbles */}
      <div className="flex gap-4 overflow-x-auto scrollbar-hide py-2">
        {optimisticStories.map((group) => (
          <div
            key={group.user.id}
            className="flex flex-col items-center gap-1 cursor-pointer"
            onClick={() => handleStoryBubbleClick(group.user.id)}
          >
            <div className="p-[2px] bg-gradient-to-tr from-orange-300 via-pink-200 to-red-900 rounded-full">
              <Image
                src={group.user.avatar || "/noAvatar.png"}
                alt="Story"
                width={70}
                height={70}
                className="w-16 h-16 rounded-full object-cover bg-white"
              />
            </div>
            <span className="font-medium text-xs truncate w-16 text-center">
              {group.user.name || group.user.username}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
