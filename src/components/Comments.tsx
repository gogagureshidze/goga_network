import Image from "next/image";
import React from "react";
import { Smile, Ellipsis, HandHeart } from "lucide-react";

function Comments() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <Image
          src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
          alt="Profile"
          width={32}
          height={32}
          className="rounded-full  w-8 h-8 ring-2 ring-orange-300 cursor-pointer"
        />
        <div className="relative flex-1 bg-slate-100 rounded-xl px-4 py-2 text-sm">
          <input
            className="w-full pr-10 bg-transparent outline-none"
            type="text"
            placeholder="Write a comment..."
          />
          <Smile className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-300 cursor-pointer" />
        </div>
      </div>

      <div className="shadow-md px-2 py-[5px]">
        <div className="flex gap-4 justify-between mt-6">
          <Image
            src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            alt="Profile"
            width={40}
            height={40}
            className="rounded-full w-10 h-10 ring-2 ring-orange-300 cursor-pointer"
          />
          <div className="flex flex-col gap-2 flex-1">
            <span className="font-medium cursor-pointer">Anna Ambroladze</span>
            <p>
              Lorem ipsum dolor sit, amet consectetur adipisicing elit. Beatae
              repudiandae fuga quos, velit, doloremque dolorem saepe, placeat
              fugiat inventore sequi suscipit repellendus ad sunt quas non
              adipisci? Hic, id dignissimos!
            </p>
            <div className="flex items-center gap-8 text-xs text-gray-500 mt-2">
              <div className="flex items-center gap-4">
                <HandHeart className="cursor-pointer w-5 h-5 text-red-400" />
                <span className="text-gray-300">|</span>
                <span className="text-gray-500 cursor-pointer">34 Likes</span>
              </div>
              <div className="cursor-pointer">Reply</div>
            </div>
          </div>
          <Ellipsis className="w-5 h-5 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}

export default Comments;
