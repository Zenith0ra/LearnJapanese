/** 音频：一个复用的 <audio>，课文 / 单词共用 */

const el = new Audio();
el.preload = 'metadata';

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state()));
/** 订阅播放状态，返回退订函数 */
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const state = () => ({
  playing: !el.paused,
  rate: el.playbackRate,
  time: el.currentTime || 0,
  duration: Number.isFinite(el.duration) ? el.duration : 0,
  hasSrc: !!el.getAttribute('src'),
});

el.addEventListener('play', emit);
el.addEventListener('pause', emit);
el.addEventListener('ended', emit);
el.addEventListener('timeupdate', emit);
el.addEventListener('ratechange', emit);
el.addEventListener('loadedmetadata', emit);
el.addEventListener('durationchange', emit);

export function load(src) {
  if (!src) return;
  if (el.getAttribute('src') !== src) {
    el.src = src;
    el.load();
    emit();
  }
}

export function toggle() {
  if (!el.getAttribute('src')) return;
  if (el.paused) el.play().catch(() => {});
  else el.pause();
}

export function setRate(r) {
  el.playbackRate = r;
}

export function seek(sec) {
  if (!Number.isFinite(sec)) return;
  el.currentTime = Math.max(0, Math.min(sec, (el.duration || 0) - 0.05));
}

export function seekRatio(r) {
  seek(r * (el.duration || 0));
}

export function stop() {
  el.pause();
}

/* ---------- 朗读（点击单词 / 句子） ---------- */
let jaVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices();
  return vs.find((v) => /ja[-_]JP/i.test(v.lang)) ?? vs.find((v) => /^ja/i.test(v.lang)) ?? null;
}
if ('speechSynthesis' in window) {
  jaVoice = pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => { jaVoice = pickVoice(); });
}

export function speak(text) {
  if (!text) return;
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }
}
