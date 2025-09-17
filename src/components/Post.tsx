// app/components/Post.tsx
import Image from "next/image";
import MediaGrid from "./MediaGrid";
import Link from "next/link";
import PostInfo from "./PostInfo";
import Comments from "./Comments";
import PostInteractions from "./PostInteractions";

export default function Post({ post }: { post: any }) {
  console.log(post.user.avatar, 'KIUKLLKEAikhd')
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
        <PostInfo postId={post.id} postOwnerId={post.userId} />
      </div>

      {/* Caption */}
      {post.desc && (
        <p className="text-sm leading-relaxed text-gray-800 px-1">
          {post.desc}
        </p>
      )}

      <MediaGrid media={post.media} />
      <PostInteractions
        postId={post.id}
        likes={post.likes}
        commentNumber={post._count?.comments || 0}
      />
      <Comments postId={post.id} />
    </div>
  );
}
