/** 单词总表 */
import { pitch, plain, speakable } from '../ruby.js';
import { lessonsAll, wordsAll } from '../data.js';
import * as audio from '../audio.js';
import { esc, debounce } from '../util.js';
import { dropdown } from '../ui/dropdown.js';

const PAGE = 80;

export async function render(root) {
  const [{ index }, words] = await Promise.all([lessonsAll(), wordsAll()]);

  const state = { q: '', scope: 'all', page: 0 };

  root.innerHTML = `
    <header class="hero slim">
      <h1>单词总表</h1>
    </header>

    <div class="filters">
      <div class="search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21" stroke-linecap="round"/>
        </svg>
        <input id="q" type="search" placeholder="搜假名、汉字、中文释义…" autocomplete="off" spellcheck="false">
      </div>
      <span id="scopeHost"></span>
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

  /* ---------- 范围选择（全部 / 某级 / 某一课） ---------- */
  const scopeOptions = [{ value: 'all', label: '全部课次', short: '全部课次' }];
  for (const level of ['basic', 'middle']) {
    const lv = index.filter((l) => l.level === level);
    if (!lv.length) continue;
    scopeOptions.push({ group: level === 'basic' ? '初级' : '中级' });
    scopeOptions.push({
      value: `lv:${level}`,
      label: `${level === 'basic' ? '初级' : '中级'} · 全部 ${lv.length} 課`,
      short: `${level === 'basic' ? '初级' : '中级'} · 全部`,
    });
    for (const l of lv) {
      // label 给下拉列表（带课标题），short 给收起后的按钮（只有第几课）
      scopeOptions.push({ value: `${l.level}:${l.num}`, label: `第 ${l.num} 課　${plain(l.title)}`, short: `第 ${l.num} 課` });
    }
  }

  const scopeDD = dropdown({
    options: scopeOptions,
    value: state.scope,
    label: '选择课次',
    onChange: (v) => { state.scope = v; state.page = 0; paint(); },
  });

  root.querySelector('#scopeHost').append(scopeDD.el);

  const tbody = root.querySelector('#tbody');
  const pager = root.querySelector('#pager');
  const countEl = root.querySelector('#count');

  const inScope = (w) => {
    const v = state.scope;
    if (v === 'all') return true;
    if (v.startsWith('lv:')) return w.level === v.slice(3);
    const [level, num] = v.split(':');
    return w.level === level && w.num === Number(num);
  };

  const match = (w, q) =>
    !q || w.kana.includes(q) || w.kanji.includes(q) || w.desc.includes(q) || w.word.includes(q);

  function results() {
    const q = state.q.trim();
    return words.filter((w) => inScope(w) && match(w, q));
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
        <td class="c-kanji">${(() => {
          const surface = plain(w.word || w.kanji) || '';
          return surface === speakable(w.kana) ? '' : esc(surface);
        })()}</td>
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
