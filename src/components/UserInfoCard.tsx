import Link from "next/link";
import React from "react";
import {
  MapPinHouse,
  University,
  BriefcaseBusiness,
  Cable,
} from "lucide-react";
import { User } from "@/generated/prisma";
import UserInfoCardInteraction from "./UserInfoCardInteraction";
import UpdateUser from "./UpdateUser";
import { currentUser } from "@clerk/nextjs/server";

type UserInfoCardProps = {
  user?: User & {
    _count?: {
      posts?: number;
      followers?: number;
      followings?: number;
    };
  };
  username: string;
  isOwner: boolean;
  isFollowing: boolean;
  isFollowingSent: boolean;
  isBlockedByViewer: boolean;
  hideInteraction?: boolean; // 👈 new prop to disable follow/block section
};

async function UserInfoCard({
  user,
  username,
  isOwner,
  isFollowing,
  isFollowingSent,
  isBlockedByViewer,
  hideInteraction = false,
}: UserInfoCardProps) {
  if (!user) {
    return null;
  }

  const loggedInUser = await currentUser();
  const currentUserId = loggedInUser?.id;

  const createdAtDate = new Date(user.createdAt);
  const formatedDate = createdAtDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4">
      <div className="flex items-center justify-between font-medium">
        <span className="text-gray-500">User Information</span>
        {isOwner ? (
          <UpdateUser user={user} />
        ) : (
          <></>
        )}
      </div>
      <div className="flex flex-col gap-4 text-gray-500">
        <div className="flex items-center gap-2">
          <span className="text-xl text-black">
            {user.name && user.surname
              ? user.name + " " + user.surname
              : username}
          </span>
          <span className="text-sm">{username}</span>
        </div>

        {user.description && <p>{user.description}</p>}

        {user.city && (
          <div className="flex items-center gap-2">
            <MapPinHouse className="text-green-500" />
            <span>
              Living in <b>{user.city}</b>
            </span>
          </div>
        )}

        {user.school && (
          <div className="flex items-center gap-2">
            <University className="text-blue-500" />
            <span>
              Went to <b>{user.school}</b>
            </span>
          </div>
        )}

        {user.work && (
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="text-yellow-900 font-bold" />
            <span>
              Works at <b>{user.work}</b>
            </span>
          </div>
        )}

        {user.website && (
          <div className="flex gap-1 items-center">
            <Cable className="text-rose-500" />
            <Link href="/" className="underline text-rose-500 font-bold">
              {user.website}
            </Link>
          </div>
        )}

        {/* Only show follow/block if not owner AND not hidden */}
        {currentUserId && !isOwner && !hideInteraction && (
          <UserInfoCardInteraction
            currentUserId={currentUserId}
            formatedDate={formatedDate}
            isUserBlocked={isBlockedByViewer}
            isFollowing={isFollowing}
            isFollowingSent={isFollowingSent}
            userId={user.id}
          />
        )}
      </div>
    </div>
  );
}

export default UserInfoCard;
