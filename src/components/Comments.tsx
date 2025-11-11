"use client";

import { useEffect, useState } from "react";
import CommentList from "./CommentList";
import { fetchComments } from "../actions/fetchComments";

type CommentType = any;

// Loading Skeleton Component
const CommentSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>

        {/* Content skeleton */}
        <div className="flex-1 space-y-2">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-xl p-3 space-y-2">
            {/* Username and time */}
            <div className="flex items-center gap-2">
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
            </div>
            {/* Comment text */}
            <div className="space-y-1">
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-4 mt-2">
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-8"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const Comments = ({
  postId,
  onCommentAdded,
  onCommentDeleted,
}: {
  postId: number;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
  
}) => {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadComments = async () => {
      const { comments: fetchedComments, username: fetchedUsername } =
        await fetchComments(postId);
      setComments(fetchedComments);
      setUsername(fetchedUsername ?? undefined);
      setIsLoading(false);
    };

    loadComments();
  }, [postId]);

  if (isLoading) {
    return <CommentSkeleton />;
  }

  return (
    <div>
      <CommentList
        comments={comments}
        postId={postId}
        username={username}
        onCommentAdded={onCommentAdded}
        onCommentDeleted={onCommentDeleted}
      />
    </div>
  );
};

export default Comments;
