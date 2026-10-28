#!/usr/bin/env node
/**
 * 开发用截图工具（走 CDP，支持真机尺寸模拟 + 整页截图）
 *
 * 用法：node scripts/shot.mjs <输出目录> <宽>x<高> <url> [更多 url...]
 *   例：node scripts/shot.mjs .shots 390x844 "http://127.0.0.1:8321/#/lesson/l1"
 *   命名按 url 的 hash 自动生成，如 lesson-l1-words.png
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;

const [outDir = '.shots', size = '1440x900', ...urls] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const OUT = resolve(outDir);
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
if (!urls.length) { console.error('需要一个 url'); process.exit(1); }

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + join(OUT, '.cdp-profile'),
  `--remote-debugging-port=${PORT}`,
  'about:blank',
], { stdio: 'ignore' });

const waitFor = async (fn, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(150);
  }
  throw new Error('CDP 未就绪');
};

const list = await waitFor(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const j = await r.json();
  return j.find((t) => t.type === 'page') ? j : null;
});
const target = list.find((t) => t.type === 'page');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else if (msg.method) events.push(msg);
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width, height, deviceScaleFactor: 2, mobile: width < 700,
});

for (const url of urls) {
  await send('Page.navigate', { url });
  await sleep(1400); // 等数据 fetch + 渲染

  // SHOT_JS：截图前先在页面里跑一段 JS（比如点开下拉）
  if (process.env.SHOT_JS) {
    await send('Runtime.evaluate', { expression: process.env.SHOT_JS, awaitPromise: true });
    await sleep(500);
  }

  const name = url
    .replace(/^https?:\/\/[^/]+\/?/, '')
    .replace(/^#\/?/, '')
    .replace(/[?&=#/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'home';

  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('→', file);
}

ws.close();
chrome.kill();
process.exit(0);
