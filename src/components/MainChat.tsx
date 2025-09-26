"use client";
import React, { useEffect, useState, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import { Message } from "../app/chat/page";

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
  const { socket, isConnected } = useSocket();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const connectionStatus = isConnected ? "Connected" : "Disconnected";

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: Message) => {
      const belongsToCurrentConversation =
        (message.senderId === selectedFriend?.id &&
          message.receiverId === userId) ||
        (message.senderId === userId &&
          message.receiverId === selectedFriend?.id);

      if (belongsToCurrentConversation) {
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
    };

    socket.on("receiveMessage", handleReceiveMessage);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
    };
  }, [socket, selectedFriend, userId, setMessages]);

  const handleSendMessage = () => {
    if (!input.trim() || !selectedFriend || !socket || !isConnected) return;

    const messageToSend = {
      senderId: userId,
      receiverId: selectedFriend.id,
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };

    socket.emit("sendMessage", messageToSend);

    // Optimistic UI update
    setMessages((prev) => [
      ...prev,
      {
        ...messageToSend,
        id: Date.now(),
        isOwn: true,
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
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">
                {selectedFriend.name}
              </h2>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <p
                  className={`text-sm ${
                    isConnected ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {connectionStatus}
                </p>
              </div>
            </div>
          </div>

          {/* Connection Warning */}
          {!isConnected && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Connection issues detected. Messages may not be delivered.
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Status: {connectionStatus}
                  </p>
                </div>
              </div>
            </div>
          )}

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
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-md transition-all duration-300 ${
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
              className="p-3 rounded-full bg-rose-800 text-white hover:bg-rose-700 transition-colors duration-200 shadow-lg disabled:opacity-50"
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
