"use client";

import { useState, useEffect } from "react";
import { subscribeUser } from "@/actions/subscribeAction";
import { BellRing, X } from "lucide-react"; // Make sure you have lucide-react installed

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        setIsSupported(true);

        // 1. Register the worker immediately (this is silent and safe)
        const register = await navigator.serviceWorker.register(
          "/custom-sw.js",
          {
            scope: "/",
          }
        );
        await navigator.serviceWorker.ready;

        // 2. Check if already subscribed
        const subscription = await register.pushManager.getSubscription();

        if (subscription) {
          setIsSubscribed(true);
        } else {
          // If not subscribed, show the button
          setShowPrompt(true);
        }
      }
    }
    checkStatus();
  }, []);

  async function handleSubscribe() {
    try {
      const register = await navigator.serviceWorker.ready;

      // 3. This specific line triggers the iOS popup
      const sub = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      // 4. Save to your DB
      await subscribeUser(JSON.parse(JSON.stringify(sub)));

      setIsSubscribed(true);
      setShowPrompt(false);
      alert("Success! You will now receive notifications.");
    } catch (error) {
      console.error("Subscription failed:", error);
      alert(
        "Could not enable notifications. Make sure you added the app to Home Screen!"
      );
    }
  }

  // Don't render anything if not supported or already subscribed
  if (!isSupported || isSubscribed || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-rose-100 dark:border-gray-700 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-full">
          <BellRing className="text-rose-600 dark:text-rose-400" size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white text-sm">
            Enable Notifications
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Stay updated with likes & comments
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowPrompt(false)}
          className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
        <button
          onClick={handleSubscribe}
          className="px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-lg shadow-lg hover:bg-rose-700 transition-transform active:scale-95"
        >
          Enable
        </button>
      </div>
    </div>
  );
}
