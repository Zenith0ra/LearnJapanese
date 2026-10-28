/** 单词总表 */
import { ja, pitch, speakable } from '../ruby.js';
import { lessonsAll, wordsAll } from '../data.js';
import * as audio from '../audio.js';
import { esc, debounce } from '../util.js';

const PAGE = 80;

export async function render(root) {
  const [{ index }, words] = await Promise.all([lessonsAll(), wordsAll()]);
  const lessons = index;

  const state = { q: '', level: 'all', ref: 'all', page: 0 };

  root.innerHTML = `
    <div class="crumb"><a href="#/">课程</a><span>/</span><span>单词</span></div>
    <header class="hero" style="padding-bottom:22px;border-bottom:0;margin-bottom:8px">
      <p class="eyebrow">Word list</p>
      <h1 style="font-size:28px">单词总表</h1>
      <p>${words.length.toLocaleString()} 个词条 · 带音调标记 · 点词朗读</p>
    </header>

    <div class="filters">
      <div class="search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21" stroke-linecap="round"/>
        </svg>
        <input id="q" type="search" placeholder="搜假名、汉字、中文释义…" autocomplete="off" spellcheck="false">
      </div>
      <select class="sel" id="level">
        <option value="all">全部级别</option>
        <option value="basic">初级</option>
        <option value="middle">中级</option>
      </select>
      <select class="sel" id="lesson"><option value="all">全部课次</option></select>
      <span class="count" id="count"></span>
    </div>

    <table class="wtable">
      <thead><tr>
        <th class="c-kana">假名</th><th class="c-kanji">汉字</th>
        <th class="c-pos">词性</th><th class="c-desc">释义</th><th class="c-l">课</th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table>
    <div class="pager" id="pager"></div>
  `;

  const lessonSel = root.querySelector('#lesson');
  const fillLessons = () => {
    const lv = state.level;
    const opts = lessons
      .filter((l) => lv === 'all' || l.level === lv)
      .map((l) => `<option value="${l.ref}">${l.level === 'basic' ? '初' : '中'} 第${l.num}課</option>`)
      .join('');
    lessonSel.innerHTML = `<option value="all">全部课次</option>${opts}`;
    lessonSel.value = state.ref;
  };
  fillLessons();

  const tbody = root.querySelector('#tbody');
  const pager = root.querySelector('#pager');
  const countEl = root.querySelector('#count');

  const match = (w, q) =>
    !q || w.kana.includes(q) || w.kanji.includes(q) || w.desc.includes(q) || w.word.includes(q);

  function results() {
    const q = state.q.trim();
    return words.filter((w) =>
      (state.level === 'all' || w.level === state.level) &&
      (state.ref === 'all' || w.ref === state.ref) &&
      match(w, q)
    );
  }

  function paint() {
    const rows = results();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    state.page = Math.min(state.page, pages - 1);
    const slice = rows.slice(state.page * PAGE, state.page * PAGE + PAGE);

    countEl.textContent = `${rows.length.toLocaleString()} 条`;

    tbody.innerHTML = slice.map((w) => `
      <tr data-read="${esc(speakable(w.kana))}">
        <td class="c-kana">${pitch(w.kana)}</td>
        <td class="c-kanji">${ja(w.word || w.kanji || '—')}</td>
        <td class="c-pos">${esc(w.pos)}</td>
        <td class="c-desc">${esc(w.desc)}</td>
        <td class="c-l"><a href="#/lesson/${w.level === 'basic' ? 'l' : 'm'}${w.num}" style="color:var(--muted)">${w.num}</a></td>
      </tr>`).join('') || `<tr><td colspan="5" class="muted" style="padding:28px 0">没有匹配的单词</td></tr>`;

    pager.innerHTML = pages > 1 ? `
      <button class="btn btn-sm" data-p="-1" ${state.page === 0 ? 'disabled' : ''}>上一页</button>
      <span class="count">${state.page + 1} / ${pages}</span>
      <button class="btn btn-sm" data-p="1" ${state.page >= pages - 1 ? 'disabled' : ''}>下一页</button>` : '';
  }

  root.querySelector('#q').addEventListener('input', debounce((e) => {
    state.q = e.target.value; state.page = 0; paint();
  }, 150));

  root.querySelector('#level').addEventListener('change', (e) => {
    state.level = e.target.value;
    state.ref = 'all';
    fillLessons();
    state.page = 0; paint();
  });

  lessonSel.addEventListener('change', (e) => {
    state.ref = e.target.value; state.page = 0; paint();
  });

  pager.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-p]');
    if (!b) return;
    state.page += Number(b.dataset.p); paint();
  });

  tbody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-read]');
    if (tr && !e.target.closest('a')) audio.speak(tr.dataset.read);
  });

  paint();
}
