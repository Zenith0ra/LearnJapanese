# 標日 · 新标准日本语学习站

用 [wizicer/LearnJapan](https://github.com/wizicer/LearnJapan) 整理的数据重写的静态站点：
**零依赖、零构建**，`git push` 就能发布。

## 内容

| 内容 | 数量 | 说明 |
| --- | --- | --- |
| 初级课文 | 48 课 | 基本课文 / 基本会话 / 应用课文 + 全部中文译文 |
| 中级课文 | 32 课 | 会話 / 課文（原数据没有译文与注音） |
| 生词 | 5,751 | 带音调标记（`@0` 平板、`@1` 头高、`@n` 中高） |
| 语法 | 607 | 按课次索引，一个语法点可归属多课 |
| 音频 | 160 段 | 课文 / 单词各 80 段，随仓库一起部署 |

## 页面

- `#/` 课程目录：初级 / 中级切换，按单元排列
- `#/lesson/l1` 课文页：注音开关、译文对照、音频（进度条拖动 + 1× / 1.25× / 1.5× / 2×）、生词（宽屏「日汉」成对两栏）、语法
- `#/lesson/l1?tab=words&tr=1&ruby=0` 可深链到任意标签页与显示状态
- `#/words` 单词总表：搜索、按级别 / 课次筛选
- `#/grammar` 语法总表：搜索、按课次分组
- `#/cards` 背单词：可按课选范围，顺序 / 随机两种出题顺序，四种出题方向（中文 / 汉字 / 假名 / 听音），空格 / 回车 / → 先翻面再下一张，← 上一张

背单词的「已记住」与注音 / 译文偏好存在浏览器 localStorage，不需要后端。

## 目录

```
index.html            页面外壳
assets/app.css        全部样式（浅色 / 深色）
assets/js/app.js      路由与主题
assets/js/data.js     数据加载
assets/js/ruby.js     注音与音调渲染
assets/js/store.js    主题与本地偏好
assets/js/audio.js    音频与朗读
assets/js/pages/      各页面
data/*.json           由 _data 转换出的站点数据
audio/                课文与单词音频
scripts/build-data.mjs 数据转换（读 ../LearnJapan/_data）
scripts/serve.mjs     本地预览
scripts/shot.mjs      截图（调试用，走 CDP）
```

## 本地预览

```bash
npm run serve          # http://127.0.0.1:8321/
```

因为用了 `fetch` 读 JSON，不能直接双击 `index.html`，需要起一个静态服务器。`scripts/serve.mjs` 支持 Range 请求——没有它浏览器会认为音频不可拖动，进度条点了会跳回开头（GitHub Pages 本身支持 Range，线上不会有这个问题）。

## 自检

```bash
node scripts/check-align.mjs   # 原文与译文逐行对齐检查（当前 0 问题 / 1443 行译文）
node scripts/smoke.mjs         # 无头浏览器点一遍所有交互，35 项检查
```

`smoke.mjs` 会真的去点标签页、开关、翻页、背单词，并收集 JS 异常；改完代码跑一遍就知道有没有点坏。

## 重新生成数据

```bash
npm run data           # 需要同级目录下有 LearnJapan 仓库
```

`scripts/build-data.mjs` 用 `js-yaml` 解析 `_data/lessons.yml` / `mlessons.yml`，
用自带的 CSV 解析读 `words.csv` / `grammar.csv`，输出到 `data/`，并做一致性自检
（课数、译文与原文行数是否对齐、每课是否都有注音等）。

> 当前脚本引用的是本机 `D:/Dev/portfolio/node_modules/js-yaml`。换机器时改成
> `npm i js-yaml` 后把 `require('D:/Dev/portfolio/node_modules/js-yaml')`
> 换成 `require('js-yaml')` 即可。

## 部署到 jp.houlinzhi.com

1. 新建 GitHub 仓库，把本目录推上去（默认分支 `main`）。
2. 仓库 Settings → Pages → Source 选 **Deploy from a branch**，分支 `main`、目录 `/ (root)`。
3. DNS 加一条 `CNAME` 记录：`jp` → `<你的用户名>.github.io`。
4. 仓库里的 `CNAME` 文件已写好 `jp.houlinzhi.com`；`robots.txt` 已禁止收录。

站点是纯静态文件，不需要 Actions、不需要 Ruby、不需要 npm install。

## 注意

- 教材原文、译文、音频的版权不属于 MIT；本仓库只用于个人学习，已通过 `robots.txt` 禁止搜索引擎收录。
- 词性里的 `动1 / 动2 / 动3`、`形1 / 形2` 沿用原数据的中文标注习惯（对应五段 / 一段 / サ变，い形容词 / な形容词）。
- 单词音频是「整课连读」，没有逐词时间轴，所以点词用浏览器语音合成朗读，不假装能跳到某个词。
