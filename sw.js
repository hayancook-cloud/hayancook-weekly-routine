// 앱 화면과 아이콘을 캐시하여 설치 후 인터넷 없이도 실행하도록 한다.
const CACHE = 'hayancook-v3';
const FILES = ['./', './index.html', './style.css', './app.js', './routine.js', './calendar.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hayancook-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const known = FILES.some(file => new URL(file, self.location).pathname === url.pathname);
  if (!known && event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok && known && !response.redirected && response.type === 'basic') await cache.put(event.request, response.clone());
      if (response.ok) return response;
      return await cache.match(event.request, { ignoreSearch: true }) || response;
    } catch {
      const saved = await cache.match(event.request, { ignoreSearch: true });
      return saved || (event.request.mode === 'navigate' ? await cache.match('./index.html') : Response.error());
    }
  })());
});
