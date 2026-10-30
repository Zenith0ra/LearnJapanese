/** 当前页面的上下文：让 AI 知道用户正在看什么
 *  每个页面在 render() 里注册一个 provider，返回 { label, text }；
 *  每次发消息时现取，所以翻卡、切标签、改筛选都会立刻反映进去。
 */

let provider = null;

export function setContextProvider(fn) {
  provider = typeof fn === 'function' ? fn : null;
}

export function resetContext() {
  provider = null;
}

export function getContext() {
  if (!provider) return null;
  try {
    const c = provider();
    if (!c || !c.text) return null;
    return { label: String(c.label ?? ''), text: String(c.text).slice(0, 6000) };
  } catch {
    return null;
  }
}

/* ---------- 各页面共用的小工具 ---------- */

/** `!漢字(かんじ)` → `漢字`；`@1` 声调标记去掉 */
export const plainJa = (s) => String(s ?? '')
  .replace(/!([^()（）]+)[(（]([^()（）]+)[)）]/g, '$1')
  .replace(/@\d{1,2}/g, '');

export const LEVEL_NAME = { basic: '初级', middle: '中级' };

/** 课文块 → 纯文本（原文 + 译文逐行对照） */
export function blockText(block, t) {
  const scenes = block?.scenes ?? [];
  const trs = t?.scenes ?? [];
  return scenes.map((lines, si) => lines.map((ln, li) => {
    const ja = plainJa(ln).trim();
    const zh = (trs[si]?.[li] ?? '').trim();
    if (!ja) return zh ? `　${zh}` : '';
    return zh ? `${ja}\n　　${zh}` : ja;
  }).filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
}
