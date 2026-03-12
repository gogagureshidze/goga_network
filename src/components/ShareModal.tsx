"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Users, Share2, Check, AlertCircle } from "lucide-react";
import Image from "next/image";
import { sharePost, getFollowersForSharing } from "@/actions/sharePost";
import { io, Socket } from "socket.io-client";
import { useUser } from "@clerk/nextjs";

interface ShareModalProps {
  postId: number;
  onClose: () => void;
  onShareSuccess?: (count: number) => void;
}

type Follower = {
  id: string;
  username: string;
  avatar: string;
  name: string;
};

export default function ShareModal({
  postId,
  onClose,
  onShareSuccess,
}: ShareModalProps) {
  const { user } = useUser();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const SOCKET_SERVER_URL =
    process.env.NODE_ENV === "production"
      ? "wss://socket.goga.network"
      : "http://localhost:3001";

  const [mounted, setMounted] = useState(false);

  // Mount guard (needed for SSR / Next.js)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock background scroll while modal is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    const fetchFollowers = async () => {
      setIsLoading(true);
      try {
        const data = await getFollowersForSharing();
        setFollowers(data);
      } catch (error) {
        console.error("Failed to fetch followers:", error);
        setErrorMessage("Failed to load followers. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowers();
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (!user?.id) return;

    const newSocket = io(SOCKET_SERVER_URL, {
      query: { userId: user.id },
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      console.log("ShareModal: Socket connected");
    });

    newSocket.on("connect_error", (error) => {
      console.error("ShareModal: Socket connection error:", error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id, SOCKET_SERVER_URL]);

  const filteredFollowers = followers.filter(
    (follower) =>
      follower.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      follower.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleShare = async () => {
    if (selectedUserIds.size === 0) {
      setErrorMessage("Please select at least one person to share with");
      return;
    }

    if (!socket) {
      setErrorMessage("Connection error. Please try again.");
      return;
    }

    if (!user) {
      setErrorMessage("You must be logged in to share posts");
      return;
    }

    setIsSharing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      console.log(
        "Starting share for post:",
        postId,
        "to users:",
        Array.from(selectedUserIds),
      );

      const result = await sharePost(postId, Array.from(selectedUserIds));

      console.log("Share result:", result);

      if (result.success && result.messages) {
        // Send real-time messages via socket
        for (const msgData of result.messages) {
          if (msgData.success && msgData.message) {
            socket.emit("sendMessage", {
              senderId: user.id,
              receiverId: msgData.recipientId,
              text: msgData.message.text,
              mediaUrl: msgData.message.mediaUrl,
              mediaType: msgData.message.mediaType,
              createdAt: msgData.message.createdAt,
            });
          }
        }

        // Show success message if there were partial failures
        if (result.failedCount && result.failedCount > 0) {
          setSuccessMessage(
            `Shared to ${result.sharedCount} ${
              result.sharedCount === 1 ? "person" : "people"
            }. ${result.failedCount} failed.`,
          );
          setTimeout(() => {
            onShareSuccess?.(result.sharedCount || 0);
            onClose();
          }, 2000);
        } else {
          setSuccessMessage(
            `Successfully shared to ${result.sharedCount} ${result.sharedCount === 1 ? "person" : "people"}!`,
          );
          setTimeout(() => {
            onShareSuccess?.(result.sharedCount || 0);
            onClose();
          }, 1500);
        }
      } else {
        const errorMsg =
          result.error || "Failed to share post. Please try again.";
        console.error("Share failed:", errorMsg);
        setErrorMessage(errorMsg);
      }
    } catch (error) {
      console.error("Error sharing post:", error);
      const errorMsg =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setErrorMessage(errorMsg);
    } finally {
      setIsSharing(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Share2
              className="text-orange-500 dark:text-orange-400"
              size={24}
            />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Share Post
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search followers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-orange-400 dark:focus:ring-orange-500 transition-all"
            />
          </div>
        </div>

        {/* Selected Count */}
        {selectedUserIds.size > 0 && !errorMessage && !successMessage && (
          <div className="px-6 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              {selectedUserIds.size}{" "}
              {selectedUserIds.size === 1 ? "person" : "people"} selected
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mx-4 my-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle
              size={18}
              className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
            />
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mx-4 my-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
            <Check
              size={18}
              className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5"
            />
            <p className="text-sm text-green-600 dark:text-green-400">
              {successMessage}
            </p>
          </div>
        )}

        {/* Followers List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
            </div>
          ) : filteredFollowers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="text-gray-400 mb-3" size={48} />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? "No followers found"
                  : "No followers to share with"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFollowers.map((follower) => {
                const isSelected = selectedUserIds.has(follower.id);
                return (
                  <div
                    key={follower.id}
                    onClick={() => !isSharing && toggleUser(follower.id)}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                      ${isSharing ? "opacity-50 cursor-not-allowed" : ""}
                      ${
                        isSelected
                          ? "bg-orange-100 dark:bg-orange-900/30 ring-2 ring-orange-400 dark:ring-orange-500"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      }
                    `}
                  >
                    <div className="relative">
                      <Image
                        src={follower.avatar}
                        alt={follower.username}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 bg-orange-500 rounded-full p-1">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {follower.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        @{follower.username}
                      </p>
                    </div>
                    <div
                      className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                        ${
                          isSelected
                            ? "bg-orange-500 border-orange-500"
                            : "border-gray-300 dark:border-gray-600"
                        }
                      `}
                    >
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSharing}
            className="flex-1 px-4 py-3 rounded-xl font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={selectedUserIds.size === 0 || isSharing || !socket}
            className="flex-1 px-4 py-3 rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSharing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Sharing...
              </>
            ) : (
              <>
                <Share2 size={18} />
                Share ({selectedUserIds.size})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
