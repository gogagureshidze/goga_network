import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { SquareCheckBig, SquareX } from "lucide-react";

function FriendRequests() {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500">Friend Requests</span>
        <Link href={"/"} className="text-orange-300 text-sm">
          See all
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image
            src={
              "https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            }
            alt=""
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cove cursor-pointer"
          ></Image>
          <span className="font-semibold cursor-pointer cursor-pointer">
            Goga Gureshidze
          </span>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <SquareCheckBig className="w-8 h-8 text-green-600 cursor-pointer" />
          <SquareX className="w-8 h-8 text-red-500 cursor-pointer" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image
            src={
              "https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            }
            alt=""
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover cursor-pointer"
          ></Image>
          <span className="font-semibold cursor-pointer">Mate Diakonidze</span>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <SquareCheckBig className="w-8 h-8 text-green-600 cursor-pointer" />
          <SquareX className="w-8 h-8 text-red-500 cursor-pointer" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image
            src={
              "https://static.wikia.nocookie.net/sanrio/images/9/9f/Hello_Kitty.jpg/revision/latest/scale-to-width-down/1200?cb=20191128154539"
            }
            alt=""
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover cursor-pointer"
          ></Image>
          <span className="font-semibold cursor-pointer">Zaal Chkheidze</span>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <SquareCheckBig className="w-8 h-8 text-green-600 cursor-pointer" />
          <SquareX className="w-8 h-8 text-red-500 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}

export default FriendRequests