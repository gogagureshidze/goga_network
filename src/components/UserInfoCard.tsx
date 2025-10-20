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
import allPatterns, { CustomPattern } from "../actions/allPaterns";
import LinkifyText from "./LinkifyText";
import prisma from "@/lib/client";

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
  hideInteraction?: boolean;
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
  // At the top, add this helper function to extract @mentions and check them
  async function getValidUsernames(text: string) {
    if (!text) return [];

    const mentionRegex = /@(\w+)/g;
    const matches = Array.from(text.matchAll(mentionRegex));
    const usernames = matches.map((match) => match[1]);

    if (usernames.length === 0) return [];

    // Query database for valid usernames
    const users = await prisma.user.findMany({
      where: {
        username: {
          in: usernames,
        },
      },
      select: {
        username: true,
      },
    });

    return users.map((u) => u.username);
  }

  const loggedInUser = await currentUser();
  const currentUserId = loggedInUser?.id;

  const descriptionUsernames = await getValidUsernames(user.description || "");
  const websiteUsernames = await getValidUsernames(user.website || "");
  const allValidUsernames = [...descriptionUsernames, ...websiteUsernames].filter(
    (username): username is string => username !== null
  );

  const createdAtDate = new Date(user.createdAt);
  const formatedDate = createdAtDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const selectedPattern = user.bioPattern
    ? allPatterns.find((p) => p.id === user.bioPattern)
    : undefined;

  const textColorClass = selectedPattern
    ? selectedPattern.textColor
    : "text-gray-500";

  return (
    <div className="p-4 bg-white rounded-lg shadow-md text-sm flex flex-col gap-4 relative ">
      {selectedPattern && (
        <div className="absolute inset-0 z-0 rounded-lg overflow-hidden">
          <selectedPattern.component />
        </div>
      )}

      {/* This overlay ensures text is visible on top of the pattern */}
      <div className="relative z-10 flex flex-col gap-4 cursor-pointer z-100">
        <div
          className={`flex items-center justify-between font-medium ${textColorClass} z-100`}
        >
          <span>User Information</span>
          {isOwner ? <UpdateUser user={user} /> : <></>}
        </div>
        <div className={`flex flex-col gap-4 ${textColorClass}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xl text-black ${textColorClass}`}>
              {user.name && user.surname
                ? user.name + " " + user.surname
                : username}
            </span>
            <span className="text-sm">{username}</span>
          </div>
          {user.description && (
            <LinkifyText
              text={user.description}
              validUsernames={allValidUsernames}
              className={textColorClass}
              mentionClassName="text-orange-600 font-bold hover:text-orange-700"
            />
          )}
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
              <LinkifyText
                text={user.website}
                validUsernames={allValidUsernames}
                linkClassName="text-rose-500 font-bold underline hover:text-rose-600"
                mentionClassName="text-orange-600 font-bold hover:text-orange-700"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserInfoCard;
