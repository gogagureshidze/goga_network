import React from "react";
import ProfileCard from "./ProfileCard";
import Link from "next/link";
import Image from "next/image";
import Ad from "./Ad";
import { currentUser } from "@clerk/nextjs/server";
import {
  Images,
  Video,
  Album,
  Users,
  MessageCircle,
  Settings,
} from "lucide-react";

async function LeftMenu({ type }: { type: "home" | "profile" }) {
  const user = await currentUser();
  const userId = user?.id;
  return (
    <div className="flex flex-col gap-6">
      {type === "home" && <ProfileCard />}
      <div className="p-4 bg-white dark:bg-gray-800 text-sm rounded-lg shadow-md dark:shadow-gray-900/50 text-gray-500 dark:text-gray-400 flex flex-col gap-2 border border-gray-100 dark:border-gray-700 transition-colors">
        <Link
          href={`/media/${userId}`}
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <Images className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
          <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
            My Media
          </span>
        </Link>
        <hr className="border-t-1 border-gray-100 dark:border-gray-700 w-36 self-center" />

        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <Video className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
          <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
            Videos
          </span>
        </Link>
        <hr className="border-t-1 border-gray-100 dark:border-gray-700 w-36 self-center" />

        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <Album className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
          <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
            Albums
          </span>
        </Link>
        <hr className="border-t-1 border-gray-100 dark:border-gray-700 w-36 self-center" />

        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <Users className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
          <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
            Groups
          </span>
        </Link>
        <hr className="border-t-1 border-gray-100 dark:border-gray-700 w-36 self-center" />

        <Link
          href="/"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <MessageCircle className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
          <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
            Messages
          </span>
        </Link>
        <hr className="border-t-1 border-gray-100 dark:border-gray-700 w-36 self-center" />

        <Link
          href="/settings"
          className="flex items-center gap-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors group"
        >
          <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
          <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
            Settings
          </span>
        </Link>
        <hr className="border-t-1 border-gray-100 dark:border-gray-700 w-36 self-center" />
      </div>
      <Ad size="sm"></Ad>
    </div>
  );
}

export default LeftMenu;
