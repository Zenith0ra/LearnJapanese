/** 音频：一个复用的 <audio>，课文 / 单词共用 */

const el = new Audio();
el.preload = 'none';

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state()));
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const state = () => ({
  playing: !el.paused,
  rate: el.playbackRate,
  time: el.currentTime,
  duration: el.duration || 0,
  src: el.currentSrc,
});

el.addEventListener('play', emit);
el.addEventListener('pause', emit);
el.addEventListener('ended', emit);
el.addEventListener('timeupdate', emit);
el.addEventListener('ratechange', emit);

export function load(src) {
  if (!src) return;
  if (el.getAttribute('src') !== src) {
    el.src = src;
    el.load();
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

export function back(sec = 2) {
  el.currentTime = Math.max(0, el.currentTime - sec);
}

export function stop() {
  el.pause();
}

/* ---------- 朗读（单词点击） ---------- */
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

/* ---------- 单词音频定位 ----------
   单词表只有整课的音频，没有逐词时间轴；
   这里用「点一下从本课开头播放」的方式代替，不做假的逐词跳转。 */
export function lessonAudio(level, num) {
  return `/audio/lesson/${level === 'basic' ? 'l' : 'm'}${num}.mp3`;
}
export function wordAudio(level, num) {
  return `/audio/word/${level === 'basic' ? 'l' : 'm'}${num}.mp3`;
}
