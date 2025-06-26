import Image from "next/image";
import React from "react";
import {
  SmilePlus,
  ImagePlus,
  Clapperboard,
  CalendarArrowUp,
  Vote,
} from "lucide-react";

function AddPost() {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md flex gap-4 justify-between text-sm">
      <Image
        src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
        alt=""
        width={40}
        height={40}
        className="cursor-pointer w-12 h-12 object-cover rounded-full ring-orange-200 ring-2"
      />

      <div className="flex-1">
        <div className="flex  gap-4 mb-2">
          <textarea
            placeholder="What is on your mind?"
            className="flex-1 p-2 bg-slate-100 rounded-lg"
            name=""
            id=""
          ></textarea>
          <SmilePlus className="w-6 h-6 self-end text-orange-300 cursor-pointer" />
        </div>

        <div className="flex items-center gap-4 mt-4 text-gray-400 flex-wrap">
          <div className="flex items-center gap-2 cursor-pointer text-green-600">
            <ImagePlus /> Photo
          </div>

          <div className="flex items-center gap-2 cursor-pointer text-blue-950">
            <Clapperboard />
            Video
          </div>

          <div className="flex items-center gap-2 cursor-pointer text-amber-400">
            <CalendarArrowUp />
            Event
          </div>

          <div className="flex items-center gap-2 cursor-pointer text-orange-600">
            <Vote />
            Poll
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddPost;
