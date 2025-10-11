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
} from "react";
import { addComment } from "../actions/createComment";
import { addReplyComment } from "../actions/addReplyComment";
import { likeComment } from "../actions/likeComment";
import { deleteComment } from "../actions/deleteComment";
import Link from "next/link";

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
}) {
  const hasLiked = comment.likes.some((like) => like.userId === user?.id);
  const isReplyingToThisComment = replyingTo === comment.id;
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const isCommentOwner = user?.id === comment.userId;

  const repliesToDisplay = showAllReplies
    ? comment.replies
    : comment.replies?.slice(0, 3);
  const hasMoreReplies = (comment.replies?.length || 0) > 3;

  return (
    <>
      <div className="flex items-start gap-3 relative">
        <Link href={`/profile/${comment.user.username}`}>
          <Image
            src={comment.user.avatar || "/noAvatar.png"}
            alt={comment.user.username || "User"}
            width={28}
            height={28}
            className="rounded-full w-7 h-7"
          />
        </Link>
        <div className="bg-slate-100 rounded-xl px-3 py-2 text-sm flex-1">
          <Link href={`/profile/${comment.user.username}`}>
            <span className="font-semibold">{comment.user.username}</span>{" "}
          </Link>
          {comment.desc}
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
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
                size={14}
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

        {isCommentOwner && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1">
              <MoreVertical
                size={16}
                className="text-gray-500 hover:text-gray-700"
              />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-6 w-24 bg-white rounded-md shadow-lg py-1 z-10">
                <button
                  onClick={() => {
                    handleDeleteComment(comment.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isReplyingToThisComment && user && (
        <div className="flex flex-col gap-2 mt-2 ml-10 border-l-2 border-gray-300 pl-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Image
              src={comment.user.avatar || "/noAvatar.png"}
              alt="Profile"
              width={20}
              height={20}
              className="rounded-full w-5 h-5"
            />
            <span>Replying to {comment.user.username}</span>
          </div>
          <div className="flex items-center gap-4">
            <Image
              src={user.imageUrl || "/noAvatar.png"}
              alt="Profile"
              width={28}
              height={28}
              className="rounded-full w-7 h-7 ring-2 ring-orange-300 cursor-pointer"
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
              className="relative flex-1 bg-slate-100 rounded-xl px-4 py-2 text-sm"
            >
              <input
                className="w-full pr-10 bg-transparent outline-none"
                type="text"
                name="reply-input"
                placeholder={
                  isReplying
                    ? "Sending reply..."
                    : `Replying to ${comment.user.username}...`
                }
                disabled={isReplying}
              />
              <button type="submit" disabled={isReplying}>
                <SendHorizonal
                  className={`absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer ${
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
        <div className="pl-8 mt-2 border-l-2 border-gray-300">
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
              />
            </div>
          ))}
          {hasMoreReplies && (
            <button
              onClick={() => setShowAllReplies(!showAllReplies)}
              className="text-sm text-gray-500 hover:text-gray-700 hover:underline mt-2"
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

              // Check replies recursively
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

  // Replace your handleLike function with this fixed version:
  const handleLike = useCallback(
    (commentId: number) => {
      if (!user) return;

      // Get current like state for this comment
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

      // Wrap optimistic update in startTransition to fix the error
      startTransition(() => {
        addOptimisticComment({
          type: "like",
          likedComment: { commentId, userId: user.id },
        });
      });

      // Send the FINAL state to server (debounced on server side)
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
              onChange={(e) => setDesc(e.target.value)}
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
          />
        </div>
      ))}
    </>
  );
}

export default CommentList;
