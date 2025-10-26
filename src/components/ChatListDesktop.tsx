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
    <div className="flex flex-col w-full md:w-1/3 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 rounded-l-3xl overflow-hidden shadow-xl transition-colors duration-300">
      <div className="p-6 font-extrabold text-xl text-rose-800 dark:text-white border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        Chats
      </div>
      <div className="flex-1 overflow-y-auto pt-2">
        {friends.map((friend) => (
          <div
            key={friend.id}
            onClick={() => setSelectedFriend(friend)}
            className={`flex items-center gap-4 p-4 cursor-pointer transition-colors duration-200 rounded-xl m-2 ${
              selectedFriend?.id === friend.id
                ? "bg-orange-300 dark:bg-gray-700 shadow-lg"
                : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
            }`}
          >
            <Avatar />
            <div className="flex flex-col flex-1 min-w-0">
              <span
                className={`font-semibold ${
                  selectedFriend?.id === friend.id
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {friend.name}
              </span>
              <span
                className={`text-xs truncate w-full ${
                  selectedFriend?.id === friend.id
                    ? "text-gray-700 dark:text-gray-300"
                    : "text-gray-500 dark:text-gray-400"
                }`}
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
