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

/* 已掌握：按 level/num/part/idx 记，存在 localStorage */
const MK = 'lj.mastered';
const keyOf = (w) => `${w.level}:${w.num}:${w.part}:${w.idx}`;
const loadMastered = () => {
  try { return new Set(JSON.parse(localStorage.getItem(MK) || '[]')); } catch { return new Set(); }
};
const saveMastered = (set) => {
  try { localStorage.setItem(MK, JSON.stringify([...set])); } catch { /* 隐私模式忽略 */ }
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

  const mastered = loadMastered();

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
          <span class="mastered-wrap" id="masteredWrap">
            <button class="mchip" id="masteredBtn" type="button" hidden>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              <span>已掌握 <b id="masteredNum">0</b></span>
            </button>
            <div class="mastered-pop" id="masteredPop" hidden></div>
          </span>
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
        <div class="flashcard" id="card" role="button" tabindex="0" aria-label="点击翻面 / 下一张">
          <button class="card-mark" id="mark" type="button" aria-pressed="false" title="标记已掌握（M）">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span>掌握</span>
          </button>
          <div class="face front" id="front"></div>
          <div class="face back" id="back"></div>
        </div>
      </div>
    </div>
  `;

  /* ---------- 范围选择 ---------- */
  const scopeOptions = [{ value: 'all', label: '全部词条', short: '全部词条' }];
  for (const level of ['basic', 'middle']) {
    const lv = index.filter((l) => l.level === level);
    if (!lv.length) continue;
    scopeOptions.push({ group: level === 'basic' ? '初级' : '中级' });
    for (const l of lv) {
      // label 给下拉列表（带课标题），short 给收起后的按钮（只有第几课）
      scopeOptions.push({ value: `${l.level}:${l.num}`, label: `第 ${l.num} 課　${plain(l.title)}`, short: `第 ${l.num} 課` });
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
    // 只背还没掌握的
    const list = pool().filter((w) => !mastered.has(keyOf(w)));
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
      const all = pool().length;
      const none = all > 0 && state.deck.length === 0;
      front.innerHTML = `<div class="done">
        <div class="done-title">${none ? '这些词都掌握了' : '这一组背完了'}</div>
        <div class="done-sub">${none
          ? `本范围共 ${all} 个词 · 点上方「已掌握」可以撤回来重背`
          : `共 ${total} 个词 · 点一下重新开始`}</div>
      </div>`;
      back.innerHTML = '';
      card.classList.remove('revealed');
      paintMastered();
      return;
    }

    front.innerHTML = frontHtml(w);
    back.innerHTML = backHtml(w);
    card.classList.toggle('revealed', state.revealed);

    front.querySelector('#speakBtn')?.addEventListener('click', (e) => { e.stopPropagation(); speak(w); });
    back.querySelector('#speakBtn')?.addEventListener('click', (e) => { e.stopPropagation(); speak(w); });

    if (state.mode === 'audio' && !state.revealed) {
      setTimeout(() => speak(w), 120);
    }

    paintMastered();
  }

  /* ---------- 已掌握 ---------- */
  const markBtn = root.querySelector('#mark');
  const mWrap = root.querySelector('#masteredWrap');
  const mBtn = root.querySelector('#masteredBtn');
  const mNum = root.querySelector('#masteredNum');
  const mPop = root.querySelector('#masteredPop');

  const masteredInScope = () => pool().filter((w) => mastered.has(keyOf(w)));

  function paintMastered() {
    const list = masteredInScope();
    mBtn.hidden = list.length === 0;
    mNum.textContent = String(list.length);

    const w = current();
    const on = !!w && mastered.has(keyOf(w));
    markBtn.hidden = !w;
    markBtn.classList.toggle('on', on);
    markBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    markBtn.querySelector('span').textContent = on ? '已掌握' : '掌握';
    markBtn.title = on ? '取消掌握（M）' : '标记已掌握（M）';

    if (!mPop.hidden) paintPop();
  }

  function paintPop() {
    const list = masteredInScope();
    const scopeName = state.scope === 'all' ? '全部词条' : `第 ${state.scope.split(':')[1]} 課`;
    mPop.innerHTML = list.length
      ? `<div class="mp-head">${scopeName} · 已掌握 ${list.length} 个</div>
        ${list.map((w) => `
          <div class="mp-item">
            <span class="mp-ja">${esc(surfaceOf(w))}</span>
            <span class="mp-zh">${esc(w.desc)}</span>
            <button type="button" data-rm="${keyOf(w)}" aria-label="取消掌握" title="取消掌握">×</button>
          </div>`).join('')}
        <div class="mp-foot"><button type="button" id="mpClear">全部取消（${list.length}）</button></div>`
      : '<div class="mp-empty">这个范围还没有标记</div>';
  }

  function toggleMastered() {
    const w = current();
    if (!w) return;
    const k = keyOf(w);
    if (mastered.has(k)) mastered.delete(k); else mastered.add(k);
    saveMastered(mastered);
    paintMastered();
  }

  markBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMastered(); });

  mBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mPop.hidden = !mPop.hidden;
    if (!mPop.hidden) paintPop();
  });

  mPop.addEventListener('click', (e) => {
    e.stopPropagation();
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      mastered.delete(rm.dataset.rm);
      saveMastered(mastered);
      paintMastered();
      return;
    }
    if (e.target.closest('#mpClear')) {
      for (const w of masteredInScope()) mastered.delete(keyOf(w));
      saveMastered(mastered);
      paintMastered();
    }
  });

  const closePop = (e) => {
    if (!mPop.hidden && !mWrap.contains(e.target)) mPop.hidden = true;
  };
  document.addEventListener('click', closePop);
  window.addEventListener('hashchange', () => document.removeEventListener('click', closePop), { once: true });

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

  /* 键盘：← 上一张；空格 / 回车 / → 都是「先翻面，再下一张」；M 标记掌握 */
  const onKey = (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest('button, .dd, input, select, textarea')) return;
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMastered(); return; }
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
