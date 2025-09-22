"use client";

import Image from "next/image";
import { useParams } from "next/navigation";

import React, { useState, useTransition } from "react";
import {
  ImagePlus,
  Clapperboard,
  CalendarArrowUp,
  Vote,
} from "lucide-react";
import { CldUploadWidget } from "next-cloudinary";
import { useUser } from "@clerk/nextjs";
import { testAction } from "@/actions/createPost";
import Link from "next/link";
import { useRouter } from "next/navigation";

function AddPost() {
  const [media, setMedia] = useState<any[]>([]);
  const { isLoaded, user } = useUser();
  const [desc, setDesc] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const params = useParams();
const Owner = params?.username === user?.username;
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!desc.trim()) return;

    // Use a transition to make the UI non-blocking
    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      await testAction(formData, media);
      router.refresh(); // This will trigger a re-fetch of the posts
      setDesc("");
      setMedia([]);
    });
  };

  if (!isLoaded || !user) {
    return null; // Or a loading spinner
  }

  return (
    <>
      {user && (
        <div className="p-4 bg-white rounded-lg shadow-md flex gap-4 justify-between text-sm">
          <Link href={`/profile/${user.username}`}>
            <Image
              src={user.imageUrl || "/noAvatar.png"}
              alt="Profile"
              width={40}
              height={40}
              className="cursor-pointer w-12 h-12 object-cover rounded-full ring-orange-200 ring-2"
            />
          </Link>
          <div className="flex-1">
            <form onSubmit={handleSubmit} className="flex gap-4 mb-2">
              <textarea
                placeholder="What is on your mind?"
                className="flex-1 p-2 bg-slate-100 rounded-lg"
                name="desc"
                value={desc}
                onChange={(e) => {
                  const maxLength = 2000; // match your Prisma schema
                  if (e.target.value.length <= maxLength) {
                    setDesc(e.target.value);
                  }
                }}
                disabled={isPending}
              />
              <p className="text-sm text-gray-500">{desc.length}/1500</p>

              {/* <SmilePlus className="w-6 h-6 self-end text-orange-300 cursor-pointer" /> */}
              <button
                type="submit"
                className="bg-orange-300 hover:bg-rose-300 text-white font-semibold text-sm px-2 py-2 rounded-lg shadow-sm transition-all duration-200"
                disabled={isPending}
              >
                {isPending ? "Posting..." : "Post"}
              </button>
            </form>

            <div className="flex items-center gap-4 mt-4 text-gray-400 flex-wrap">
              {/* 📸 IMAGE UPLOAD */}
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
                  <button type="button" onClick={() => open()}>
                    <div className="flex items-center gap-2 cursor-pointer text-green-600">
                      <ImagePlus /> Photo
                    </div>
                  </button>
                )}
              </CldUploadWidget>

              {/* 🎥 VIDEO UPLOAD */}
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
                  <button type="button" onClick={() => open()}>
                    <div className="flex items-center gap-2 cursor-pointer text-blue-950">
                      <Clapperboard /> Video
                    </div>
                  </button>
                )}
              </CldUploadWidget>

              <div className="flex items-center gap-2 cursor-pointer text-amber-400">
                <CalendarArrowUp />
                Event
              </div>

              <div className="flex items-center gap-2 cursor-pointer text-orange-600">
                <Vote />
                Poll
              </div>
            </div>

            {/* 🔎 Preview what’s uploaded */}
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4">
              {media.map((file, idx) => (
                <div key={idx} className="flex justify-center items-center">
                  {file.resource_type === "image" ? (
                    <Image
                      src={file.secure_url}
                      alt="uploaded"
                      width={120}
                      height={120}
                      className="rounded object-cover"
                    />
                  ) : (
                    <video
                      src={file.secure_url}
                      controls
                      className="rounded w-40 h-40 object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AddPost;
