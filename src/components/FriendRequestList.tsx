"use client";

import Image from "next/image";
import { SquareCheckBig, SquareX } from "lucide-react";
import type { RequestWithUser } from "./FriendRequests"; // Assuming this path is correct
import { useOptimistic, useState } from "react";
import acceptFollowReq from "@/actions/acceptFollowReq";
import declineFollowReq from "@/actions/declineFollowReq";
import Link from "next/link";

function FriendRequestList({ requests }: { requests: RequestWithUser[] }) {
  const [requestState, setRequestState] = useState(requests);

  const [optimisticRequests, removedOptimisticRequests] = useOptimistic(
    requestState,
    (state, value: number) => state.filter((req) => req.id !== value)
  );

  const accept = async (requestId: number, userId: string) => {
    removedOptimisticRequests(requestId);

    try {
      await acceptFollowReq(userId);
      setRequestState((prev) =>
        prev.filter((request) => request.id !== requestId)
      );
    } catch (error) {
      console.log(error);
    }
  };

  const decline = async (requestId: number, userId: string) => {
    removedOptimisticRequests(requestId);

    try {
      await declineFollowReq(userId);
      setRequestState((prev) =>
        prev.filter((request) => request.id !== requestId)
      );
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <>
      {optimisticRequests.map((request) => (
        <div
          className="flex items-center justify-between p-4 rounded-lg hover:bg-rose-200/50 dark:hover:bg-gray-700/50 transition-colors duration-200"
          key={request.id}
        >
          <Link href={`/profile/${request.sender.username}`}>
            <div className="flex items-center gap-4">
              <Image
                src={request.sender.avatar || "/noAvatar.png"}
                alt={request.sender.username || "User"}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover cursor-pointer border-2 border-orange-300 dark:border-gray-600 transition-colors"
              />
              <span className="font-semibold cursor-pointer text-gray-900 dark:text-white">
                {request.sender.username}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3 justify-end">
            <form action={() => accept(request.id, request.senderId)}>
              <button>
                <SquareCheckBig className="w-8 h-8 text-green-600 hover:text-green-700 dark:hover:text-green-500 transition-colors cursor-pointer" />
              </button>
            </form>

            <form action={() => decline(request.id, request.senderId)}>
              <button>
                <SquareX className="w-8 h-8 text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer" />
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}

export default FriendRequestList;
