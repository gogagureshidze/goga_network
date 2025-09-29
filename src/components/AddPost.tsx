"use client";

import Image from "next/image";
import {
  ImagePlus,
  Clapperboard,
  CalendarArrowUp,
  Vote,
  X,
} from "lucide-react";
import { CldUploadWidget } from "next-cloudinary";
import { useUser } from "@clerk/nextjs";
import { testAction } from "@/actions/createPost";
import { addEventPost } from "../actions/addPostEvent"; // ✅ FIXED
import Link from "next/link";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EventPostModal, { EventData } from "./EventPostModal"; // ✅ FIXED
import PollPostModal from "./PollPostModal";

function AddPost() {
  const [media, setMedia] = useState<any[]>([]);
  const { isLoaded, user } = useUser();
  const [desc, setDesc] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
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
const [isPollModalOpen, setIsPollModalOpen] = useState(false);

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
            <form onSubmit={handleSubmit} className="flex flex-1 gap-4 mb-2">
              <textarea
                placeholder="What is on your mind?"
                className="flex-1 p-2 bg-slate-100 rounded-lg"
                name="desc"
                value={desc}
                onChange={(e) => {
                  const maxLength = 2000;
                  if (e.target.value.length <= maxLength) {
                    setDesc(e.target.value);
                  }
                }}
                disabled={isPending}
              />
              <p className="text-xs text-gray-500">{desc.length}/2000</p>
              <button
                type="submit"
                className="bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-2 py-2 rounded-lg shadow-sm transition-all duration-200"
                disabled={isPending}
              >
                {isPending ? ". . ." : "Post"}
              </button>
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
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4">
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
        userId={user.id} // ✅ Pass the actual user ID here
      />
    </>
  );
}

export default AddPost;
