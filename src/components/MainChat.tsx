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

// Max messages in DOM at once — older ones get trimmed off the bottom
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

  // TWO separate loading states:
  // isInitLoading = first load when entering chat (full overlay, scroll to bottom after)
  // isLoadingOlder = paginating up (overlay, restore scroll position after)
  const [isInitLoading, setIsInitLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const oldestIdRef = useRef<number | undefined>(undefined);
  // Sync lock so IntersectionObserver can't double-fire before state updates
  const isFetchingRef = useRef(false);

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

  // ─── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFriend) return;

    isFetchingRef.current = true;
    setIsInitLoading(true);
    setIsLoadingOlder(false);
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

        // Scroll to bottom after paint — only time we ever force scroll down
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        });
      })
      .catch(console.error)
      .finally(() => {
        setIsInitLoading(false);
        isFetchingRef.current = false;
      });
  }, [selectedFriend?.id]);

  // ─── Load older messages ───────────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || !selectedFriend) return;

    isFetchingRef.current = true;
    setIsLoadingOlder(true);

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
        const combined = [...incoming, ...prev];
        // Trim from bottom to stay under cap
        return combined.length > DOM_CAP
          ? combined.slice(0, DOM_CAP)
          : combined;
      });

      // Restore scroll — double rAF ensures DOM has fully painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - heightBefore;
          // Only AFTER scroll is restored do we release the lock
          setIsLoadingOlder(false);
          isFetchingRef.current = false;
        });
      });
    } catch (e) {
      console.error(e);
      setIsLoadingOlder(false);
      isFetchingRef.current = false;
    }
    // NOTE: no finally here — we release the lock manually after scroll restore above
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

  // ─── Auto-scroll ONLY for genuinely new messages at the bottom ────────────
  // Key fix: we check isLoadingOlder as a React state (not a ref) so it's
  // always in sync with the render that added the messages
  const prevLenRef = useRef(0);
  useEffect(() => {
    // Never auto-scroll during any loading phase
    if (isInitLoading || isLoadingOlder) {
      prevLenRef.current = messages.length;
      return;
    }

    if (messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;

    const addedCount = messages.length - prevLenRef.current;
    const addedAtBottom = addedCount > 0;
    const lastMsg = messages[messages.length - 1];
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;

    if (addedAtBottom && (lastMsg?.isOwn || nearBottom)) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }

    prevLenRef.current = messages.length;
  }, [messages, isInitLoading, isLoadingOlder]);

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
        // Trim from top if over cap
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

  const anyLoading = isInitLoading || isLoadingOlder;

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
            {/* Loader overlay — covers everything and prevents all scroll */}
            {anyLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-rose-50/80 dark:bg-gray-900/80 backdrop-blur-[2px]">
                <Spinner />
              </div>
            )}

            <div
              ref={scrollRef}
              className="h-full px-6 pt-4 pb-2 bg-rose-50 dark:bg-gray-900"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                // Physically disable scroll during loading so nothing can drift
                overflowY: anyLoading ? "hidden" : "auto",
              }}
            >
              <style>{`div::-webkit-scrollbar{display:none}`}</style>

              {/* Top sentinel — IO watches this to trigger loadOlder */}
              <div ref={sentinelRef} className="h-px w-full" />

              {/* Beginning of conversation */}
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
