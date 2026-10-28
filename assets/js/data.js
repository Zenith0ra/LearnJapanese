/** 数据加载（首次 fetch 后缓存在内存） */

const cache = new Map();

async function get(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(`/data/${name}.json`).then((r) => {
        if (!r.ok) throw new Error(`加载 ${name}.json 失败 (${r.status})`);
        return r.json();
      }).catch((e) => {
        cache.delete(name);
        throw e;
      })
    );
  }
  return cache.get(name);
}

export const lessonsAll = () => get('lessons');   // { basic, middle, index }
export const wordsAll = () => get('words');
export const grammarAll = () => get('grammar');
export const meta = () => get('meta');

/** 按课次取生词 */
export async function wordsOf(ref) {
  const all = await wordsAll();
  return all.filter((w) => w.ref === ref);
}

/** 按课次取语法点 */
export async function grammarOf(ref) {
  const all = await grammarAll();
  return all.filter((g) => g.ref === ref);
}

/** 找到某课（详细对象） */
export async function lessonById(id) {
  const d = await lessonsAll();
  return d.basic.find((l) => l.id === id) ?? d.middle.find((l) => l.id === id) ?? null;
}

/** 相邻课 */
export async function neighbours(id) {
  const d = await lessonsAll();
  const all = [...d.basic, ...d.middle];
  const i = all.findIndex((l) => l.id === id);
  return { prev: i > 0 ? all[i - 1] : null, next: i < all.length - 1 ? all[i + 1] : null };
}
