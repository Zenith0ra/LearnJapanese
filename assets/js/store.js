/** 本地状态：主题与阅读偏好 */

const KEY_THEME = 'lj.theme';
const KEY_PREFS = 'lj.prefs';

const read = (k, dflt) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? dflt; } catch { return dflt; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式忽略 */ }
};

/* ---------- 主题 ---------- */
export function getTheme() {
  return read(KEY_THEME, 'auto');
}
export function setTheme(t) {
  write(KEY_THEME, t);
  applyTheme(t);
}
export function applyTheme(t = getTheme()) {
  document.documentElement.dataset.theme = t;
}
export function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(getTheme()) + 1) % order.length];
  setTheme(next);
  return next;
}

/* ---------- 阅读偏好 ---------- */
export function prefs() {
  return { ruby: true, tr: false, ...read(KEY_PREFS, {}) };
}
export function setPref(k, v) {
  write(KEY_PREFS, { ...prefs(), [k]: v });
}
