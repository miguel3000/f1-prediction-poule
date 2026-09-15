// Minimal service worker — its only job is to exist and respond to fetch,
// which is what makes Chrome/Android consider the site installable.
// No caching: this is an app that shows live race data, so serving stale
// content offline would be actively wrong.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Always fall through to the network.
});
