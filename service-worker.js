// SiteBuilder service worker placeholder.
// The app registers a worker for update detection, but customer sites do not
// use a custom fetch/cache strategy here. Keeping the worker non-intercepting
// avoids 404s without changing application/network behavior.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
