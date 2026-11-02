/**
 * Service Worker：让站点能「安装」到桌面并离线使用
 *
 * 策略：**网络优先，缓存兜底**。
 * 之前用过缓存优先，结果改了样式后手机上要刷两次才更新，所以一律先走网络：
 * 在线时永远是最新版本，断网时才回落到缓存。
 * 音频（/audio/）完全不拦截，交给浏览器以保留 Range 拖动。
 */
const VERSION = 'lj-v2';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
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

  e.respondWith((async () => {
    try {
      // no-cache：每次都跟服务器确认一下（没变就 304），避免手机上的 HTTP 缓存把旧 CSS 喂回来
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await caches.match('/index.html');
        if (shell) return shell;
      }
      return new Response('离线状态，且这条资源没有缓存', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
