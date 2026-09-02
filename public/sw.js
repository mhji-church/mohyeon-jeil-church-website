const CACHE_NAME = "mhji-public-v2";
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/assets/favicon.png", "/assets/logo-horizontal.png", "/assets/icon-192.png?v=2"];
const PRIVATE_PREFIXES = ["/api/", "/admin", "/member", "/archive", "/gallery"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || PRIVATE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/assets/")) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic" && !response.headers.has("set-cookie")) await cache.put(request, response.clone());
      return response;
    }));
  }
});
