import FriendRequestList from "@/components/FriendRequestList";
import { Prisma } from "@/generated/prisma";
import prisma from "@/lib/client";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type RequestWithUser = Prisma.FollowRequestGetPayload<{
  include: { sender: true };
}>;

export default async function RequestPage() {
  const user = await currentUser();
  const currentUserId = user?.id;

  if (!currentUserId) {
    redirect("/sign-in");
  }

  const requests: RequestWithUser[] = await prisma.followRequest.findMany({
    where: { receiverId: currentUserId },
    include: { sender: true },
  });

  return (
    <div className="flex flex-col items-center min-h-screen bg-rose-50 dark:bg-gray-900 p-4 sm:p-6 md:p-8 transition-colors duration-300">
      <div className="w-full max-w-lg md:max-w-xl lg:max-w-2xl">
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-800 dark:text-white">
          Friend Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
          You have{" "}
          <span className="font-semibold text-orange-500 dark:text-white">
            {requests.length}
          </span>{" "}
          incoming requests.
        </p>

        {requests.length > 0 ? (
          <div className="w-full p-5 bg-rose-100 dark:bg-gray-800 rounded-xl shadow-md flex flex-col gap-4 max-h-[70vh] overflow-y-auto transition-colors duration-300">
            <FriendRequestList requests={requests} />
          </div>
        ) : (
          <div className="w-full p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md text-center text-gray-500 dark:text-gray-400 text-lg transition-colors duration-300">
            You have no new friend requests.
          </div>
        )}
      </div>
    </div>
  );
}
