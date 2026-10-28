/** 背单词：翻转卡片 + 本地记忆进度 */
import { pitch, plain } from '../ruby.js';
import { lessonsAll, wordsAll } from '../data.js';
import { isKnown, setKnown, knownCount } from '../store.js';
import * as audio from '../audio.js';
import { esc, clamp } from '../util.js';

export async function render(root) {
  const [{ index }, words] = await Promise.all([lessonsAll(), wordsAll()]);
  const ref = new URLSearchParams(location.hash.split('?')[1] ?? '').get('ref');

  const scopeLesson = ref ? index.find((l) => l.ref === ref) : null;
  const state = { scope: ref ? 'ref' : 'all', onlyUnknown: true, deck: [], i: 0, flipped: false };

  root.innerHTML = `
    <div class="cards-wrap">
      <div class="crumb"><a href="#/">课程</a><span>/</span><span>背单词</span></div>
      <header class="hero" style="padding-bottom:18px;border-bottom:0;margin-bottom:14px">
        <p class="eyebrow">Flash cards</p>
        <h1 style="font-size:28px">背单词</h1>
        <p>${scopeLesson ? `${scopeLesson.level === 'basic' ? '初级' : '中级'} 第 ${scopeLesson.num} 課 · 本课生词` : '看汉字想读音，看中文想日文'}</p>
      </header>

      <div class="filters">
        <select class="sel" id="scope">
          ${scopeLesson ? `<option value="ref">本课（第${scopeLesson.num}課）</option>` : ''}
          <option value="all">全部词条</option>
          <option value="basic">初级</option>
          <option value="middle">中级</option>
        </select>
        <label class="switch">只练未记住<input type="checkbox" id="onlyNew" checked><span class="track"></span></label>
        <span class="count" id="stat"></span>
      </div>

      <div class="card-stage">
        <div class="flashcard" id="card" role="button" tabindex="0" aria-label="翻转卡片">
          <div class="face on" id="front"></div>
          <div class="face" id="back"></div>
          <div class="hint" id="hint">空格翻面 · ← 不熟 · → 记住</div>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn" id="again">还不熟</button>
        <button class="btn btn-primary" id="known">记住了</button>
      </div>
      <div class="card-stat" id="stat2"></div>
    </div>
  `;

  const card = root.querySelector('#card');
  const front = root.querySelector('#front');
  const back = root.querySelector('#back');
  const hint = root.querySelector('#hint');

  function pool() {
    let p = words;
    if (state.scope === 'ref') p = p.filter((w) => w.ref === ref);
    else if (state.scope !== 'all') p = p.filter((w) => w.level === state.scope);
    if (state.onlyUnknown) p = p.filter((w) => !isKnown(w));
    return p;
  }

  function shuffle(a) {
    const arr = [...a];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function restart() {
    state.deck = shuffle(pool());
    state.i = 0;
    state.flipped = false;
    paint();
  }

  function current() { return state.deck[state.i]; }

  function paint() {
    const w = current();
    const total = state.deck.length;
    root.querySelector('#stat').textContent = total ? `${Math.min(state.i + 1, total)} / ${total} · 已记住 ${knownCount(words)}` : '';
    root.querySelector('#stat2').textContent = total ? '' : '这个范围里的词都记住了 🎉';

    if (!w) {
      front.innerHTML = `<div class="front-word" style="font-size:22px">这一组已完成</div>
        <div class="front-desc">共 ${total} 个词</div>`;
      back.classList.remove('on');
      front.classList.add('on');
      hint.style.display = 'none';
      return;
    }

    hint.style.display = '';
    const word = plain(w.kanji || w.word || w.kana);
    front.innerHTML = `
      <div class="front-word">${esc(word)}</div>
      ${w.pos ? `<div class="front-desc">${esc(w.pos)}</div>` : ''}`;
    back.innerHTML = `
      <div class="back-kana">${pitch(w.kana)}</div>
      <div class="front-desc" style="margin-top:6px">${esc(w.desc)}</div>`;

    front.classList.toggle('on', !state.flipped);
    back.classList.toggle('on', state.flipped);
    if (state.flipped && w) audio.speak(w.kana.replace(/@\d+/g, ''));
  }

  function flip() {
    if (!current()) return;
    state.flipped = !state.flipped;
    front.classList.toggle('on', !state.flipped);
    back.classList.toggle('on', state.flipped);
    if (state.flipped) audio.speak(current().kana.replace(/@\d+/g, ''));
  }

  function answer(known) {
    const w = current();
    if (!w) { restart(); return; }
    setKnown(w, known);
    if (known) {
      state.deck.splice(state.i, 1);
      if (state.i >= state.deck.length) state.i = 0;
    } else {
      state.i = (state.i + 1) % state.deck.length;
    }
    state.flipped = false;
    paint();
  }

  card.addEventListener('click', flip);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  root.querySelector('#known').addEventListener('click', () => answer(true));
  root.querySelector('#again').addEventListener('click', () => answer(false));

  root.querySelector('#scope').addEventListener('change', (e) => {
    state.scope = e.target.value;
    restart();
  });
  root.querySelector('#onlyNew').addEventListener('change', (e) => {
    state.onlyUnknown = e.target.checked;
    restart();
  });

  const onKey = (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); flip(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); answer(true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); answer(false); }
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });

  restart();
}
