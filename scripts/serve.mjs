#!/usr/bin/env node
/** 本地预览用极简静态服务器：node scripts/serve.mjs [端口]
 *  支持 Range 请求（音频拖动进度必需），行为与 GitHub Pages 一致。 */
import { createServer } from 'node:http';
import { stat, open } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { createReadStream } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.argv[2] ?? 8321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
    if (url.endsWith('/')) file = join(file, 'index.html');

    let st;
    try { st = await stat(file); } catch { st = null; }
    if (!st || st.isDirectory()) {
      file = join(ROOT, 'index.html');
      st = await stat(file);
    }

    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const total = st.size;

    // ---- Range 支持（<audio> 拖动进度必须） ----
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        let start = m[1] === '' ? null : Number(m[1]);
        let end = m[2] === '' ? null : Number(m[2]);
        if (start === null && end === null) {
          res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': total });
          return createReadStream(file).pipe(res);
        }
        if (start === null) { start = Math.max(0, total - end); end = total - 1; }
        else if (end === null || end >= total) end = total - 1;

        if (start > end || start >= total) {
          res.writeHead(416, { 'content-range': `bytes */${total}` });
          return res.end();
        }

        res.writeHead(206, {
          'content-type': type,
          'accept-ranges': 'bytes',
          'content-length': end - start + 1,
          'content-range': `bytes ${start}-${end}/${total}`,
          'cache-control': 'no-store',
        });
        return createReadStream(file, { start, end }).pipe(res);
      }
    }

    res.writeHead(200, {
      'content-type': type,
      'content-length': total,
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('server error: ' + err.message);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`preview: http://127.0.0.1:${PORT}/`);
});
