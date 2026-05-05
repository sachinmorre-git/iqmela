// IQMela Service Worker — Push Notifications + Offline Support
// This file lives in /public and runs in the browser's background thread.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push notification handler ───────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: data.icon || "/brand/icon/iq-icon-192.png",
      badge: data.badge || "/brand/icon/iq-icon-48.png",
      vibrate: [100, 50, 100],
      data: { url: data.data?.url || "/" },
      actions: [
        { action: "open", title: "Open" },
        { action: "dismiss", title: "Dismiss" },
      ],
      tag: data.tag || "iqmela-notification",
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "IQMela", options)
    );
  } catch (e) {
    console.error("[SW] Failed to parse push payload:", e);
  }
});

// ── Notification click handler ──────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
