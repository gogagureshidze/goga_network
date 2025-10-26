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
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const SOCKET_SERVER_URL =
    process.env.NODE_ENV === "production"
      ? "wss://socket.goga.network"
      : "http://localhost:3001";

  useEffect(() => {
    if (!selectedFriend || !userId) return;

    console.log("MainChat: Starting connection process for user:", userId);
    setConnectionStatus("Connecting...");

    const newSocket = io(SOCKET_SERVER_URL, {
      query: { userId },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });

    newSocket.on("connect", () => {
      console.log("MainChat: Successfully connected. Socket ID:", newSocket.id);
      console.log("MainChat: Transport:", newSocket.io.engine.transport.name);
      setIsConnected(true);
      setConnectionStatus("Connected");
    });

    newSocket.on("connect_error", (error: any) => {
      console.error("MainChat: Connection error:", error);
      setIsConnected(false);
      setConnectionStatus(`Error: ${error.message || "Connection failed"}`);
    });

    newSocket.on("disconnect", (reason, details) => {
      console.log("MainChat: Disconnected. Reason:", reason);
      console.log("MainChat: Details:", details);
      setIsConnected(false);
      setConnectionStatus(`Disconnected: ${reason}`);

      if (reason === "io server disconnect" || reason === "transport close") {
        console.log("MainChat: Attempting manual reconnection...");
        setTimeout(() => {
          if (newSocket && !newSocket.connected) {
            newSocket.connect();
          }
        }, 1000);
      }
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log("MainChat: Reconnected after", attemptNumber, "attempts");
      setIsConnected(true);
      setConnectionStatus("Reconnected");
    });

    newSocket.on("reconnect_attempt", (attemptNumber) => {
      console.log("MainChat: Reconnection attempt", attemptNumber);
      setConnectionStatus(`Reconnecting... (${attemptNumber})`);
    });

    newSocket.on("reconnect_failed", () => {
      console.error("MainChat: All reconnection attempts failed");
      setConnectionStatus("Connection failed");
    });

    setSocket(newSocket);

    // Message handling
    newSocket.on("receiveMessage", (message: Message) => {
      console.log("MainChat: Received message:", message);

      const belongsToCurrentConversation =
        (message.senderId === selectedFriend.id &&
          message.receiverId === userId) ||
        (message.senderId === userId &&
          message.receiverId === selectedFriend.id);

      if (belongsToCurrentConversation) {
        setMessages((prev) => {
          const messageExists = prev.some((existingMsg) => {
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
            console.log("MainChat: Duplicate message, skipping");
            return prev;
          }

          console.log("MainChat: Adding message to conversation");
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
      }
    });

    newSocket.on("messageError", (error) => {
      console.error("MainChat: Message error:", error);
      setConnectionStatus(`Message error: ${error.error}`);
    });

    return () => {
      console.log("MainChat: Cleaning up connection");
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
  }, [selectedFriend, userId, setMessages, SOCKET_SERVER_URL]);

  const handleSendMessage = () => {
    if (!input.trim() || !selectedFriend || !socket || !isConnected) {
      console.log("MainChat: Cannot send - not ready:", {
        hasInput: !!input.trim(),
        hasSocket: !!socket,
        isConnected,
      });
      return;
    }

    const messageToSend = {
      senderId: userId,
      receiverId: selectedFriend.id,
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };

    console.log("MainChat: Sending message:", messageToSend);
    socket.emit("sendMessage", messageToSend);

    // Optimistic update
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
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-r-3xl overflow-hidden shadow-2xl transition-colors duration-300">
      {selectedFriend ? (
        <>
          {/* Chat Header with Debug Info */}
          <div className="flex items-center gap-4 p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300">
            {onBack && (
              <button
                onClick={onBack}
                className="mr-4 text-rose-800 dark:text-white font-bold md:hidden"
              >
                Back
              </button>
            )}
            <Avatar />
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white">
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
            <div className="bg-yellow-50 dark:bg-yellow-900/50 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 transition-colors duration-300">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Connection issues detected. Messages may not be delivered.
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Status: {connectionStatus}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-rose-50 dark:bg-gray-900 transition-colors duration-300">
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
                      ? "bg-rose-800 text-white rounded-br-md dark:bg-gray-200 dark:text-gray-900"
                      : "bg-orange-300 text-gray-900 rounded-bl-md dark:bg-gray-700 dark:text-white"
                  }`}
                >
                  <p className="font-light">{msg.text}</p>
                  <span
                    className={`block text-[10px] mt-1 text-right ${
                      msg.isOwn
                        ? "text-rose-200 dark:text-gray-500"
                        : "text-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {msg.createdAt}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 transition-colors duration-300">
            <input
              type="text"
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              className="flex-1 px-5 py-3 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-400 dark:focus:ring-gray-500 text-gray-900 dark:text-white transition-all duration-200 disabled:opacity-50"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={!isConnected}
            />
            <button
              onClick={handleSendMessage}
              disabled={!isConnected || !input.trim()}
              className="p-3 rounded-full bg-rose-800 text-white hover:bg-rose-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300 transition-colors duration-200 shadow-lg disabled:opacity-50"
            >
              <SendIcon />
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400 transition-colors duration-300">
          Select a conversation to start chatting
        </div>
      )}
    </div>
  );
};

export default MainChat;
