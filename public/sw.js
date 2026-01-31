// sw.js - Simple, working service worker for push notifications

const CACHE_NAME = "goga-network-v1";

// Install event
self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installing...");
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activating...");
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
      self.clients.claim(),
    ])
  );
});

// Push notification event
self.addEventListener("push", function (event) {
  console.log("🔔 Push notification received");

  if (!event.data) {
    console.log("❌ No data in push event");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
    console.log("📦 Payload:", payload);
  } catch (e) {
    console.error("❌ Failed to parse push data:", e);
    return;
  }

  const title = payload.message || payload.title || "New Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    tag: "goga-notification",
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || "/",
      dateOfArrival: Date.now(),
    },
  };

  console.log("📤 Showing notification:", title);

  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(() => console.log("✅ Notification shown"))
      .catch((err) => console.error("❌ Failed to show notification:", err))
  );
});

// Notification click event
self.addEventListener("notificationclick", function (event) {
  console.log("👆 Notification clicked");
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Check if already open
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }

        // Navigate existing window if available
        if (clientList.length > 0) {
          return clientList[0].focus().then(() => {
            if (clientList[0].navigate) {
              return clientList[0].navigate(urlToOpen);
            }
          });
        }

        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch((err) => {
        console.error("❌ Error handling notification click:", err);
        return clients.openWindow(urlToOpen);
      })
  );
});

// Handle notification close
self.addEventListener("notificationclose", function (event) {
  console.log("🚫 Notification closed");
});

// Handle messages from client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

console.log("🚀 Service Worker loaded");
