/* Mizan service worker. Phase 2: makes Mizan installable. Always fetches fresh files from the network.
   Phase 4 adds reminder notifications here. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
