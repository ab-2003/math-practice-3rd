// The service worker. Hand written, no Workbox: every line is a decision we
// can point at. The precache list and the build stamp are stamped in at BUILD
// time by the plugin in vite.config.ts, from the real build output, because a
// hand maintained list is one forgotten file away from an app that boots
// offline to a blank screen.

const PRECACHE = __PRECACHE__;
const STAMP = __STAMP__;
const CACHE = `trickline-${STAMP}`;

/**
 * ignoreVary is LOAD BEARING.
 *
 * Both vite preview and Cloudflare send `Vary: Origin`. The Cache API honours
 * Vary by comparing the STORED request's headers against the new one's, and
 * cache.addAll() issues same origin no-cors requests carrying no Origin header
 * at all, while Vite marks the module script `crossorigin` so that one DOES
 * carry one. Stored without, requested with, no match: the app caches every
 * file perfectly and then boots offline to nothing.
 */
const MATCH = { ignoreSearch: true, ignoreVary: true };

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll is all or nothing, which is what we want: a half populated cache
    // is an app that boots offline and dies on the first missing piece.
    await cache.addAll(PRECACHE);
    // NO skipWaiting. One production URL means a worker that swaps the bundle
    // mid session has nowhere to be caught. The page offers a reload chip.
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const isDocument = (request) => request.mode === "navigate" || request.destination === "document";

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The document is network first so an online launch always sees the current
  // build, and cache fallback so an offline launch still boots.
  if (isDocument(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("./index.html", MATCH)) ?? Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, MATCH);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      // Only cache real answers. Pages replies to an unknown path with
      // index.html at status 200, so a missing asset would otherwise be cached
      // as a fake success and fail silently forever.
      if (fresh.ok && fresh.type === "basic") {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});
