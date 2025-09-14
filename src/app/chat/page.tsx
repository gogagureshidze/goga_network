"use client";

import React, { useState, useEffect } from "react";
import ChatListDesktop from "@/components/ChatListDesktop";
import MainChat from "@/components/MainChat";
import { useUser } from "@clerk/nextjs";
import { getFollowers } from "@/actions/getFollowers";
import { getMessages } from "@/actions/getMessages";

// Types
export type Message = {
  id: number;
  senderId: string;
  text: string | null;
  createdAt: string;
  isOwn: boolean;
  mediaUrl?: string | null;
  mediaType?: string | null;
  conversationId?: number;
  isRead?: boolean;
  receiverId?: string;
};

export type Friend = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
};

// 💡 Keep Avatar & SendIcon **inside the file but do not export them**
const Avatar = () => (
  <div className="w-10 h-10 rounded-full bg-orange-300 flex items-center justify-center font-bold text-gray-700 text-lg">
    A
  </div>
);

const SendIcon = () => (
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

  // Fetch followers
  useEffect(() => {
    if (!isSignedIn || !user) return;

    const fetchFollowers = async () => {
      setIsLoading(true);
      try {
        const fetchedFollowers = await getFollowers();
        if (fetchedFollowers) {
          const formattedFollowers: Friend[] = fetchedFollowers.map((f) => ({
            id: f.id,
            name: f.username || "Unknown User",
            avatar: f.avatar || "/noAvatar.png",
            lastMessage: "Start a conversation!",
          }));
          setFollowers(formattedFollowers);
          if (!isMobile && formattedFollowers.length > 0) {
            setSelectedFriend(formattedFollowers[0]);
          }
        } else {
          setFollowers([]);
        }
      } catch (e) {
        console.error("Failed to fetch followers:", e);
        setFollowers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowers();
  }, [isSignedIn, user, isMobile]);

  // Fetch messages
  useEffect(() => {
    if (!selectedFriend) return;

    const fetchMessages = async () => {
      try {
        const fetchedMessages = await getMessages(selectedFriend.id);
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
      } catch (e) {
        console.error("Failed to fetch messages:", e);
        setMessages([]);
      }
    };

    fetchMessages();
  }, [selectedFriend, user]);

  const handleBack = () => setSelectedFriend(null);

  if (!isSignedIn)
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Please sign in to chat</p>
      </div>
    );

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading ...</p>
      </div>
    );

  if (followers.length === 0)
    return (
      <div className="flex justify-center items-center h-screen">
        <p>No followers found. Start following people to chat with them!</p>
      </div>
    );

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
