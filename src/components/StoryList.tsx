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
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
}

// Rate limiting utility
function useRateLimit(maxCalls: number, timeWindow: number) {
  const callsRef = useRef<number[]>([]);

  return useCallback(() => {
    const now = Date.now();
    const cutoff = now - timeWindow;

    // More efficient filtering - only keep recent calls
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
  // State management with better organization
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
  const [commentMap, setCommentMap] = useState<{ [key: string]: string }>({});
  const [isMuted, setIsMuted] = useState(true);
  const [isInputActive, setIsInputActive] = useState(false);
  const [showLikes, setShowLikes] = useState(true);

  // Story management states
  const [showStoryMenu, setShowStoryMenu] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>(
    {}
  );

  // Rate limiting hooks
  const canLikeStory = useRateLimit(10, 5000); // 10 likes per 5 seconds
  const canLikeComment = useRateLimit(20, 10000); // 20 comment likes per 10 seconds
  const canAddComment = useRateLimit(5, 10000); // 5 comments per 10 seconds

  // Memoized story grouping function
  const groupStories = useCallback((storiesArray: StoryWithUser[]) => {
    const grouped: { [key: string]: UserStoryGroup } = {};
    storiesArray.forEach((story) => {
      const uId = story.user.id;
      if (!grouped[uId]) grouped[uId] = { user: story.user, stories: [] };
      grouped[uId].stories.push(story);
    });
    return Object.values(grouped);
  }, []);

  // Optimistic updates with better error handling
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
                  username: user?.username || "Sending...",
                  avatar: user?.imageUrl || "/noAvatar.png",
                  cover: user?.imageUrl || "/noCover.png",
                  description: "",
                  name: user?.firstName || "",
                  surname: user?.lastName || "",
                  city: "",
                  work: "",
                  school: "",
                  website: "",
                  bioPattern: '',
                  createdAt: new Date(),
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
        return state; // Return unchanged state on error
      }
    }
  );
  

  // Story navigation state
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const lastTrackedRef = useRef<number | null>(null);

  // Helper function to update pending actions
const updatePendingAction = useCallback(
  (actionType: keyof typeof pendingActions, id: number, isAdding: boolean) => {
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
useRateLimit
  // Improved story addition with better error handling
  const handleAddStory = async () => {
    if (media.length === 0 || isPending) return;

    const newOptimisticStories: StoryWithUser[] = media.map((item, idx) => ({
      id: -(Date.now() + idx), // Negative IDs for temp stories
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
        description: "",
        name: user?.firstName || "",
        surname: user?.lastName || "",
        city: "",
        work: "",
        school: "",
        website: "",
        bioPattern: "",
        createdAt: new Date(),
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
        // Could add toast notification here
      }
    });
  };

  // Improved comment deletion with proper error handling
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

    // Instant UI removal
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

      // Rollback - restore the comment
      dispatch({
        type: "ADD_COMMENT",
        storyId: currentStory.id,
        comment: originalComment,
      });

      // Show user-friendly error
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

  // Improved comment addition with rate limiting and validation
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
          username: user?.username || "",
          avatar: user?.imageUrl || "/noAvatar.png",
          name: user?.firstName || "",
          surname: user?.lastName || "",
          createdAt: new Date(),
          description: "",
          cover: "",
          city: "",
          work: "",
          school: "",
          website: "",
          bioPattern: ''
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
        // Rollback
        dispatch({
          type: "DELETE_COMMENT",
          storyId,
          commentId: tempId,
        });
        // Restore comment text
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

  // Story navigation callbacks
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

  // Improved story liking with rate limiting and optimistic updates
 const handleLikeStory = useCallback(
   async (storyId: number) => {
     // Prevent double-clicking and check rate limit
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

     // Instant UI update
     dispatch({ type: "TOGGLE_STORY_LIKE", storyId, isLiking });
     updatePendingAction("likingStories", storyId, true);

     try {
       // Fire and forget - don't await to keep UI snappy
       likeStory(storyId, isLiking).catch((error) => {
         console.error("Background like failed:", error);
         // Rollback on error
         dispatch({ type: "TOGGLE_STORY_LIKE", storyId, isLiking: !isLiking });
       });
     } finally {
       // Clear pending state immediately for instant feedback
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


  // Improved comment liking with better error handling
 const handleLikeComment = useCallback(
   async (storyId: number, commentId: number) => {
     // Skip temporary comments and prevent double-clicking
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

     // Instant UI update
     dispatch({
       type: "TOGGLE_COMMENT_LIKE",
       storyId,
       commentId,
       isLiking,
     });
     updatePendingAction("likingComments", commentId, true);

     try {
       // Background request - don't block UI
       likeStoryComment(commentId, isLiking).catch((error) => {
         console.error("Background comment like failed:", error);
         // Rollback on error
         dispatch({
           type: "TOGGLE_COMMENT_LIKE",
           storyId,
           commentId,
           isLiking: !isLiking,
         });
       });
     } finally {
       // Clear pending state quickly
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

  // Story bubble click handler with improved view tracking
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

  // Story deletion handler
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
  // Videos can play for up to 60 seconds (1 minute)
  // Photos get 10 seconds
  return isStoryVideo(story) ? 60000 : 10000; // milliseconds
};
  // Timer management for story progression
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
   optimisticStories, // Add this dependency
 ]);

  // Reset progress on story change
  useEffect(() => {
    setProgress(0);
    startTimeRef.current = Date.now();
  }, [activeIndex, activeUserStoryId]);

  // View tracking for story progression
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
          options={{ multiple: true, resourceType: "auto" }}
        >
          {({ open }) => (
            <div
              className="flex flex-col items-center gap-2 cursor-pointer relative"
              onClick={() => open()}
            >
              <div className="p-[3px] rounded-full bg-gradient-to-tr from-orange-300 via-pink-200 to-red-800">
                <Image
                  src={user.imageUrl || "/noAvatar.png"}
                  alt="Add Story"
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover bg-white"
                />
              </div>
              <span className="font-medium text-xs">Add a Story</span>
              <div className="absolute -bottom-1 -right-1 flex items-center justify-center bg-white rounded-full p-1">
                <div className="bg-orange-400 rounded-full w-5 h-5 flex items-center justify-center">
                  <span className="text-white text-xl -mt-0">+</span>
                </div>
              </div>
            </div>
          )}
        </CldUploadWidget>
      )}

      {/* Preview Modal */}
      {media.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
          onClick={() => setMedia([])}
        >
          <div
            className="flex flex-col items-center justify-center gap-4 bg-white rounded-lg p-6 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-2">Preview Stories</h3>

            <div className="flex flex-wrap gap-4 overflow-y-auto max-h-96 justify-center">
              {media.map((item, index) => (
                <div
                  key={item.public_id}
                  className="relative w-20 h-32 flex-shrink-0"
                >
                  {item.resource_type === "video" ? (
                    <video
                      src={item.secure_url}
                      className="rounded-lg shadow-lg w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <div className="relative w-full h-full">
                      <Image
                        src={item.secure_url}
                        alt={`Story Preview ${index + 1}`}
                        fill
                        className="rounded-lg shadow-lg object-cover"
                      />
                    </div>
                  )}
                  <button
                    onClick={() =>
                      setMedia((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between w-full mt-4 px-2">
              <span className="text-sm font-medium">Show likes to others?</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showLikes}
                  onChange={() => setShowLikes(!showLikes)}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 transition-colors"></div>
                <div
                  className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                    showLikes ? "translate-x-5" : "translate-x-0"
                  }`}
                ></div>
              </label>
            </div>

            <div className="flex gap-4 w-full mt-4">
              <button
                onClick={() => setMedia([])}
                className="flex-1 text-sm bg-gray-200 p-2 rounded-md text-gray-800 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStory}
                disabled={isPending}
                className="flex-1 text-sm bg-blue-500 p-2 rounded-md text-white font-semibold disabled:bg-opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story Viewer Modal */}
      {activeUserStoryId !== null && activeGroup && currentStory && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
          onClick={() => setActiveUserStoryId(null)}
        >
          <div
            className="relative w-full h-full max-w-[400px] max-h-[800px] flex flex-col justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            {isStoryVideo(currentStory) ? (
              <video
                src={currentStory.img}
                autoPlay
                playsInline
                muted={isMuted}
                className="absolute inset-0 w-full h-full object-contain rounded-lg"
                onEnded={() => {
                  // Only auto-advance if not interacting with comments
                  if (!isInputActive) {
                    goNextStory();
                  }
                }}
                onLoadedMetadata={(e) => {
                  // Optional: Cap video duration at 1 minute for display
                  const video = e.target as HTMLVideoElement;
                  if (video.duration > 60) {
                    // If video is longer than 1 minute, we'll still advance after 1 minute
                    // The timer will handle this automatically
                  }
                }}
              />
            ) : (
              <Image
                src={currentStory.img}
                alt="Story"
                fill
                style={{ objectFit: "contain" }}
                className="rounded-lg"
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
            <div className="absolute bottom-16 left-4 right-4 z-30 max-h-48 overflow-y-auto flex flex-col gap-2 px-2 py-1">
              {currentStory.comments && currentStory.comments.length > 0 ? (
                currentStory.comments.map((c) => {
                  const hasLikedByAuthor =
                    c.likes.some((l) => l.userId === activeGroup.user.id) ||
                    false;
                  const isDeleting = pendingActions.deletingComments.has(c.id);
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
                disabled={pendingActions.addingComments.has(currentStory.id)}
              />

              {commentMap[currentStory.id]?.trim() && (
                <button
                  onClick={() => handleAddComment(currentStory.id)}
                  disabled={pendingActions.addingComments.has(currentStory.id)}
                  className="bg-blue-500 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50"
                >
                  {pendingActions.addingComments.has(currentStory.id) ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "➔"
                  )}
                </button>
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
