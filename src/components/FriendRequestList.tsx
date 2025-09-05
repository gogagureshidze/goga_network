"use client";

import Image from "next/image";
import { SquareCheckBig, SquareX } from "lucide-react";
import type { RequestWithUser } from "./FriendRequests";
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
      console.log(error)
    }

  }

    const decline = async (requestId: number, userId: string) => {
      removedOptimisticRequests(requestId);

      try {
        await declineFollowReq(userId);
        setRequestState((prev) =>
          prev.filter((request) => request.id !== requestId)
        );
      } catch (error) {
        console.log(error)
      }
    };
  return (
    <>
      {optimisticRequests.map((request) => (
        <div className="flex items-center justify-between" key={request.id}>
          <Link href={`/profile/${request.sender.username}`}>
            <div className="flex items-center gap-4">
              <Image
                src={request.sender.avatar || "/noAvatar.png"}
                alt={request.sender.username || "User"}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover cursor-pointer"
              />
              <span className="font-semibold cursor-pointer">
                {request.sender.username}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3 justify-end">
            <form action={() => accept(request.id, request.senderId)}>
              <button>
                <SquareCheckBig className="w-8 h-8 text-green-600 cursor-pointer" />
              </button>
            </form>

            <form action={() => decline(request.id, request.senderId)}>
              <button>
                <SquareX className="w-8 h-8 text-red-500 cursor-pointer" />
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}

export default FriendRequestList;
