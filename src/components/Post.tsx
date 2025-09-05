import Image from "next/image";
import MediaGrid from "./MediaGrid";
import PostInteractions from "./PostInteractions";
import Comments from "./Comments"; // Server Component
import Link from "next/link";
import { Suspense } from "react";
import PostInfo from "./PostInfo";

function Post({ post }: { post: any }) {
  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href={`/profile/${post.user?.username}`}>
          <div className="flex items-center gap-4">
            <Image
              src={post.user?.avatar || "/noAvatar.png"}
              alt="Profile"
              width={40}
              height={40}
              className="w-10 h-10 object-cover cursor-pointer rounded-full ring-orange-200 ring-2"
            />
            <span className="font-medium cursor-pointer">
              {post.user?.username}
            </span>
          </div>
        </Link>

        {/* ✅ pass post owner ID */}
        <PostInfo postId={post.id} postOwnerId={post.userId} />
      </div>

      {/* Caption */}
      {post.desc && (
        <p className="text-sm leading-relaxed text-gray-800 px-1">
          {post.desc}
        </p>
      )}

      <Suspense fallback={<p>Loading...</p>}>
        {/* Media */}
        <MediaGrid media={post.media} />

        {/* Reactions */}
        <PostInteractions
          postId={post.id}
          likes={post.likes?.map((l: { userId: string }) => l.userId) || []}
          commentNumber={post._count?.comments || 0}
        />

        {/* Comments */}
        <Comments postId={post.id} />
      </Suspense>
    </div>
  );
}

export default Post;
