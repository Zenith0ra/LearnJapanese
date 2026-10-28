/** 背单词：翻卡背诵（参考 portfolio 的 Vocab Cards：四种出题方向 + 3D 翻转 + 进度） */
import { pitch, plain } from '../ruby.js';
import { lessonsAll, wordsAll } from '../data.js';
import * as audio from '../audio.js';
import { esc } from '../util.js';

const MODES = [
  { id: 'cn', label: '中文' },
  { id: 'kanji', label: '汉字' },
  { id: 'kana', label: '假名' },
  { id: 'audio', label: '听音' },
];

const kanaOf = (w) => w.kana.replace(/@\d{1,2}/g, '');
const surfaceOf = (w) => plain(w.word || w.kanji || '') || kanaOf(w);
const pitchNum = (w) => {
  const nums = String(w.kana).match(/@(\d{1,2})/g);
  return nums ? nums.map((s) => Number(s.slice(1))).join(' / ') : null;
};

export async function render(root) {
  const [{ index }, words] = await Promise.all([lessonsAll(), wordsAll()]);
  const ref = new URLSearchParams(location.hash.split('?')[1] ?? '').get('ref');
  const scopeLesson = ref ? index.find((l) => l.ref === ref) : null;

  const state = {
    scope: ref ? 'ref' : 'all',
    mode: 'cn',
    deck: [],
    i: 0,
    revealed: false,
  };

  root.innerHTML = `
    <div class="cards-wrap">
      <div class="crumb"><a href="#/">课程</a><span>/</span><span>背单词</span></div>
      <header class="hero slim">
        <h1>背单词</h1>
        ${scopeLesson ? `<p class="muted" style="margin-top:6px">${scopeLesson.level === 'basic' ? '初级' : '中级'} 第 ${scopeLesson.num} 課</p>` : ''}
      </header>

      <div class="cards-bar">
        <select class="sel" id="scope">
          ${scopeLesson ? `<option value="ref">本课（第${scopeLesson.num}課）</option>` : ''}
          <option value="all">全部词条</option>
          <option value="basic">初级</option>
          <option value="middle">中级</option>
        </select>
        <div class="seg" id="modes">
          ${MODES.map((m) => `<button data-mode="${m.id}" class="${m.id === state.mode ? 'on' : ''}">${m.label}</button>`).join('')}
        </div>
        <span class="count" id="counter"></span>
      </div>

      <div class="card-progress"><i id="bar" style="width:0%"></i></div>

      <div class="card-stage">
        <div class="flashcard" id="card" role="button" tabindex="0" aria-label="翻转卡片">
          <div class="face front" id="front"></div>
          <div class="face back" id="back"></div>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn btn-primary" id="action">揭晓</button>
        <button class="btn btn-sm" id="restart" title="重新洗牌">重新开始</button>
      </div>
      <div class="card-hint">空格 / 回车 翻面并继续 · ← 上一张</div>
    </div>
  `;

  const card = root.querySelector('#card');
  const front = root.querySelector('#front');
  const back = root.querySelector('#back');
  const counter = root.querySelector('#counter');
  const bar = root.querySelector('#bar');
  const actionBtn = root.querySelector('#action');

  const pool = () => {
    let p = words;
    if (state.scope === 'ref') p = p.filter((w) => w.ref === ref);
    else if (state.scope !== 'all') p = p.filter((w) => w.level === state.scope);
    return p;
  };

  const shuffle = (a) => {
    const arr = [...a];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const current = () => state.deck[state.i] ?? null;
  const finished = () => state.i >= state.deck.length;

  function restart() {
    state.deck = shuffle(pool());
    state.i = 0;
    state.revealed = false;
    paint();
  }

  function speak(w, rate = 0.9) {
    if (w) audio.speak(kanaOf(w), rate);
  }

  function frontHtml(w) {
    const surface = surfaceOf(w);
    // 窄屏整体缩小，避免长词撑爆卡片
    const k = window.innerWidth < 621 ? 0.8 : 1;
    const size = (t) => Math.round((t.length <= 4 ? 52 : t.length <= 8 ? 42 : 34) * k);

    if (state.mode === 'audio') {
      return `<button class="speak-big" id="speakBtn">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/>
        </svg>
        <span>再听一次</span>
      </button>`;
    }
    if (state.mode === 'cn') {
      const fs = Math.round(Math.min(44, Math.max(26, 900 / Math.max(4, w.desc.length))) * k);
      return `<div class="front-cn" style="font-size:${fs}px">${esc(w.desc)}</div>`;
    }
    if (state.mode === 'kanji') {
      return `<div class="front-ja" style="font-size:${size(surface)}px">${esc(surface)}</div>`;
    }
    return `<div class="front-ja" style="font-size:${size(kanaOf(w))}px">${esc(kanaOf(w))}</div>`;
  }

  function backHtml(w) {
    const p = pitchNum(w);
    return `
      <div class="back-top">
        ${w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ''}
      </div>
      <div class="back-main">
        ${w.kanji && w.kanji !== kanaOf(w) ? `<div class="back-kanji">${esc(w.kanji)}</div>` : ''}
        <div class="back-kana">
          <span class="kana-big">${pitch(w.kana)}</span>
          <button class="speak-btn" id="speakBtn" aria-label="发音">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/>
            </svg>
          </button>
          ${p !== null ? `<span class="pitch-num" title="声调">${p}</span>` : ''}
        </div>
      </div>
      <div class="back-line"></div>
      <div class="back-meaning">${esc(w.desc)}</div>
    `;
  }

  function paint() {
    const w = current();
    const total = state.deck.length;

    counter.textContent = finished() ? `${total} / ${total}` : `${Math.min(state.i + 1, total)} / ${total}`;
    bar.style.width = `${Math.min(100, (state.i / Math.max(1, total)) * 100)}%`;

    if (!w) {
      front.innerHTML = `<div class="done">
        <div class="done-title">这一组背完了</div>
        <div class="done-sub">共 ${total} 个词</div>
      </div>`;
      back.innerHTML = '';
      card.classList.remove('flipped');
      actionBtn.textContent = '再来一遍';
      actionBtn.dataset.done = '1';
      return;
    }

    delete actionBtn.dataset.done;
    front.innerHTML = frontHtml(w);
    back.innerHTML = backHtml(w);
    card.classList.toggle('flipped', state.revealed);
    actionBtn.textContent = state.revealed ? '下一张' : '揭晓';

    front.querySelector('#speakBtn')?.addEventListener('click', (e) => { e.stopPropagation(); speak(w); });
    back.querySelector('#speakBtn')?.addEventListener('click', (e) => { e.stopPropagation(); speak(w); });

    if (state.mode === 'audio' && !state.revealed) {
      // 听音模式：换卡即读
      setTimeout(() => speak(w), 120);
    }
  }

  function reveal() {
    if (finished()) return;
    state.revealed = true;
    paint();
  }

  function next() {
    if (finished()) { restart(); return; }
    if (!state.revealed) { reveal(); return; }
    state.i += 1;
    state.revealed = false;
    paint();
  }

  function prev() {
    if (state.i === 0) return;
    state.i -= 1;
    state.revealed = false;
    paint();
  }

  card.addEventListener('click', () => (state.revealed ? next() : reveal()));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); state.revealed ? next() : reveal(); }
  });
  actionBtn.addEventListener('click', () => (actionBtn.dataset.done ? restart() : next()));
  root.querySelector('#restart').addEventListener('click', restart);

  root.querySelector('#scope').addEventListener('change', (e) => {
    state.scope = e.target.value;
    restart();
  });
  root.querySelector('#modes').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b || b.dataset.mode === state.mode) return;
    state.mode = b.dataset.mode;
    root.querySelectorAll('#modes button').forEach((x) => x.classList.toggle('on', x === b));
    state.revealed = false;
    paint();
  });

  const onKey = (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); state.revealed ? next() : reveal(); }
    else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });

  restart();
}
