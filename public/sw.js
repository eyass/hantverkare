// Minimal service worker for installability + faster shell loads.
//
// Scope: cache-first for same-origin static assets (Next.js build output,
// icons, fonts) so the app shell paints quickly on a flaky connection. It
// deliberately does NOT intercept navigations, API routes, or Supabase/OpenAI
// calls -- those always go to the network. There is no offline queueing of
// mutations or AI-generation requests here; see NewQuoteForm's localStorage
// draft persistence for the (much narrower) offline-safety this app actually
// provides today.
const CACHE_NAME = "hantverkare-static-v1";

const STATIC_ASSET_PATTERN = /\/_next\/static\/|\/icons\/|\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle simple same-origin GETs for static assets. Everything else
  // (navigations, API routes, POST/PUT/etc, cross-origin requests) is left
  // to the network untouched -- no offline fallback, no request queueing.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!STATIC_ASSET_PATTERN.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Truly offline and not cached -- let the request fail normally
        // rather than fabricating a fake response.
        if (cached) return cached;
        throw err;
      }
    }),
  );
});
