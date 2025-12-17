"use client";

import { useEffect } from "react";
import { subscribeUser } from "@/actions/subscribeAction";

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
  useEffect(() => {
    async function registerAndSubscribe() {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          // 👇 CHANGE THIS: Point directly to custom-sw.js
          const register = await navigator.serviceWorker.register(
            "/custom-sw.js",
            {
              scope: "/",
            }
          );

          console.log("Service Worker registered waiting for ready...");
          await navigator.serviceWorker.ready;
          console.log("Service Worker is ready!");

          const subscription = await register.pushManager.getSubscription();

          if (!subscription) {
            console.log("No subscription found, asking for permission...");
            const newSub = await register.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
              ),
            });

            console.log("Permission granted! Saving to DB...");
            await subscribeUser(JSON.parse(JSON.stringify(newSub)));
          } else {
            console.log("Already subscribed:", subscription.endpoint);
          }
        } catch (e) {
          console.error("Service Worker/Push Error:", e);
        }
      }
    }

    registerAndSubscribe();
  }, []);

  return null;
}
