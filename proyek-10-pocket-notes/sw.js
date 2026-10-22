/*
 * Pocket Notes Service Worker.
 * Naikkan angka pada CACHE_NAME setiap kali app shell berubah agar cache lama
 * dihapus pada fase activate dan aset baru benar-benar dipakai.
 */
const CACHE_PREFIX = "pocket-notes-";
const CACHE_NAME = `${CACHE_PREFIX}shell-v2`;

const APP_SHELL = [
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "assets/icon.svg",
  "assets/icon-maskable.svg",
  "js/app.js",
  "js/db.js",
  "js/notes.js",
  "js/ui.js",
];

const SCOPE = self.registration.scope;
const INDEX_URL = new URL("index.html", SCOPE).href;
const SHELL_URLS = APP_SHELL.map((path) => new URL(path, SCOPE).href);

async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    clients.forEach((client) => {
      try {
        client.postMessage(message);
      } catch {
        // Satu klien yang sudah ditutup tidak boleh menggagalkan notifikasi lain.
      }
    });
  } catch {
    // Notifikasi bersifat tambahan; kegagalan instalasi tetap dilaporkan lewat reject.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const failures = [];

      // Cache per aset agar aset yang gagal dapat disebutkan dengan jelas.
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: "reload" }));
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            await cache.put(url, response);
          } catch (error) {
            failures.push({
              url,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      );

      if (failures.length > 0) {
        await notifyClients({
          type: "pocket-notes:install-failed",
          cacheName: CACHE_NAME,
          failures,
        });
        throw new Error(
          `Precache gagal untuk: ${failures.map((failure) => failure.url).join(", ")}`,
        );
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function handleNavigation(request) {
  const cached = await caches.match(INDEX_URL);
  if (cached) return cached;

  try {
    return await fetch(request);
  } catch {
    return new Response(
      '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pocket Notes offline</title></head><body><h1>Pocket Notes belum siap offline</h1><p>Buka halaman ini sekali lagi saat terhubung ke server agar app shell tersimpan di cache.</p></body></html>',
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    return await fetch(request);
  } catch {
    return new Response("Aset tidak tersedia saat offline.", {
      status: 504,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "pocket-notes:status") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const matches = await Promise.all(
          SHELL_URLS.map((url) => cache.match(url)),
        );
        const cached = matches.every(Boolean);

        event.ports[0]?.postMessage({
          type: "pocket-notes:status",
          cached,
          cacheName: CACHE_NAME,
          cachedCount: matches.filter(Boolean).length,
          expectedCount: SHELL_URLS.length,
        });
      })(),
    );
  }
});
