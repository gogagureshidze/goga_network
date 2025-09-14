// src/components/Messenger.tsx
"use client";

import React, { useState, useEffect } from "react";
import ChatListDesktop from "@/components/ChatListDesktop";
import MainChat from "@/components/MainChat";
import { useUser } from "@clerk/nextjs";
import { getFollowers } from "@/actions/getFollowers";
import { getMessages } from "@/actions/getMessages"; // Import the new server action

// Types
export type Message = {
  id: number;
  senderId: string;
  text: string | null; // Allow text to be null
  createdAt: string;
  isOwn: boolean;
  mediaUrl?: string | null; // Allow mediaUrl to be null
  mediaType?: string | null; // Allow mediaType to be null
  conversationId?: number; // Add conversationId
  isRead?: boolean; // Add isRead
  receiverId?: string; // Add receiverId
};

export type Friend = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
};

// Placeholder Avatar Component
export const Avatar = () => (
  <div className="w-10 h-10 rounded-full bg-orange-300 flex items-center justify-center font-bold text-gray-700 text-lg">
    A
  </div>
);

// Send Icon Component
export const SendIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-5 h-5"
  >
    <path d="M3 2l18 10-18 10V13l12-3-12-3V2z" />
  </svg>
);

export default function Messenger() {
  const { user, isSignedIn } = useUser();

  const [followers, setFollowers] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // Detect mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch real followers using the server action
  useEffect(() => {
    if (!isSignedIn || !user) return;

    const fetchFollowers = async () => {
      setIsLoading(true);
      try {
        const fetchedFollowers = await getFollowers();

        if (fetchedFollowers) {
          const formattedFollowers: Friend[] = fetchedFollowers.map(
            (follower) => ({
              id: follower.id,
              name: follower.username || "Unknown User",
              avatar: follower.avatar || "/noAvatar.png",
              lastMessage: "Start a conversation!",
            })
          );

          setFollowers(formattedFollowers);
          if (!isMobile && formattedFollowers.length > 0) {
            setSelectedFriend(formattedFollowers[0]);
          }

          console.log(followers, 'fetched from chat componet')
        } else {
          setFollowers([]);
        }
      } catch (error) {
        console.error("Failed to fetch followers:", error);
        setFollowers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowers();
  }, [isSignedIn, user, isMobile]);

  // Fetch messages when a new friend is selected
  useEffect(() => {
    if (selectedFriend) {
      const fetchMessages = async () => {
        try {
          const fetchedMessages = await getMessages(selectedFriend.id);
          // Safely assert that fetchedMessages is not null or undefined
          const formattedMessages: Message[] = (fetchedMessages || []).map(
            (msg) => ({
              ...msg,
              isOwn: msg.senderId === user?.id,
              createdAt: new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })
          );
          setMessages(formattedMessages);
        } catch (error) {
          console.error("Failed to fetch messages:", error);
          setMessages([]);
        }
      };
      fetchMessages();
    }
  }, [selectedFriend, user]);

  const handleBack = () => setSelectedFriend(null);

  if (!isSignedIn) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Please sign in to chat</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading ...</p>
      </div>
    );
  }

  if (followers.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>No followers found. Start following people to chat with them!</p>
      </div>
    );
  }

  return (
    <div className="flex h-[87dvh] bg-rose-50 font-sans text-gray-900 antialiased pt-4">
      {(!isMobile || !selectedFriend) && (
        <ChatListDesktop
          selectedFriend={selectedFriend}
          setSelectedFriend={setSelectedFriend}
          Avatar={Avatar}
          friends={followers}
        />
      )}

      {(selectedFriend || !isMobile) && (
        <MainChat
          selectedFriend={selectedFriend}
          messages={messages}
          setMessages={setMessages}
          Avatar={Avatar}
          SendIcon={SendIcon}
          onBack={isMobile ? handleBack : undefined}
          userId={user.id}
        />
      )}
    </div>
  );
}
