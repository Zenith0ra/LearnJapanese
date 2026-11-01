#!/usr/bin/env node
/**
 * 生成练习册音频索引 data/workbook.json
 *
 * 素材来源：初级-同步练习-上 / 下 两个文件夹里的 TrackNN.mp3（文件名没有课次信息）。
 * 顺序规则（按教材结构）：每 4 课一个单元，单元末练习排在单元最后一课之后：
 *   上：第1-4课 → 单元末练习1 → 第5-8课 → 练习2 → … → 第25-28课 → 练习7 → 第29、30课   （共 37 条）
 *   下：第31、32课 → 练习8 → 第33-36课 → 练习9 → … → 第45-48课 → 练习12 → 模拟4级 → 模拟3级（共 25 条）
 *
 * 用法：node scripts/build-workbook.mjs
 */
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TOTAL_LESSONS = 48;
const UP_TRACKS = 37;

const lessons = JSON.parse(readFileSync(join(ROOT, 'data', 'lessons.json'), 'utf8'));
const index = [...lessons.basic, ...lessons.middle].filter((l) => l.level === 'basic');
const titleOf = (num) => {
  const l = index.find((x) => x.num === num);
  return l ? l.title.replace(/!([^!()]*)\(([^()]*)\)/g, '$1') : '';
};

/** 按「4 课 + 1 个单元末练习」拼出整本书的顺序 */
function sequence() {
  const seq = [];
  for (let n = 1; n <= TOTAL_LESSONS; n++) {
    seq.push({ kind: 'lesson', num: n });
    if (n % 4 === 0 && n / 4 <= 12) seq.push({ kind: 'unit', num: n / 4 });
  }
  seq.push({ kind: 'mock', num: 4, label: '模拟试题录音内容 4 级' });
  seq.push({ kind: 'mock', num: 3, label: '模拟试题录音内容 3 级' });
  return seq;
}

const list = sequence();
if (list.length !== 62) throw new Error(`条目数应为 62，实际 ${list.length}`);

const upFiles = readdirSync(join(ROOT, 'audio', 'workbook', 'up')).filter((f) => f.endsWith('.mp3')).sort();
const downFiles = readdirSync(join(ROOT, 'audio', 'workbook', 'down')).filter((f) => f.endsWith('.mp3')).sort();
if (upFiles.length !== UP_TRACKS) throw new Error(`上应有 ${UP_TRACKS} 个文件，实际 ${upFiles.length}`);
if (downFiles.length !== list.length - UP_TRACKS) throw new Error(`下文件数不对：${downFiles.length}`);

const out = list.map((it, i) => {
  const vol = i < UP_TRACKS ? 'up' : 'down';
  const file = vol === 'up' ? upFiles[i] : downFiles[i - UP_TRACKS];
  const base = {
    vol,
    kind: it.kind,
    src: `/audio/workbook/${vol}/${file}`,
  };
  if (it.kind === 'lesson') {
    return { ...base, id: `l${it.num}`, num: it.num, label: `第 ${it.num} 課`, title: titleOf(it.num) };
  }
  if (it.kind === 'unit') {
    return { ...base, id: `u${it.num}`, num: it.num, label: `单元末练习 ${it.num}`, title: '' };
  }
  return { ...base, id: `m${it.num}`, num: it.num, label: it.label, title: '' };
});

writeFileSync(join(ROOT, 'data', 'workbook.json'), JSON.stringify(out), 'utf8');

console.log(`共 ${out.length} 条（上 ${out.filter((x) => x.vol === 'up').length} / 下 ${out.filter((x) => x.vol === 'down').length}）`);
console.log('样例：');
for (const x of [out[0], out[4], out[35], out[36], out[37], out[60], out[61]]) {
  console.log(` ${x.vol}\t${x.label}\t${x.title || ''}\t${x.src}`);
}
