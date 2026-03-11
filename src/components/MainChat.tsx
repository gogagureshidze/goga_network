"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "../app/chat/page";
import { io, Socket } from "socket.io-client";
import SharedPost from "./SharedPost";
import { getMessages } from "@/actions/getMessages";

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

const Spinner = () => (
  <div className="flex justify-center py-3">
    <svg
      className="w-6 h-6 text-gray-400 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </div>
);

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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  // The scroll container
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sentinel div at the very top — IO watches this
  const topSentinelRef = useRef<HTMLDivElement>(null);
  // Cursor for pagination
  const cursorRef = useRef<number | undefined>(undefined);
  // Prevent double-firing
  const loadingRef = useRef(false);

  const SOCKET_SERVER_URL =
    process.env.NODE_ENV === "production"
      ? "wss://socket.goga.network"
      : "http://localhost:3001";

  const fmt = useCallback(
    (msg: any): Message => ({
      ...msg,
      isOwn: msg.senderId === userId,
      createdAt: new Date(msg.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }),
    [userId],
  );

  // ─── Scroll to bottom ─────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFriend) return;

    setIsInitialLoading(true);
    setHasMore(false);
    cursorRef.current = undefined;
    setMessages([]);

    getMessages(selectedFriend.id)
      .then((result) => {
        if (!result) return;
        const formatted = result.messages.map(fmt);
        setMessages(formatted);
        setHasMore(result.hasMore);
        if (formatted.length > 0) cursorRef.current = formatted[0].id;
        // Wait for DOM then scroll to bottom
        requestAnimationFrame(() => scrollToBottom("instant"));
      })
      .catch(console.error)
      .finally(() => setIsInitialLoading(false));
  }, [selectedFriend, fmt, setMessages, scrollToBottom]);

  // ─── Load older messages ──────────────────────────────────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (loadingRef.current || !hasMore || !selectedFriend) return;
    loadingRef.current = true;
    setIsLoadingOlder(true);

    const el = scrollRef.current;
    // Snapshot scroll height BEFORE new items are added
    const prevScrollHeight = el?.scrollHeight ?? 0;

    try {
      const result = await getMessages(selectedFriend.id, cursorRef.current);
      if (!result || result.messages.length === 0) {
        setHasMore(false);
        return;
      }

      const formatted = result.messages.map(fmt);
      cursorRef.current = formatted[0].id;
      setHasMore(result.hasMore);

      // Prepend messages — React batches this setState
      setMessages((prev) => [...formatted, ...prev]);

      // After DOM updates, restore scroll so viewport doesn't jump
      requestAnimationFrame(() => {
        if (el) {
          // New scrollHeight minus old = how much was added on top
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        }
      });
    } catch (e) {
      console.error("Failed to load older messages:", e);
    } finally {
      setIsLoadingOlder(false);
      loadingRef.current = false;
    }
  }, [hasMore, selectedFriend, fmt, setMessages]);

  // ─── Intersection Observer on top sentinel ────────────────────────────────
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadOlderMessages();
      },
      {
        root: container,
        // Fire when sentinel is 10px from coming into view
        rootMargin: "10px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlderMessages]);

  // ─── Auto-scroll to bottom when new messages arrive ──────────────────────
  const prevLengthRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;

    const addedAtBottom = messages.length > prevLengthRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;

    if (
      addedAtBottom &&
      (isNearBottom || messages[messages.length - 1]?.isOwn)
    ) {
      scrollToBottom("smooth");
    }

    prevLengthRef.current = messages.length;
  }, [messages, scrollToBottom]);

  // ─── Socket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFriend || !userId) return;

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
      setIsConnected(true);
      setConnectionStatus("Connected");
    });
    newSocket.on("connect_error", (e: any) => {
      setIsConnected(false);
      setConnectionStatus(`Error: ${e.message}`);
    });
    newSocket.on("disconnect", (reason: string) => {
      setIsConnected(false);
      setConnectionStatus(`Disconnected: ${reason}`);
      if (reason === "io server disconnect" || reason === "transport close") {
        setTimeout(() => {
          if (!newSocket.connected) newSocket.connect();
        }, 1000);
      }
    });
    newSocket.on("reconnect", () => {
      setIsConnected(true);
      setConnectionStatus("Reconnected");
    });
    newSocket.on("reconnect_attempt", (n: number) =>
      setConnectionStatus(`Reconnecting... (${n})`),
    );
    newSocket.on("reconnect_failed", () =>
      setConnectionStatus("Connection failed"),
    );

    setSocket(newSocket);

    newSocket.on("receiveMessage", (message: Message) => {
      const belongs =
        (message.senderId === selectedFriend.id &&
          message.receiverId === userId) ||
        (message.senderId === userId &&
          message.receiverId === selectedFriend.id);
      if (!belongs) return;

      setMessages((prev) => {
        const exists = prev.some((m) => {
          if (message.id && m.id) return m.id === message.id;
          return (
            m.text === message.text &&
            m.senderId === message.senderId &&
            Math.abs(
              new Date(m.createdAt).getTime() -
                new Date(message.createdAt).getTime(),
            ) < 1000
          );
        });
        if (exists) return prev;
        return [...prev, fmt(message)];
      });
    });

    newSocket.on("messageError", (e: any) =>
      setConnectionStatus(`Message error: ${e.error}`),
    );

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
  }, [selectedFriend, userId, fmt, setMessages, SOCKET_SERVER_URL]);

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSendMessage = () => {
    if (!input.trim() || !selectedFriend || !socket || !isConnected) return;

    const messageToSend = {
      senderId: userId,
      receiverId: selectedFriend.id,
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };

    socket.emit("sendMessage", messageToSend);

    const optimistic: Message = {
      ...messageToSend,
      id: Date.now(),
      isOwn: true,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
  };

  // ─── Render message ───────────────────────────────────────────────────────
  const renderMessage = (msg: Message) => {
    const isSharedPost = msg.mediaType === "shared_post" && msg.mediaUrl;
    let sharedData = null;
    if (isSharedPost) {
      try {
        sharedData = JSON.parse(msg.mediaUrl as string);
      } catch (e) {
        console.error(e);
      }
    }

    return (
      <div
        className={`flex w-full mb-4 ${msg.isOwn ? "justify-end" : "justify-start"}`}
      >
        {!msg.isOwn && selectedFriend?.avatar && (
          <img
            src={selectedFriend.avatar}
            alt="avatar"
            className="w-7 h-7 rounded-full object-cover mr-2 self-end mb-5 shadow-sm"
          />
        )}
        <div
          className={`flex flex-col gap-1 w-full max-w-[75%] sm:max-w-[60%] md:max-w-[320px] ${msg.isOwn ? "items-end" : "items-start"}`}
        >
          {msg.text && (
            <div
              className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm z-10 ${
                msg.isOwn
                  ? "bg-orange-500 text-white rounded-[20px] rounded-br-[4px]"
                  : "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100 rounded-[20px] rounded-bl-[4px]"
              }`}
            >
              {msg.text}
            </div>
          )}
          {isSharedPost && sharedData?.post && (
            <div className={`w-full ${msg.text ? "-mt-2" : ""}`}>
              <SharedPost postData={sharedData.post} isOwn={msg.isOwn} />
            </div>
          )}
          <span
            className={`text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 ${msg.isOwn ? "mr-1" : "ml-1"}`}
          >
            {msg.createdAt}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-r-3xl overflow-hidden shadow-2xl transition-colors duration-300">
      {selectedFriend ? (
        <>
          {/* Header */}
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
                  className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                />
                <p
                  className={`text-sm ${isConnected ? "text-green-500" : "text-red-500"}`}
                >
                  {connectionStatus}
                </p>
              </div>
            </div>
          </div>

          {!isConnected && (
            <div className="bg-yellow-50 dark:bg-yellow-900/50 border-l-4 border-yellow-400 p-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-300 ml-3">
                Connection issues. Messages may not be delivered.
              </p>
            </div>
          )}

          {/* Scroll area */}
          <div className="flex-1 relative overflow-hidden">
            {/* Full-area initial loader */}
            {isInitialLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-rose-50 dark:bg-gray-900">
                <Spinner />
              </div>
            )}

            <div
              ref={scrollRef}
              className="h-full overflow-y-auto px-6 pt-4 pb-2 bg-rose-50 dark:bg-gray-900 transition-colors duration-300"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* webkit scrollbar hide */}
              <style>{`div::-webkit-scrollbar { display: none; }`}</style>

              {/* TOP sentinel — IO fires loadOlderMessages when this is visible */}
              <div ref={topSentinelRef} className="h-px w-full" />

              {/* Older messages spinner — shown inline at top while fetching */}
              {isLoadingOlder && <Spinner />}

              {/* "Beginning of conversation" once nothing more to load */}
              {!hasMore && !isLoadingOlder && messages.length > 0 && (
                <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 py-2 mb-1">
                  Beginning of conversation
                </p>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <div key={msg.id}>{renderMessage(msg)}</div>
              ))}

              {/* Scroll anchor — browser keeps this in view when content added above */}
              <div style={{ overflowAnchor: "auto" as any }} />
            </div>
          </div>

          {/* Input */}
          <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 transition-colors duration-300">
            <input
              type="text"
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              className="flex-1 px-5 py-3 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 dark:text-white transition-all duration-200 disabled:opacity-50"
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
        <div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400">
          Select a conversation to start chatting
        </div>
      )}
    </div>
  );
};

export default MainChat;
