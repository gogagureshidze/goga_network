import Image from 'next/image'
import React from 'react'

function Stories() {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md overflow-scroll text-sm scrollbar-hide">
      <div className="flex gap-8 w-max">
        <div className="flex flex-col items-center gap-2 cursor-pointer">
          <Image
            src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            alt=""
            width={80}
            height={80}
            className="w-20 h-20 rounded-full ring-2"
          />
          <span className="font-medium">Anna</span>
        </div>

        <div className="flex flex-col items-center gap-2 cursor-pointer">
          <Image
            src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            alt=""
            width={80}
            height={80}
            className="w-20 h-20 rounded-full ring-2"
          />
          <span className="font-medium">Anna</span>
        </div>

        <div className="flex flex-col items-center gap-2 cursor-pointer">
          <Image
            src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            alt=""
            width={80}
            height={80}
            className="w-20 h-20 rounded-full ring-2"
          />
          <span className="font-medium">Anna</span>
        </div>

        <div className="flex flex-col items-center gap-2 cursor-pointer">
          <Image
            src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            alt=""
            width={80}
            height={80}
            className="w-20 h-20 rounded-full ring-2"
          />
          <span className="font-medium">Anna</span>
        </div>

        <div className="flex flex-col items-center gap-2 cursor-pointer">
          <Image
            src="https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            alt=""
            width={80}
            height={80}
            className="w-20 h-20 rounded-full ring-2"
          />
          <span className="font-medium">Anna</span>
        </div>
      </div>
    </div>
  );
}

export default Stories