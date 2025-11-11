import { memo, useContext, useState, useEffect } from "react";
import Image from "next/image";
import MediaGrid from "./MediaGrid";
import Link from "next/link";
import PostInfo from "./PostInfo";
import PostInteractions from "./PostInteractions";
import EventCard from "./EventCard";
import PollCard from "./PollCard";
import PostDescription from "./PostDescription";
import ActivityStatus from "./ActivityStatus";
import Comments from "./Comments";
import { CommentContext } from "./Observer";

// Helper function to format time
function formatTimeAgo(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w`;
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// Post component with React.memo for optimal performance
const PostComponent = ({ post }: { post: any }) => {
  const { openComments, toggleComments } = useContext(CommentContext);
  const isCommentsOpen = openComments.has(post.id);

  // Track comment count locally
  const [commentCount, setCommentCount] = useState(post._count?.comments || 0);

  const isEventPost = !!post.event;
  const isPollPost = !!post.poll;
  const taggedUsernames = post.tags?.map((tag: any) => tag.user.username) || [];
  const taggedUserIds = post.tags?.map((tag: any) => tag.userId) || [];

  const showActivity = post.user?.showActivityStatus && post.user?.lastActiveAt;

  // Increment counter when comment added
  const handleCommentAdded = () => {
    setCommentCount((prev: number) => prev + 1);
  };

  // Decrement counter when comment deleted
  const handleCommentDeleted = () => {
    setCommentCount((prev: number) => Math.max(0, prev - 1));
  };

  // Sync with server data on prop change
  useEffect(() => {
    setCommentCount(post._count?.comments || 0);
  }, [post._count?.comments]);

  return (
    <div className="flex flex-col gap-4 p-4 mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href={`/profile/${post.user?.username}`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Image
                src={post.user?.avatar || "/noAvatar.png"}
                alt="Profile"
                width={40}
                height={40}
                className="w-10 h-10 object-cover cursor-pointer rounded-full ring-orange-200 dark:ring-orange-600 ring-2 transition-all"
              />
            </div>

            <div className="flex flex-col">
              <span className="font-medium cursor-pointer text-gray-900 dark:text-gray-100 transition-colors">
                {post.user?.username}
              </span>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTimeAgo(post.createdAt)}
                </span>
                {showActivity && (
                  <>
                    <span className="text-xs text-gray-400 dark:text-gray-600">
                      •
                    </span>
                    <ActivityStatus
                      lastActiveAt={post.user.lastActiveAt}
                      size="sm"
                      showText={true}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </Link>
        <PostInfo
          taggedUserIds={taggedUserIds}
          postId={post.id}
          postOwnerId={post.userId}
        />
      </div>

      {/* Post Description */}
      {post.desc && (
        <PostDescription text={post.desc} taggedUsernames={taggedUsernames} />
      )}

      {/* Post Content */}
      {isPollPost ? (
        <PollCard poll={post.poll} />
      ) : isEventPost ? (
        <EventCard event={post.event} />
      ) : (
        <MediaGrid media={post.media} />
      )}

      {/* Post Interactions */}
      <PostInteractions
        postId={post.id}
        likes={post.likes}
        commentNumber={commentCount}
        onToggleComments={() => toggleComments(post.id)}
        isCommentsOpen={isCommentsOpen}
      />

      {/* Comments - Only show when toggled */}
      {isCommentsOpen && (
        <Comments
          postId={post.id}
          onCommentAdded={handleCommentAdded}
          onCommentDeleted={handleCommentDeleted}
        />
      )}
    </div>
  );
};

// Custom comparison function for better memo performance
const areEqual = (prevProps: { post: any }, nextProps: { post: any }) => {
  // Only re-render if the post ID or key data changes
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.likes?.length === nextProps.post.likes?.length &&
    prevProps.post._count?.comments === nextProps.post._count?.comments
  );
};

// Export memoized component with custom comparison
export default memo(PostComponent, areEqual);
