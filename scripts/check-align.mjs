import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(new URL('../data/lessons.json', import.meta.url)));
const bad = [];
for (const l of d.basic) {
  for (const k of ['basic4', 'basicc', 'context']) {
    const a = l[k].scenes, b = l.t[k].scenes;
    if (a.length !== b.length) { bad.push(`${l.id}.${k} 场景数 ${a.length} vs ${b.length}`); continue; }
    a.forEach((s, i) => {
      if (s.length !== b[i].length) bad.push(`${l.id}.${k} 场景${i + 1} 行数 ${s.length} vs ${b[i].length}`);
    });
  }
}
console.log('对齐问题:', bad.length);
bad.slice(0, 15).forEach((x) => console.log('  ', x));
const total = d.basic.reduce((n, l) =>
  n + l.t.basic4.scenes.flat().length + l.t.basicc.scenes.flat().length + l.t.context.scenes.flat().length, 0);
console.log('译文总行数:', total);

let empty = 0, gap = 0;
for (const l of d.basic) {
  for (const k of ['basic4', 'basicc', 'context']) {
    l[k].scenes.flat().forEach((s) => { if (/^-{1,2}$/.test(s.trim())) gap++; });
    if (!l[k].scenes.length) empty++;
  }
}
console.log('占位行:', gap, '空块:', empty);
