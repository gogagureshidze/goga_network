"use client";

import { useState, useEffect } from "react";
import { subscribeUser } from "@/actions/subscribeAction";
import { BellRing, X } from "lucide-react";

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
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      // Check if dismissed in this session
      const dismissed = sessionStorage.getItem("notif-dismissed");
      if (dismissed) {
        setIsDismissed(true);
        return;
      }

      if ("serviceWorker" in navigator && "PushManager" in window) {
        setIsSupported(true);

        try {
          // Wait for service worker to be ready (it should be registered by PWA component)
          const registration = await navigator.serviceWorker.ready;

          // Check if already subscribed
          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            setIsSubscribed(true);
            // Verify subscription is saved in DB
            await subscribeUser(JSON.parse(JSON.stringify(subscription)));
          } else {
            // Show prompt after a short delay for better UX
            setTimeout(() => setShowPrompt(true), 2000);
          }
        } catch (error) {
          console.error("Error checking notification status:", error);
        }
      }
    }
    checkStatus();
  }, []);

  async function handleSubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;

      // Request permission explicitly (important for iOS)
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        alert("Please allow notifications in your browser settings.");
        return;
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      // Save to database
      await subscribeUser(JSON.parse(JSON.stringify(subscription)));

      setIsSubscribed(true);
      setShowPrompt(false);

      // Show a test notification
      registration.showNotification("Notifications Enabled! 🎉", {
        body: "You'll now receive updates via notifications.",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-96x96.png",
      });
    } catch (error) {
      console.error("Subscription failed:", error);

      // Specific error messages
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          alert(
            "Notifications were blocked. Please enable them in your browser settings."
          );
        } else if (error.name === "NotSupportedError") {
          alert("Push notifications are not supported on this device/browser.");
        }
      } else {
        alert("Could not enable notifications. Please try again.");
      }
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    setIsDismissed(true);
    sessionStorage.setItem("notif-dismissed", "true");
  }

  // Don't render if not supported, already subscribed, dismissed, or shouldn't show
  if (!isSupported || isSubscribed || !showPrompt || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-rose-100 dark:border-gray-700 animate-in slide-in-from-bottom-5 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-full">
          <BellRing className="text-rose-600 dark:text-rose-400" size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white text-sm">
            Enable Notifications
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Get notified when someone likes your posts
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleDismiss}
          className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Dismiss"
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
