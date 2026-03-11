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

const DOM_CAP = 50;

const Spinner = () => (
  <svg
    className="w-8 h-8 text-orange-400 animate-spin"
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
);

export default function MainChat({
  selectedFriend,
  messages,
  setMessages,
  Avatar,
  SendIcon,
  onBack,
  userId,
}: Props) {
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");

  // Loading states
  const [loading, setLoading] = useState(false); // covers both initial + paginate
  const [hasMore, setHasMore] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const oldestIdRef = useRef<number | undefined>(undefined);
  const isFetchingRef = useRef(false); // hard lock against double fetches

  const SOCKET_SERVER_URL =
    process.env.NODE_ENV === "production"
      ? "wss://socket.goga.network"
      : "http://localhost:3001";

  // ─── Format message ────────────────────────────────────────────────────────
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

  // ─── Initial load when friend changes ─────────────────────────────────────
  useEffect(() => {
    if (!selectedFriend) return;

    // Reset everything
    isFetchingRef.current = true;
    setLoading(true);
    setHasMore(false);
    setMessages([]);
    oldestIdRef.current = undefined;

    getMessages(selectedFriend.id)
      .then((res) => {
        if (!res) return;
        const formatted = res.messages.map(fmt);
        setMessages(formatted);
        setHasMore(res.hasMore);
        oldestIdRef.current = formatted[0]?.id;

        // Scroll to bottom after paint
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        });
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        isFetchingRef.current = false;
      });
  }, [selectedFriend?.id]); // only re-run when the actual friend ID changes

  // ─── Load older messages ───────────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || !selectedFriend) return;

    isFetchingRef.current = true;
    setLoading(true);

    const el = scrollRef.current;
    const heightBefore = el?.scrollHeight ?? 0;

    try {
      const res = await getMessages(selectedFriend.id, oldestIdRef.current);
      if (!res || res.messages.length === 0) {
        setHasMore(false);
        return;
      }

      const incoming = res.messages.map(fmt);
      oldestIdRef.current = incoming[0].id;
      setHasMore(res.hasMore);

      setMessages((prev) => {
        // Prepend new, trim bottom to stay under DOM_CAP
        const combined = [...incoming, ...prev];
        return combined.length > DOM_CAP
          ? combined.slice(0, DOM_CAP)
          : combined;
      });

      // Restore scroll so user stays where they were
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - heightBefore;
        });
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [hasMore, selectedFriend, fmt, setMessages]);

  // ─── Intersection observer on top sentinel ────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadOlder();
      },
      { root: container, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlder]);

  // ─── Auto-scroll to bottom on own message or if near bottom ───────────────
  const prevLenRef = useRef(0);
  useEffect(() => {
    if (messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;

    const isOwn = messages[messages.length - 1]?.isOwn;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;

    if (isOwn || nearBottom) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }

    prevLenRef.current = messages.length;
  }, [messages]);

  // ─── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFriend || !userId) return;

    setConnectionStatus("Connecting...");

    const sock = io(SOCKET_SERVER_URL, {
      query: { userId },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true,
    });

    sock.on("connect", () => {
      setIsConnected(true);
      setConnectionStatus("Connected");
    });
    sock.on("connect_error", (e: any) => {
      setIsConnected(false);
      setConnectionStatus(`Error: ${e.message}`);
    });
    sock.on("disconnect", (reason: string) => {
      setIsConnected(false);
      setConnectionStatus(`Disconnected: ${reason}`);
      if (reason === "io server disconnect" || reason === "transport close") {
        setTimeout(() => {
          if (!sock.connected) sock.connect();
        }, 1000);
      }
    });
    sock.on("reconnect", () => {
      setIsConnected(true);
      setConnectionStatus("Reconnected");
    });
    sock.on("reconnect_attempt", (n: number) =>
      setConnectionStatus(`Reconnecting... (${n})`),
    );
    sock.on("reconnect_failed", () => setConnectionStatus("Connection failed"));

    sock.on("receiveMessage", (msg: Message) => {
      const belongs =
        (msg.senderId === selectedFriend.id && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === selectedFriend.id);
      if (!belongs) return;

      setMessages((prev) => {
        // Deduplicate
        const exists = prev.some((m) => {
          if (msg.id && m.id) return m.id === msg.id;
          return (
            m.text === msg.text &&
            m.senderId === msg.senderId &&
            Math.abs(
              new Date(m.createdAt).getTime() -
                new Date(msg.createdAt).getTime(),
            ) < 1000
          );
        });
        if (exists) return prev;

        const updated = [...prev, fmt(msg)];
        // Trim top if over cap
        return updated.length > DOM_CAP ? updated.slice(-DOM_CAP) : updated;
      });
    });

    sock.on("messageError", (e: any) =>
      setConnectionStatus(`Message error: ${e.error}`),
    );

    setSocket(sock);
    return () => {
      sock.removeAllListeners();
      sock.disconnect();
    };
  }, [selectedFriend?.id, userId]);

  // ─── Send ──────────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!input.trim() || !selectedFriend || !socket || !isConnected) return;

    const payload = {
      senderId: userId,
      receiverId: selectedFriend.id,
      text: input.trim(),
      createdAt: new Date().toISOString(),
    };

    socket.emit("sendMessage", payload);

    const optimistic: Message = {
      ...payload,
      id: Date.now(),
      isOwn: true,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => {
      const updated = [...prev, optimistic];
      return updated.length > DOM_CAP ? updated.slice(-DOM_CAP) : updated;
    });

    setInput("");
  };

  // ─── Render message ────────────────────────────────────────────────────────
  const renderMessage = (msg: Message) => {
    const isShared = msg.mediaType === "shared_post" && msg.mediaUrl;
    let sharedData: any = null;
    if (isShared) {
      try {
        sharedData = JSON.parse(msg.mediaUrl as string);
      } catch {}
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
          {isShared ? (
            <div className="w-full">
              {msg.text && (
                <p
                  className={`text-[11px] font-medium mb-1.5 ${msg.isOwn ? "text-right text-orange-300" : "text-left text-gray-400"}`}
                >
                  {msg.text}
                </p>
              )}
              {sharedData?.post && (
                <SharedPost postData={sharedData.post} isOwn={msg.isOwn} />
              )}
            </div>
          ) : msg.text ? (
            <div
              className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                msg.isOwn
                  ? "bg-orange-500 text-white rounded-[20px] rounded-br-[4px]"
                  : "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100 rounded-[20px] rounded-bl-[4px]"
              }`}
            >
              {msg.text}
            </div>
          ) : null}
          <span
            className={`text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 ${msg.isOwn ? "mr-1" : "ml-1"}`}
          >
            {msg.createdAt}
          </span>
        </div>
      </div>
    );
  };

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-r-3xl overflow-hidden shadow-2xl transition-colors duration-300">
      {selectedFriend ? (
        <>
          {/* Header */}
          <div className="flex items-center gap-4 p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
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

          {/* Messages area */}
          <div className="flex-1 relative overflow-hidden">
            {/* Loader — covers everything, no scrolling through blank space */}
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-rose-50/80 dark:bg-gray-900/80 backdrop-blur-[2px]">
                <Spinner />
              </div>
            )}

            <div
              ref={scrollRef}
              className="h-full overflow-y-auto px-6 pt-4 pb-2 bg-rose-50 dark:bg-gray-900"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <style>{`div::-webkit-scrollbar{display:none}`}</style>

              {/* Sentinel at top — triggers loadOlder when visible */}
              <div ref={sentinelRef} className="h-px w-full" />

              {/* Beginning of conversation label */}
              {!hasMore && messages.length > 0 && (
                <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 py-2 mb-1">
                  Beginning of conversation
                </p>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <div key={msg.id}>{renderMessage(msg)}</div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4">
            <input
              type="text"
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              className="flex-1 px-5 py-3 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 dark:text-white transition-all duration-200 disabled:opacity-50"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={!isConnected}
            />
            <button
              onClick={handleSend}
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
}
