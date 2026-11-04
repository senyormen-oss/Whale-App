// Minimal, safe service worker: same-origin GET requests only, network-first
// with a cache fallback so the app shell still loads offline. Cross-origin
// requests (e.g. specialist images from Unsplash) are left untouched — this
// keeps the cache small and avoids opaque-response quota surprises.
const CACHE_NAME = 'whale-shell-v1'
const APP_SHELL = ['/', '/manifest.json', '/icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() => caches.match(request).then(cached => cached ?? caches.match('/')))
  )
})
