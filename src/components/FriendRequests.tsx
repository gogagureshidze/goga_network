import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/client";
import FriendRequestList from "./FriendRequestList";
import type { Prisma } from "@/generated/prisma";

export type RequestWithUser = Prisma.FollowRequestGetPayload<{
  include: { sender: true };
}>;

async function FriendRequests() {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) return null;

  const requests: RequestWithUser[] = await prisma.followRequest.findMany({
    where: { receiverId: currentUserId },
    include: { sender: true },
  });

  if (!requests.length) return null;

  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 dark:bg-gray-800 transition-colors duration-300">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500 dark:text-gray-400">
          Friend Requests
        </span>
        <Link
          href="/requests"
          className="text-orange-500 dark:text-white text-sm"
        >
          See all
        </Link>
      </div>

      <FriendRequestList requests={requests} />
    </div>
  );
}

export default FriendRequests;
