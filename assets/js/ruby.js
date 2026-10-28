/**
 * 日文渲染：注音（ruby）与音调（pitch accent）
 *
 * 数据里的两种标记：
 *   !漢字(かんじ)        → <ruby>漢字<rt>かんじ</rt></ruby>
 *   ちゅうごくじん@4     → 带音调线的假名（0 平板 / 1 头高 / n 中高）
 */
import { esc } from './util.js';

const SMALL = new Set([...'ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ']);

/** 渲染一行日文（含注音），返回 html 字符串
 *  不用原生 <ruby>：它会把汉字词撑到注音的宽度，导致字距忽大忽小。
 *  这里用 inline-block + 绝对定位的注音，基准字保持自然字距（注音向两侧探出）。 */
export function ja(text) {
  return esc(text).replace(
    /!([^!()]*)\(([^()]*)\)/g,
    '<span class="rb"><span class="rb-b">$1</span><span class="rb-r">$2</span></span>'
  );
}

/** 去掉标记后的纯日文，用于 title 等 */
export function plain(text) {
  return String(text ?? '').replace(/!([^!()]*)\(([^()]*)\)/g, '$1');
}

/** 把假名切成音拍 */
export function moras(kana) {
  const out = [];
  for (const ch of [...kana]) {
    if (out.length && SMALL.has(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/**
 * 音调可视化。kana 形如 `ちゅうごくじん@4`
 * 0: 平板  1: 头高  n: 第 n 拍后下降
 * 一个词条可能带多个音调核（`どうも@1すみません@4`），逐段渲染、中间留小间隙。
 */
export function pitch(kana) {
  const raw = String(kana ?? '').trim();
  if (!raw.includes('@')) return `<span class="pitch">${esc(raw)}</span>`;

  const segments = [];
  const re = /([^@]+)@(\d{1,2})/g;
  let m;
  let end = 0;
  while ((m = re.exec(raw)) !== null) {
    segments.push({ text: m[1], accent: Number(m[2]) });
    end = re.lastIndex;
  }
  if (end < raw.length) segments.push({ text: raw.slice(end), accent: null });
  if (!segments.length) return `<span class="pitch">${esc(raw.replace(/@\d{1,2}/g, ''))}</span>`;

  return `<span class="pitch">${segments
    .map((s, i) => (i ? '<span class="pitch-gap"></span>' : '') + segment(s))
    .join('')}</span>`;
}

function segment({ text, accent }) {
  const ms = moras(text);
  if (!ms.length) return '';
  if (accent === null || !Number.isFinite(accent)) {
    return ms.map((mo) => `<span class="mora">${esc(mo)}</span>`).join('');
  }
  const n = accent;
  const high = ms.map((_, i) => {
    if (n === 0) return i > 0;       // 平板：首拍低，其余高
    if (n === 1) return i === 0;     // 头高：首拍高，其余低
    return i >= 1 && i < n;          // 中高：第二拍起到第 n 拍高
  });
  const dropAt = n >= 1 && n < ms.length ? n - 1 : -1;

  return ms
    .map((mo, i) => {
      const cls = ['mora', high[i] ? 'h' : '', i === dropAt ? 'drop' : '']
        .filter(Boolean).join(' ');
      return `<span class="${cls}">${esc(mo)}</span>`;
    })
    .join('');
}

/** 带音调的假名，去掉数字后的纯假名（供朗读用） */
export function speakable(kana) {
  return String(kana ?? '').replace(/@\d{1,2}/g, '').replace(/[^\u3040-\u309f\u30a0-\u30ffー]/g, '');
}
