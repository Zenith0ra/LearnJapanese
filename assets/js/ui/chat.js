/** AI 对话框：用户自带 DeepSeek API Key，直接调 api.deepseek.com
 *  - 支持图片（deepseek-flash 多模态）与文本文件
 *  - 流式输出、Markdown 渲染、思考过程折叠
 *  - Key / 模型 / 思考开关存在 localStorage，对话只在内存里
 */
import { renderMarkdown, bindCopyButtons } from './markdown.js';
import { esc } from '../util.js';

const API_URL = 'https://api.deepseek.com/chat/completions';
const LS_KEY = 'lj.ai.key';
const LS_CFG = 'lj.ai.cfg';

const MODELS = [
  { id: 'deepseek-flash', label: 'Flash', vision: true },
  { id: 'deepseek-v4-pro', label: 'Pro', vision: false },
];

const MAX_IMAGE = 8 * 1024 * 1024;      // 8 MB
const MAX_FILE = 256 * 1024;            // 256 KB
const MAX_FILE_CHARS = 60000;

const ICONS = {
  spark: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  key: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="3.2"/><path d="M11.2 12H20M17 12v3M14 12v2.4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  img: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.4"/><path d="M21 16l-5-5-6 6"/></svg>',
  file: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/></svg>',
};

const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

let state = null;

export function mountChat() {
  if (state) return; // 只挂一次
  const cfg = readLS(LS_CFG, {});
  state = {
    open: false,
    key: readLS(LS_KEY, ''),
    model: cfg.model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-flash',
    thinking: cfg.thinking !== false,
    messages: [],       // { role, text, reasoning?, images?, files?, error?, streaming? }
    attachments: [],    // { kind:'image'|'text', name, dataUrl?, text? }
    busy: false,
    abort: null,
  };

  const host = document.createElement('div');
  host.className = 'ai-root';
  host.innerHTML = `
    <button class="ai-fab" id="aiFab" type="button" title="AI 助手" aria-label="打开 AI 助手">${ICONS.spark}</button>

    <aside class="ai-panel" id="aiPanel" aria-label="AI 助手" aria-hidden="true">
      <header class="ai-head">
        <b>AI 助手</b>
        <div class="ai-head-tools">
          <button class="icon-btn" id="aiKey" type="button" title="设置 API Key">${ICONS.key}</button>
          <button class="icon-btn" id="aiClear" type="button" title="清空对话">${ICONS.trash}</button>
          <button class="icon-btn" id="aiClose" type="button" title="关闭（Esc）">${ICONS.close}</button>
        </div>
      </header>

      <div class="ai-sub">
        <div class="seg" id="aiModels">
          ${MODELS.map((m) => `<button type="button" data-model="${m.id}">${m.label}</button>`).join('')}
        </div>
        <label class="switch"><input type="checkbox" id="aiThink"><span class="track"></span>思考</label>
      </div>

      <div class="ai-body" id="aiBody">
        <div class="ai-msgs" id="aiMsgs"></div>
        <div class="ai-setup" id="aiSetup" hidden>
          <div class="ai-setup-row">
            <input type="password" id="aiKeyInput" placeholder="sk-..." autocomplete="off" spellcheck="false">
            <button class="btn btn-primary" id="aiKeySave" type="button">保存</button>
          </div>
          <p class="ai-err" id="aiKeyErr" hidden></p>
        </div>
      </div>

      <div class="ai-foot">
        <div class="ai-attach" id="aiAttach"></div>
        <textarea id="aiInput" rows="1" placeholder="问点什么…" spellcheck="false"></textarea>
        <div class="ai-bar">
          <button class="btn btn-sm" id="aiImgBtn" type="button">${ICONS.img}<span>图片</span></button>
          <button class="btn btn-sm" id="aiFileBtn" type="button">${ICONS.file}<span>文件</span></button>
          <span class="ai-tip" id="aiTip"></span>
          <button class="btn btn-sm btn-primary" id="aiSend" type="button">发送</button>
        </div>
        <input type="file" id="aiImgInput" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden>
        <input type="file" id="aiFileInput" multiple hidden>
      </div>
    </aside>
  `;
  document.body.append(host);

  const $ = (s) => host.querySelector(s);
  const fab = $('#aiFab');
  const panel = $('#aiPanel');
  const body = $('#aiBody');
  const msgs = $('#aiMsgs');
  const setup = $('#aiSetup');
  const input = $('#aiInput');
  const sendBtn = $('#aiSend');
  const tip = $('#aiTip');
  const attachBox = $('#aiAttach');

  bindCopyButtons(msgs);

  /* ---------- 打开 / 关闭 ---------- */
  function open() {
    if (!state.key) showSetup(true);
    state.open = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    fab.classList.add('hidden');
    document.body.classList.add('ai-lock');
    setTimeout(() => input.focus({ preventScroll: true }), 60);
    scrollBottom(true);
  }
  function close() {
    state.open = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    fab.classList.remove('hidden');
    document.body.classList.remove('ai-lock');
    fab.focus({ preventScroll: true });
  }
  fab.addEventListener('click', open);
  $('#aiClose').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.open) { e.stopPropagation(); close(); }
  }, true);

  /* ---------- 设置区 ---------- */
  function showSetup(on) {
    setup.hidden = !on;
    msgs.classList.toggle('hide', on);
    if (on) {
      const i = $('#aiKeyInput');
      i.value = '';
      setTimeout(() => i.focus({ preventScroll: true }), 40);
    }
  }
  $('#aiKey').addEventListener('click', () => showSetup(setup.hidden));
  $('#aiKeySave').addEventListener('click', () => {
    const v = $('#aiKeyInput').value.trim();
    const err = $('#aiKeyErr');
    if (!/^sk-[A-Za-z0-9_-]{10,}$/.test(v)) {
      err.textContent = '看起来不是有效的 key（应该以 sk- 开头）';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    state.key = v;
    writeLS(LS_KEY, v);
    showSetup(false);
    tip.textContent = '已保存 Key';
    setTimeout(() => { tip.textContent = ''; }, 1800);
    input.focus();
  });
  $('#aiKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#aiKeySave').click(); }
  });

  /* ---------- 模型 / 思考 ---------- */
  function syncModels() {
    host.querySelectorAll('#aiModels button').forEach((b) => {
      b.classList.toggle('on', b.dataset.model === state.model);
    });
    $('#aiThink').checked = state.thinking;
  }
  $('#aiModels').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-model]');
    if (!b) return;
    state.model = b.dataset.model;
    writeLS(LS_CFG, { model: state.model, thinking: state.thinking });
    syncModels();
    hintForModel();
  });
  $('#aiThink').addEventListener('change', (e) => {
    state.thinking = e.target.checked;
    writeLS(LS_CFG, { model: state.model, thinking: state.thinking });
  });
  syncModels();

  function hintForModel() {
    const m = MODELS.find((x) => x.id === state.model);
    const hasImage = state.attachments.some((a) => a.kind === 'image');
    tip.textContent = hasImage && !m.vision ? '图片需要 Flash 模型' : '';
  }

  /* ---------- 提示条 ---------- */
  let tipTimer;
  function toast(text, ms = 2000) {
    tip.textContent = text;
    clearTimeout(tipTimer);
    if (text) tipTimer = setTimeout(() => { tip.textContent = ''; }, ms);
  }

  /* ---------- 附件 ---------- */
  $('#aiImgBtn').addEventListener('click', () => $('#aiImgInput').click());
  $('#aiFileBtn').addEventListener('click', () => $('#aiFileInput').click());
  $('#aiImgInput').addEventListener('change', (e) => addFiles([...e.target.files], 'image').then(() => { e.target.value = ''; }));
  $('#aiFileInput').addEventListener('change', (e) => addFiles([...e.target.files], 'text').then(() => { e.target.value = ''; }));

  async function addFiles(files, want) {
    for (const f of files) {
      if (want === 'image' || f.type.startsWith('image/')) {
        if (!/^image\/(jpeg|png|gif|webp)$/.test(f.type)) { toast('只支持 JPG / PNG / GIF / WebP'); continue; }
        if (f.size > MAX_IMAGE) { toast(`图片超过 ${MAX_IMAGE / 1024 / 1024}MB`); continue; }
        const dataUrl = await readAsDataURL(f);
        state.attachments.push({ kind: 'image', name: f.name, dataUrl });
      } else {
        if (f.size > MAX_FILE) { toast(`文件超过 ${MAX_FILE / 1024}KB`); continue; }
        const text = await readAsText(f);
        if (text === null) { toast('只支持文本类文件（txt / md / csv / json / 代码…）'); continue; }
        state.attachments.push({ kind: 'text', name: f.name, text: text.slice(0, MAX_FILE_CHARS) });
      }
    }
    renderAttach();
    hintForModel();
  }

  function readAsDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  function readAsText(file) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => {
        const t = String(r.result);
        // 粗略判断二进制：出现 NUL 或大量替换字符就当作非文本
        if (t.includes('\u0000') || (t.match(/\uFFFD/g) || []).length > 8) res(null);
        else res(t);
      };
      r.onerror = () => res(null);
      r.readAsText(file);
    });
  }

  function renderAttach() {
    attachBox.innerHTML = state.attachments.map((a, i) => {
      const inner = a.kind === 'image'
        ? `<img src="${a.dataUrl}" alt="">`
        : `<span class="ai-chip-name">${esc(a.name)}</span>`;
      return `<span class="ai-chip" title="${esc(a.name)}">${inner}<button type="button" data-rm="${i}" aria-label="移除">×</button></span>`;
    }).join('');
    attachBox.hidden = !state.attachments.length;
  }
  attachBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    state.attachments.splice(Number(b.dataset.rm), 1);
    renderAttach();
    hintForModel();
  });

  // 拖拽添加
  ['dragover', 'dragenter'].forEach((t) => panel.addEventListener(t, (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    panel.classList.add('dragging');
  }));
  ['dragleave', 'dragend'].forEach((t) => panel.addEventListener(t, () => panel.classList.remove('dragging')));
  panel.addEventListener('drop', async (e) => {
    e.preventDefault();
    panel.classList.remove('dragging');
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) await addFiles(files, 'auto');
  });

  /* ---------- 输入框 ---------- */
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(160, input.scrollHeight) + 'px';
  }
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });

  /* ---------- 渲染消息 ---------- */
  function bubbleInner(m) {
    if (m.role === 'user') {
      const imgs = m.images?.length
        ? `<div class="ai-imgs">${m.images.map((i) => `<img src="${i.dataUrl}" alt="${esc(i.name)}">`).join('')}</div>`
        : '';
      const files = m.files?.length
        ? `<div class="ai-files">${m.files.map((f) => `<span class="ai-file">${esc(f.name)}</span>`).join('')}</div>`
        : '';
      const text = m.text ? `<div class="ai-text">${esc(m.text).replace(/\n/g, '<br>')}</div>` : '';
      return imgs + files + text;
    }

    const think = m.reasoning
      ? `<details class="ai-think"${m.streaming ? ' open' : ''}>
           <summary>${m.streaming ? '思考中…' : '思考过程'}</summary>
           <div class="ai-think-body ai-md">${renderMarkdown(m.reasoning)}</div>
         </details>`
      : '';
    if (m.error) return `<div class="ai-error">${esc(m.text)}</div>`;
    // 还没吐任何字（含思考）时才显示等待动画，不要一直在旁边闪
    const waiting = m.streaming && !m.text && !m.reasoning;
    const empty = waiting ? '<div class="ai-typing"><i></i><i></i><i></i></div>' : '';
    return think + (m.text ? `<div class="ai-md">${renderMarkdown(m.text)}</div>` : empty);
  }

  function bubble(m) {
    const cls = m.role === 'user' ? 'ai-msg me' : 'ai-msg ai';
    return `<div class="${cls}">${bubbleInner(m)}</div>`;
  }

  function renderMessages() {
    if (!state.messages.length) {
      msgs.innerHTML = `<div class="ai-empty"><div class="ai-empty-title">有什么想问的？</div></div>`;
      return;
    }
    msgs.innerHTML = state.messages.map(bubble).join('');
  }

  function paintLast() {
    const last = msgs.lastElementChild;
    const m = state.messages[state.messages.length - 1];
    if (!last || !m) return;
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 120;
    last.innerHTML = bubbleInner(m);
    if (atBottom) scrollBottom();
  }

  function scrollBottom(force) {
    if (force || body.scrollHeight - body.scrollTop - body.clientHeight < 160) {
      body.scrollTop = body.scrollHeight;
    }
  }

  /* ---------- 发送 ---------- */
  function buildApiMessages() {
    // 只带最近 30 条，避免聊久了每次请求都重新上传整段历史
    const hist = state.messages.slice(0, -1).slice(-30);
    // 只有最后一轮用户消息带图片：更早的图片只留文字说明，省 token 和请求体
    const lastUserIdx = hist.map((m) => m.role).lastIndexOf('user');

    return hist.map((m, i) => {
      if (m.role === 'assistant') {
        return { role: 'assistant', content: m.error ? '（上一条请求失败，已忽略）' : (m.text || '') };
      }

      let text = m.text || '';
      if (m.files?.length) {
        for (const f of m.files) {
          text += `${text ? '\n\n' : ''}【用户上传的文件：${f.name}】\n${f.text}`;
        }
      }

      const imgs = m.images ?? [];
      if (imgs.length && i === lastUserIdx) {
        const blocks = [];
        if (text) blocks.push({ type: 'text', text });
        for (const img of imgs) blocks.push({ type: 'image_url', image_url: { url: img.dataUrl } });
        return { role: 'user', content: blocks };
      }
      if (imgs.length) text += `${text ? '\n' : ''}（此前上传过 ${imgs.length} 张图片）`;

      return { role: 'user', content: text };
    }).filter((m) => (Array.isArray(m.content) ? m.content.length : String(m.content).trim()));
  }

  function friendlyError(status, raw) {
    if (status === 401) return 'API Key 无效或已过期，点右上角钥匙图标重新填一个。';
    if (status === 402) return '账户余额不足，去 platform.deepseek.com 充值后再试。';
    if (status === 429) return '请求太频繁了，稍等几秒再发。';
    if (status === 400) return `请求被拒绝：${raw}`;
    if (status >= 500) return `DeepSeek 服务端出错（${status}），稍后再试。`;
    return raw || `请求失败（HTTP ${status}）`;
  }

  async function send() {
    if (state.busy) { state.abort?.abort(); return; }
    if (!state.key) { showSetup(true); return; }

    const text = input.value.trim();
    if (!text && !state.attachments.length) return;

    const images = state.attachments.filter((a) => a.kind === 'image');
    const files = state.attachments.filter((a) => a.kind === 'text');

    // 图片只有 Flash 支持
    if (images.length && state.model !== 'deepseek-flash') {
      state.model = 'deepseek-flash';
      writeLS(LS_CFG, { model: state.model, thinking: state.thinking });
      syncModels();
      toast('图片需要 Flash 模型，已自动切换');
    }

    state.messages.push({ role: 'user', text, images, files });
    state.messages.push({ role: 'assistant', text: '', reasoning: '', streaming: true });
    input.value = '';
    autoGrow();
    state.attachments = [];
    renderAttach();
    renderMessages();
    scrollBottom(true);

    const payload = {
      model: state.model,
      stream: true,
      messages: buildApiMessages(),
      ...(state.thinking
        ? { thinking: { type: 'enabled' }, reasoning_effort: 'high' }
        : { thinking: { type: 'disabled' } }),
    };

    state.busy = true;
    state.abort = new AbortController();
    sendBtn.textContent = '停止';
    sendBtn.classList.add('stop');

    const cur = state.messages[state.messages.length - 1];
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; paintLast(); });
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.key}` },
        body: JSON.stringify(payload),
        signal: state.abort.signal,
      });

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let msg = raw;
        try { msg = JSON.parse(raw)?.error?.message || raw; } catch { /* 原样 */ }
        throw new Error(friendlyError(res.status, String(msg).slice(0, 300)));
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let done = false;

      while (!done) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') { done = true; break; }
            let j;
            try { j = JSON.parse(data); } catch { continue; }
            const d = j.choices?.[0]?.delta;
            if (d?.reasoning_content) cur.reasoning += d.reasoning_content;
            if (d?.content) cur.text += d.content;
          }
          schedule();
        }
      }
      if (buf.trim()) {
        // 收尾：最后可能没有空行分隔
        for (const line of buf.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const d = JSON.parse(data).choices?.[0]?.delta;
            if (d?.reasoning_content) cur.reasoning += d.reasoning_content;
            if (d?.content) cur.text += d.content;
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        cur.text = cur.text || '（已停止）';
      } else {
        cur.error = true;
        cur.text = err.message || '请求失败';
      }
    } finally {
      cur.streaming = false;
      state.busy = false;
      state.abort = null;
      sendBtn.textContent = '发送';
      sendBtn.classList.remove('stop');
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      paintLast();
      scrollBottom();
    }
  }

  sendBtn.addEventListener('click', send);
  $('#aiClear').addEventListener('click', () => {
    state.messages = [];
    renderMessages();
    toast('对话已清空');
  });

  renderMessages();
}
