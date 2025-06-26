import Image from "next/image";
import React from "react";
import {
  EllipsisVertical,
  HandHeart,
  MessageSquareText,
  ExternalLink,
} from "lucide-react";
import Comments from "./Comments";

function Post() {
  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            alt="Profile"
            width={40}
            height={40}
            className="w-10 h-10 object-cover cursor-pointer rounded-full ring-orange-200 ring-2"
          />
          <span className="font-medium cursor-pointer">Anna Ambroladze</span>
        </div>
        <EllipsisVertical className="text-gray-500 cursor-pointer" />
      </div>

      {/* Image */}
      <div className="relative w-full aspect-square rounded-md overflow-hidden">
        <Image
          className="object-cover"
          priority
          alt="Post Image"
          fill
          src="https://instagram.ftbs10-1.fna.fbcdn.net/v/t51.2885-15/500236192_18067474022073611_7520314698147683067_n.jpg?stp=dst-jpg_e35_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjc1NzYxLmRlZmF1bHRfaW1hZ2UifQ&_nc_ht=instagram.ftbs10-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2QGoLPMKsJZcSt00pOs80HrrskVfhWA9_aAhzdpbfAzV6CDi-EgPnc7m3yQrdgvORsY&_nc_ohc=xb0sHFc4U90Q7kNvwGfvyj2&_nc_gid=98D4iT8Wf62BcqQEJxJATQ&edm=APs17CUBAAAA&ccb=7-5&ig_cache_key=MzY0MDUwNTk2MTE1OTkzNDI2NA%3D%3D.3-ccb7-5&oh=00_AfPhbFdRFfMSJ2q1CSRUkDST7B518MV8JMZSJWu6Tgw3Ww&oe=686228B8&_nc_sid=10d13b"
        />
      </div>

      {/* Caption */}
      <p className="text-sm leading-relaxed text-gray-800 px-1">
        <span className="font-semibold">|anna_ambroladze|</span> love my bf more
        than words can say. He makes me feel safe, seen, and endlessly loved.
        I’m so lucky to have someone like him by my side and he feels same
        wayyy.
      </p>

      {/* Reactions */}
      <div className="flex items-center justify-between text-sm my-2">
        {/* Left side: Likes and Comments */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
            <HandHeart className="cursor-pointer text-red-400" />
            <span className="text-gray-700">
              123{" "}
              <span className="hidden md:inline cursor-pointer">| Likes</span>
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
            <MessageSquareText className="cursor-pointer text-blue-400" />
            <span className="text-gray-700">
              23{" "}
              <span className="hidden md:inline cursor-pointer">
                | Comments
              </span>
            </span>
          </div>
        </div>

        {/* Right side: Share */}
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
          <ExternalLink className="cursor-pointer text-green-500" />
          <span className="text-gray-700">
            3 <span className="hidden md:inline cursor-pointer">| Shares</span>
          </span>
        </div>
      </div>
      <Comments></Comments>
    </div>
  );
}

export default Post;
