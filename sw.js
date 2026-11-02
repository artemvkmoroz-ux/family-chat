'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA — Service Worker (только офлайн-кэш)
   ✓ Precache app shell
   ✓ Cache-first для статики
   ✓ Network-first для навигации (fallback → index.html)
   ✓ Автоочистка старых версий кэша
   ═══════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'azerta-v15.1';
const CACHE_STATIC = CACHE_VERSION + '-static';
const CACHE_RUNTIME = CACHE_VERSION + '-runtime';

// Файлы для офлайн-режима
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/animations.css',
  '/app.js',
  '/calls-patch.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png'
];

// ─── Установка ───
self.addEventListener('install', (event) => {
  console.log('[SW] install', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] pre-cache miss:', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Активация: чистим старые версии ───
self.addEventListener('activate', (event) => {
  console.log('[SW] activate', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
          .map((k) => {
            console.log('[SW] delete old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ───
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Только GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Не кэшируем socket.io и расширения
  if (url.pathname.startsWith('/socket.io/')) return;
  if (url.protocol === 'chrome-extension:') return;

  // Сторонние ресурсы (giphy, qrserver, carto) — не трогаем
  if (url.origin !== self.location.origin) {
    return;
  }

  // Навигация (HTML) — network-first, fallback на кэш
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_RUNTIME).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Статика — cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_RUNTIME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => {
        if (req.destination === 'image') {
          return new Response('', { status: 204 });
        }
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});

// ─── Сообщения от клиента ───
self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => {
          if (event.source && event.source.postMessage) {
            event.source.postMessage({ type: 'CACHE_CLEARED' });
          }
        })
    );
  }

  if (data.type === 'GET_VERSION') {
    if (event.source && event.source.postMessage) {
      event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
    }
  }
});

console.log('[SW] loaded', CACHE_VERSION);
