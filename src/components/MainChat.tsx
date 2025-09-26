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

    console.log("MainChat: Connecting to socket for conversation:", {
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
      console.log("MainChat: Connected to socket. Socket ID:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("connect_error", (err) => {
      console.error("MainChat: Socket connection error:", err);
      setIsConnected(false);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("MainChat: Disconnected:", reason);
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Listen for incoming messages
    newSocket.on("receiveMessage", (message: Message) => {
      console.log("MainChat: Received message:", message);
      console.log("MainChat: Current userId:", userId);
      console.log("MainChat: Selected friend ID:", selectedFriend.id);

      // Check if this message belongs to the current conversation
      const belongsToCurrentConversation =
        (message.senderId === selectedFriend.id &&
          message.receiverId === userId) ||
        (message.senderId === userId &&
          message.receiverId === selectedFriend.id);

      if (belongsToCurrentConversation) {
        setMessages((prev) => {
          // Check if message already exists
          const messageExists = prev.some((existingMsg) => {
            if (message.id && existingMsg.id) {
              return existingMsg.id === message.id;
            }
            // Fallback: check by content and timing
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
            console.log("MainChat: Message already exists, skipping");
            return prev;
          }

          console.log("MainChat: Adding new message to conversation");
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
        console.log("MainChat: Message not for current conversation");
      }
    });

    return () => {
      console.log("MainChat: Cleaning up socket connection");
      newSocket.disconnect();
    };
  }, [selectedFriend, setMessages, userId]);

  // 2. Handle Sending a Message via WebSocket
  const handleSendMessage = () => {
    if (!input.trim() || !selectedFriend || !socket || !isConnected) {
      console.log("MainChat: Cannot send message - missing requirements");
      return;
    }

    console.log(
      "MainChat: Sending message from",
      userId,
      "to",
      selectedFriend.id
    );

    const messageToSend = {
      senderId: userId,
      receiverId: selectedFriend.id,
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };

    // Emit the message to the server
    socket.emit("sendMessage", messageToSend);
    console.log("MainChat: Message emitted to server");

    // Optimistically add the message to the UI
    setMessages((prev) => [
      ...prev,
      {
        ...messageToSend,
        id: Date.now(),
        isOwn: true,
        text: input.trim(),
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col bg-white rounded-r-3xl overflow-hidden shadow-2xl">
      {selectedFriend ? (
        <>
          {/* Chat Header */}
          <div className="flex items-center gap-4 p-6 bg-white border-b border-gray-200 shadow-sm">
            {onBack && (
              <button
                onClick={onBack}
                className="mr-4 text-rose-800 font-bold md:hidden"
              >
                Back
              </button>
            )}
            <Avatar />
            <div>
              <h2 className="font-semibold text-gray-900">
                {selectedFriend.name}
              </h2>
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
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.isOwn ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-md transition-all duration-300 transform scale-100 ${
                    msg.isOwn
                      ? "bg-rose-800 text-white rounded-br-md"
                      : "bg-orange-300 text-gray-900 rounded-bl-md"
                  }`}
                >
                  <p className="font-light">{msg.text}</p>
                  <span className="block text-[10px] text-gray-400 mt-1 text-right">
                    {msg.createdAt}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 bg-white border-t border-gray-200 flex items-center gap-4">
            {!isConnected && (
              <div className="absolute top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-center py-2 text-sm">
                Connecting to chat server...
              </div>
            )}
            <input
              type="text"
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              className="flex-1 px-5 py-3 text-sm bg-gray-100 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200 disabled:opacity-50"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={!isConnected}
            />
            <button
              onClick={handleSendMessage}
              disabled={!isConnected || !input.trim()}
              className="p-3 rounded-full bg-rose-800 text-white hover:bg-rose-700 transition-colors duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SendIcon />
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center flex-1 text-gray-500">
          Select a conversation to start chatting
        </div>
      )}
    </div>
  );
};

export default MainChat;
