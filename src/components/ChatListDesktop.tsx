// src/components/ChatListDesktop.tsx
"use client";

import React from "react";

type Friend = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
};

type Props = {
  selectedFriend: Friend | null;
  setSelectedFriend: (friend: Friend) => void;
  Avatar: React.ComponentType;
  friends: Friend[];
};

const ChatListDesktop = ({
  selectedFriend,
  setSelectedFriend,
  Avatar,
  friends,
}: Props) => {
  return (
    <div className="flex flex-col w-full md:w-1/3 bg-white border-r border-gray-200 rounded-l-3xl overflow-hidden shadow-xl">
      <div className="p-6 font-extrabold text-xl text-rose-800 border-b border-gray-200">
        Chats
      </div>
      <div className="flex-1 overflow-y-auto pt-2">
        {friends.map((friend) => (
          <div
            key={friend.id}
            onClick={() => setSelectedFriend(friend)}
            className={`flex items-center gap-4 p-4 cursor-pointer transition-colors duration-200 rounded-xl m-2 ${
              selectedFriend?.id === friend.id
                ? "bg-orange-300 shadow-lg"
                : "hover:bg-gray-100"
            }`}
          >
            <Avatar />
            <div className="flex flex-col flex-1 min-w-0">
              <span
                className={`font-semibold ${
                  selectedFriend?.id === friend.id
                    ? "text-gray-900"
                    : "text-gray-900"
                }`}
              >
                {friend.name}
              </span>
              <span
                className={`text-xs ${
                  selectedFriend?.id === friend.id
                    ? "text-gray-700"
                    : "text-gray-500"
                } truncate w-full`}
              >
                {friend.lastMessage}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatListDesktop;
