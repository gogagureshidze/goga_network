// src/components/MainChat.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Message } from "../app/chat/page";
import { io, Socket } from "socket.io-client";

type Friend = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
};

type Props = {
  selectedFriend: Friend | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  Avatar: React.ComponentType;
  SendIcon: React.ComponentType;
  onBack?: () => void;
  userId: string;
};

const MainChat = ({
  selectedFriend,
  messages,
  setMessages,
  Avatar,
  SendIcon,
  onBack,
  userId,
}: Props) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // 1. Establish WebSocket Connection and Listen for Messages
  useEffect(() => {
    if (!selectedFriend || !userId) return;

    console.log("🔌 MainChat connecting to socket for conversation:", {
      userId,
      friendId: selectedFriend.id,
    });

    const newSocket = io("https://socket.goga.network", {
      query: { userId },
      transports: ["websocket"], // force websocket, skip polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    // Connection events
    newSocket.on("connect", () => {
      console.log("✅ MainChat connected to socket. Socket ID:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("connect_error", (err) => {
      console.error("🚨 MainChat socket connection error:", err);
      setIsConnected(false);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ MainChat disconnected:", reason);
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Listen for incoming messages
    newSocket.on("receiveMessage", (message: Message) => {
      console.log("📨 Received message:", message);
      console.log("👤 Current userId:", userId);
      console.log("👤 Selected friend ID:", selectedFriend.id);

      // Only add messages that are part of the current conversation
      const isCurrentConversation =
        (message.senderId === selectedFriend.id &&
          message.receiverId === userId) ||
        (message.senderId === userId &&
          message.receiverId === selectedFriend.id);

      if (isCurrentConversation) {
        setMessages((prev) => {
          // Check if message already exists to avoid duplicates
          const messageExists = prev.some((existingMsg) => {
            // Check by ID if available, otherwise by content and timing
            if (message.id && existingMsg.id) {
              return existingMsg.id === message.id;
            }
            return (
              existingMsg.text === message.text &&
              existingMsg.senderId === message.senderId &&
              Math.abs(
                new Date(existingMsg.createdAt).getTime() -
                  new Date(message.createdAt).getTime()
              ) < 1000
            );
          });

          if (messageExists) {
            console.log("🔄 Message already exists, skipping");
            return prev;
          }

          console.log("✅ Adding new message to conversation");
          return [
            ...prev,
            {
              ...message,
              isOwn: message.senderId === userId,
              createdAt: new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ];
        });
      } else {
        console.log("🚫 Message not for current conversation, ignoring");
      }
    });

    // Listen for message errors
    newSocket.on("messageError", (error) => {
      console.error("💥 Message error:", error);
      // You could show a toast notification here
    });

    return () => {
      console.log("🧹 Cleaning up MainChat socket connection");
      newSocket.disconnect();
    };
  }, [selectedFriend, userId, setMessages]);

  // 2. Handle Sending a Message via WebSocket
  const handleSendMessage = () => {
    if (!input.trim() || !selectedFriend || !socket || !isConnected) {
      console.log("❌ Cannot send message:", {
        hasInput: !!input.trim(),
        hasSelectedFriend: !!selectedFriend,
        hasSocket: !!socket,
        isConnected,
      });
      return;
    }

    console.log("📤 Sending message:");
    console.log("👤 From (senderId):", userId);
    console.log("👤 To (receiverId):", selectedFriend.id);
    console.log("💬 Text:", input);

    // Create a message object to send
    const messageToSend = {
      senderId: userId,
      receiverId: selectedFriend.id,
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };

    // Emit the message to the server
    socket.emit("sendMessage", messageToSend);
    console.log("✅ Message emitted to server");

    // Optimistically add the message to the UI
    const optimisticMessage = {
      ...messageToSend,
      id: Date.now(), // Temporary ID for optimistic update
      isOwn: true,
      text: input.trim(),
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInput("");
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedFriend) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-r-3xl overflow-hidden shadow-2xl">
        <div className="text-center text-gray-500 p-8">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-xl font-semibold mb-2">Start a conversation</h3>
          <p className="text-sm">
            Select a friend from the sidebar to begin chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-r-3xl overflow-hidden shadow-2xl">
      {/* Chat Header */}
      <div className="flex items-center gap-4 p-6 bg-white border-b border-gray-200 shadow-sm">
        {onBack && (
          <button
            onClick={onBack}
            className="mr-4 text-rose-800 font-bold md:hidden hover:text-rose-600 transition-colors"
          >
            ← Back
          </button>
        )}
        <Avatar />
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">{selectedFriend.name}</h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <p
              className={`text-sm ${
                isConnected ? "text-green-500" : "text-gray-400"
              }`}
            >
              {isConnected ? "Online" : "Connecting..."}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-rose-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">👋</div>
              <p className="text-sm">No messages yet. Say hello!</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-md transition-all duration-300 ${
                  msg.isOwn
                    ? "bg-rose-800 text-white rounded-br-md"
                    : "bg-orange-300 text-gray-900 rounded-bl-md"
                }`}
              >
                <p className="font-light whitespace-pre-wrap break-words">
                  {msg.text}
                </p>
                <span className="block text-[10px] text-gray-400 mt-1 text-right">
                  {msg.createdAt}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-white border-t border-gray-200">
        {!isConnected && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Connecting to chat server...
            </p>
          </div>
        )}
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            className="flex-1 px-5 py-3 text-sm bg-gray-100 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200 disabled:opacity-50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={!isConnected}
            maxLength={1000}
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !input.trim()}
            className="p-3 rounded-full bg-rose-800 text-white hover:bg-rose-700 transition-colors duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        </div>
        {input.length > 900 && (
          <p className="text-xs text-gray-500 mt-2 text-right">
            {1000 - input.length} characters remaining
          </p>
        )}
      </div>
    </div>
  );
};

export default MainChat;
