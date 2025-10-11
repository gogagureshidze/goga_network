import React from "react";
import ProfileCard from "./ProfileCard";
import Link from "next/link";
import Image from "next/image";
import Ad from "./Ad";
import { currentUser } from "@clerk/nextjs/server";

async function LeftMenu({ type }: { type: "home" | "profile" }) {
  const user = await currentUser();
  const userId = user?.id;
  return (
    <div className="flex flex-col gap-6">
      {type === "home" && <ProfileCard />}
      <div className="p-4 bg-white text-sm rounded-lg shadow-md text-gray-500 flex flex-col gap-2">
        <Link
          href={`/media/${userId}`}
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100"
        >
          <Image src="/posts.png" alt="" height={20} width={20}></Image>
          <span className="">My Media</span>
        </Link>
        <hr className="border-t-1 border-gray-50 w-36 self-center" />
        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100"
        >
          <Image src="/videos.png" alt="" height={20} width={20}></Image>
          <span className="">Videos</span>
        </Link>
        <hr className="border-t-1 border-gray-50 w-36 self-center" />
        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100"
        >
          <Image src="/albums.png" alt="" height={20} width={20}></Image>
          <span className="">Albums</span>
        </Link>
        <hr className="border-t-1 border-gray-50 w-36 self-center" />

        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100"
        >
          <Image src="/groups.png" alt="" height={20} width={20}></Image>
          <span className="">Groups</span>
        </Link>
        <hr className="border-t-1 border-gray-50 w-36 self-center" />
        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100"
        >
          <Image src="/people.png" alt="" height={20} width={20}></Image>
          <span className="">Messagas</span>
        </Link>
        <hr className="border-t-1 border-gray-50 w-36 self-center" />
        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100"
        >
          <Image src="/settings.png" alt="" height={20} width={20}></Image>
          <span className="">Settings</span>
        </Link>
        <hr className="border-t-1 border-gray-50 w-36 self-center" />
      </div>
     <Ad size="sm"></Ad>
    </div>
  );
}

export default LeftMenu;
