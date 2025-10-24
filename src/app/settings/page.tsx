"use client";

import { useState } from "react";
import {
  User,
  Lock,
  Bell,
  Eye,
  EyeOff,
  Archive,
  MessageSquare,
  Shield,
  Cookie,
  Trash2,
  LogOut,
  ChevronRight,
  Globe,
  Moon,
  Sun,
} from "lucide-react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { togglePrivateAccount } from "../../actions/togglePrivateAction";
import { toggleActivityStatus } from "../../actions/activityActions"; // 🆕 Import this
import { useUserContext } from "../../contexts/UserContext";

export default function SettingsPage() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const router = useRouter();

  const {
    userData,
    refreshUser,
    isLoading: isContextLoading,
  } = useUserContext();
  const isPrivate = userData?.isPrivate ?? false;
  const showActivityStatusState = userData?.showActivityStatus ?? true; // 🆕 Get from context

  const [isToggleLoading, setIsToggleLoading] = useState(false);
  const [isActivityToggleLoading, setIsActivityToggleLoading] = useState(false); // 🆕 Add loading state

  // These other states are fine because they are local to this page
  const [allowStoryComments, setAllowStoryComments] = useState(true);
  const [showStoryLikes, setShowStoryLikes] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const handleTogglePrivate = async () => {
    setIsToggleLoading(true);
    try {
      await togglePrivateAccount();
      await refreshUser();
    } catch (error) {
      console.error("Failed to toggle privacy:", error);
      alert("Failed to update privacy settings");
    } finally {
      setIsToggleLoading(false);
    }
  };
const handleToggleActivityStatus = async () => {
  setIsActivityToggleLoading(true);
  try {
    const res = await toggleActivityStatus();

    if (res.success) {
      // ✅ Update UI immediately (no waiting for revalidation)
      await refreshUser();
    }
  } catch (error) {
    console.error("Failed to toggle activity status:", error);
  } finally {
    setIsActivityToggleLoading(false);
  }
};

console.log(userData?.isPrivate, "USER DATA ACTIVITY STATUS");
  // Loading state: Wait for BOTH Clerk and your context to be ready
  if (!isClerkLoaded || isContextLoading) {
    return <div className="loader-spiner"></div>;
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Not logged in!!!
          </h2>
          <p className="text-gray-600">Please log in to access settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen rose-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-rose-800 to-orange-400 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-gray-600">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-10 mb-6">
            <Image
              src={user.imageUrl || "/noAvatar.png"}
              alt="Profile"
              width={50}
              height={50}
              className="rounded-full w-12 h-12 ring-2 mt-5 ring-orange-200"
            />
            <div>
              <h2 className="text-xl font-semibold mt-5 text-gray-900">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-gray-600">@{user.username}</p>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">
                Privacy & Security
              </h3>
            </div>
            <p className="text-sm text-gray-600 ml-9">
              Control who can see your content
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {/* Private Account */}
            <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <Lock className="text-gray-400 mt-1" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">Private Account</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Only approved followers can see your posts
                  </p>
                  {isPrivate && (
                    <p className="text-xs text-orange-600 mt-2 font-medium">
                      🚀 Your account is private. Existing followers can still
                      see your content. 🚀
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleTogglePrivate}
                disabled={isToggleLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPrivate ? "bg-orange-500" : "bg-gray-300"
                } ${isToggleLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isToggleLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPrivate ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                )}
              </button>
            </div>

            {/* 🆕 Activity Status - UPDATED VERSION */}
            <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <Eye className="text-gray-400 mt-1" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">
                    Show Activity Status
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Let others see when you were last active
                  </p>
                  {showActivityStatusState && (
                    <p className="text-xs text-green-600 mt-2 font-medium">
                      ✨ Others can see when you&apos;re online ✨
                    </p>
                  )}
                  {!showActivityStatusState && (
                    <p className="text-xs text-gray-500 mt-2 font-medium">
                      🔒 Your activity status is hidden
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleActivityStatus}
                disabled={isActivityToggleLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showActivityStatusState ? "bg-orange-500" : "bg-gray-300"
                } ${
                  isActivityToggleLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isActivityToggleLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showActivityStatusState
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stories Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Globe className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">Stories</h3>
            </div>
            <p className="text-sm text-gray-600 ml-9">
              Manage your story preferences
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {/* Allow Story Comments */}
            <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <MessageSquare className="text-gray-400 mt-1" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">
                    Allow Story Comments
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Let others comment on your stories
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAllowStoryComments(!allowStoryComments)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  allowStoryComments ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    allowStoryComments ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Show Story Likes */}
            <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <Eye className="text-gray-400 mt-1" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">
                    Show Story Likes Count
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Display like count on your stories
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStoryLikes(!showStoryLikes)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showStoryLikes ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showStoryLikes ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Story Archive */}
            <button className="p-6 w-full flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-start gap-4 flex-1">
                <Archive className="text-gray-400 mt-1" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">Story Archive</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    View your archived stories
                  </p>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Bell className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications
              </h3>
            </div>
            <p className="text-sm text-gray-600 ml-9">
              Choose what you want to be notified about
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {Object.entries(notifications).map(([key, value]) => (
              <div
                key={key}
                className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4 flex-1">
                  <Bell className="text-gray-400 mt-1" size={20} />
                  <div>
                    <h4 className="font-medium text-gray-900 capitalize">
                      {key}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Get notified about new {key}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setNotifications({ ...notifications, [key]: !value })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    value ? "bg-orange-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      value ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Moon className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">
                Appearance
              </h3>
            </div>
            <p className="text-sm text-gray-600 ml-9">
              Customize how the app looks
            </p>
          </div>

          <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4 flex-1">
              {darkMode ? (
                <Moon className="text-gray-400 mt-1" size={20} />
              ) : (
                <Sun className="text-gray-400 mt-1" size={20} />
              )}
              <div>
                <h4 className="font-medium text-gray-900">Dark Mode</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Switch to dark theme
                </p>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? "bg-orange-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Archive & Data */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Archive className="text-orange-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">
                Archive & Data
              </h3>
            </div>
            <p className="text-sm text-gray-600 ml-9">
              Manage your archived content
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            <button className="p-6 w-full flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-start gap-4 flex-1">
                <Archive className="text-gray-400 mt-1" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">Archived Posts</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    View all your archived posts
                  </p>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </button>

            <button className="p-6 w-full flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-start gap-4 flex-1">
                <Cookie className="text-gray-400 mt-1" size={20} />
                <div>
                  <h4 className="font-medium text-gray-900">
                    Cookies & Permissions
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage cookies and app permissions
                  </p>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 mb-8">
          <div className="p-6 border-b border-red-100 bg-red-200">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="text-red-500" size={24} />
              <h3 className="text-lg font-semibold text-red-900">
                Danger Zone
              </h3>
            </div>
            <p className="text-sm text-red-700 ml-9">
              Irreversible and destructive actions
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            <button
              onClick={() => setShowDeactivateModal(true)}
              className="p-6 w-full flex items-center justify-between hover:bg-red-50 transition-colors text-left group"
            >
              <div className="flex items-start gap-4 flex-1">
                <EyeOff
                  className="text-gray-400 group-hover:text-red-500 mt-1 transition-colors"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                    Deactivate Account
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Temporarily disable your account
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 group-hover:text-red-500 transition-colors"
                size={20}
              />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-6 w-full flex items-center justify-between hover:bg-red-50 transition-colors text-left group"
            >
              <div className="flex items-start gap-4 flex-1">
                <Trash2
                  className="text-gray-400 group-hover:text-red-500 mt-1 transition-colors"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                    Delete All Posts
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Permanently delete all your posts
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 group-hover:text-red-500 transition-colors"
                size={20}
              />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-6 w-full flex items-center justify-between hover:bg-red-50 transition-colors text-left group"
            >
              <div className="flex items-start gap-4 flex-1">
                <Trash2
                  className="text-gray-400 group-hover:text-red-500 mt-1 transition-colors"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                    Delete Account
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Permanently delete your account and all data
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 group-hover:text-red-500 transition-colors"
                size={20}
              />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="text-red-500" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Delete Account?
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                This action cannot be undone. All your posts, stories, and data
                will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium">
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deactivate Confirmation Modal */}
        {showDeactivateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <EyeOff className="text-orange-500" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Deactivate Account?
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                Your account will be temporarily disabled. You can reactivate it
                anytime by logging back in.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium">
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
