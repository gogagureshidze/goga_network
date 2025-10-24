"use client";

import { useUser } from "@clerk/nextjs";
import { Heart, SendHorizonal, MoreVertical } from "lucide-react";
import Image from "next/image";
import {
  useOptimistic,
  useState,
  useTransition,
  useCallback,
  memo,
  useEffect,
  useRef,
} from "react";
import CommentActivityModal from "./CommentActivityModal";
import { addComment } from "../actions/createComment";
import { addReplyComment } from "../actions/addReplyComment";
import { likeComment } from "../actions/likeComment";
import { deleteComment } from "../actions/deleteComment";
import Link from "next/link";
import { io, Socket } from "socket.io-client";

// Type definition for a comment including user details and nested replies
type CommentWithUser = {
  id: number;
  desc: string;
  postId: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  likes: {
    userId: string;
  }[];
  user: {
    id: string;
    username: string | null;
    avatar: string | null;
    imageUrl?: string | null;
  };
  parentId?: number | null;
  replies?: CommentWithUser[];
};

// Helper function to format time
const formatTimeAgo = (date: Date | string) => {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Helper function to build a nested comment tree from a flat list
const buildCommentTree = (flatComments: CommentWithUser[]) => {
  const commentMap: { [key: number]: CommentWithUser } = {};
  const rootComments: CommentWithUser[] = [];

  flatComments.forEach((comment) => {
    commentMap[comment.id] = { ...comment, replies: [] };
  });

  flatComments.forEach((comment) => {
    if (comment.parentId) {
      const parent = commentMap[comment.parentId];
      if (parent) {
        parent.replies?.push(commentMap[comment.id]);
      }
    } else {
      rootComments.push(commentMap[comment.id]);
    }
  });

  return rootComments;
};

// Helper function to remove a comment from the tree
const removeCommentFromTree = (
  comments: CommentWithUser[],
  commentId: number
): CommentWithUser[] => {
  return comments.reduce((acc, comment) => {
    if (comment.id === commentId) {
      return acc;
    }
    const updatedReplies = comment.replies
      ? removeCommentFromTree(comment.replies, commentId)
      : [];
    acc.push({ ...comment, replies: updatedReplies });
    return acc;
  }, [] as CommentWithUser[]);
};

// 🆕 TYPING INDICATOR COMPONENT
const TypingIndicator = memo(function TypingIndicator({
  usernames,
}: {
  usernames: string[];
}) {
  if (usernames.length === 0) return null;

  // Only show first 3 users max
  const maxDisplay = 3;
  const displayUsernames = usernames.slice(0, maxDisplay);
  const remainingCount = usernames.length - maxDisplay;

  let displayText = "";

  if (usernames.length === 1) {
    displayText = `${displayUsernames[0]} is typing`;
  } else if (usernames.length === 2) {
    displayText = `${displayUsernames[0]} and ${displayUsernames[1]} are typing`;
  } else if (usernames.length === 3) {
    displayText = `${displayUsernames[0]}, ${displayUsernames[1]}, and ${displayUsernames[2]} are typing`;
  } else {
    // 4 or more users - show first 3 and count remaining
    displayText = `${displayUsernames[0]}, ${displayUsernames[1]}, ${
      displayUsernames[2]
    }, and ${remainingCount} ${
      remainingCount === 1 ? "other is" : "others are"
    } typing`;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded-lg animate-pulse py-2">
      <div className="flex gap-1">
        <span
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        ></span>
        <span
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        ></span>
        <span
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        ></span>
      </div>
      <span>{displayText}</span>
    </div>
  );
});

// --- CommentItem Component (Memoized) ---
const CommentItem = memo(function CommentItem({
  comment,
  user,
  handleLike,
  setReplyingTo,
  replyingTo,
  isPending,
  addOptimisticComment,
  startTransition,
  handleDeleteComment,
  depth = 0,
}: {
  comment: CommentWithUser;
  user: any;
  handleLike: (commentId: number) => void;
  setReplyingTo: (id: number | null) => void;
  replyingTo: number | null;
  isPending: boolean;
  addOptimisticComment: (action: any) => void;
  startTransition: (callback: () => void) => void;
  handleDeleteComment: (commentId: number) => void;
  depth?: number;
}) {
  const hasLiked = comment.likes.some((like) => like.userId === user?.id);
  const isReplyingToThisComment = replyingTo === comment.id;
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const isCommentOwner = user?.id === comment.userId;

  const repliesToDisplay = showAllReplies
    ? comment.replies
    : comment.replies?.slice(0, 3);
  const hasMoreReplies = (comment.replies?.length || 0) > 3;

  // Keep only 3 levels of indentation to prevent mobile overflow
  const maxDepth = 3;
  const shouldIndent = depth < maxDepth;

  return (
    <>
      <div className="flex items-start gap-2 sm:gap-3 relative">
        <Link
          href={`/profile/${comment.user.username}`}
          className="flex-shrink-0"
        >
          <Image
            src={comment.user.avatar || "/noAvatar.png"}
            alt={comment.user.username || "User"}
            width={28}
            height={28}
            className="rounded-full w-6 h-6 sm:w-7 sm:h-7"
          />
        </Link>
        <div className="bg-slate-100 rounded-xl px-2 sm:px-3 py-2 text-sm flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link href={`/profile/${comment.user.username}`}>
              <span className="font-semibold text-xs sm:text-sm">
                {comment.user.username}
              </span>
            </Link>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-xs sm:text-sm break-words">{comment.desc}</p>
          <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs text-gray-500">
            <button
              onClick={() => handleLike(comment.id)}
              className="flex items-center gap-1 transition-colors"
              disabled={isPending}
            >
              <Heart
                className={`cursor-pointer transition-all duration-200 ${
                  hasLiked
                    ? "text-red-500 fill-red-500 scale-110"
                    : "text-gray-400 hover:text-red-400 hover:scale-105"
                }`}
                size={12}
              />
              <span
                className={
                  hasLiked ? "text-red-500 font-medium" : "text-gray-500"
                }
              >
                {comment.likes?.length || 0}
              </span>
            </button>
            <button
              className="hover:underline"
              onClick={() =>
                setReplyingTo(isReplyingToThisComment ? null : comment.id)
              }
            >
              Reply
            </button>
          </div>
        </div>

        {/* 3-DOT MENU */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1">
            <MoreVertical
              size={16}
              className="text-gray-500 hover:text-gray-700"
            />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 w-32 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
              <button
                onClick={() => {
                  setShowActivityModal(true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Heart size={14} /> Activity
              </button>

              {isCommentOwner && (
                <>
                  <div className="border-t border-gray-200"></div>
                  <button
                    onClick={() => {
                      handleDeleteComment(comment.id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Activity Modal */}
      {showActivityModal && (
        <CommentActivityModal
          commentId={comment.id}
          onClose={() => setShowActivityModal(false)}
        />
      )}

      {/* Reply form */}
      {isReplyingToThisComment && user && (
        <div
          className={`flex flex-col gap-2 mt-2 ${
            shouldIndent ? "ml-4 sm:ml-10" : "ml-0"
          } ${shouldIndent ? "border-l-2 border-gray-300 pl-2 sm:pl-4" : ""}`}
        >
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Image
              src={comment.user.avatar || "/noAvatar.png"}
              alt="Profile"
              width={20}
              height={20}
              className="rounded-full w-5 h-5 flex-shrink-0"
            />
            <span className="truncate text-xs sm:text-sm">
              Replying to {comment.user.username}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Image
              src={user.imageUrl || "/noAvatar.png"}
              alt="Profile"
              width={28}
              height={28}
              className="rounded-full w-6 h-6 sm:w-7 sm:h-7 ring-2 ring-orange-300 cursor-pointer flex-shrink-0"
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const desc = (
                  e.currentTarget.elements.namedItem(
                    "reply-input"
                  ) as HTMLInputElement
                ).value;
                if (!desc.trim() || isReplying) return;

                setIsReplying(true);
                const newCommentId = Date.now();
                const newComment: CommentWithUser = {
                  id: newCommentId,
                  desc,
                  postId: comment.postId,
                  likes: [],
                  userId: user.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  user: {
                    id: user.id,
                    username: user.username || "Anonymous",
                    avatar: user.imageUrl,
                  },
                  parentId: comment.id,
                };

                startTransition(() => {
                  addOptimisticComment({
                    type: "add",
                    newComment: newComment,
                  });
                  setReplyingTo(null);
                  setIsReplying(false);
                  (
                    e.currentTarget.elements.namedItem(
                      "reply-input"
                    ) as HTMLInputElement
                  ).value = "";
                  addReplyComment(comment.postId, desc, comment.id);
                });
              }}
              className="relative flex-1 bg-slate-100 rounded-xl px-3 sm:px-4 py-2 text-sm min-w-0"
            >
              <input
                className="w-full pr-8 sm:pr-10 bg-transparent outline-none text-xs sm:text-sm"
                type="text"
                name="reply-input"
                placeholder={isReplying ? "Sending..." : "Reply..."}
                disabled={isReplying}
              />
              <button
                type="submit"
                disabled={isReplying}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2"
              >
                <SendHorizonal
                  className={`cursor-pointer w-4 h-4 sm:w-5 sm:h-5 ${
                    isReplying ? "text-gray-300" : "text-orange-300"
                  }`}
                />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Render nested replies */}
      {repliesToDisplay && repliesToDisplay.length > 0 && (
        <div
          className={`${shouldIndent ? "pl-4 sm:pl-8" : "pl-0"} mt-2 ${
            shouldIndent ? "border-l-2 border-gray-300" : ""
          }`}
        >
          {repliesToDisplay.map((reply) => (
            <div key={reply.id} className="mt-2 mb-2">
              <CommentItem
                comment={reply}
                user={user}
                handleLike={handleLike}
                setReplyingTo={setReplyingTo}
                replyingTo={replyingTo}
                isPending={isPending}
                addOptimisticComment={addOptimisticComment}
                startTransition={startTransition}
                handleDeleteComment={handleDeleteComment}
                depth={depth + 1}
              />
            </div>
          ))}
          {hasMoreReplies && (
            <button
              onClick={() => setShowAllReplies(!showAllReplies)}
              className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 hover:underline mt-2"
            >
              {showAllReplies
                ? "Hide replies"
                : `Show all ${comment.replies?.length} replies`}
            </button>
          )}
        </div>
      )}
    </>
  );
});

// --- CommentList Component ---
function CommentList({
  comments,
  postId,
  username,
}: {
  comments: CommentWithUser[];
  postId: number;
  username: string | null | undefined;
}) {
  const { user } = useUser();
  const [desc, setDesc] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isCommenting, setIsCommenting] = useState(false);

  // 🆕 SOCKET & TYPING STATE
  const [socket, setSocket] = useState<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const SOCKET_SERVER_URL =
    process.env.NODE_ENV === "production"
      ? "wss://socket.goga.network"
      : "http://localhost:3001";

  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    (
      state,
      action: {
        type: "add" | "like" | "delete";
        newComment?: CommentWithUser;
        likedComment?: { commentId: number; userId: string };
        deletedComment?: { commentId: number };
      }
    ) => {
      switch (action.type) {
        case "add":
          const newComment = { ...action.newComment!, replies: [] };
          if (newComment.parentId) {
            const findAndAddReply = (
              comments: CommentWithUser[],
              parentId: number,
              reply: CommentWithUser
            ): CommentWithUser[] => {
              return comments.map((comment) => {
                if (comment.id === parentId) {
                  return {
                    ...comment,
                    replies: [...(comment.replies || []), reply],
                  };
                } else if (comment.replies && comment.replies.length > 0) {
                  return {
                    ...comment,
                    replies: findAndAddReply(comment.replies, parentId, reply),
                  };
                }
                return comment;
              });
            };
            return findAndAddReply(state, newComment.parentId, newComment);
          }
          return [newComment, ...state];

        case "like":
          const { commentId: likedId, userId: likedUserId } =
            action.likedComment!;

          const toggleLikeRecursive = (
            comments: CommentWithUser[]
          ): CommentWithUser[] => {
            return comments.map((comment) => {
              if (comment.id === likedId) {
                const currentLikes = comment.likes || [];
                const hasLiked = currentLikes.some(
                  (like) => like.userId === likedUserId
                );

                const newLikes = hasLiked
                  ? currentLikes.filter((like) => like.userId !== likedUserId)
                  : [...currentLikes, { userId: likedUserId }];

                return {
                  ...comment,
                  likes: newLikes,
                };
              }

              if (comment.replies && comment.replies.length > 0) {
                return {
                  ...comment,
                  replies: toggleLikeRecursive(comment.replies),
                };
              }

              return comment;
            });
          };

          return toggleLikeRecursive(state);

        case "delete":
          return removeCommentFromTree(state, action.deletedComment!.commentId);

        default:
          return state;
      }
    }
  );

  // 🆕 SOCKET CONNECTION SETUP
  useEffect(() => {
    if (!user) return;

    console.log(`💬 Setting up socket for post ${postId}`);

    const newSocket = io(SOCKET_SERVER_URL, {
      query: { userId: user.id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log(`✅ Connected to socket server for post ${postId}`);
      // Join the post room
      newSocket.emit("joinPost", { postId });
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
    });

    // 🆕 LISTEN FOR TYPING UPDATES
    newSocket.on(
      "typingUpdate",
      (data: { postId: number; typingUsers: string[] }) => {
        if (data.postId === postId) {
          console.log(`⌨️ Typing update for post ${postId}:`, data.typingUsers);
          // Filter out current user from typing list
          const otherUsers = data.typingUsers.filter(
            (u) => u !== user.username
          );
          setTypingUsers(otherUsers);
        }
      }
    );

    setSocket(newSocket);

    return () => {
      console.log(`🔌 Cleaning up socket for post ${postId}`);
      newSocket.emit("leavePost", { postId });
      newSocket.removeAllListeners();
      newSocket.disconnect();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user, postId, SOCKET_SERVER_URL]);

  // 🆕 HANDLE TYPING INDICATOR
  const handleTyping = useCallback(() => {
    if (!socket || !user || !user.username) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Emit typing started
    socket.emit("userTyping", {
      postId,
      username: user.username,
      isTyping: true,
    });

    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("userTyping", {
        postId,
        username: user.username,
        isTyping: false,
      });
    }, 3000);
  }, [socket, user, postId]);

  const handleLike = useCallback(
    (commentId: number) => {
      if (!user) return;

      const findComment = (
        comments: CommentWithUser[],
        id: number
      ): CommentWithUser | null => {
        for (const comment of comments) {
          if (comment.id === id) return comment;
          if (comment.replies) {
            const found = findComment(comment.replies, id);
            if (found) return found;
          }
        }
        return null;
      };

      const currentComment = findComment(optimisticComments, commentId);
      const isCurrentlyLiked =
        currentComment?.likes.some((like) => like.userId === user.id) || false;

      startTransition(() => {
        addOptimisticComment({
          type: "like",
          likedComment: { commentId, userId: user.id },
        });
      });

      likeComment(commentId, !isCurrentlyLiked).catch(console.error);
    },
    [user, addOptimisticComment, optimisticComments, startTransition]
  );

  const handleDeleteComment = useCallback(
    (commentId: number) => {
      startTransition(() => {
        addOptimisticComment({ type: "delete", deletedComment: { commentId } });
        deleteComment(commentId);
      });
    },
    [startTransition, addOptimisticComment]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!desc.trim() || !user || isCommenting) return;

      setIsCommenting(true);
      const newCommentId = Date.now();

      const newComment: CommentWithUser = {
        id: newCommentId,
        desc,
        postId,
        likes: [],
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: user.id,
          username: user.username || username || "Anonymous",
          avatar: user.imageUrl,
        },
        parentId: replyingTo || undefined,
      };

      addOptimisticComment({
        type: "add",
        newComment: newComment,
      });
      setDesc("");
      setReplyingTo(null);
      setIsCommenting(false);

      // 🆕 EMIT COMMENT SUBMITTED TO STOP TYPING INDICATOR
      if (socket) {
        socket.emit("commentSubmitted", { postId });
        socket.emit("userTyping", {
          postId,
          username: user.username,
          isTyping: false,
        });
      }

      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      startTransition(() => {
        if (replyingTo) {
          addReplyComment(postId, desc, replyingTo);
        } else {
          addComment(postId, desc);
        }
      });
    },
    [
      desc,
      user,
      postId,
      username,
      replyingTo,
      startTransition,
      addOptimisticComment,
      isCommenting,
      socket,
    ]
  );

  const nestedComments = buildCommentTree(optimisticComments);
  const commentsToDisplay = showAll
    ? nestedComments
    : nestedComments.slice(0, 3);
  const totalComments = nestedComments.length;
  const hasMoreComments = totalComments > 3;

  return (
    <>
      {user && (
        <div className="flex items-center gap-4 mb-2">
          <Link href={`/profile/${username}`}>
            <Image
              src={user.imageUrl || "/noAvatar.png"}
              alt="Profile"
              width={32}
              height={32}
              className="rounded-full w-8 h-8 ring-2 ring-orange-300 cursor-pointer"
            />
          </Link>
          <form
            onSubmit={handleSubmit}
            className="relative flex-1 bg-slate-100 rounded-xl mb-0.5 px-4 py-2 text-sm"
          >
            <input
              className="w-full pr-10 bg-transparent outline-none"
              type="text"
              placeholder={
                isCommenting ? "Posting comment..." : "Write a comment..."
              }
              value={desc}
              onChange={(e) => {
                setDesc(e.target.value);
                handleTyping(); // 🆕 TRIGGER TYPING INDICATOR
              }}
              disabled={isCommenting}
            />
            <button type="submit" disabled={isCommenting}>
              <SendHorizonal
                className={`absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer ${
                  isCommenting ? "text-gray-300" : "text-orange-300"
                }`}
              />
            </button>
          </form>
        </div>
      )}

      {/* 🆕 TYPING INDICATOR */}
      {typingUsers.length > 0 && (
        <div className="mb-4">
          <TypingIndicator usernames={typingUsers} />
        </div>
      )}

      {hasMoreComments && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline mb-2"
        >
          {showAll ? "Hide comments" : `Show all ${totalComments} comments`}
        </button>
      )}

      {commentsToDisplay.map((comment) => (
        <div key={comment.id} className="mb-2">
          <CommentItem
            comment={comment}
            user={user}
            handleLike={handleLike}
            setReplyingTo={setReplyingTo}
            replyingTo={replyingTo}
            isPending={isPending}
            addOptimisticComment={addOptimisticComment}
            startTransition={startTransition}
            handleDeleteComment={handleDeleteComment}
            depth={0}
          />
        </div>
      ))}
    </>
  );
}

export default CommentList;
