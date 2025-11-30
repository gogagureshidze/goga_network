"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
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
  ChevronRight,
  Globe,
  Moon,
  Sun,
} from "lucide-react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { togglePrivateAccount } from "../../actions/togglePrivateAction";
import { toggleActivityStatus } from "../../actions/activityActions";
import {
  toggleAllowStoryComments,
  toggleShowStoryLikes,
} from "../../actions/storySettingsActions";
import { useUserContext } from "../../contexts/UserContext";

export default function SettingsPage() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const {
    userData,
    refreshUser,
    isLoading: isContextLoading,
  } = useUserContext();

  const isPrivate = userData?.isPrivate ?? false;
  const showActivityStatusState = userData?.showActivityStatus ?? true;
  const allowStoryCommentsState = userData?.allowStoryComments ?? true;
  const showStoryLikesState = userData?.showStoryLikes ?? true;

  const [isToggleLoading, setIsToggleLoading] = useState(false);
  const [isActivityToggleLoading, setIsActivityToggleLoading] = useState(false);
  const [isStoryCommentsLoading, setIsStoryCommentsLoading] = useState(false);
  const [isStoryLikesLoading, setIsStoryLikesLoading] = useState(false);

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
        await refreshUser();
      }
    } catch (error) {
      console.error("Failed to toggle activity status:", error);
    } finally {
      setIsActivityToggleLoading(false);
    }
  };

  const handleToggleStoryComments = async () => {
    setIsStoryCommentsLoading(true);
    try {
      await toggleAllowStoryComments();
      await refreshUser();
    } catch (error) {
      console.error("Failed to toggle story comments:", error);
      alert("Failed to update story comments setting");
    } finally {
      setIsStoryCommentsLoading(false);
    }
  };

  const handleToggleStoryLikes = async () => {
    setIsStoryLikesLoading(true);
    try {
      await toggleShowStoryLikes();
      await refreshUser();
    } catch (error) {
      console.error("Failed to toggle story likes:", error);
      alert("Failed to update story likes setting");
    } finally {
      setIsStoryLikesLoading(false);
    }
  };

  if (!isClerkLoaded || (isContextLoading && !userData)) {
    return <div className="loader-spiner"></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Not logged in!!!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please log in to access settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rose-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-rose-800 to-orange-400 dark:from-white dark:to-white bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6 transition-colors">
          <div className="flex items-center gap-10 mb-6">
            <Image
              src={user.imageUrl || "/noAvatar.png"}
              alt="Profile"
              width={50}
              height={50}
              className="rounded-full w-12 h-12 ring-2 mt-5 ring-orange-200 dark:ring-orange-600"
            />
            <div>
              <h2 className="text-xl font-semibold mt-5 text-gray-900 dark:text-white">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                @{user.username}
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Shield
                className="text-orange-500 dark:text-orange-400"
                size={24}
              />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Privacy & Security
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-9">
              Control who can see your content
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <div className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <Lock
                  className="text-gray-400 dark:text-gray-500 mt-1"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Private Account
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Only approved followers can see your posts
                  </p>
                  {isPrivate && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
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
                  isPrivate ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
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

            <div className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <Eye
                  className="text-gray-400 dark:text-gray-500 mt-1"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Show Activity Status
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Let others see when you were last active
                  </p>
                  {showActivityStatusState && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                      ✨ Others can see when you&apos;re online ✨
                    </p>
                  )}
                  {!showActivityStatusState && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
                      🔒 Your activity status is hidden
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleActivityStatus}
                disabled={isActivityToggleLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showActivityStatusState
                    ? "bg-orange-500"
                    : "bg-gray-300 dark:bg-gray-600"
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Globe
                className="text-orange-500 dark:text-orange-400"
                size={24}
              />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Stories
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-9">
              Manage your story preferences
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* Allow Story Comments */}
            <div className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <MessageSquare
                  className="text-gray-400 dark:text-gray-500 mt-1"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Allow Story Comments
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Let others comment on your stories
                  </p>
                  {allowStoryCommentsState && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                      💬 Comments enabled on your stories
                    </p>
                  )}
                  {!allowStoryCommentsState && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
                      🔒 Comments disabled on your stories
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleStoryComments}
                disabled={isStoryCommentsLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  allowStoryCommentsState
                    ? "bg-orange-500"
                    : "bg-gray-300 dark:bg-gray-600"
                } ${
                  isStoryCommentsLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isStoryCommentsLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      allowStoryCommentsState
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                )}
              </button>
            </div>

            {/* Show Story Likes */}
            <div className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <Eye
                  className="text-gray-400 dark:text-gray-500 mt-1"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Show Story Likes Count
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Display like count on your stories
                  </p>
                  {showStoryLikesState && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                      ❤️ Likes are visible on your stories
                    </p>
                  )}
                  {!showStoryLikesState && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
                      🔒 Likes are hidden on your stories
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleStoryLikes}
                disabled={isStoryLikesLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showStoryLikesState
                    ? "bg-orange-500"
                    : "bg-gray-300 dark:bg-gray-600"
                } ${
                  isStoryLikesLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isStoryLikesLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showStoryLikesState ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                )}
              </button>
            </div>

            {/* Story Archive */}
            <button
              onClick={() => router.push("/story")}
              className="p-6 w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
            >
              <div className="flex items-start gap-4 flex-1">
                <Archive
                  className="text-gray-400 dark:text-gray-500 mt-1"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Story Archive
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    View your archived stories
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 dark:text-gray-500"
                size={20}
              />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Bell
                className="text-orange-500 dark:text-orange-400"
                size={24}
              />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Notifications
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-9">
              Choose what you want to be notified about
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {Object.entries(notifications).map(([key, value]) => (
              <div
                key={key}
                className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start gap-4 flex-1">
                  <Bell
                    className="text-gray-400 dark:text-gray-500 mt-1"
                    size={20}
                  />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                      {key}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Get notified about new {key}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setNotifications({ ...notifications, [key]: !value })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    value ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
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

        {/* Appearance - NEW 3-OPTION SECTION */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              {/* This icon will match what's *currently* displayed */}
              {resolvedTheme === "dark" ? (
                <Moon
                  className="text-orange-500 dark:text-orange-400"
                  size={24}
                />
              ) : (
                <Sun
                  className="text-orange-500 dark:text-orange-400"
                  size={24}
                />
              )}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Appearance
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-9">
              Customize how the app looks
            </p>
          </div>

          <div className="p-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">
              Choose a theme
            </h4>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Light Button */}
              <button
                onClick={() => setTheme("light")}
                className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium ${
                  theme === "light"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <Sun size={18} />
                <span>Light</span>
              </button>

              {/* Dark Button */}
              <button
                onClick={() => setTheme("dark")}
                className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium ${
                  theme === "dark"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <Moon size={18} />
                <span>Dark</span>
              </button>

              {/* System Button */}
              <button
                onClick={() => setTheme("system")}
                className={`flex-1 p-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium ${
                  theme === "system"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {/* Using Globe for "System", but feel free to change! */}
                <Globe size={18} />
                <span>System</span>
              </button>
            </div>
          </div>
        </div>

        {/* Archive & Data */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <Archive
                className="text-orange-500 dark:text-orange-400"
                size={24}
              />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Archive & Data
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 ml-9">
              Manage your archived content
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <button className="p-6 w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
              <div className="flex items-start gap-4 flex-1">
                <Archive
                  className="text-gray-400 dark:text-gray-500 mt-1"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Archived Posts
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    View all your archived posts
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 dark:text-gray-500"
                size={20}
              />
            </button>

            <button className="p-6 w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
              <div className="flex items-start gap-4 flex-1">
                <Cookie
                  className="text-gray-400 dark:text-gray-500 mt-1"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Cookies & Permissions
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Manage cookies and app permissions
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 dark:text-gray-500"
                size={20}
              />
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-red-200 dark:border-red-900 mb-8 transition-colors">
          <div className="p-6 border-b border-red-100 dark:border-red-900 bg-red-200 dark:bg-red-900/20">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="text-red-500 dark:text-red-400" size={24} />
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
                Danger Zone
              </h3>
            </div>
            <p className="text-sm text-red-700 dark:text-red-400 ml-9">
              Irreversible and destructive actions
            </p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            <button
              onClick={() => setShowDeactivateModal(true)}
              className="p-6 w-full flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left group"
            >
              <div className="flex items-start gap-4 flex-1">
                <EyeOff
                  className="text-gray-400 dark:text-gray-500 group-hover:text-red-500 mt-1 transition-colors"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    Deactivate Account
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Temporarily disable your account
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 dark:text-gray-500 group-hover:text-red-500 transition-colors"
                size={20}
              />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-6 w-full flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left group"
            >
              <div className="flex items-start gap-4 flex-1">
                <Trash2
                  className="text-gray-400 dark:text-gray-500 group-hover:text-red-500 mt-1 transition-colors"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    Delete All Posts
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Permanently delete all your posts
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 dark:text-gray-500 group-hover:text-red-500 transition-colors"
                size={20}
              />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-6 w-full flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left group"
            >
              <div className="flex items-start gap-4 flex-1">
                <Trash2
                  className="text-gray-400 dark:text-gray-500 group-hover:text-red-500 mt-1 transition-colors"
                  size={20}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    Delete Account
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Permanently delete your account and all data
                  </p>
                </div>
              </div>
              <ChevronRight
                className="text-gray-400 dark:text-gray-500 group-hover:text-red-500 transition-colors"
                size={20}
              />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2
                    className="text-red-500 dark:text-red-400"
                    size={24}
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Delete Account?
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This action cannot be undone. All your posts, stories, and data
                will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
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
