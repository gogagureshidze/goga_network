"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import {
  Loader2,
  Check,
  Upload,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { createHighlight } from "@/actions/highlightActions";
import { useRouter } from "next/navigation";
import { CldUploadWidget } from "next-cloudinary";

type AddToHighlightModalProps = {
  selectedStories: number[];
  selectedStoriesData: { id: number; img: string }[];
  onClose: () => void;
  userId: string;
};

const isVideo = (url: string) => {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
  return videoExtensions.some((ext) => url?.toLowerCase().includes(ext));
};

export default function AddToHighlightModal({
  selectedStories,
  selectedStoriesData,
  onClose,
  userId,
}: AddToHighlightModalProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [isPending, startTransition] = useTransition();

  // New Notification State
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const router = useRouter();

  const [orderedStories, setOrderedStories] = useState(selectedStoriesData);
  const [coverUrl, setCoverUrl] = useState<string>(
    selectedStoriesData[0]?.img || ""
  );

  useEffect(() => {
    if (orderedStories.length > 0 && !coverUrl) {
      setCoverUrl(orderedStories[0].img);
    }
  }, [orderedStories, coverUrl]);

  const handleMoveStory = (index: number, direction: "left" | "right") => {
    const newStories = [...orderedStories];
    const targetIndex = direction === "left" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newStories.length) return;

    [newStories[index], newStories[targetIndex]] = [
      newStories[targetIndex],
      newStories[index],
    ];

    setOrderedStories(newStories);
  };

  const handleCreate = () => {
    if (!title.trim()) {
      setNotification({ type: "error", message: "Please enter a title" });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    startTransition(async () => {
      try {
        const sortedIds = orderedStories.map((s) => s.id);

        await createHighlight({
          title,
          desc,
          coverUrl,
          storyIds: sortedIds,
        });

        // Show Success Popup
        setNotification({ type: "success", message: "Highlight created!" });

        // Wait a moment so user sees the success message, then close
        setTimeout(() => {
          router.refresh();
          onClose();
        }, 1500);
      } catch (error) {
        console.error("Error creating highlight:", error);
        // Show Error Popup
        setNotification({
          type: "error",
          message: "Failed to create highlight.",
        });
        setTimeout(() => setNotification(null), 3000);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- NOTIFICATION POPUP --- */}
        {notification && (
          <div className="absolute top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <div
              className={`
                    flex items-center gap-2 px-4 py-2 rounded-full shadow-lg font-medium text-sm text-white animate-in fade-in slide-in-from-top-4 duration-300
                    ${
                      notification.type === "success"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }
                `}
            >
              {notification.type === "success" ? (
                <Check size={16} className="stroke-2" />
              ) : (
                <AlertCircle size={16} className="stroke-2" />
              )}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 shrink-0">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            New Highlight
          </h2>
          <button
            onClick={handleCreate}
            disabled={
              !title.trim() || isPending || notification?.type === "success"
            }
            className="text-orange-500 font-semibold hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending || notification?.type === "success"
              ? "Saving..."
              : "Done"}
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 flex flex-col items-center gap-6 overflow-y-auto custom-scrollbar">
          {/* Cover Section */}
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="relative group cursor-pointer">
              <div className="relative w-28 h-28 rounded-full p-1 border-2 border-orange-200 dark:border-gray-700">
                <div className="relative w-full h-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {isVideo(coverUrl) ? (
                    <video
                      src={coverUrl}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={coverUrl || "/noAvatar.png"}
                      alt="Cover"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  )}
                </div>
              </div>

              <CldUploadWidget
                uploadPreset="social"
                options={{
                  resourceType: "image",
                  clientAllowedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
                  maxFileSize: 5000000,
                }}
                onSuccess={(result: any) => {
                  setCoverUrl(result.info.secure_url);
                  setNotification({
                    type: "success",
                    message: "Image uploaded!",
                  }); // Optional: Notify on upload
                  setTimeout(() => setNotification(null), 2000);
                }}
              >
                {({ open }) => (
                  <button
                    type="button"
                    onClick={() => open()}
                    className="absolute bottom-0 right-0 bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-full shadow-md border-2 border-white dark:border-gray-900 transition-transform hover:scale-110"
                    title="Upload Custom Cover"
                  >
                    <Upload size={14} />
                  </button>
                )}
              </CldUploadWidget>
            </div>

            <div className="w-full max-w-xs space-y-4">
              <input
                type="text"
                placeholder="Highlight Name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={15}
                className="w-full text-center bg-transparent text-xl font-medium border-b border-gray-300 dark:border-gray-700 pb-2 focus:outline-none focus:border-orange-500 transition-colors placeholder:text-gray-400 dark:text-white"
                autoFocus
              />

              <input
                type="text"
                placeholder="Description (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={100}
                className="w-full text-center bg-transparent text-sm text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800 pb-2 focus:outline-none focus:border-orange-500 transition-colors placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="w-full h-px bg-gray-100 dark:bg-gray-800" />

          {/* Stories Section */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                Selected Stories
                <span className="text-xs font-normal text-gray-500">
                  ({orderedStories.length})
                </span>
              </p>
              <p className="text-xs text-gray-400">Use arrows to reorder</p>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-6 pt-2 px-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
              {orderedStories.map((story, index) => (
                <div
                  key={story.id}
                  className="relative group flex-shrink-0 flex flex-col items-center gap-2"
                >
                  <div
                    onClick={() => setCoverUrl(story.img)}
                    className={`relative w-20 h-32 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      coverUrl === story.img
                        ? "border-orange-500 ring-2 ring-orange-500/20"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="absolute top-1 left-1 z-10 bg-black/50 backdrop-blur-sm text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                      {index + 1}
                    </div>

                    {isVideo(story.img) ? (
                      <video
                        src={story.img}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <Image
                        src={story.img}
                        alt="Story option"
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    )}

                    {coverUrl === story.img && (
                      <div className="absolute inset-0 bg-orange-500/10 flex items-center justify-center">
                        <div className="bg-orange-500 rounded-full p-1">
                          <Check size={12} className="text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full p-1 shadow-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveStory(index, "left");
                      }}
                      disabled={index === 0}
                      className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                      title="Move Left"
                    >
                      <ArrowLeft
                        size={12}
                        className="text-gray-600 dark:text-gray-300"
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveStory(index, "right");
                      }}
                      disabled={index === orderedStories.length - 1}
                      className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                      title="Move Right"
                    >
                      <ArrowRight
                        size={12}
                        className="text-gray-600 dark:text-gray-300"
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isPending && !notification && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        )}
      </div>
    </div>
  );
}
