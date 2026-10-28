/** 课文页 */
import { ja, plain, pitch } from '../ruby.js';
import { lessonsAll, lessonById, neighbours, wordsOf, grammarOf } from '../data.js';
import { isLearned, toggleLearned, prefs, setPref } from '../store.js';
import * as audio from '../audio.js';
import { esc } from '../util.js';

const LEVEL = { basic: '初级', middle: '中级' };
const isGap = (s) => /^-{1,2}$/.test(String(s).trim());

export async function render(root, id) {
  const l = await lessonById(id);
  if (!l) {
    root.innerHTML = `<div class="panel"><h1 style="font-size:20px">没有这一课</h1>
      <p class="muted" style="margin-top:8px"><a href="#/" style="color:var(--accent)">回到课程列表</a></p></div>`;
    return;
  }

  const { index } = await lessonsAll();
  const meta = index.find((x) => x.id === l.id);
  const { prev, next } = await neighbours(l.id);
  const p = prefs();

  const chapters = l.level === 'basic'
    ? [
        { key: 'basic4', label: '基本课文', block: l.basic4, tr: l.t.basic4 },
        { key: 'basicc', label: '基本会话', block: l.basicc, tr: l.t.basicc },
        { key: 'context', label: l.contextTitle || '应用课文', block: l.context, tr: l.t.context },
      ]
    : [
        { key: 'conversation', label: '会話', block: l.conversation, tr: null },
        { key: 'text', label: l.textTitle || '課文', block: l.text, tr: null },
      ];

  const done = isLearned(l.id);

  root.innerHTML = `
    <div class="crumb">
      <a href="#/">课程</a><span>/</span>
      <span>${LEVEL[l.level]}</span><span>/</span>
      <span>第 ${l.num} 課</span>
    </div>

    <header class="lesson-head">
      <div class="top"><span class="eyebrow">${LEVEL[l.level]} · 第 ${l.unit} 单元</span></div>
      <h1>${ja(l.title)}</h1>
      ${l.contextTitle || l.textTitle ? `<div class="sub">${ja(l.contextTitle || l.textTitle)}</div>` : ''}
      <div class="lesson-meta">
        <span class="chip">${meta?.words ?? 0} 词</span>
        <span class="chip">${meta?.grammar ?? 0} 语法</span>
        <span class="chip">音声あり</span>
        <button class="btn btn-sm${done ? ' btn-primary' : ''}" id="doneBtn">${done ? '✓ 已学' : '标记已学'}</button>
        <a class="btn btn-sm" href="#/cards?ref=${l.ref}">背本课单词</a>
      </div>
    </header>

    <div class="player">
      <button class="play" id="playBtn" title="播放 / 暂停">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="seg" id="trackSeg" style="padding:2px">
        <button data-track="lesson" class="on">课文</button>
        <button data-track="word">单词</button>
      </div>
      <span class="title" id="trackTitle">课文音频</span>
      <button class="btn btn-sm" id="backBtn">− 2s</button>
      <button class="btn btn-sm speed" id="speedBtn">1.0×</button>
    </div>

    <div class="toolbar">
      <div class="seg" id="tabs">
        ${chapters.map((c, i) => `<button data-tab="${i}" class="${i === 0 ? 'on' : ''}">${esc(c.label)}</button>`).join('')}
        <button data-tab="words">生词</button>
        <button data-tab="grammar">语法</button>
      </div>
      <span class="spacer"></span>
      <div class="opts" id="opts">
        <label class="switch">注音<input type="checkbox" id="optRuby" ${p.ruby ? 'checked' : ''}><span class="track"></span></label>
        ${l.level === 'basic'
          ? `<label class="switch">译文<input type="checkbox" id="optTr" ${p.tr ? 'checked' : ''}><span class="track"></span></label>`
          : ''}
      </div>
    </div>

    <div id="pane"></div>
  `;

  /* ---------- 音频 ---------- */
  let track = 'lesson';
  const srcOf = (t) => (t === 'lesson'
    ? `/audio/lesson/${l.id}.mp3`
    : `/audio/word/${l.id}.mp3`);

  audio.load(srcOf(track));
  const playBtn = root.querySelector('#playBtn');
  const speedBtn = root.querySelector('#speedBtn');

  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

  const syncBtn = () => { playBtn.innerHTML = audio.state().playing ? ICON_PAUSE : ICON_PLAY; };
  playBtn.addEventListener('click', () => { audio.toggle(); setTimeout(syncBtn, 60); });

  root.querySelector('#trackSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-track]');
    if (!b || b.dataset.track === track) return;
    track = b.dataset.track;
    root.querySelectorAll('#trackSeg button').forEach((x) => x.classList.toggle('on', x === b));
    root.querySelector('#trackTitle').textContent = track === 'lesson' ? '课文音频' : '单词音频';
    audio.load(srcOf(track));
    audio.toggle();
    setTimeout(syncBtn, 60);
  });

  root.querySelector('#backBtn').addEventListener('click', () => audio.back(2));

  const rates = [1, 0.8, 0.6];
  let ri = 0;
  speedBtn.addEventListener('click', () => {
    ri = (ri + 1) % rates.length;
    audio.setRate(rates[ri]);
    speedBtn.textContent = rates[ri].toFixed(1) + '×';
  });

  /* ---------- 已学 ---------- */
  const doneBtn = root.querySelector('#doneBtn');
  doneBtn.addEventListener('click', () => {
    const now = toggleLearned(l.id);
    doneBtn.classList.toggle('btn-primary', now);
    doneBtn.textContent = now ? '✓ 已学' : '标记已学';
  });

  /* ---------- 标签页 ---------- */
  const pane = root.querySelector('#pane');
  const tabsEl = root.querySelector('#tabs');
  const optsEl = root.querySelector('#opts');
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  let current = 0;

  function paint() {
    pane.className = [p.ruby ? '' : 'hide-ruby', p.tr ? 'show-tr' : ''].filter(Boolean).join(' ');

    if (current === 'words' || current === 'grammar') {
      pane.innerHTML = '<div class="panel muted">载入中…</div>';
      return;
    }
    const ch = chapters[current];
    pane.innerHTML = `<div class="panel${p.ruby ? '' : ' hide-ruby'}${p.tr ? ' show-tr' : ''}">${chapterBody(ch)}</div>`;
  }

  async function showWords() {
    const ws = await wordsOf(l.ref);
    const byPart = l.level === 'middle' && ws.some((w) => w.part > 1);
    const parts = byPart ? [...new Set(ws.map((w) => w.part))].sort() : [null];

    pane.innerHTML = `<div class="panel" id="wordPane">${parts.map((part) => {
      const rows = part === null ? ws : ws.filter((w) => w.part === part);
      return `${part !== null ? `<div class="word-group">生詞表 ${part}</div>` : ''}
        ${rows.map(wordRow).join('')}`;
    }).join('')}
    ${ws.length === 0 ? '<p class="muted">本课暂无生词表。</p>' : ''}
    </div>`;

    // 点词朗读
    pane.querySelectorAll('.word-row').forEach((row) => {
      row.addEventListener('click', () => audio.speak(row.dataset.read));
    });
  }

  async function showGrammar() {
    const gs = await grammarOf(l.ref);
    pane.innerHTML = `<div class="panel">${gs.length
      ? gs.map((g) => `
        <div class="g-item">
          <div class="exp">${ja(g.expression)}${g.short ? `<span class="short">${esc(g.short)}</span>` : ''}</div>
          ${g.explanation ? `<div class="exp-zh">${esc(g.explanation)}</div>` : ''}
        </div>`).join('')
      : '<p class="muted">本课暂无语法条目。</p>'}
    </div>`;
  }

  function selectTab(target) {
    current = target === 'words' || target === 'grammar' ? target : Number(target);
    const btn = tabsEl.querySelector(`button[data-tab="${current}"]`);
    tabsEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === btn));
    const isText = typeof current === 'number';
    optsEl.style.opacity = isText ? '1' : '.35';
    optsEl.style.pointerEvents = isText ? '' : 'none';
    if (current === 'words') { showWords(); return; }
    if (current === 'grammar') { showGrammar(); return; }
    paint();
  }

  tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) selectTab(b.dataset.tab);
  });

  root.querySelector('#optRuby').addEventListener('change', (e) => {
    p.ruby = e.target.checked; setPref('ruby', p.ruby);
    pane.classList.toggle('hide-ruby', !p.ruby);
    pane.querySelector('.panel')?.classList.toggle('hide-ruby', !p.ruby);
  });
  root.querySelector('#optTr')?.addEventListener('change', (e) => {
    p.tr = e.target.checked; setPref('tr', p.tr);
    pane.classList.toggle('show-tr', p.tr);
    pane.querySelector('.panel')?.classList.toggle('show-tr', p.tr);
  });

  // 支持深链：#/lesson/l1?tab=words&tr=1&ruby=0
  if (q.has('tr')) { p.tr = q.get('tr') !== '0'; if (root.querySelector('#optTr')) root.querySelector('#optTr').checked = p.tr; }
  if (q.has('ruby')) { p.ruby = q.get('ruby') !== '0'; root.querySelector('#optRuby').checked = p.ruby; }
  const want = q.get('tab');
  selectTab(want && tabsEl.querySelector(`button[data-tab="${want}"]`) ? want : 0);

  /* ---------- 键盘 ---------- */
  const onKey = (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); audio.toggle(); }
    if (e.key === 'ArrowLeft' && prev) location.hash = `#/lesson/${prev.id}`;
    if (e.key === 'ArrowRight' && next) location.hash = `#/lesson/${next.id}`;
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });

  /* ---------- 上/下一课 ---------- */
  const nav = document.createElement('div');
  nav.className = 'pager lesson-nav';
  nav.innerHTML = `
    ${prev ? `<a class="btn" href="#/lesson/${prev.id}">← 第 ${prev.num} 課</a>` : '<span></span>'}
    ${next ? `<a class="btn" href="#/lesson/${next.id}">第 ${next.num} 課 →</a>` : '<span></span>'}`;
  root.append(nav);
}

/* ---------- 片段 ---------- */

function chapterBody(ch) {
  const trs = ch.tr?.scenes ?? [];
  return ch.block.scenes.map((lines, si) => `
    <div class="scene">
      ${lines.map((ln, li) => {
        const gap = isGap(ln);
        const tr = trs[si]?.[li] ?? '';
        // 占位行（原文里用 `* -` 对齐译文的叙述句）在有译文时只显示译文
        if (gap) return tr ? `<div class="tr">${esc(tr)}</div>` : '<div class="line gap"></div>';
        return `<div class="line" data-read="${esc(plain(ln).replace(/"/g, ''))}" title="点击朗读">${ja(ln)}</div>
          ${tr ? `<div class="tr">${esc(tr)}</div>` : ''}`;
      }).join('')}
    </div>`).join('');
}

function wordRow(w) {
  return `
    <div class="word-row" data-read="${esc(w.kana.replace(/@\d{1,2}/g, ''))}" title="点击朗读">
      <div class="kana">${pitch(w.kana)}</div>
      <div class="main">
        <div class="kanji"><span class="w">${ja(w.word || w.kanji || '—')}</span>${w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ''}</div>
        <div class="desc">${esc(w.desc)}</div>
      </div>
    </div>`;
}

/* 点击任意句子朗读 */
document.addEventListener('click', (e) => {
  const line = e.target.closest('.line[data-read]');
  if (line) audio.speak(line.dataset.read);
});
