/** 背单词：翻卡背诵（四种出题方向 + 轻量淡入切换） */
import { pitch, plain } from '../ruby.js';
import { lessonsAll, wordsAll } from '../data.js';
import { prefs, setPref } from '../store.js';
import * as audio from '../audio.js';
import { esc } from '../util.js';
import { dropdown } from '../ui/dropdown.js';

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
  const fromLesson = ref ? index.find((l) => l.ref === ref) : null;

  const state = {
    scope: fromLesson ? `${fromLesson.level}:${fromLesson.num}` : 'all',
    mode: 'cn',
    order: prefs().cardOrder === 'order' ? 'order' : 'random',
    deck: [],
    i: 0,
    revealed: false,
  };

  root.innerHTML = `
    <div class="cards-wrap">
      <header class="hero slim">
        <h1>背单词</h1>
      </header>

      <div class="cards-bar">
        <span id="scopeHost"></span>
        <div class="seg" id="modes">
          ${MODES.map((m) => `<button data-mode="${m.id}" class="${m.id === state.mode ? 'on' : ''}">${m.label}</button>`).join('')}
        </div>
        <div class="cards-bar-end">
          <span class="count" id="counter"></span>
          <div class="seg" id="orderSeg" title="出题顺序">
            <button data-order="order" class="${state.order === 'order' ? 'on' : ''}">顺序</button>
            <button data-order="random" class="${state.order === 'random' ? 'on' : ''}">随机</button>
          </div>
          <button class="icon-btn" id="restart" title="重新开始" aria-label="重新开始">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 11a8 8 0 10-2.6 6"/><path d="M20 5v6h-6"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="card-progress"><i id="bar" style="width:0%"></i></div>

      <div class="card-stage">
        <div class="flashcard" id="card" role="button" tabindex="0" aria-label="翻转卡片">
          <div class="face front" id="front"></div>
          <div class="face back" id="back"></div>
          <div class="card-cta">
            <button class="btn btn-primary" id="action">揭晓</button>
          </div>
        </div>
      </div>
    </div>
  `;

  /* ---------- 范围选择 ---------- */
  const scopeOptions = [{ value: 'all', label: '全部词条' }];
  for (const level of ['basic', 'middle']) {
    const lv = index.filter((l) => l.level === level);
    if (!lv.length) continue;
    scopeOptions.push({ group: level === 'basic' ? '初级' : '中级' });
    for (const l of lv) {
      scopeOptions.push({ value: `${l.level}:${l.num}`, label: `第 ${l.num} 課　${plain(l.title)}` });
    }
  }

  const scopeDD = dropdown({
    options: scopeOptions,
    value: state.scope,
    label: '选择范围',
    onChange: (v) => { state.scope = v; restart(); },
  });
  root.querySelector('#scopeHost').append(scopeDD.el);

  const card = root.querySelector('#card');
  const front = root.querySelector('#front');
  const back = root.querySelector('#back');
  const counter = root.querySelector('#counter');
  const bar = root.querySelector('#bar');
  const actionBtn = root.querySelector('#action');

  const pool = () => {
    if (state.scope === 'all') return words;
    const [level, num] = state.scope.split(':');
    return words.filter((w) => w.level === level && w.num === Number(num));
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
    const list = pool();
    if (state.order === 'order') {
      state.deck = [...list].sort((a, b) =>
        a.level.localeCompare(b.level) || a.num - b.num || a.part - b.part || a.idx - b.idx);
    } else {
      state.deck = shuffle(list);
    }
    state.i = 0;
    state.revealed = false;
    paint();
  }

  const speak = (w, rate = 0.9) => { if (w) audio.speak(kanaOf(w), rate); };

  function frontHtml(w) {
    const surface = surfaceOf(w);
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
    const kanaBase = kanaOf(w);
    const hasKanji = !!w.kanji && w.kanji !== kanaBase;
    const p = pitchNum(w);
    const k = window.innerWidth < 621 ? 0.82 : 1;

    const heroSize = hasKanji
      ? Math.round((w.kanji.length <= 3 ? 46 : w.kanji.length <= 5 ? 38 : 30) * k)
      : Math.round((kanaBase.length <= 5 ? 40 : kanaBase.length <= 9 ? 32 : 26) * k);
    const kanaSize = Math.round((kanaBase.length <= 5 ? 27 : kanaBase.length <= 9 ? 23 : 20) * k);

    return `
      <div class="back-inner">
        ${w.pos ? `<div class="back-pos">${esc(w.pos)}</div>` : ''}
        <div class="back-hero" style="font-size:${heroSize}px">
          ${hasKanji ? esc(w.kanji) : pitch(w.kana)}
        </div>
        ${hasKanji ? `
        <div class="back-reading" style="font-size:${kanaSize}px">
          <span class="reading-kana">${pitch(w.kana)}</span>
          <button class="speak-btn" id="speakBtn" aria-label="发音">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/>
            </svg>
          </button>
          ${p !== null ? `<span class="pitch-num" title="声调">${p}</span>` : ''}
        </div>` : `
        <div class="back-reading" style="font-size:${kanaSize}px">
          <button class="speak-btn" id="speakBtn" aria-label="发音">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/>
            </svg>
          </button>
          ${p !== null ? `<span class="pitch-num" title="声调">${p}</span>` : ''}
        </div>`}
        <div class="back-divider"></div>
        <div class="back-meaning">${esc(w.desc)}</div>
      </div>
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
      card.classList.remove('revealed');
      actionBtn.textContent = '再来一遍';
      actionBtn.dataset.done = '1';
      return;
    }

    delete actionBtn.dataset.done;
    front.innerHTML = frontHtml(w);
    back.innerHTML = backHtml(w);
    card.classList.toggle('revealed', state.revealed);
    actionBtn.textContent = state.revealed ? '下一张' : '揭晓';

    front.querySelector('#speakBtn')?.addEventListener('click', (e) => { e.stopPropagation(); speak(w); });
    back.querySelector('#speakBtn')?.addEventListener('click', (e) => { e.stopPropagation(); speak(w); });

    if (state.mode === 'audio' && !state.revealed) {
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
    // 关掉过渡再换内容：否则背面淡出的那 160ms 里会看到下一张的答案
    card.classList.add('no-fade');
    paint();
    void card.offsetWidth;
    card.classList.remove('no-fade');
  }

  function prev() {
    if (state.i === 0) {
      if (state.revealed) { state.revealed = false; paint(); }
      return;
    }
    state.i -= 1;
    state.revealed = false;
    card.classList.add('no-fade');
    paint();
    void card.offsetWidth;
    card.classList.remove('no-fade');
  }

  card.addEventListener('click', () => next());
  actionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (actionBtn.dataset.done) restart();
    else next();
  });
  root.querySelector('#restart').addEventListener('click', (e) => {
    e.stopPropagation();
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

  root.querySelector('#orderSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-order]');
    if (!b || b.dataset.order === state.order) return;
    state.order = b.dataset.order;
    setPref('cardOrder', state.order);
    root.querySelectorAll('#orderSeg button').forEach((x) => x.classList.toggle('on', x === b));
    restart();
  });

  /* 键盘：← 上一张；空格 / 回车 / → 都是「先翻面，再下一张」 */
  const onKey = (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest('button, .dd, input, select, textarea')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); return; }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    }
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });

  restart();
}
