/* CampusBest service worker.
 *
 * Scope: Cache Storage only. A service worker cannot reach localStorage, and this file never
 * touches IndexedDB or any page storage, so installing/activating/updating it cannot affect
 * the user's data (tasks, subjects, schedules, notes, focus sessions, settings).
 *
 * Update strategy: a new worker installs and then WAITS. The page shows "Versi baru tersedia";
 * only when the user taps "Perbarui" does it receive SKIP_WAITING. No automatic takeover, so a
 * page that is open never has its chunks swapped out from under it.
 * Keep VERSION equal to package.json "version" and APP_VERSION in src/lib/pwa.ts (tested).
 */
const VERSION = "0.12.0";
const PREFIX = "campusbest-";
const SHELL_CACHE = PREFIX + "shell-v" + VERSION; // precached on install, replaced per version
const PAGES_CACHE = PREFIX + "pages";             // visited pages; kept across versions
const ASSETS_CACHE = PREFIX + "assets";           // hashed /_next/static files; kept across versions
const OFFLINE_URL = "/offline.html";
const MAX_PAGES = 40;
const MAX_ASSETS = 250;
const NAV_TIMEOUT_MS = 4000;

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];
// Pages fetched best-effort at install so a first visit already warms the main screens.
const WARM_PAGES = ["/dashboard", "/tasks", "/schedule", "/calendar", "/subjects", "/exams", "/notes", "/focus", "/import", "/settings"];

const KEEP = new Set([SHELL_CACHE, PAGES_CACHE, ASSETS_CACHE]);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(PRECACHE_URLS); // required: if this fails, install fails and the old worker stays
    const pages = await caches.open(PAGES_CACHE);
    await Promise.allSettled(WARM_PAGES.map(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      if (res.ok && !res.redirected) await pages.put(url, res);
    }));
    // No skipWaiting() here on purpose: see "Update strategy".
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Only Cache Storage entries with our own prefix, and only outdated shell versions.
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !KEEP.has(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "SKIP_WAITING") self.skipWaiting();
  if (data && data.type === "GET_VERSION" && event.source) event.source.postMessage({ type: "VERSION", version: VERSION });
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function handleNavigation(request) {
  const pages = await caches.open(PAGES_CACHE);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT_MS)),
    ]);
    if (res && res.ok && !res.redirected && res.type === "basic") {
      await pages.put(new URL(request.url).pathname, res.clone());
      trim(PAGES_CACHE, MAX_PAGES);
    }
    return res;
  } catch (err) {
    const cached = (await pages.match(new URL(request.url).pathname)) || (await caches.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function handleAsset(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit; // hashed filenames never change
  const res = await fetch(request);
  if (res && res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
    trim(ASSETS_CACHE, MAX_ASSETS);
  }
  return res;
}

async function handleStatic(request) {
  const hit = await caches.match(request, { ignoreSearch: true });
  const refresh = fetch(request).then(async (res) => {
    if (res && res.ok && res.type === "basic") (await caches.open(SHELL_CACHE)).put(request, res.clone());
    return res;
  });
  if (hit) { refresh.catch(() => {}); return hit; }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // React Server Component payloads and anything dynamic: leave to the network. If they fail
  // offline, Next falls back to a normal navigation, which is handled below.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") { event.respondWith(handleNavigation(request)); return; }
  if (url.pathname.startsWith("/_next/static/")) { event.respondWith(handleAsset(request)); return; }
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === OFFLINE_URL) {
    event.respondWith(handleStatic(request));
  }
});
