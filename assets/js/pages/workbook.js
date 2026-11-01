/** 练习册：同步练习的录音（只有音频，没有题目文本） */
import { esc } from '../util.js';
import { workbookAll, lessonsAll } from '../data.js';
import * as audio from '../audio.js';
import { setContextProvider, LEVEL_NAME } from '../context.js';

const SPEEDS = [1, 1.25, 1.5, 2];
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z"/></svg>';

const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

export async function render(root) {
  const all = await workbookAll();
  const { index } = await lessonsAll();
  const lessonTitle = (n) => {
    const l = index.find((x) => x.level === 'basic' && x.num === n);
    return l ? l.title.replace(/!([^!()]*)\(([^()]*)\)/g, '$1') : '';
  };

  const state = {
    vol: 'up',
    cur: null,   // 当前播放的条目 id
  };

  root.innerHTML = `
    <header class="hero slim"><h1>练习册</h1></header>

    <div class="wb-top">
      <div class="seg" id="wbVol">
        <button data-vol="up" class="${state.vol === 'up' ? 'on' : ''}">初级 · 上</button>
        <button data-vol="down" class="${state.vol === 'down' ? 'on' : ''}">初级 · 下</button>
      </div>
      <span class="wb-hint">同步练习录音</span>
    </div>

    <div class="player solo">
      <button class="play" id="playBtn" title="播放 / 暂停" aria-label="播放 / 暂停">${ICON_PLAY}</button>
      <input class="seek" id="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="播放进度">
      <span class="time" id="time">0:00 / 0:00</span>
      <button class="btn btn-sm speed" id="speedBtn">1×</button>
    </div>

    <div class="panel wb-panel"><div id="wbList"></div></div>
  `;

  const listEl = root.querySelector('#wbList');
  const playBtn = root.querySelector('#playBtn');
  const seek = root.querySelector('#seek');
  const timeEl = root.querySelector('#time');
  const speedBtn = root.querySelector('#speedBtn');

  const itemsOf = (vol) => all.filter((x) => x.vol === vol);

  function rows() {
    const items = itemsOf(state.vol);
    return items.map((it, i) => {
      const title = it.kind === 'lesson' ? lessonTitle(it.num) : '';
      const on = it.id === state.cur;
      return `<button class="wb-row${on ? ' on' : ''}" data-id="${esc(it.id)}">
        <span class="wb-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="wb-label">${esc(it.label)}</span>
        <span class="wb-title">${esc(title)}</span>
        <span class="wb-icon">${on ? ICON_PAUSE : ICON_PLAY}</span>
      </button>`;
    }).join('');
  }

  function paintList() {
    listEl.innerHTML = rows();
  }

  function paintAudio(st) {
    playBtn.innerHTML = st.playing ? ICON_PAUSE : ICON_PLAY;
    const ratio = st.duration ? Math.min(1, st.time / st.duration) : 0;
    if (!dragging) {
      seek.value = String(Math.round(ratio * 1000));
      timeEl.textContent = `${fmtTime(st.time)} / ${fmtTime(st.duration)}`;
    }
    seek.style.setProperty('--fill', `${ratio * 100}%`);
    listEl.querySelectorAll('.wb-row').forEach((row) => {
      const on = row.dataset.id === state.cur;
      row.classList.toggle('on', on);
      row.querySelector('.wb-icon').innerHTML = on ? ICON_PAUSE : ICON_PLAY;
    });
  }

  let dragging = false;
  let speedIdx = 0;
  const offAudio = audio.onChange(paintAudio);

  function play(id, { toggle = true } = {}) {
    const it = all.find((x) => x.id === id);
    if (!it) return;
    if (state.cur === id && toggle) { audio.toggle(); return; }
    state.cur = id;
    audio.load(it.src);
    audio.setRate(SPEEDS[speedIdx]);
    audio.toggle();
    paintAudio(audio.state());
    document.dispatchEvent(new Event('lj:ctx'));
  }

  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('.wb-row');
    if (row) play(row.dataset.id);
  });

  playBtn.addEventListener('click', () => {
    if (!state.cur) { play(itemsOf(state.vol)[0].id, { toggle: false }); return; }
    audio.toggle();
  });

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

  root.querySelector('#wbVol').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-vol]');
    if (!b || b.dataset.vol === state.vol) return;
    state.vol = b.dataset.vol;
    root.querySelectorAll('#wbVol button').forEach((x) => x.classList.toggle('on', x === b));
    paintList();
    document.dispatchEvent(new Event('lj:ctx'));
  });

  // 翻到练习册时把播放器复位到当前条目（音频是全局单例，可能在别的页面播着）
  paintList();
  paintAudio(audio.state());
  window.addEventListener('hashchange', () => offAudio(), { once: true });

  /* ---------- 给 AI 的上下文 ---------- */
  setContextProvider(() => {
    const it = state.cur ? all.find((x) => x.id === state.cur) : null;
    const st = audio.state();
    const volName = state.vol === 'up' ? '初级 上' : '初级 下';
    const head = `【页面】练习册（同步练习录音）\n【分册】${volName}\n【本册条目】${itemsOf(state.vol).length} 条`;
    if (!it) return { label: `练习册 · ${volName}`, text: head };
    return {
      label: `练习册 · ${it.label}`,
      text: `${head}\n【正在听】${it.label}${it.kind === 'lesson' ? `　${lessonTitle(it.num)}` : ''}\n【播放位置】${fmtTime(st.time)} / ${fmtTime(st.duration)}`,
    };
  });
}
