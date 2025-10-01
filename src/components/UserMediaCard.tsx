import { User } from "@/generated/prisma";
import prisma from "@/lib/client";
import Image from "next/image";
import Link from "next/link";
import React from "react";

type UserMediaCardProps = {
  user?: User;
  username?: string;
};
async function UserMediaCard({ user, username }:   UserMediaCardProps) {
  if (!user) return null;
  // fetch posts with media, limiting total media items to 8
  const postsWithMedia = await prisma.post.findMany({
    where: {
      userId: user.id,
      media: {
        some: {}, // at least one media item exists
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      media: {
        where: {
          type: "photo", // only photos
        },
        take: 8, // limit media per post
      },
    },
  });

  // flatten all media from posts into a single array (limit total to 8)
  const allMedia = postsWithMedia.flatMap((post) => post.media).slice(0, 8);

  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500">User Media</span>
        <Link
          href={`/media`}
          className="text-orange-300 text-sm hover:underline"
        >
          See all
        </Link>
      </div>

      {allMedia.length > 0 ? (
        <div className="flex gap-2 justify-start flex-wrap">
          {allMedia.map((media) => (
            <div key={media.id} className="relative w-[19%] aspect-square">
              <Image
                src={media.url}
                alt="User post media"
                fill
                className="object-cover rounded-md"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400">No media posts available.</p>
      )}
    </div>
  );
}

export default UserMediaCard;
