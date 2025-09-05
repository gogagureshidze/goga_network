"use client";

import { deletePost } from "@/actions/deletePost";
import { EllipsisVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

function PostInfo({
  postId,
  postOwnerId,
}: {
  postId: number;
  postOwnerId: string;
}) {
  const [open, setOpen] = useState(false);
  const { userId } = useAuth();

  const deletePostAction = deletePost.bind(null, postId);

  // ✅ Only show menu if logged-in user is owner
  if (userId !== postOwnerId) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen((prev) => !prev)}>
        <EllipsisVertical className="text-gray-500 cursor-pointer w-5 h-5" />
      </button>

      {open && (
        <div className="absolute top-6 right-0 bg-white rounded-lg shadow-lg z-30 min-w-[140px]">
          <form action={deletePostAction}>
            <button className="flex items-center gap-2 px-4 py-2 w-full text-left text-red-500 hover:bg-red-50 transition-colors duration-200">
              <Trash2 size={16} /> Delete
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default PostInfo;
