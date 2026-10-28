/** 首页：课程目录 */
import { ja } from '../ruby.js';
import { lessonsAll } from '../data.js';
import { prefs, setPref } from '../store.js';

export async function render(root) {
  const { index } = await lessonsAll();
  const level = prefs().level === 'middle' ? 'middle' : 'basic';
  const list = index.filter((l) => l.level === level);

  const units = [...new Set(list.map((l) => l.unit))];

  root.innerHTML = `
    <section class="hero">
      <h1>标准日本语</h1>
      <div class="seg" id="levelSeg">
        <button data-level="basic" class="${level === 'basic' ? 'on' : ''}">初级</button>
        <button data-level="middle" class="${level === 'middle' ? 'on' : ''}">中级</button>
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
  return `
    <a class="lesson-card" href="#/lesson/${l.id}">
      <span class="n">第 ${l.num} 課</span>
      <span class="t">${ja(l.title)}</span>
      <span class="m">
        <span class="chip">${l.words} 词</span>
        <span class="chip">${l.grammar} 语法</span>
      </span>
    </a>`;
}
