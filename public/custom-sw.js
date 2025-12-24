// Service Worker for Push Notifications
const CACHE_NAME = "goga-network-v1";

// Install event - activate immediately
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting();
});

// Activate event - take control immediately
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
      // Take control of all clients
      self.clients.claim(),
    ])
  );
});

// Push event - show notification
self.addEventListener("push", function (event) {
  console.log("Push notification received:", event);

  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/icon-96x96.png",
      vibrate: [200, 100, 200],
      tag: data.tag || "notification",
      requireInteraction: false,
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || "1",
        url: data.url || "/",
      },
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options).then(() => {
        console.log("Notification shown successfully");
      })
    );
  } else {
    console.log("Push event but no data");
  }
});

// Notification click event
self.addEventListener("notificationclick", function (event) {
  console.log("Notification clicked:", event.notification.tag);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }

        // If there's any window open, focus it and navigate
        if (clientList.length > 0) {
          return clientList[0].focus().then((client) => {
            return client.navigate(urlToOpen);
          });
        }

        // Otherwise open a new window
        return clients.openWindow(urlToOpen);
      })
      .catch((err) => {
        console.error("Error handling notification click:", err);
        return clients.openWindow(urlToOpen);
      })
  );
});

// Handle notification close event
self.addEventListener("notificationclose", function (event) {
  console.log("Notification closed:", event.notification.tag);
});

// Handle messages from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
