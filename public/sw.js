// Service Worker für die installierbare PWA (Feature Mobile-Optimierung).
// Bewusst kein Precache-Manifest (Vite-Bundle-Dateinamen sind pro Build
// gehasht, ein statisches Manifest würde nach jedem Deploy veralten) --
// stattdessen Laufzeit-Caching:
//
// - /api/* wird NIE gecacht: die Antworten sind dynamisch und teils
//   personenbezogen (Coachie-/Admin-Daten), Caching wäre hier ein
//   Datenleck-Risiko auf einem geteilten Gerät, kein Performance-Gewinn.
// - Navigationen (HTML) laufen network-first mit Cache-Fallback, damit
//   ein erneuter Aufruf ohne Netz zumindest die zuletzt geladene Seite
//   zeigt, statt einen Browser-Fehler.
// - Statische Assets (JS/CSS/Bilder/Icons) laufen stale-while-revalidate:
//   sofort aus dem Cache antworten, falls vorhanden, im Hintergrund
//   aktualisieren -- schnelle wiederholte Ladezeiten auf Mobilgeräten.
const CACHE_NAME = 'mrh-coaching-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html'))),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const netzwerk = fetch(event.request)
          .then((response) => {
            cache.put(event.request, response.clone())
            return response
          })
          .catch(() => cached)

        return cached || netzwerk
      }),
    ),
  )
})
