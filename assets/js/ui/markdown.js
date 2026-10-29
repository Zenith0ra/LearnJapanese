/** 轻量 Markdown 渲染（够聊天用，无依赖）
 *  支持：标题、代码块、行内代码、粗体/斜体/删除线、链接、列表（含一层缩进）、
 *        引用、分割线、表格、段落（单换行保留为 <br>）
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function inline(src) {
  let s = esc(src);
  const codes = [];
  // 行内代码先摘出来，避免里面的 * _ 被当成强调
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });

  s = s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<span class="md-img">[图片: $1]</span>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_, text, href) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
  return s;
}

function tableFrom(lines, i) {
  const header = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const align = lines[i + 1].trim().replace(/^\||\|$/g, '').split('|').map((c) => {
    const t = c.trim();
    if (/^:?-+:?$/.test(t)) {
      if (t.startsWith(':') && t.endsWith(':')) return 'center';
      if (t.endsWith(':')) return 'right';
      return 'left';
    }
    return null;
  });
  if (align.some((a) => a === null)) return null;

  const rows = [];
  let j = i + 2;
  while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
    rows.push(lines[j].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    j++;
  }
  const th = header.map((c, k) => `<th style="text-align:${align[k]}">${inline(c)}</th>`).join('');
  const tb = rows.map((r) => `<tr>${r.map((c, k) => `<td style="text-align:${align[k]}">${inline(c)}</td>`).join('')}</tr>`).join('');
  return { html: `<table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`, next: j };
}

/**
 * 先把数学公式摘出来，避免被 markdown 的 * _ 之类语法拆坏（LaTeX 里全是这些符号）。
 * 返回替换后的文本和取出的公式表。
 */
function protectMath(src) {
  const tokens = [];
  const keep = (s) => `\u0002${tokens.push(s) - 1}\u0002`;

  const mathify = (seg) => {
    if (!seg) return seg;
    return seg
      .replace(/\$\$([\s\S]+?)\$\$/g, (m) => keep(m))
      .replace(/\\\[([\s\S]+?)\\\]/g, (m) => keep(m))
      .replace(/\\\(([\s\S]+?)\\\)/g, (m) => keep(m))
      // 行内 $...$：开头不跟空白、结尾前不跟空白，且不是 $$
      .replace(/(^|[^\\$])\$(?!\s)([^\n$]+?)(?<!\s)\$(?!\$)/g,
        (m, pre, body) => `${pre}${keep(`$${body}$`)}`);
  };

  // 代码围栏内部不处理
  const lines = src.split('\n');
  const parts = [];
  let buf = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inFence) {
        parts.push(mathify(buf.join('\n')));
        buf = [line];
        inFence = true;
      } else {
        buf.push(line);
        parts.push(buf.join('\n'));   // 代码块原样保留
        buf = [];
        inFence = false;
      }
    } else {
      buf.push(line);
    }
  }
  parts.push(inFence ? buf.join('\n') : mathify(buf.join('\n')));

  return { text: parts.join('\n'), tokens };
}

const restoreMath = (html, tokens) =>
  html.replace(/\u0002(\d+)\u0002/g, (_, i) => esc(tokens[Number(i)]));

/** 把 markdown 转成 html 字符串 */
export function renderMarkdown(src) {
  const { text, tokens } = protectMath(String(src ?? '').replace(/\r\n?/g, '\n'));
  const html = renderBlocks(text);
  return tokens.length ? restoreMath(html, tokens) : html;
}

function renderBlocks(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    const fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)\s*$/);
    if (fence) {
      const lang = fence[2] || '';
      const body = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${fence[1]}\\s*$`).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // 跳过结束围栏
      out.push(
        `<div class="md-code"><div class="md-code-head"><span>${esc(lang || 'code')}</span>` +
        `<button class="md-copy" type="button" data-copy>复制</button></div>` +
        `<pre><code>${esc(body.join('\n'))}</code></pre></div>`
      );
      continue;
    }

    // 空行
    if (!line.trim()) { i++; continue; }

    // 分割线
    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lv = Math.min(6, h[1].length);
      out.push(`<h${lv}>${inline(h[2].trim())}</h${lv}>`);
      i++;
      continue;
    }

    // 表格
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const t = tableFrom(lines, i);
      if (t) { out.push(t.html); i = t.next; continue; }
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
      continue;
    }

    // 列表
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) break;
        const indent = Math.floor(m[1].replace(/\t/g, '  ').length / 2);
        items.push({ indent, text: m[3] });
        i++;
      }
      const html = items.map((it) => {
        const pad = it.indent ? ` style="margin-left:${it.indent * 1.1}em"` : '';
        return `<li${pad}>${inline(it.text)}</li>`;
      }).join('');
      out.push(ordered ? `<ol>${html}</ol>` : `<ul>${html}</ul>`);
      continue;
    }

    // 段落：连续非空行，且不是新块的开头
    const para = [];
    while (i < lines.length && lines[i].trim()) {
      const l = lines[i];
      if (/^\s*(```|~~~)/.test(l) || /^#{1,6}\s/.test(l) || /^\s*>\s?/.test(l) ||
          /^(\s*)([-*+]|\d+[.)])\s+/.test(l) || /^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(l)) break;
      para.push(l);
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join('\n')).replace(/\n/g, '<br>')}</p>`);
    else { i++; } // 兜底，避免死循环
  }

  return out.join('\n');
}

/** 让代码块的「复制」按钮生效（事件委托，只需绑一次） */
export function bindCopyButtons(root) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const code = btn.closest('.md-code')?.querySelector('code');
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent);
      const old = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = old; }, 1200);
    } catch { btn.textContent = '复制失败'; }
  });
}
