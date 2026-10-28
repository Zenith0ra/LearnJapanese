#!/usr/bin/env node
/**
 * 把 LearnJapan 的原始数据（YAML / CSV）转换成站点用的 JSON。
 *
 * 用法：node scripts/build-data.mjs [源目录]
 * 默认源目录：../LearnJapan（只读它的 _data 目录）
 *
 * YAML 解析用 scripts/vendor/js-yaml（MIT，已随仓库一起提交，无需安装）。
 * 想换成 npm 版的话，先 `npm i js-yaml`，脚本会优先用项目里的那份。
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const YAML = (() => {
  const candidates = [
    join(__dirname, 'vendor', 'js-yaml'),   // 随仓库提交的副本（默认走这条）
    join(ROOT, 'node_modules', 'js-yaml'),  // 如果项目里 npm i 过
    'js-yaml',                              // 全局 / NODE_PATH
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* 试下一个 */ }
  }
  console.error('\n找不到 js-yaml（scripts/vendor/js-yaml 应该跟着仓库一起在）。\n');
  process.exit(1);
})();

const SRC = resolve(process.argv[2] ?? join(ROOT, '..', 'LearnJapan'));
const OUT = join(ROOT, 'data');

if (!existsSync(join(SRC, '_data'))) {
  console.error(
    `\n找不到数据源目录：${SRC}\n` +
    '重建数据需要 wizicer/LearnJapan 仓库里的 _data（只读它，不会改动）。\n' +
    `  git clone https://github.com/wizicer/LearnJapan.git "${SRC}"\n` +
    '日常使用站点不需要它——data/*.json 已经提交在仓库里。\n'
  );
  process.exit(1);
}

const read = (p) => readFileSync(join(SRC, p), 'utf8');

/* ---------- 文本块解析 ---------- */

/**
 * 把 YAML 里的 markdown 块（`> * 句子` / `* 句子` / 空行 / `---` 分场）拆成
 * scenes: string[][]，每个 scene 是若干行，行内保留原始标记（!漢字(かんじ)、@音调、全角空格缩进）。
 * trimIndent 用于译文：中文行首的全角空格多少不一，统一去掉，左边缘才整齐。
 */
function parseBlock(text, trimIndent = false) {
  if (!text) return { scenes: [] };
  const scenes = [[]];
  for (const raw of String(text).split('\n')) {
    let s = raw.replace(/[ \t]+$/, '');
    if (!s.trim()) continue;
    if (/^-{3,}$/.test(s.trim())) { scenes.push([]); continue; }
    s = s.replace(/^>\s*/, '').replace(/^[*-]\s?/, '');
    if (trimIndent) s = s.replace(/^[\u3000\s]+/, '');
    scenes[scenes.length - 1].push(s);
  }
  return { scenes: scenes.filter((s) => s.length > 0) };
}

/** 去掉注音标记，用于 title / 纯文本场景 */
const purify = (s) => String(s ?? '').replace(/!([^!()]*)\(([^()]*)\)/g, '$1').trim();

/** 行内是否只是对齐占位符（原站点用 `* -` 占位） */
const isPlaceholder = (s) => /^-{1,2}$/.test(s.trim());

/* ---------- 初级 ---------- */

function buildBasic(raw, units) {
  return Object.entries(raw)
    .map(([id, l]) => {
      const num = Number(id.replace('l', ''));
      let title = l.title ? String(l.title).trim() : '';
      if (!title) {
        // 初級 25–48 课没有 title 字段：取基本课文第一句兜底（原站点也是这么做的）
        const first = parseBlock(l.basic4).scenes[0]?.[0] ?? '';
        title = purify(first).replace(/。$/, '');
      }
      return {
        id,
        ref: lessonRef(false, num),
        level: 'basic',
        num,
        unit: Math.floor((num - 1) / 4) + 1,
        title: String(title).trim(),
        basic4: parseBlock(l.basic4),
        basicc: parseBlock(l.basicc),
        context: parseBlock(l.context),
        contextTitle: l.contitle ? purify(l.contitle) : '',
        contextTitleRaw: l.contitle ? String(l.contitle).trim() : '',
        t: {
          basic4: parseBlock(l.basic4t, true),
          basicc: parseBlock(l.basicct, true),
          context: parseBlock(l.contextt, true),
          contextTitle: l.contitlet ? String(l.contitlet).trim() : '',
        },
      };
    })
    .sort((a, b) => a.num - b.num);
}

/* ---------- 中级 ---------- */

function buildMiddle(raw) {
  return Object.entries(raw)
    .map(([id, l]) => {
      const num = Number(id.replace('m', ''));
      return {
        id,
        ref: lessonRef(true, num),
        level: 'middle',
        num,
        unit: Math.floor((num - 1) / 4) + 1,
        title: l.contitle ? purify(l.contitle) : '',
        titleRaw: l.contitle ? String(l.contitle).trim() : '',
        conversation: parseBlock(l.conversation),
        text: parseBlock(l.text),
        textTitle: l.texttitle ? String(l.texttitle).trim() : '',
      };
    })
    .sort((a, b) => a.num - b.num);
}

/* ---------- CSV ---------- */

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim())).map((r) => r.map((f) => f.trim()));
}

function buildWords(rows) {
  const [head, ...body] = rows;
  const col = (n) => head.indexOf(n);
  const [K, KJ, P, D, W, L, I] = ['kana', 'kanji', 'pos', 'desc', 'word', 'lesson', 'idx'].map(col);
  return body
    .map((r) => {
      const lesson = (r[L] ?? '').trim();
      const middle = /^m/.test(lesson);
      const num = Number(middle ? lesson.slice(1, 3) : lesson);
      return {
        kana: r[K] ?? '',
        kanji: r[KJ] ?? '',
        pos: r[P] ?? '',
        desc: r[D] ?? '',
        word: r[W] ?? '',
        lesson,
        ref: lessonRef(middle, num),
        level: middle ? 'middle' : 'basic',
        num,
        part: middle ? Number(lesson.slice(3)) || 1 : 1,
        idx: Number(r[I]) || 0,
      };
    })
    .filter((w) => w.num > 0);
}

function buildGrammar(rows) {
  const [head, ...body] = rows;
  const col = (n) => head.indexOf(n);
  const [I, L, E, S, X] = ['idx', 'lesson', 'expression', 'shortexplain', 'explanation'].map(col);
  const out = [];
  for (const r of body) {
    // lesson 可能是 `m04|m11`，一个语法点归属多课
    const refs = (r[L] ?? '').split('|').map((s) => s.trim()).filter(Boolean);
    for (const ref of refs) {
      const middle = /^m/.test(ref);
      const num = Number(middle ? ref.slice(1) : ref);
      if (!(num > 0)) continue;
      out.push({
        idx: Number(r[I]) || 0,
        lesson: ref,
        ref: lessonRef(middle, num),
        level: middle ? 'middle' : 'basic',
        num,
        expression: r[E] ?? '',
        short: r[S] ?? '',
        explanation: r[X] ?? '',
      });
    }
  }
  return out.sort((a, b) => a.level.localeCompare(b.level) || a.num - b.num || a.idx - b.idx);
}

/* ---------- main ---------- */

/** 课次引用：初级补零成 001，中级 m01 */
function lessonRef(middle, num) {
  return middle ? 'm' + String(num).padStart(2, '0') : String(num).padStart(3, '0');
}

const basic = buildBasic(YAML.load(read('_data/lessons.yml')), null);
const middle = buildMiddle(YAML.load(read('_data/mlessons.yml')));
const words = buildWords(parseCsv(read('_data/words.csv')));
const grammar = buildGrammar(parseCsv(read('_data/grammar.csv')));

const lessons = [
  ...basic.map((l) => ({
    id: l.id, ref: lessonRef(false, l.num), level: l.level, num: l.num, unit: l.unit,
    title: l.title,
    subtitle: l.contextTitle,
    hasTranslation: true,
    words: words.filter((w) => w.ref === lessonRef(false, l.num)).length,
    grammar: grammar.filter((g) => g.ref === lessonRef(false, l.num)).length,
  })),
  ...middle.map((l) => ({
    id: l.id, ref: lessonRef(true, l.num), level: l.level, num: l.num, unit: l.unit,
    title: l.title,
    subtitle: l.textTitle,
    hasTranslation: false,
    words: words.filter((w) => w.ref === lessonRef(true, l.num)).length,
    grammar: grammar.filter((g) => g.ref === lessonRef(true, l.num)).length,
  })),
];

mkdirSync(OUT, { recursive: true });
const write = (name, data) => {
  writeFileSync(join(OUT, name), JSON.stringify(data));
  const size = (JSON.stringify(data).length / 1024).toFixed(1);
  console.log(`  ${name.padEnd(14)} ${size} KB`);
};

console.log('写出 data/：');
write('lessons.json', { basic, middle, index: lessons });
write('words.json', words);
write('grammar.json', grammar);
write('meta.json', {
  generated: new Date().toISOString(),
  counts: {
    basic: basic.length,
    middle: middle.length,
    words: words.length,
    grammar: grammar.length,
    audioLesson: basic.length + middle.length,
  },
});

/* ---------- 自检 ---------- */

const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

check(basic.length === 48, `初级课数 ${basic.length} ≠ 48`);
check(middle.length === 32, `中级课数 ${middle.length} ≠ 32`);
for (const l of basic) {
  check(l.basic4.scenes.length > 0, `${l.id} 缺基本课文`);
  check(l.basicc.scenes.length > 0, `${l.id} 缺基本会话`);
  check(l.context.scenes.length > 0, `${l.id} 缺应用课文`);
  check(l.t.basic4.scenes.length === l.basic4.scenes.length,
    `${l.id} 基本课文与译文行数不一致 ${l.basic4.scenes.length}/${l.t.basic4.scenes.length}`);
}
for (const l of middle) {
  check(l.conversation.scenes.length > 0, `${l.id} 缺会话`);
  check(l.text.scenes.length > 0, `${l.id} 缺课文`);
}
check(words.length > 5000, `生词数 ${words.length} 偏少`);
check(grammar.length > 500, `语法数 ${grammar.length} 偏少`);

const noRuby = basic.filter((l) => l.basic4.scenes.flat().every((s) => !s.includes('!')));
check(noRuby.length === 0, `这些课完全没有注音：${noRuby.map((l) => l.id).join(',')}`);

console.log('\n自检：');
if (problems.length) {
  console.log(`  ✗ ${problems.length} 个问题`);
  problems.slice(0, 20).forEach((p) => console.log('    - ' + p));
} else {
  console.log('  ✓ 全部通过');
}
console.log(`  初级 ${basic.length} 课 / 中级 ${middle.length} 课 / 生词 ${words.length} / 语法 ${grammar.length}`);
console.log(`  样例 l1.title = ${basic[0].title}`);
console.log(`  样例 l1.basic4[0][0] = ${basic[0].basic4.scenes[0][0]}`);
console.log(`  样例 m1.textTitle = ${middle[0].textTitle}`);
