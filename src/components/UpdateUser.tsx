"use client";
import UpdateProfile from "@/actions/updateProfile";
import { User } from "@/generated/prisma";
import Image from "next/image";
import { useState, useEffect } from "react";
import { CldUploadWidget } from "next-cloudinary";
import UpdateButton from "./UpdateButton";

function UpdateUser({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [cover, setCover] = useState<any>();
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = () => {
    setOpen(false);
  };

  const handleUploadSuccess = (result: any) => {
    if (result?.info?.secure_url) {
      setCover(result.info);
      setToast({
        message:
          "Image uploaded successfully! Don't Forget To Press Update Button!",
        type: "success",
      });
    } else {
      setToast({ message: "Upload failed!", type: "error" });
    }
    setTimeout(() => setToast(null), 6000);
  };

  const handleSubmit = async (formData: FormData) => {
    try {
      await UpdateProfile(formData, cover?.secure_url);

      // ✅ Show success toast
      setToast({
        message: "Profile updated!",
        type: "success",
      });

      // ✅ Close modal after short delay (so they see the toast first)
      setTimeout(() => {
        setOpen(false);
      }, 500); // half a second feels smooth

      // ✅ Hide toast after 3s
      setTimeout(() => {
        setToast(null);
      }, 3000);
    } catch (error: any) {
      console.error("UpdateProfile error:", error);
      setToast({
        message: error?.message || "Update failed! Please try again.",
        type: "error",
      });
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <div>
      <span
        className="text-orange-400 text-sm cursor-pointer"
        onClick={() => setOpen(true)}
      >
        Update
      </span>

      {open && (
        <div className="fixed w-screen h-screen top-0 left-0 bg-black/50 z-50 flex items-center justify-center">
          <form
            className="p-8 relative bg-white rounded-lg shadow-md flex flex-col gap-6 w-full md:w-2/3 xl:w-1/2 max-h-[90vh] overflow-y-auto"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              await handleSubmit(formData);
            }}
          >
            <h1 className="text-lg font-bold">Update Profile</h1>
            <div className="text-xs text-gray-500">
              Use the navbar profile icon to update your avatar or username.
            </div>

            {/* Cover Picture Preview */}
            <div className="relative w-full h-[150px] overflow-hidden rounded-md">
              <Image
                src={cover?.secure_url || user.cover || "/noCover.png"}
                alt="Cover Preview"
                fill
                className="object-cover"
              />
            </div>

            {/* Cover Picture Upload Button */}
            <CldUploadWidget
              uploadPreset="social"
              options={{
                multiple: false,
                resourceType: "image",
                clientAllowedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
              }}
              onSuccess={handleUploadSuccess}
            >
              {({ open }) => {
                return (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500">
                      Cover Picture
                    </label>
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => open()}
                    >
                      <span className="text-sm underline text-orange-400">
                        Change
                      </span>
                    </div>
                  </div>
                );
              }}
            </CldUploadWidget>

            {/* Input fields grid */}
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500">First Name</label>
                <input
                  type="text"
                  placeholder={user.name || "John"}
                  className="ring-1 ring-gray-300 p-[13px] rounded-md text-sm"
                  name="name"
                />
              </div>

              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500">Surname</label>
                <input
                  type="text"
                  placeholder={user.surname || "Doe"}
                  className="ring-1 ring-gray-300 p-[13px] rounded-md text-sm"
                  name="surname"
                />
              </div>

              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500">Description</label>
                <input
                  type="text"
                  name="description"
                  placeholder={user.description || "I miss my girlfriend..."}
                  className="ring-1 ring-gray-300 p-[13px] rounded-md text-sm"
                />
              </div>

              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500">City</label>
                <input
                  name="city"
                  type="text"
                  placeholder={user.city || "London"}
                  className="ring-1 ring-gray-300 p-[13px] rounded-md text-sm"
                />
              </div>

              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500">School</label>
                <input
                  name="school"
                  type="text"
                  placeholder={user.school || "MIT"}
                  className="ring-1 ring-gray-300 p-[13px] rounded-md text-sm"
                />
              </div>

              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500">Work</label>
                <input
                  type="text"
                  name="work"
                  placeholder={user.work || "Goga_Network Inc."}
                  className="ring-1 ring-gray-300 p-[13px] rounded-md text-sm"
                />
              </div>

              <div className="flex flex-col flex-1 min-w-[45%]">
                <label className="text-xs text-gray-500">Website</label>
                <input
                  type="text"
                  name="website"
                  placeholder={user.website || "goga_net.com"}
                  className="ring-1 ring-gray-300 p-[13px] rounded-md text-sm"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm bg-gray-300 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <UpdateButton></UpdateButton>
            </div>

            {/* Close button */}
            <div
              className="cursor-pointer absolute text-xl top-3 right-3"
              onClick={handleClose}
            >
              ✕
            </div>
            {toast && (
              <div
                className={`fixed bottom-5 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-md text-white font-medium ${
                  toast.type === "success" ? "bg-green-500" : "bg-red-500"
                }`}
              >
                {toast.message}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

export default UpdateUser;
