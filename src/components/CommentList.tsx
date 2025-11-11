"use client";

import { useUser } from "@clerk/nextjs";
import { Heart, SendHorizonal, MoreVertical } from "lucide-react";
import Image from "next/image";
import { useState, useCallback, memo, useEffect, useRef } from "react";
import CommentActivityModal from "./CommentActivityModal";
import { addComment } from "../actions/createComment";
import { addReplyComment } from "../actions/addReplyComment";
import { likeComment } from "../actions/likeComment";
import { deleteComment } from "../actions/deleteComment";
import Link from "next/link";
import { io, Socket } from "socket.io-client";

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

const TypingIndicator = memo(function TypingIndicator({
  usernames,
}: {
  usernames: string[];
}) {
  if (usernames.length === 0) return null;

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
    displayText = `${displayUsernames[0]}, ${displayUsernames[1]}, ${
      displayUsernames[2]
    }, and ${remainingCount} ${
      remainingCount === 1 ? "other is" : "others are"
    } typing`;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse py-2 transition-colors">
      <div className="flex gap-1">
        <span
          className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        ></span>
        <span
          className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        ></span>
        <span
          className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        ></span>
      </div>
      <span>{displayText}</span>
    </div>
  );
});

const CommentItem = memo(function CommentItem({
  comment,
  user,
  handleLike,
  setReplyingTo,
  replyingTo,
  handleDeleteComment,
  handleReplySubmit,
  depth = 0,
}: {
  comment: CommentWithUser;
  user: any;
  handleLike: (commentId: number) => void;
  setReplyingTo: (id: number | null) => void;
  replyingTo: number | null;
  handleDeleteComment: (commentId: number) => void;
  handleReplySubmit: (desc: string, parentId: number) => void;
  depth?: number;
}) {
  const hasLiked = comment.likes.some((like) => like.userId === user?.id);
  const isReplyingToThisComment = replyingTo === comment.id;
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const isCommentOwner = user?.id === comment.userId;

  const repliesToDisplay = showAllReplies
    ? comment.replies
    : comment.replies?.slice(0, 3);
  const hasMoreReplies = (comment.replies?.length || 0) > 3;

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
            className="rounded-full w-6 h-6 sm:w-7 sm:h-7 ring-2 ring-orange-200 dark:ring-orange-600"
          />
        </Link>
        <div className="bg-slate-100 dark:bg-gray-700 rounded-xl px-2 sm:px-3 py-2 text-sm flex-1 min-w-0 transition-colors">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link href={`/profile/${comment.user.username}`}>
              <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                {comment.user.username}
              </span>
            </Link>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-xs sm:text-sm break-words text-gray-800 dark:text-gray-200">
            {comment.desc}
          </p>
          <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <button
              onClick={() => handleLike(comment.id)}
              className="flex items-center gap-1 transition-colors"
            >
              <Heart
                className={`cursor-pointer transition-all duration-200 ${
                  hasLiked
                    ? "text-red-500 fill-red-500 scale-110"
                    : "text-gray-400 dark:text-gray-500 hover:text-red-400 hover:scale-105"
                }`}
                size={12}
              />
              <span
                className={
                  hasLiked
                    ? "text-red-500 dark:text-red-400 font-medium"
                    : "text-gray-500 dark:text-gray-400"
                }
              >
                {comment.likes?.length || 0}
              </span>
            </button>
            <button
              className="hover:underline transition-colors"
              onClick={() =>
                setReplyingTo(isReplyingToThisComment ? null : comment.id)
              }
            >
              Reply
            </button>
          </div>
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MoreVertical
              size={16}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg dark:shadow-gray-900/50 py-1 z-10 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowActivityModal(true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <Heart size={14} /> Activity
              </button>

              {isCommentOwner && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700"></div>
                  <button
                    onClick={() => {
                      handleDeleteComment(comment.id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
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

      {showActivityModal && (
        <CommentActivityModal
          commentId={comment.id}
          onClose={() => setShowActivityModal(false)}
        />
      )}

      {isReplyingToThisComment && user && (
        <div
          className={`flex flex-col gap-2 mt-2 ${
            shouldIndent ? "ml-4 sm:ml-10" : "ml-0"
          } ${
            shouldIndent
              ? "border-l-2 border-gray-300 dark:border-gray-600 pl-2 sm:pl-4"
              : ""
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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
              className="rounded-full w-6 h-6 sm:w-7 sm:h-7 ring-2 ring-orange-300 dark:ring-orange-600 cursor-pointer flex-shrink-0"
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem(
                  "reply-input"
                ) as HTMLInputElement;
                const desc = input.value;
                if (!desc.trim()) return;

                handleReplySubmit(desc, comment.id);
                input.value = "";
                setReplyingTo(null);
              }}
              className="relative flex-1 bg-slate-100 dark:bg-gray-700 rounded-xl px-3 sm:px-4 py-2 text-sm min-w-0 transition-colors"
            >
              <input
                className="w-full pr-8 sm:pr-10 bg-transparent outline-none text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                type="text"
                name="reply-input"
                placeholder="Reply..."
              />
              <button
                type="submit"
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2"
              >
                <SendHorizonal className="cursor-pointer w-4 h-4 sm:w-5 sm:h-5 text-orange-300 dark:text-orange-400" />
              </button>
            </form>
          </div>
        </div>
      )}

      {repliesToDisplay && repliesToDisplay.length > 0 && (
        <div
          className={`${shouldIndent ? "pl-4 sm:pl-8" : "pl-0"} mt-2 ${
            shouldIndent
              ? "border-l-2 border-gray-300 dark:border-gray-600"
              : ""
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
                handleDeleteComment={handleDeleteComment}
                handleReplySubmit={handleReplySubmit}
                depth={depth + 1}
              />
            </div>
          ))}
          {hasMoreReplies && (
            <button
              onClick={() => setShowAllReplies(!showAllReplies)}
              className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:underline mt-2 transition-colors"
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

function CommentList({
  comments: initialComments,
  postId,
  username,
  onCommentAdded,
  onCommentDeleted,
}: {
  comments: CommentWithUser[];
  postId: number;
  username: string | null | undefined;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}) {
  const { user } = useUser();
  const [desc, setDesc] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  // LOCAL STATE - this is the source of truth
  const [comments, setComments] = useState<CommentWithUser[]>(initialComments);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const SOCKET_SERVER_URL =
    process.env.NODE_ENV === "production"
      ? "wss://socket.goga.network"
      : "http://localhost:3001";

  useEffect(() => {
    if (!user) return;

    const newSocket = io(SOCKET_SERVER_URL, {
      query: { userId: user.id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      newSocket.emit("joinPost", { postId });
    });

    newSocket.on(
      "typingUpdate",
      (data: { postId: number; typingUsers: string[] }) => {
        if (data.postId === postId) {
          const otherUsers = data.typingUsers.filter(
            (u) => u !== user.username
          );
          setTypingUsers(otherUsers);
        }
      }
    );

    setSocket(newSocket);

    return () => {
      newSocket.emit("leavePost", { postId });
      newSocket.removeAllListeners();
      newSocket.disconnect();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user, postId, SOCKET_SERVER_URL]);

  const handleTyping = useCallback(() => {
    if (!socket || !user || !user.username) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socket.emit("userTyping", {
      postId,
      username: user.username,
      isTyping: true,
    });

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

      // Update UI immediately
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === commentId) {
            const hasLiked = comment.likes.some(
              (like) => like.userId === user.id
            );
            const newLikes = hasLiked
              ? comment.likes.filter((like) => like.userId !== user.id)
              : [...comment.likes, { userId: user.id }];
            return { ...comment, likes: newLikes };
          }
          return comment;
        })
      );

      // Find current state for server
      const currentComment = comments.find((c) => c.id === commentId);
      const isCurrentlyLiked = currentComment?.likes.some(
        (like) => like.userId === user.id
      );

      // Send to server
      likeComment(commentId, !isCurrentlyLiked).catch((err) => {
        console.error("Like failed:", err);
        // Revert on error
        setComments((prev) =>
          prev.map((comment) => {
            if (comment.id === commentId) {
              return currentComment || comment;
            }
            return comment;
          })
        );
      });
    },
    [user, comments]
  );

  const handleDeleteComment = useCallback(
    (commentId: number) => {
      // Update UI immediately
      setComments((prev) => {
        const findAllChildren = (parentId: number): number[] => {
          const children = prev
            .filter((c) => c.parentId === parentId)
            .map((c) => c.id);
          return [
            ...children,
            ...children.flatMap((childId) => findAllChildren(childId)),
          ];
        };
        const idsToRemove = [commentId, ...findAllChildren(commentId)];

        // ✅ DECREMENT COUNTER FOR EACH COMMENT REMOVED
        if (onCommentDeleted) {
          idsToRemove.forEach(() => onCommentDeleted());
        }

        return prev.filter((c) => !idsToRemove.includes(c.id));
      });

      // Send to server
      deleteComment(commentId).catch((err) => {
        console.error("Delete failed:", err);
      });
    },
    [onCommentDeleted]
  );

  const handleReplySubmit = useCallback(
    async (desc: string, parentId: number) => {
      if (!user) return;

      const tempId = -Date.now();
      const tempComment: CommentWithUser = {
        id: tempId,
        desc,
        postId,
        likes: [],
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: user.id,
          username: user.username || "Anonymous",
          avatar: user.imageUrl,
        },
        parentId,
      };

      // Add temp comment immediately
      setComments((prev) => [tempComment, ...prev]);

      // ✅ INCREMENT COUNTER FOR REPLIES TOO
      if (onCommentAdded) {
        onCommentAdded();
      }

      try {
        // Send to server and get real comment back
        const realComment = await addReplyComment(postId, desc, parentId);

        // Replace temp comment with real one
        setComments((prev) =>
          prev.map((c) =>
            c.id === tempId ? { ...realComment, user: tempComment.user } : c
          )
        );
      } catch (err) {
        console.error("Reply failed:", err);
        // Remove failed comment
        setComments((prev) => prev.filter((c) => c.id !== tempId));
      }
    },
    [user, postId, onCommentAdded]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!desc.trim() || !user) return;

      const tempId = -Date.now();
      const tempComment: CommentWithUser = {
        id: tempId,
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
        parentId: null,
      };

      // Add temp comment immediately
      setComments((prev) => [tempComment, ...prev]);
      setDesc("");

      // ✅ INCREMENT THE COUNTER IMMEDIATELY
      if (onCommentAdded) {
        onCommentAdded();
      }

      if (socket) {
        socket.emit("commentSubmitted", { postId });
        socket.emit("userTyping", {
          postId,
          username: user.username,
          isTyping: false,
        });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      try {
        // Send to server and get real comment back
        const realComment = await addComment(postId, desc);

        // Replace temp comment with real one
        setComments((prev) =>
          prev.map((c) =>
            c.id === tempId ? { ...realComment, user: tempComment.user } : c
          )
        );
      } catch (err) {
        console.error("Comment failed:", err);
        // Remove failed comment
        setComments((prev) => prev.filter((c) => c.id !== tempId));
      }
    },
    [desc, user, postId, username, socket, onCommentAdded]
  );

  // Build tree from flat list
  const nestedComments = buildCommentTree(comments);
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
              className="rounded-full w-8 h-8 ring-2 ring-orange-300 dark:ring-orange-600 cursor-pointer"
            />
          </Link>
          <form
            onSubmit={handleSubmit}
            className="relative flex-1 bg-slate-100 dark:bg-gray-700 rounded-xl mb-0.5 px-4 py-2 text-sm transition-colors"
          >
            <input
              className="w-full pr-10 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              type="text"
              placeholder="Write a comment..."
              value={desc}
              onChange={(e) => {
                setDesc(e.target.value);
                handleTyping();
              }}
            />
            <button type="submit">
              <SendHorizonal className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-orange-300 dark:text-orange-400" />
            </button>
          </form>
        </div>
      )}

      {typingUsers.length > 0 && (
        <div className="mb-4">
          <TypingIndicator usernames={typingUsers} />
        </div>
      )}

      {hasMoreComments && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:underline mb-2 transition-colors"
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
            handleDeleteComment={handleDeleteComment}
            handleReplySubmit={handleReplySubmit}
            depth={0}
          />
        </div>
      ))}
    </>
  );
}

export default CommentList;
