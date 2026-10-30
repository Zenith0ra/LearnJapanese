/** 课文页 */
import { ja, plain, pitch } from '../ruby.js';
import { lessonsAll, lessonById, neighbours, wordsOf, grammarOf } from '../data.js';
import { prefs, setPref } from '../store.js';
import * as audio from '../audio.js';
import { esc } from '../util.js';
import { setContextProvider, plainJa, blockText, LEVEL_NAME } from '../context.js';

const LEVEL = { basic: '初级', middle: '中级' };
const isGap = (s) => /^-{1,2}$/.test(String(s).trim());
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
const SPEEDS = [1, 1.25, 1.5, 2];

const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export async function render(root, id) {
  const l = await lessonById(id);
  if (!l) {
    root.innerHTML = `<div class="panel"><h1 style="font-size:22px">没有这一课</h1>
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

  root.innerHTML = `
    <header class="lesson-head">
      <div class="top"><span class="eyebrow">${LEVEL[l.level]} · 第 ${l.num} 課</span></div>
      <h1>${ja(l.title)}</h1>
      ${l.contextTitle || l.textTitle ? `<div class="sub">${ja(l.contextTitle || l.textTitle)}</div>` : ''}
      <div class="lesson-meta">
        <span class="chip">${meta?.words ?? 0} 词</span>
        <span class="chip">${meta?.grammar ?? 0} 语法</span>
        <a class="btn btn-sm" href="#/cards?ref=${l.ref}">背本课单词</a>
      </div>
    </header>

    <div class="player">
      <button class="play" id="playBtn" title="播放 / 暂停" aria-label="播放 / 暂停">${ICON_PLAY}</button>
      <div class="seg" id="trackSeg">
        <button data-track="lesson" class="on">课文</button>
        <button data-track="word">单词</button>
      </div>
      <input class="seek" id="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="播放进度">
      <span class="time" id="time">0:00 / 0:00</span>
      <button class="btn btn-sm speed" id="speedBtn">1×</button>
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
  const srcOf = (t) => `/audio/${t === 'lesson' ? 'lesson' : 'word'}/${l.id}.mp3`;

  const playBtn = root.querySelector('#playBtn');
  const seek = root.querySelector('#seek');
  const timeEl = root.querySelector('#time');
  const speedBtn = root.querySelector('#speedBtn');

  let dragging = false;
  let speedIdx = 0;

  function paintAudio(st) {
    playBtn.innerHTML = st.playing ? ICON_PAUSE : ICON_PLAY;
    const ratio = st.duration ? Math.min(1, st.time / st.duration) : 0;
    if (!dragging) {
      seek.value = String(Math.round(ratio * 1000));
      timeEl.textContent = `${fmtTime(st.time)} / ${fmtTime(st.duration)}`;
    }
    seek.style.setProperty('--fill', `${ratio * 100}%`);
  }

  const offAudio = audio.onChange(paintAudio);

  audio.load(srcOf(track));
  paintAudio(audio.state());

  playBtn.addEventListener('click', () => audio.toggle());

  seek.addEventListener('pointerdown', () => { dragging = true; });
  seek.addEventListener('input', () => {
    dragging = true;
    const r = Number(seek.value) / 1000;
    const dur = audio.state().duration;
    timeEl.textContent = `${fmtTime(r * dur)} / ${fmtTime(dur)}`;
    seek.style.setProperty('--fill', `${r * 100}%`);
  });
  seek.addEventListener('change', () => {
    audio.seekRatio(Number(seek.value) / 1000);
    dragging = false;
  });

  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    audio.setRate(SPEEDS[speedIdx]);
    speedBtn.textContent = `${SPEEDS[speedIdx]}×`;
  });

  root.querySelector('#trackSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-track]');
    if (!b || b.dataset.track === track) return;
    track = b.dataset.track;
    root.querySelectorAll('#trackSeg button').forEach((x) => x.classList.toggle('on', x === b));
    audio.load(srcOf(track));
    audio.toggle();
  });

  /* ---------- 标签页 ---------- */
  const pane = root.querySelector('#pane');
  const tabsEl = root.querySelector('#tabs');
  const optsEl = root.querySelector('#opts');
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  let current = 0;

  function paint() {
    if (current === 'words' || current === 'grammar') return;
    const ch = chapters[current];
    pane.innerHTML = `<div class="panel${p.ruby ? '' : ' hide-ruby'}${p.tr ? ' show-tr' : ''}">${chapterBody(ch)}</div>`;
  }

  let wsCache = null;
  let gsCache = null;

  async function showWords() {
    const ws = await wordsOf(l.ref);
    wsCache = ws;
    const byPart = l.level === 'middle' && ws.some((w) => w.part > 1);
    const parts = byPart ? [...new Set(ws.map((w) => w.part))].sort() : [null];
    const inner = parts.map((part) => {
      const rows = part === null ? ws : ws.filter((w) => w.part === part);
      return `${part !== null ? `<div class="word-group">生詞表 ${part}</div>` : ''}${rows.map(wordRow).join('')}`;
    }).join('');

    pane.innerHTML = `<div class="panel">
      ${ws.length ? `<div class="word-list">${inner}</div>` : '<p class="muted">本课暂无生词表。</p>'}
    </div>`;

    pane.querySelectorAll('.word-row').forEach((row) => {
      row.addEventListener('click', () => audio.speak(row.dataset.read));
    });
  }

  async function showGrammar() {
    const gs = await grammarOf(l.ref);
    gsCache = gs;
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
    document.dispatchEvent(new Event('lj:ctx'));
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
    pane.querySelector('.panel')?.classList.toggle('hide-ruby', !p.ruby);
  });
  root.querySelector('#optTr')?.addEventListener('change', (e) => {
    p.tr = e.target.checked; setPref('tr', p.tr);
    pane.querySelector('.panel')?.classList.toggle('show-tr', p.tr);
  });

  // 深链：#/lesson/l1?tab=words&tr=1&ruby=0
  if (q.has('tr')) { p.tr = q.get('tr') !== '0'; if (root.querySelector('#optTr')) root.querySelector('#optTr').checked = p.tr; }
  if (q.has('ruby')) { p.ruby = q.get('ruby') !== '0'; root.querySelector('#optRuby').checked = p.ruby; }
  const want = q.get('tab');
  selectTab(want && tabsEl.querySelector(`button[data-tab="${want}"]`) ? want : 0);

  /* ---------- 给 AI 的上下文 ---------- */
  setContextProvider(() => {
    const base = `【页面】课文\n【课次】${LEVEL_NAME[l.level]} 第 ${l.num} 課　${plain(l.title)}`;

    if (current === 'words') {
      const ws = wsCache ?? [];
      return {
        label: `生词 · 第 ${l.num} 課`,
        text: `${base}\n【正在看】本课生词表（${ws.length} 个）\n${ws.slice(0, 60)
          .map((w) => `${plainJa(w.word || w.kanji || '') || plain(w.kana)}（${plain(w.kana)}）　${w.pos || ''}　${w.desc}`)
          .join('\n')}`,
      };
    }

    if (current === 'grammar') {
      const gs = gsCache ?? [];
      return {
        label: `语法 · 第 ${l.num} 課`,
        text: `${base}\n【正在看】本课语法（${gs.length} 条）\n${gs
          .map((g) => `・${plainJa(g.expression)}${g.short ? `（${g.short}）` : ''}${g.explanation ? `　${g.explanation}` : ''}`)
          .join('\n')}`,
      };
    }

    const ch = chapters[current] ?? chapters[0];
    return {
      label: `课文 · 第 ${l.num} 課 · ${ch.label}`,
      text: `${base}\n【正在看】${ch.label}\n${blockText(ch.block, ch.tr) || '（本课没有这一部分）'}`,
    };
  });

  /* ---------- 键盘：← → 翻课，空格播放 ---------- */
  const onKey = (e) => {
    if (e.target instanceof Element && e.target.matches('input, textarea, select')) return;
    if (e.key === ' ' && !(e.target instanceof Element && e.target.closest('button'))) { e.preventDefault(); audio.toggle(); }
    if (e.key === 'ArrowLeft' && prev) location.hash = `#/lesson/${prev.id}`;
    if (e.key === 'ArrowRight' && next) location.hash = `#/lesson/${next.id}`;
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => {
    document.removeEventListener('keydown', onKey);
    offAudio();
  }, { once: true });

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
        // 占位行（原文用 `* -` 对齐译文的叙述句）在有译文时只显示译文
        if (gap) return tr ? `<div class="tr">${esc(tr)}</div>` : '<div class="line gap"></div>';
        return `<div class="line" data-read="${esc(plain(ln).replace(/"/g, ''))}" title="点击朗读">${ja(ln)}</div>
          ${tr ? `<div class="tr">${esc(tr)}</div>` : ''}`;
      }).join('')}
    </div>`).join('');
}

function wordRow(w) {
  const surface = plain(w.word || w.kanji || '—');
  const kanaBase = w.kana.replace(/@\d{1,2}/g, '');
  const kanaOnly = surface === kanaBase;      // 没有汉字：读音就是词形，只显示一次
  const pos = w.pos ? `<span class="pos">${esc(w.pos)}</span>` : '';

  return `
    <div class="word-row" data-read="${esc(kanaBase)}" title="点击朗读">
      <div class="ja">
        <div class="kanji${surface.length >= 6 ? ' long' : ''}">${kanaOnly ? pitch(w.kana) : esc(surface)}${pos}</div>
        ${kanaOnly ? '<span class="kana empty" aria-hidden="true"></span>' : `<span class="kana">${pitch(w.kana)}</span>`}
      </div>
      <div class="zh">${esc(w.desc)}</div>
    </div>`;
}

/* 点击任意句子朗读 */
document.addEventListener('click', (e) => {
  const line = e.target.closest('.line[data-read]');
  if (line) audio.speak(line.dataset.read);
});
