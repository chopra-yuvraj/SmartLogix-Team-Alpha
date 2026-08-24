/**
 * SmartLogix — Service Worker for PWA + Web Push (Task 5.1, 8.1)
 *
 * Handles:
 * - PWA offline caching (app shell + API responses)
 * - Web Push notification display
 */

const CACHE_NAME = "smartlogix-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

// Install — cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch — network-first with cache fallback
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip API calls (let them go to network)
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});

// Push — display notification (Task 8.1)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.title || "SmartLogix";
  const options = {
    body: payload.body || payload.message || "New notification",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
    actions: payload.actions || [],
    tag: payload.tag || "smartlogix-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open the relevant page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = "/";

  if (data.type === "bid_opportunity") {
    url = `/driver/bids?route=${data.route_id}`;
  } else if (data.type === "bid_outcome") {
    url = `/driver/routes`;
  } else if (data.type === "route_ready") {
    url = `/shipper?shipment=${data.shipment_id}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
