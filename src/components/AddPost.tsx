"use client";

import Image from "next/image";
import {
  ImagePlus,
  Clapperboard,
  CalendarArrowUp,
  Vote,
  X,
  Sparkles,
  Wand2,
} from "lucide-react";
import { CldUploadWidget } from "next-cloudinary";
import { useUser } from "@clerk/nextjs";
import { testAction } from "@/actions/createPost";
import { addEventPost } from "../actions/addPostEvent";
import Link from "next/link";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EventPostModal, { EventData } from "./EventPostModal";
import PollPostModal from "./PollPostModal";
import { generateDescription } from "../actions/generateDesc";

// Fun loading messages that rotate
const LOADING_MESSAGES = [
  "✨ Analyzing your images...",
  "🎨 Getting creative...",
  "🤖 AI is thinking...",
  "📝 Crafting the perfect caption...",
  "✍️ Almost there...",
  "🔮 Working some magic...",
];

function AddPost() {
  const [media, setMedia] = useState<any[]>([]);
  const { isLoaded, user } = useUser();
  const [desc, setDesc] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!desc.trim()) return;

    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      await testAction(formData, media);
      router.refresh();
      setDesc("");
      setMedia([]);
    });
  };

  const handleEventSubmit = async (eventData: EventData, eventDesc: string) => {
    startTransition(async () => {
      await addEventPost({
        userId: user!.id,
        desc: eventDesc,
        media: media.map((m) => ({
          url: m.secure_url,
          type: m.resource_type === "video" ? "video" : "photo",
        })),
        event: eventData,
      });

      router.refresh();
      setDesc("");
      setMedia([]);
      setIsEventModalOpen(false);
    });
  };

  const handleRemoveMedia = (idxToRemove: number) => {
    setMedia(media.filter((_, idx) => idx !== idxToRemove));
  };

  const handleGenerateDescription = async () => {
    if (media.length === 0) return;

    setIsGeneratingDesc(true);
    setDesc('')
    setProgress(0);
    setLoadingMessage(LOADING_MESSAGES[0]);

    // Rotate loading messages every 3 seconds
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[messageIndex]);
    }, 3000);

    // Fake progress bar (since we can't track actual progress)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Stop at 90%, complete on success
        return prev + Math.random() * 10;
      });
    }, 1000);

    try {
      const result = await generateDescription(media);

      // Complete progress
      setProgress(100);

      if (result.success && result.description) {
        // Append or replace description
        setDesc((prev) => {
          if (!prev.trim()) {
            return result.description!;
          }
          return `${prev}\n\n${result.description}`;
        });
      } else {
        alert(
          result.error || "Failed to generate description. Please try again."
        );
      }
    } catch (error) {
      console.error("Error generating description:", error);
      alert("An error occurred while generating the description.");
    } finally {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
      setIsGeneratingDesc(false);
      setProgress(0);
    }
  };

  if (!isLoaded || !user) {
    return null;
  }

  return (
    <>
      {user && (
        <div className="p-4 bg-white rounded-lg shadow-md flex flex-col gap-4 text-sm">
          <div className="flex gap-4">
            <Link href={`/profile/${user.username}`}>
              <Image
                src={user.imageUrl || "/noAvatar.png"}
                alt="Profile"
                width={40}
                height={40}
                className="cursor-pointer w-12 h-12 object-cover rounded-full ring-orange-200 ring-2"
              />
            </Link>
            <form
              onSubmit={handleSubmit}
              className="flex flex-1 flex-col gap-2"
            >
              <div className="flex gap-2">
                <textarea
                  placeholder={
                    isGeneratingDesc ? loadingMessage : "What is on your mind?"
                  }
                  className="flex-1 p-2 bg-slate-100 rounded-lg resize-none"
                  name="desc"
                  value={desc}
                  onChange={(e) => {
                    const maxLength = 2000;
                    if (e.target.value.length <= maxLength) {
                      setDesc(e.target.value);
                    }
                  }}
                  disabled={isPending || isGeneratingDesc}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{desc.length}/2000</p>
                <button
                  type="submit"
                  className="bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isPending || isGeneratingDesc}
                >
                  {isPending ? "Posting..." : "Post"}
                </button>
              </div>
            </form>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-4 -ml-4 -mr-4 px-4">
            <CldUploadWidget
              uploadPreset="social"
              options={{
                resourceType: "image",
                clientAllowedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
              }}
              onSuccess={(result) => {
                setMedia((prev) => [...prev, result.info]);
              }}
            >
              {({ open }) => (
                <button
                  type="button"
                  onClick={() => open()}
                  className="flex items-center justify-center flex-1 gap-2 p-2 rounded-lg text-green-600 bg-green-50/50 hover:bg-green-100 transition-colors duration-200"
                >
                  <ImagePlus className="w-6 h-6" />
                  <span className="font-medium text-sm hidden md:block">
                    Photo
                  </span>
                </button>
              )}
            </CldUploadWidget>

            <CldUploadWidget
              uploadPreset="social"
              options={{
                resourceType: "video",
                clientAllowedFormats: ["mp4", "mov", "avi", "webm", "mkv"],
              }}
              onSuccess={(result) => {
                setMedia((prev) => [...prev, result.info]);
              }}
            >
              {({ open }) => (
                <button
                  type="button"
                  onClick={() => open()}
                  className="flex items-center justify-center flex-1 gap-2 p-2 rounded-lg text-blue-950 bg-blue-50/50 hover:bg-blue-100 transition-colors duration-200"
                >
                  <Clapperboard className="w-6 h-6" />
                  <span className="font-medium text-sm hidden md:block">
                    Video
                  </span>
                </button>
              )}
            </CldUploadWidget>

            <button
              type="button"
              onClick={() => setIsEventModalOpen(true)}
              className="flex items-center justify-center flex-1 gap-2 p-2 rounded-lg text-amber-400 bg-amber-50/50 hover:bg-amber-100 transition-colors duration-200"
            >
              <CalendarArrowUp className="w-6 h-6" />
              <span className="font-medium text-sm hidden md:block">Event</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPollModalOpen(true)}
              className="flex items-center justify-center flex-1 gap-2 p-2 rounded-lg text-orange-600 bg-orange-50/50 hover:bg-orange-100 transition-colors duration-200"
            >
              <Vote className="w-6 h-6" />
              <span className="font-medium text-sm hidden md:block">Poll</span>
            </button>
          </div>

          {media.length > 0 && (
            <div className="flex flex-col gap-3">
              {/* AI Generate Button with Progress */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDesc}
                  className="relative overflow-hidden flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-90 disabled:cursor-wait shadow-lg"
                >
                  {/* Progress bar background */}
                  {isGeneratingDesc && (
                    <div
                      className="absolute inset-0 bg-white/20 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  )}

                  {/* Button content */}
                  <div className="relative flex items-center gap-2">
                    {isGeneratingDesc ? (
                      <Wand2 className="w-5 h-5 animate-bounce" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    <span className="font-semibold">
                      {isGeneratingDesc
                        ? loadingMessage
                        : "✨ Generate AI Caption"}
                    </span>
                  </div>
                </button>

                {/* Progress percentage */}
                {isGeneratingDesc && (
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <div className="flex gap-1">
                      <div
                        className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: "200ms" }}
                      />
                      <div
                        className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: "350ms" }}
                      />
                    </div>
                    <span>{Math.round(progress)}%</span>
                  </div>
                )}
              </div>

              {/* Media Grid */}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4">
                {media.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative overflow-hidden rounded-md aspect-square"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(idx)}
                      className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 transition-all duration-200 z-10"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                    {file.resource_type === "image" ? (
                      <Image
                        src={file.secure_url}
                        alt="uploaded"
                        fill
                        className="object-cover rounded-md"
                      />
                    ) : (
                      <video
                        src={file.secure_url}
                        controls
                        className="w-full h-full object-cover rounded-md"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <EventPostModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSubmit={handleEventSubmit}
      />
      <PollPostModal
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        userId={user.id}
      />
    </>
  );
}

export default AddPost;
