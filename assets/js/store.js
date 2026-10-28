/** 本地状态：主题、阅读偏好、背单词进度 */

const KEY_THEME = 'lj.theme';
const KEY_WORDS = 'lj.remembered';
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

/* ---------- 已记住的单词（背单词用） ---------- */
let wordCache = null;
const wordKey = (w) => `${w.ref}|${w.idx}`;

export function wordMap() {
  if (!wordCache) wordCache = read(KEY_WORDS, {});
  return wordCache;
}
export function isKnown(w) {
  return !!wordMap()[wordKey(w)];
}
export function setKnown(w, known) {
  const m = wordMap();
  if (known) m[wordKey(w)] = 1;
  else delete m[wordKey(w)];
  write(KEY_WORDS, m);
}
export function knownCount(words) {
  const m = wordMap();
  return words.reduce((n, w) => n + (m[wordKey(w)] ? 1 : 0), 0);
}

/* ---------- 阅读偏好 ---------- */
export function prefs() {
  return { ruby: true, tr: false, ...read(KEY_PREFS, {}) };
}
export function setPref(k, v) {
  write(KEY_PREFS, { ...prefs(), [k]: v });
}
