/** 首页：课程目录 */
import { ja, plain } from '../ruby.js';
import { lessonsAll } from '../data.js';
import { isLearned, learnedCount, prefs, setPref } from '../store.js';
import { esc } from '../util.js';

const LEVEL_NAME = { basic: '初级', middle: '中级' };

export async function render(root) {
  const { index } = await lessonsAll();
  const level = prefs().level === 'middle' ? 'middle' : 'basic';
  const list = index.filter((l) => l.level === level);

  const units = [...new Set(list.map((l) => l.unit))];
  const done = learnedCount(level);
  const nextUp = list.find((l) => !isLearned(l.id)) ?? list[0];

  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">新标准日本语 · 初级 48 课 + 中级 32 课</p>
      <h1>一課一課，把课文读透</h1>
      <p>全文注音 · 中日对照 · 逐课音频 · 5,751 个单词 · 607 条语法</p>
      <div class="hero-row">
        <div class="seg" id="levelSeg">
          <button data-level="basic" class="${level === 'basic' ? 'on' : ''}">初级 · 48 課</button>
          <button data-level="middle" class="${level === 'middle' ? 'on' : ''}">中级 · 32 課</button>
        </div>
        <div class="progress">
          <span class="num">已学 ${done} / ${list.length}</span>
          <span class="bar"><i style="width:${(done / list.length) * 100}%"></i></span>
          <a class="btn btn-sm" href="#/lesson/${nextUp.id}">继续 第 ${nextUp.num} 課</a>
        </div>
      </div>
    </section>
    <div id="units"></div>
  `;

  const unitsEl = root.querySelector('#units');
  for (const u of units) {
    const items = list.filter((l) => l.unit === u);
    const sec = document.createElement('section');
    sec.className = 'unit';
    sec.innerHTML = `
      <div class="unit-head">
        <b>第 ${u} 单元</b>
        <span>第 ${items[0].num}–${items[items.length - 1].num} 課</span>
      </div>
      <div class="lesson-grid">
        ${items.map(card).join('')}
      </div>`;
    unitsEl.append(sec);
  }

  root.querySelector('#levelSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-level]');
    if (!b) return;
    setPref('level', b.dataset.level);
    render(root);
  });
}

function card(l) {
  const done = isLearned(l.id);
  return `
    <a class="lesson-card${done ? ' done' : ''}" href="#/lesson/${l.id}">
      ${done ? '<span class="tick">✓</span>' : ''}
      <span class="n">第 ${l.num} 課</span>
      <span class="t">${ja(l.title)}</span>
      <span class="m">
        <span class="chip">${l.words} 词</span>
        <span class="chip">${l.grammar} 语法</span>
      </span>
    </a>`;
}

export const title = (l) => plain(l.title);
