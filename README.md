# LearnJapanese · 标准日本语学习站

用 [wizicer/LearnJapan](https://github.com/wizicer/LearnJapan) 整理的数据重写的静态站点：
**零依赖、零构建**，`git push` 就能发布到 <https://jp.houlinzhi.com/>。

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
- `#/cards` 背单词：可按课选范围，顺序 / 随机两种出题顺序，四种出题方向（中文 / 汉字 / 假名 / 听音），点卡片翻面（再点翻回），卡片左右两侧箭头切上一个/下一个，键盘 ↑/← 上一个、↓/→ 下一个、空格/回车翻面，M 或卡片右上角标记「已掌握」

背单词的「已掌握」、注音 / 译文偏好存在浏览器 localStorage，不需要后端。已掌握的词不会进入新一轮，点工具栏的「已掌握 n」可以查看列表、单独取消或全部取消。

## AI 助手

每个页面右下角都有一个 ✦ 按钮，打开一个浮动对话窗口（按钮和窗口都能拖动，位置会记住），用的是**你自己的 DeepSeek API Key**：

- 首次打开会让你填 Key（在 [platform.deepseek.com](https://platform.deepseek.com/api_keys) 申请）。
  Key 只保存在这台浏览器的 `localStorage`（`lj.ai.key`），请求**直接从浏览器发往 `api.deepseek.com`**，不经过任何第三方服务器。
- 模型可切 `Flash` / `Pro`；`思考` 开关控制是否返回思维链（思考过程会折叠显示在回答上方）。
- 支持上传**图片**（JPG / PNG / GIF / WebP，单张 ≤ 8 MB，走多模态，需要 Flash 模型）和**文本文件**
  （txt / md / csv / json / 代码等，≤ 256 KB，内容会拼进提示词）。PDF、Word 这类二进制文件不支持。
- 回答按 Markdown 渲染（标题、列表、表格、代码块带复制按钮、链接），LaTeX 公式用 KaTeX 渲染，
  支持 `$...$`、`$$...$$`、`\(...\)`、`\[...\]` 四种写法；KaTeX 与字体随仓库一起提交（`assets/vendor/katex`）。
- **会读取你当前正在看的那一屏**：课文正文与译文、本课生词、语法条目、单词总表的当前页、或者背单词正翻到的那张卡（含假名、声调、词性、释义）。所以可以直接问「用这个词造个句」「这篇课文讲了什么」「这条语法怎么用」。面板底部会显示一行「已读取：…」说明读到了什么。
- 对话会**自动存在这台电脑上**（localStorage，最近 30 段、上限约 2 MB）。刷新或关掉浏览器再回来会自动接上；点顶栏的时钟图标可以翻历史、点一条继续聊、单条删除或清空。垃圾桶图标是「新对话」，旧的那段会留在历史里。图片只备份文件名，不备份内容。
- Key、模型、思考开关也都会记住。
- 快捷键：`Enter` 发送，`Shift + Enter` 换行，`Esc` 关闭面板。

> 没填 Key 或 Key 失效时，面板里会显示对应提示，不会静默失败。

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
assets/js/ui/         下拉、AI 对话框、Markdown 渲染
data/*.json           由 _data 转换出的站点数据
audio/                课文与单词音频
scripts/build-data.mjs 数据转换（读 ../LearnJapan/_data）
scripts/serve.mjs     本地预览
scripts/shot.mjs      截图（调试用，走 CDP）
scripts/smoke.mjs     交互冒烟测试（无头浏览器点一遍）
DEPLOY.md             部署步骤
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

> YAML 解析用 `scripts/vendor/js-yaml`（MIT，随仓库一起提交），不用 `npm i`，
> 也不依赖任何外部目录。想改用 npm 版就先 `npm i js-yaml`，脚本会优先用项目里的那份。
> 源目录也可以传参：`node scripts/build-data.mjs D:\somewhere\LearnJapan`。

## 部署

完整的发布步骤（建仓库 → 推送 → 开 Pages → 绑域名 → 自检清单 → 常见问题）见
[**DEPLOY.md**](./DEPLOY.md)。

一句话版本：建仓库 `LearnJapanese` → `git push` → Pages 选 `main` + `/ (root)` →
DNS 加 `jp` CNAME 指向 `zenith0ra.github.io` → Pages 填 Custom domain 并勾 Enforce HTTPS。

站点是纯静态文件，不需要 Actions、不需要 Ruby、不需要 npm install。

## 注意

- 教材原文、译文、音频的版权不属于 MIT；本仓库只用于个人学习，已通过 `robots.txt` 禁止搜索引擎收录。
- 词性里的 `动1 / 动2 / 动3`、`形1 / 形2` 沿用原数据的中文标注习惯（对应五段 / 一段 / サ变，い形容词 / な形容词）。
- 单词音频是「整课连读」，没有逐词时间轴，所以点词用浏览器语音合成朗读，不假装能跳到某个词。
