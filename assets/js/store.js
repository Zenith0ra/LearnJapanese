/** 本地进度：主题、已学课次、已记住单词 */

const KEY_THEME = 'lj.theme';
const KEY_LEARNED = 'lj.learned';
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

/* ---------- 已学课次 ---------- */
let learnedCache = null;
export function learnedSet() {
  if (!learnedCache) learnedCache = new Set(read(KEY_LEARNED, []));
  return learnedCache;
}
export function isLearned(id) {
  return learnedSet().has(id);
}
export function toggleLearned(id) {
  const s = learnedSet();
  s.has(id) ? s.delete(id) : s.add(id);
  write(KEY_LEARNED, [...s]);
  return s.has(id);
}
export function learnedCount(level) {
  const s = learnedSet();
  if (!level) return s.size;
  const p = level === 'basic' ? 'l' : 'm';
  let n = 0;
  for (const id of s) if (id[0] === p) n++;
  return n;
}

/* ---------- 已记住的单词 ---------- */
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
