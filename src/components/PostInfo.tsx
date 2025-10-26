"use client";

import { deletePost } from "@/actions/deletePost";
import { EllipsisVertical, Trash2, Heart } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import PostActivityModal from "./PostActivityModal"; // Assuming this is themed

function PostInfo({
  postId,
  postOwnerId,
  taggedUserIds = [] as string[], // Pass tagged user IDs here
}: {
  postId: number;
  postOwnerId: string;
  taggedUserIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { userId } = useAuth();

  const handleDelete = async () => {
    if (deleteLoading) return; // Prevent double-click
    setDeleteLoading(true);

    try {
      await deletePost(postId);
      // No need to manually update UI here if the parent component re-fetches or refreshes
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post. Please try again.");
    } finally {
      setDeleteLoading(false);
      setOpen(false); // Close menu
    }
  };

  // Delete button visible if user is owner OR tagged
  const canDelete = userId === postOwnerId || taggedUserIds.includes(userId!);

  return (
    <>
      <div className="relative">
        {/* Ellipsis Button - Themed */}
        <button onClick={() => setOpen((prev) => !prev)}>
          <EllipsisVertical className="text-gray-500 dark:text-gray-400 cursor-pointer w-5 h-5 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" />
        </button>

        {/* Dropdown Menu - Themed */}
        {open && (
          <div className="absolute top-6 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-30 min-w-[160px] border border-gray-200 dark:border-gray-700 transition-colors duration-300">
            {/* Activity option - Themed */}
            <button
              onClick={() => {
                setShowActivityModal(true);
                setOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 w-full text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <Heart size={16} /> Activity
            </button>

            {/* Delete option - Themed */}
            {canDelete && (
              <>
                {/* Separator - Themed */}
                <div className="border-t border-gray-200 dark:border-gray-700"></div>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex items-center gap-2 px-4 py-2 w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 dark:text-red-400 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />{" "}
                  {deleteLoading ? "Deleting..." : "Delete"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Activity Modal - Assuming this component is already themed */}
      {showActivityModal && (
        <PostActivityModal
          postId={postId}
          onClose={() => setShowActivityModal(false)}
        />
      )}
    </>
  );
}

export default PostInfo;
