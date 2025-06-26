import Image from 'next/image';
import React from 'react'
import { Cake } from "lucide-react";
import Link from 'next/link';

function Birthdays() {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 ">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500">Birthdays</span>
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
          <span className="font-semibold cursor-pointer">Goga Gureshidze</span>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button className="bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-all duration-200">
            🎉 Celebrate
          </button>
        </div>
      </div>

      <div className="p-4 bg-slate-100 rounded-lg flex items-center gap-4">
        <Cake className="w-10 h-10 text-rose-300 cursor-pointer" />
        <Link href="/" className="flex flex-col gap-1 text-xs">
          <span className="text-gray-700 font-semibold">
            Upcoming Birthdays
          </span>
          <span className="text-gray-500">See other 3 upcoming birthdays!</span>
        </Link>
      </div>
    </div>
  );
}

export default Birthdays