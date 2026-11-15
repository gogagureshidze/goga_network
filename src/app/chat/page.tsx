"use client";

import React, { useState, useEffect } from "react";
import ChatListDesktop from "@/components/ChatListDesktop";
import MainChat from "@/components/MainChat";
import { useUser } from "@clerk/nextjs";
import { getFollowers } from "@/actions/getFollowers";

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
  readBy?: string[];
  receiverId?: string;
  clientMessageId?: string | null;
  replyToId?: number | null;
  replyTo?: { id: number; text: string | null; senderId: string; deletedAt?: string | Date | null; mediaType?: string | null } | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  mediaAssetId?: string | null;
  durationMs?: number | null;
  waveform?: number[] | null;
  reactions?: { userId: string; emoji: string }[];
  sender?: { username?: string | null; name?: string | null; avatar?: string | null };
  delivery?: "sending" | "failed" | "sent";
};

export type Friend = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  conversationId?: number;
  kind?: "DIRECT" | "GROUP";
};

// Avatar component (themed)
const Avatar = () => (
  <div className="w-10 h-10 rounded-full bg-orange-300 dark:bg-gray-600 flex items-center justify-center font-bold text-gray-700 dark:text-gray-100 text-lg transition-colors duration-300">
    A
  </div>
);

// SendIcon
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
  const { user, isSignedIn, isLoaded } = useUser();
  const [followers, setFollowers] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  // messages state is lifted here so MainChat can append incoming socket messages
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
    if (!isSignedIn) return;

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
  }, [isSignedIn, user?.id]);

  // Clear messages when switching friends
  useEffect(() => {
    setMessages([]);
  }, [selectedFriend?.id]);

  const handleBack = () => setSelectedFriend(null);

  if (!isLoaded) return <p className="p-8 text-center">Loading…</p>;

  if (!isSignedIn)
    return (
      <div className="flex justify-center items-center h-screen bg-rose-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
        <p>Please sign in to chat</p>
      </div>
    );

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-screen bg-rose-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
        <p>Loading ...</p>
      </div>
    );

  return (
    <div className="flex h-[87dvh] bg-rose-50 font-sans text-gray-900 dark:bg-gray-900 dark:text-white antialiased pt-4 transition-colors duration-300">
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
