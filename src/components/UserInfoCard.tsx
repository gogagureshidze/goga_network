import Link from "next/link";
import React from "react";
import {
  MapPinHouse,
  University,
  BriefcaseBusiness,
  Cable,
  CalendarHeart,
} from "lucide-react";


function UserInfoCard({ userId }: { userId: string }) {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500">User Information</span>
        <Link href={"/"} className="text-orange-300 text-sm">
          See all
        </Link>
      </div>
      <div className="flex flex-col gap-4 text-grey-500">
        <div className="flex items-center gap-2">
          <span className="text-xl text-black">Anna Ambroladze</span>
          <span className="text-sm">Anuko</span>
        </div>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Magni sit
          ipsa ipsam voluptas vero, reprehenderit, sed accusamus sapiente
          nesciunt non distinctio assumenda porro aspernatur eius minima
          deserunt, eum deleniti. Inventore.a
        </p>
        <div className="flex items-center gap-2">
          <MapPinHouse className="text-green-500" />
          <span>
            Living in <b>London</b>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <University className="text-blue-500" />
          <span>
            Went to <b>KIU</b> University of Medicine
          </span>
        </div>

        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="text-yellow-900 font-bold" />
          <span>
            Works at <b>Harley Street Clinics</b>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 items-center">
            <Cable className="text-rose-500" />
            <Link href="/" className="underline text-rose-500 font-bold">
              anna_ambroladze
            </Link>
          </div>
        </div>
        <button className="bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-all duration-200">
          Follow
        </button>
        <div className="flex items-center justify-between">
          <span className="text-red-600 self-end text-xs cursor-pointer hover:underline">
            Block User!
          </span>
          <div>
            <div className="flex gap-1 items-center">
              <CalendarHeart className="text-rose-400" />
              <span className="text-xs">Joined November 2024</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserInfoCard;
