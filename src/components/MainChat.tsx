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

  // 1. Establish WebSocket Connection and Listen for Messages
   useEffect(() => {
    if (!selectedFriend || !userId) return;

    const newSocket = io("http://31.97.76.24:3001", {
      query: { userId },
      transports: ["websocket", "polling"],
    });
    setSocket(newSocket);

    // Listen for incoming messages
    newSocket.on("receiveMessage", (message: Message) => {
      // FIX: Only add the message if it's NOT from the current user
      if (message.senderId !== userId) {
        if (
          message.senderId === selectedFriend.id ||
          message.receiverId === selectedFriend.id
        ) {
          setMessages((prev) => [
            ...prev,
            {
              ...message,
              isOwn: message.senderId === userId,
              createdAt: new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
        }
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [selectedFriend, setMessages, userId]);

  // 2. Handle Sending a Message via WebSocket
  const handleSendMessage = () => {
    if (!input.trim() || !selectedFriend || !socket) return;

    // Create a message object to send
    const messageToSend = {
      senderId: userId,
      receiverId: selectedFriend.id,
      text: input,
      createdAt: new Date().toISOString(),
    };

    // Emit the message to the server
    socket.emit("sendMessage", messageToSend);

    // Optimistically add the message to the UI
    setMessages((prev) => [
      ...prev,
      {
        ...messageToSend,
        id: Date.now(),
        isOwn: true,
        text: input,
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
              <p className="text-sm text-green-500">Online</p>
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
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 px-5 py-3 text-sm bg-gray-100 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              className="p-3 rounded-full bg-rose-800 text-white hover:bg-rose-700 transition-colors duration-200 shadow-lg"
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
