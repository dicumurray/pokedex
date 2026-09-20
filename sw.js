// ============================================================
// POKÉDEX — Service Worker (PWA)
// ============================================================
// Cachea la app shell (HTML, CSS, JS) para funcionamiento offline.
// Los datos de Pokémon se cargan desde la API (no se cachean,
// salvo los detalles visitados que se guardan en IndexedDB).

const CACHE_NAME = "pokedex-v1.0.2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./detail.html",
  "./css/style.css",
  "./js/script.js",
  "./js/detail.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.hostname === "pokeapi.co") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          if (clone.ok) {
            caches.open("pokedex-api-v1").then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: "Sin conexión. Reintentá más tarde." }),
              { status: 503, headers: { "Content-Type": "application/json" } }
            );
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === "document") {
          return caches.match("./");
        }
        return new Response("Offline", { status: 503 });
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
