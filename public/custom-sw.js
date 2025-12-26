// Service Worker for Push Notifications
const CACHE_NAME = "goga-network-v1";

// Install event - activate immediately
self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installing...");
  self.skipWaiting();
});

// Activate event - take control immediately
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

// 🔥 CRITICAL: Push event handler
self.addEventListener("push", function (event) {
  console.log("🔔 ========== PUSH EVENT RECEIVED ==========");
  console.log("Push data:", event.data ? event.data.text() : "No data");

  if (!event.data) {
    console.log("❌ No data in push event");
    return;
  }

  let data;
  try {
    data = event.data.json();
    console.log("✅ Parsed push data:", data);
  } catch (e) {
    console.error("❌ Failed to parse push data:", e);
    return;
  }

  const title = data.title || "New Notification";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-96x96.png",
    tag: data.tag || "goga-notification",
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      url: data.url || "/",
    },
    actions: data.actions || [],
  };

  console.log("📤 Showing notification with options:", options);

  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(() => {
        console.log("✅ Notification shown successfully");
      })
      .catch((err) => {
        console.error("❌ Failed to show notification:", err);
      })
  );
});

// Notification click event
self.addEventListener("notificationclick", function (event) {
  console.log("👆 Notification clicked:", event.notification.tag);
  event.notification.close();

  const urlToOpen = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  ).href;
  console.log("🔗 Opening URL:", urlToOpen);

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Check if there's already a window open with this URL
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            console.log("✅ Focusing existing window");
            return client.focus();
          }
        }

        // If there's any window open, navigate it
        if (clientList.length > 0 && clientList[0].navigate) {
          console.log("✅ Navigating existing window");
          return clientList[0]
            .focus()
            .then(() => clientList[0].navigate(urlToOpen));
        }

        // Otherwise open a new window
        console.log("✅ Opening new window");
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

// Handle notification close event
self.addEventListener("notificationclose", function (event) {
  console.log("🚫 Notification closed:", event.notification.tag);
});

// Handle messages from the client
self.addEventListener("message", (event) => {
  console.log("📨 Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log("🚀 Service Worker script loaded");
