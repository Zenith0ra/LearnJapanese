/** 自定义下拉选择：替代原生 select，样式与站点一致
 *  options: [{ value, label } | { group }]
 */
import { esc } from '../util.js';

export function dropdown({ options, value, onChange, label = '' }) {
  const root = document.createElement('div');
  root.className = 'dd';

  const find = (v) => options.filter((o) => o.value !== undefined).find((o) => o.value === v);
  let current = find(value) ?? options.find((o) => o.value !== undefined);

  root.innerHTML = `
    <button class="dd-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="dd-value"></span>
      <svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>
    <div class="dd-menu" role="listbox" hidden></div>
  `;

  const trigger = root.querySelector('.dd-trigger');
  const valueEl = root.querySelector('.dd-value');
  const menu = root.querySelector('.dd-menu');

  const paintValue = () => { valueEl.textContent = current?.label ?? ''; };

  const paintMenu = () => {
    menu.innerHTML = options.map((o) => {
      if (o.group) return `<div class="dd-group">${esc(o.group)}</div>`;
      const sel = o.value === current?.value;
      return `<button class="dd-opt" type="button" role="option"
        data-value="${esc(o.value)}" aria-selected="${sel}">${esc(o.label)}</button>`;
    }).join('');
    const on = menu.querySelector('[aria-selected="true"]');
    if (on) menu.scrollTop = Math.max(0, on.offsetTop - menu.clientHeight / 2 + 20);
  };

  function open() {
    if (!root.classList.contains('open')) {
      paintMenu();
      root.classList.add('open');
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      menu.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
      document.addEventListener('pointerdown', onDocDown, true);
      document.addEventListener('keydown', onEsc, true);
    }
  }

  function close() {
    root.classList.remove('open');
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('keydown', onEsc, true);
  }

  function onDocDown(e) {
    if (!root.contains(e.target)) close();
  }
  function onEsc(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); trigger.focus(); }
  }

  trigger.addEventListener('click', () => (root.classList.contains('open') ? close() : open()));

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });

  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.dd-opt');
    if (!b) return;
    const opt = find(b.dataset.value);
    if (!opt) return;
    current = opt;
    paintValue();
    close();
    trigger.focus();
    onChange?.(opt.value);
  });

  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('.dd-opt')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] ?? items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] ?? items[items.length - 1]).focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
  });

  if (label) root.setAttribute('aria-label', label);
  paintValue();

  return {
    el: root,
    setValue(v) {
      const opt = find(v);
      if (opt) { current = opt; paintValue(); }
    },
  };
}
