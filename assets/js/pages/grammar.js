/** 语法总表 */
import { ja } from '../ruby.js';
import { grammarAll } from '../data.js';
import { esc, debounce } from '../util.js';
import { setContextProvider, plainJa } from '../context.js';

export async function render(root) {
  const all = await grammarAll();
  const state = { q: '', level: 'all' };
  let lastRows = [];

  root.innerHTML = `
    <header class="hero slim">
      <h1>语法总表</h1>
    </header>

    <div class="filters">
      <div class="search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21" stroke-linecap="round"/>
        </svg>
        <input id="q" type="search" placeholder="搜句型或解释…" autocomplete="off" spellcheck="false">
      </div>
      <div class="seg" id="lv">
        <button data-v="all" class="on">全部</button>
        <button data-v="basic">初级</button>
        <button data-v="middle">中级</button>
      </div>
      <span class="count" id="count"></span>
    </div>

    <div id="list"></div>
  `;

  const list = root.querySelector('#list');
  const count = root.querySelector('#count');

  function paint() {
    const q = state.q.trim();
    const rows = all.filter((g) =>
      (state.level === 'all' || g.level === state.level) &&
      (!q || g.expression.includes(q) || g.explanation.includes(q) || g.short.includes(q))
    );
    lastRows = rows;
    count.textContent = `${rows.length} 条`;

    // 按课分组
    const groups = new Map();
    for (const g of rows) {
      const k = `${g.level}-${g.num}`;
      if (!groups.has(k)) groups.set(k, { ...g, items: [] });
      groups.get(k).items.push(g);
    }

    list.innerHTML = [...groups.values()].map((grp) => `
      <section class="unit" style="margin-bottom:22px">
        <div class="unit-head">
          <b>${grp.level === 'basic' ? '初級' : '中級'} 第 ${grp.num} 課</b>
          <a href="#/lesson/${grp.level === 'basic' ? 'l' : 'm'}${grp.num}" class="tiny" style="color:var(--accent)">去课文</a>
        </div>
        <div class="panel" style="padding:6px 22px">
          ${grp.items.map((g) => `
            <div class="gpage-item">
              <div class="exp">${ja(g.expression)}${g.short ? `<span class="short">${esc(g.short)}</span>` : ''}</div>
              ${g.explanation ? `<div class="exp-zh">${esc(g.explanation)}</div>` : ''}
            </div>`).join('')}
        </div>
      </section>`).join('') || '<p class="muted" style="padding:24px 0">没有匹配的语法条目</p>';
  }

  root.querySelector('#q').addEventListener('input', debounce((e) => {
    state.q = e.target.value; paint();
  }, 150));

  root.querySelector('#lv').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    state.level = b.dataset.v;
    root.querySelectorAll('#lv button').forEach((x) => x.classList.toggle('on', x === b));
    paint();
  });

  paint();

  /* ---------- 给 AI 的上下文 ---------- */
  setContextProvider(() => {
    const lvName = state.level === 'all' ? '全部' : state.level === 'basic' ? '初级' : '中级';
    const head = `【页面】语法总表\n【筛选】${lvName}${state.q.trim() ? `　搜索「${state.q.trim()}」` : ''}\n【结果】${lastRows.length} 条`;
    const body = lastRows.slice(0, 60)
      .map((g) => `・${plainJa(g.expression)}${g.short ? `（${g.short}）` : ''}${g.explanation ? `　${g.explanation}` : ''}`)
      .join('\n');
    return { label: `语法 · ${lvName}${state.q.trim() ? ` · ${state.q.trim()}` : ''}`, text: `${head}\n${body}` };
  });
}
