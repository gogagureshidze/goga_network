"use client";

import React from "react";
import type { Friend } from "@/app/chat/page";
import GroupConversations from "./chat/GroupConversations";


type Props = {
  selectedFriend: Friend | null;
  setSelectedFriend: (friend: Friend | null) => void;
  Avatar: React.ComponentType;
  friends: Friend[];
};

const ChatListDesktop = ({
  selectedFriend,
  setSelectedFriend,
  friends,
}: Props) => {
  return (
    <div className="flex flex-col w-full md:w-80 lg:w-96 md:shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 rounded-l-3xl overflow-hidden shadow-xl transition-colors duration-300">
      <div className="p-6 font-extrabold text-xl text-rose-800 dark:text-white border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        Chats
      </div>
      <div className="flex-1 overflow-y-auto pt-2">
        <GroupConversations friends={friends} selectedFriend={selectedFriend} onSelect={setSelectedFriend} />

      </div>
    </div>
  );
};

export default ChatListDesktop;
