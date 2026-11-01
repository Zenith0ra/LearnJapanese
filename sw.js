/**
 * Service Worker：让站点能「安装」到桌面并离线使用
 * - 页面导航：网络优先，断网时回退到缓存的首页
 * - 静态资源（JS/CSS/JSON/图标）：缓存优先，后台更新
 * - 音频：完全不拦，交给浏览器（保留 Range 拖动）
 */
const VERSION = 'lj-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/app.css',
  '/assets/js/app.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/data/lessons.json',
  '/data/words.json',
  '/data/grammar.json',
  '/data/workbook.json',
  '/data/meta.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL))
      .catch(() => { /* 个别资源失败也别卡住安装 */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/audio/')) return;   // 音频走网络，保留 Range

  // 数据文件：网络优先，保证改了数据能马上看到
  if (url.pathname.startsWith('/data/')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 页面：网络优先，失败再用缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit || caches.match('/')))
    );
    return;
  }

  // 其他静态资源：缓存优先，同时后台刷新
  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
