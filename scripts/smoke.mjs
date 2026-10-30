#!/usr/bin/env node
/**
 * 交互冒烟测试：真的去点按钮，收集 JS 异常。
 * 用法：node scripts/smoke.mjs [baseUrl]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8321';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;
const PROFILE = join(process.env.TEMP ?? '.', 'lj-smoke-profile');
if (!existsSync(PROFILE)) mkdirSync(PROFILE, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + PROFILE, `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: 'ignore' });

const waitFor = async (fn, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(150);
  }
  throw new Error('CDP 未就绪');
};

const targets = await waitFor(async () => {
  const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  return j.find((t) => t.type === 'page') ? j : null;
});
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    errors.push(`异常: ${d.exception?.description ?? d.text} @${d.url ?? ''}:${d.lineNumber ?? ''}`);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pending.set(n, { res, rej });
  ws.send(JSON.stringify({ id: n, method, params }));
});

await send('Runtime.enable');
await send('Page.enable');
// 关掉浏览器缓存：否则连续跑测试会拿到上次的 JS（GitHub Pages 有 10 分钟缓存）
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

const go = async (hash) => {
  // 先回 about:blank，强制整页重载：否则只改 hash 不会重新执行模块，
  // localStorage 的内存缓存会带着上一次的状态，测试结果不稳定。
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(120);
  await send('Page.navigate', { url: `${BASE}/${hash}` });
  await sleep(1200);
};

const results = [];
const check = async (name, expr, expect = (v) => !!v) => {
  // 渲染是异步的：轮询到条件成立，但点击类表达式只执行一次（避免重复触发）
  const once = expr.includes('.click(');
  let v;
  for (let i = 0; i < (once ? 1 : 20); i++) {
    v = await evaluate(expr);
    const ok = typeof expect === 'function' ? expect(v) : v === expect;
    if (ok) { results.push({ name, ok: true, got: v }); return; }
    if (once) break;
    await sleep(150);
  }
  const ok = typeof expect === 'function' ? expect(v) : v === expect;
  results.push({ name, ok, got: v });
};

/* ---------- 首页 ---------- */
await go('#/');
await evaluate('localStorage.clear()');   // 清掉上一次跑测试留下的进度
await go('#/');
await check('首页渲染课程卡片', `document.querySelectorAll('.lesson-card').length`, (n) => n === 48);
await check('切到中级', `(document.querySelector('[data-level=middle]').click(), 1)`);
await sleep(600);
await check('中级 32 课', `document.querySelectorAll('.lesson-card').length`, (n) => n === 32);
await check('切回初级', `(document.querySelector('[data-level=basic]').click(), 1)`);
await sleep(500);

/* ---------- 课文页 ---------- */
await go('#/lesson/l1');
await check('课文标题', `document.querySelector('.lesson-head h1').textContent.includes('中国人')`, true);
await check('基本课文行数', `document.querySelectorAll('#pane .line').length`, (n) => n >= 4);
await check('有进度条', `!!document.querySelector('#seek')`);
await check('时间显示', `document.querySelector('#time').textContent.includes('/')`);
await check('默认倍速 1×', `document.querySelector('#speedBtn').textContent.trim()`, '1×');
await check('点倍速到 1.25×', `(document.querySelector('#speedBtn').click(), 1)`);
await sleep(150);
await check('倍速文案 1.25×', `document.querySelector('#speedBtn').textContent.trim()`, '1.25×');
await check('拖动进度条更新时长', `(() => {
  const s = document.querySelector('#seek');
  s.value = '500';
  s.dispatchEvent(new Event('input', { bubbles: true }));
  return document.querySelector('#time').textContent;
})()`, (v) => v.includes('/') && !v.startsWith('0:00'));
await check('点生词标签', `(document.querySelector('[data-tab=words]').click(), 1)`);
await sleep(900);
await check('生词渲染', `document.querySelectorAll('#pane .word-row').length`, (n) => n === 56);
await check('生词两栏（宽屏）', `getComputedStyle(document.querySelector('.word-list')).gridTemplateColumns.split(' ').length`, 2);
await check('音调线存在', `document.querySelectorAll('#pane .pitch .mora.h').length`, (n) => n > 0);
await check('点语法标签', `(document.querySelector('[data-tab=grammar]').click(), 1)`);
await sleep(700);
await check('语法渲染', `document.querySelectorAll('#pane .g-item').length`, (n) => n === 5);
await check('回课文', `(document.querySelector('[data-tab="0"]').click(), 1)`);
await sleep(400);
await check('关注音', `(document.querySelector('#optRuby').click(), 1)`);
await check('注音已隐藏', `getComputedStyle(document.querySelector('#pane .rb-r')).visibility`, 'hidden');
await check('开译文', `(document.querySelector('#optTr').click(), 1)`);
await check('译文可见', `document.querySelectorAll('#pane .tr').length`, (n) => n >= 4);
await check('课文页不再有“标记已学”', `document.querySelector('#doneBtn') === null`, true);

/* ---------- 翻页 ---------- */
await check('下一课链接', `!!document.querySelector('.pager.lesson-nav a[href="#/lesson/l2"]')`, true);
await go('#/lesson/l48');
await check('末课连接到中级第 1 课', `document.querySelector('.pager.lesson-nav a[href="#/lesson/m1"]') !== null`);

/* ---------- 单词页 ---------- */
await go('#/words');
await check('单词表行数', `document.querySelectorAll('#tbody tr').length`, 80);
await check('分页有 72 页', `document.querySelector('#pager .count').textContent.trim()`, '1 / 72');
await check('搜索「先生」', `(() => { const i = document.querySelector('#q'); i.value='先生'; i.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
await sleep(500);
await check('搜索结果变少', `document.querySelectorAll('#tbody tr').length`, (n) => n > 0 && n < 80);
await check('翻页', `(document.querySelector('#pager button[data-p="1"]')?.click(), 1)`);

/* ---------- 语法页 ---------- */
await go('#/grammar');
await check('语法分组', `document.querySelectorAll('.gpage-item').length`, (n) => n > 20);
await check('切中级语法', `(document.querySelector('#lv [data-v=middle]').click(), 1)`);
await sleep(400);
await check('中级语法分组', `document.querySelectorAll('.gpage-item').length`, (n) => n > 10);

/* ---------- 背单词 ---------- */
await go('#/cards?ref=001');
await check('卡片有词', `!!document.querySelector('#front .front-cn, #front .front-ja')`);
await check('没有多余的揭晓按钮', `document.querySelector('#action') === null`, true);
await check('点卡片翻面', `(document.querySelector('#card').click(), 1)`);
await sleep(200);
await check('卡片已翻到背面', `document.querySelector('#card').classList.contains('revealed')`, true);
await check('背面有大字与释义', `!!document.querySelector('#back .back-hero') && !!document.querySelector('#back .back-meaning')`);
await check('背面有声调数字', `!!document.querySelector('#back .pitch-num')`);
await check('再点一次进下一张', `(document.querySelector('#card').click(), 1)`);
await sleep(200);
await check('计数走到第二个', `document.querySelector('#counter').textContent.trim()`, (v) => v.startsWith('2 /'));
await check('翻回正面', `document.querySelector('#card').classList.contains('revealed')`, false);
// 换卡时背面必须立刻隐藏，否则淡出的那一下会闪出下一张的答案
await check('换卡后背面瞬间不可见', `getComputedStyle(document.querySelector('#back')).opacity`, '0');

// 键盘：空格第一次翻面，第二次下一张
await check('空格翻面', `(document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })), 1)`);
await sleep(200);
await check('空格后已翻面', `document.querySelector('#card').classList.contains('revealed')`, true);
await check('空格再按进下一张', `(document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })), 1)`);
await sleep(200);
await check('已到第三张', `document.querySelector('#counter').textContent.trim()`, (v) => v.startsWith('3 /'));

// 选择某一课
await check('打开课次下拉', `(document.querySelector('.dd-trigger').click(), 1)`);
await sleep(200);
await check('下拉里有课次分组', `document.querySelectorAll('.dd-opt').length`, (n) => n >= 80);
await check('选中第 3 课', `(document.querySelector('.dd-opt[data-value="basic:3"]').click(), 1)`);
await sleep(400);
await check('范围已切到第 3 课', `document.querySelector('#counter').textContent.trim()`, (v) => v.endsWith('/ 43'));
await check('触发按钮显示课名', `document.querySelector('.dd-value').textContent.includes('第 3 課')`, true);

// 顺序 / 随机
await check('切到顺序', `(document.querySelector('#orderSeg [data-order=order]').click(), 1)`);
await sleep(300);
await check('顺序模式第一张是第 3 课第一个词', `document.querySelector('#front .front-cn')?.textContent`, (v) => v === '百货商店');
await check('切回随机', `(document.querySelector('#orderSeg [data-order=random]').click(), 1)`);
await sleep(200);
await check('随机模式仍从第一张开始', `document.querySelector('#counter').textContent.trim()`, (v) => v.startsWith('1 /'));

/* ---------- AI 面板 ---------- */
await evaluate(`localStorage.setItem('lj.ai.key', JSON.stringify('sk-test-invalid-key-000'))`);
await go('#/');
await check('AI 浮动按钮存在', `!!document.querySelector('#aiFab')`);
await check('点击打开面板', `(document.querySelector('#aiFab').click(), 1)`);
await sleep(500);
await check('面板展开', `document.querySelector('#aiPanel').classList.contains('open')`, true);
await check('输入框可用', `!!document.querySelector('#aiInput')`);
await check('顶部显示已保存的 Key', `document.querySelector('#aiKeyChip').classList.contains('on') && document.querySelector('#aiKeyChip .txt').textContent.includes('…')`);
await sleep(1500);
await check('KaTeX 已按需加载', `typeof window.katex !== 'undefined' && typeof window.renderMathInElement === 'function'`);
await check('发一条消息', `(() => {
  const i = document.querySelector('#aiInput');
  i.value = '你好';
  i.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#aiSend').click();
  return 1;
})()`);
await check('出现用户气泡', `document.querySelectorAll('.ai-msg.me').length`, 1);
await sleep(5000);
await check('拿到回复或错误提示', `!!document.querySelector('.ai-md, .ai-error')`);
await check('按 Esc 关闭', `(document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 1)`);
await sleep(400);
await check('面板已关闭', `document.querySelector('#aiPanel').classList.contains('open')`, false);
await evaluate(`localStorage.removeItem('lj.ai.key')`);

/* ---------- 主题 ---------- */
await check('切主题', `(document.querySelector('#themeBtn').click(), document.documentElement.dataset.theme)`, (v) => ['auto', 'light', 'dark'].includes(v));

/* ---------- 汇报 ---------- */
const bad = results.filter((r) => !r.ok);
console.log('\n冒烟测试：');
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ' → ' + JSON.stringify(r.got)}`);
console.log(`\n通过 ${results.length - bad.length}/${results.length}`);
if (errors.length) {
  console.log('\nJS 错误：');
  [...new Set(errors)].slice(0, 15).forEach((e) => console.log('  ! ' + e));
}
ws.close();
chrome.kill();
process.exit(bad.length || errors.length ? 1 : 0);
