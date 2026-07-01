const CACHE_NAME = 'radio-lider-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './share.js',
  './LOGO.png',
  './icon-192.png',
  './icon-512.png',
  './FONDO%202.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // Solo interceptar peticiones GET
  if (e.request.method !== 'GET') {
    return;
  }

  // Evitar almacenar en caché la transmisión de audio y peticiones externas dinámicas
  if (
    url.hostname.includes('listen2myradio') || 
    url.pathname.includes('listen.php') ||
    url.search.includes('t=') || // Cache-buster del audio
    url.href.includes('proxy.php') ||
    url.hostname.includes('itunes.apple.com')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        // Almacenar en caché nuevos recursos propios estáticos si es exitosa
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(() => {
        // En caso de estar sin conexión y pedir el HTML, devolver index.html
        if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
