/**
 * 站点外壳：路由 + 主题
 */
import { $, $$ } from './util.js';
import { applyTheme, cycleTheme } from './store.js';
import { mountChat } from './ui/chat.js';
import { resetContext } from './context.js';
import * as home from './pages/home.js';
import * as lesson from './pages/lesson.js';
import * as words from './pages/words.js';
import * as grammar from './pages/grammar.js';
import * as cards from './pages/cards.js';

applyTheme();
mountChat();

// 深链指定主题：#/lesson/l1?theme=dark
{
  const t = new URLSearchParams(location.hash.split('?')[1] ?? '').get('theme');
  if (t === 'dark' || t === 'light') applyTheme(t);
}

const routes = [
  { re: /^\/?$/, page: home, nav: 'home' },
  { re: /^\/lesson\/([\w-]+)$/, page: lesson, nav: 'home', arg: 1 },
  { re: /^\/words$/, page: words, nav: 'words' },
  { re: /^\/grammar$/, page: grammar, nav: 'grammar' },
  { re: /^\/cards$/, page: cards, nav: 'cards' },
];

const app = $('#app');

function setNav(key) {
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === key));
}

async function route() {
  const path = decodeURI(location.hash.replace(/^#/, '') || '/');
  const clean = path.split('?')[0];
  const hit = routes.find((r) => r.re.test(clean));

  if (!hit) {
    app.innerHTML = `<div class="panel"><h1 style="font-size:20px">页面不存在</h1>
      <p class="muted" style="margin-top:8px">没有这个地址，<a href="#/" style="color:var(--accent)">回到课程列表</a>。</p></div>`;
    return;
  }

  resetContext(); // 换页先清掉上一页的上下文
  setNav(hit.nav);
  document.body.classList.toggle('at-home', clean === '/' || clean === '');
  app.innerHTML = '<div class="panel muted">载入中…</div>';
  try {
    const arg = hit.arg ? clean.match(hit.re)[hit.arg] : undefined;
    await hit.page.render(app, arg);
    document.dispatchEvent(new Event('lj:ctx')); // 页面渲染完，通知 AI 面板刷新上下文
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="panel"><h1 style="font-size:18px">加载失败</h1>
      <p class="muted" style="margin-top:8px">${String(err.message ?? err)}</p></div>`;
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  app.focus({ preventScroll: true });

  if (new URLSearchParams(location.hash.split('?')[1] ?? '').get('debug') === '1') {
    setTimeout(() => {
      const w = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > w + 0.5 || r.left < -0.5);
        })
        .slice(0, 12)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(el.getBoundingClientRect().right)} w=${Math.round(el.getBoundingClientRect().width)}`);
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;bottom:0;z-index:999;background:#111;color:#0f0;font:10px/1.4 monospace;padding:6px;max-width:100%;white-space:pre-wrap';
      d.textContent = `vw=${w} scrollW=${document.documentElement.scrollWidth}\n` + bad.join('\n');
      document.body.append(d);
    }, 500);
  }
}

window.addEventListener('hashchange', route);
$('#themeBtn').addEventListener('click', () => {
  const t = cycleTheme();
  $('#themeBtn').title = `主题：${{ auto: '跟随系统', light: '浅色', dark: '深色' }[t]}`;
});
route();

/* 站内链接统一走 hash 路由 */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (a && a.getAttribute('href') === location.hash) e.preventDefault();
});
