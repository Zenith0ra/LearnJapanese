# 部署到 jp.houlinzhi.com

> 仓库名：**LearnJapanese**　本地目录：`D:\Dev\LearnJapanese`
> 纯静态站点：**没有构建步骤**，推上去就能发布；80 MB 里 79 MB 是音频。

---

## 0. 前置条件

- GitHub 账号 `Zenith0ra`
- `houlinzhi.com` 的 DNS 管理权限（能加 CNAME 记录）
- 本地已装 Git（仓库已在本地初始化并提交好，随时可以推）

---

## 1. 建一个空仓库

GitHub → 右上角 **+** → **New repository**

| 项 | 填什么 |
| --- | --- |
| Repository name | `LearnJapanese` |
| Description | 可选，比如「新标准日本语 初级·中级 自用学习站」 |
| 可见性 | Public（GitHub Pages 免费版要求公开仓库） |
| Initialize this repository with | **全部不要勾**（不要 README / .gitignore / license） |

点 **Create repository**。

---

## 2. 推送本地代码

```powershell
cd D:\Dev\LearnJapanese
git remote add origin https://github.com/Zenith0ra/LearnJapanese.git
git push -u origin main
```

- 首次会推 450 多个文件、约 80 MB，视网速几分钟。
- HTTPS 方式需要 Personal Access Token 当密码；用 SSH 就把地址换成
  `git@github.com:Zenith0ra/LearnJapanese.git`。
- 如果提示 `remote origin already exists`，先 `git remote set-url origin <地址>`。

---

## 3. 打开 GitHub Pages

仓库 → **Settings** → 左侧 **Pages**

| 项 | 选什么 |
| --- | --- |
| Source | **Deploy from a branch** |
| Branch | `main` |
| 目录 | `/ (root)` |

点 **Save**。约 30–60 秒后，`https://zenith0ra.github.io/LearnJapanese/` 就能打开
（站点用的是相对路径，挂在子路径下也能正常跑，可以先这样验一眼）。

> 不需要 GitHub Actions，也不需要选 Jekyll 主题——仓库根的 `.nojekyll` 会让
> Pages 跳过 Jekyll、按原样发静态文件。

---

## 4. 绑定域名 jp.houlinzhi.com

### 4.1 加 DNS 记录

在域名商（或 Cloudflare）控制台加一条记录：

| 类型 | 名称 / 主机 | 值 / 目标 | TTL |
| --- | --- | --- | --- |
| **CNAME** | `jp` | `zenith0ra.github.io` | 自动 / 3600 |

⚠️ 子域名只能用 CNAME，不要用 A 记录；`jp.houlinzhi.com.` 结尾的点有些面板需要，按面板提示来。

### 4.2 填到 GitHub

同一个 Pages 页面：

1. **Custom domain** 填 `jp.houlinzhi.com` → **Save**
2. 等 GitHub 做一次 DNS 检查（通常几分钟，DNS 没传播时可能要几小时）
3. 检查通过后勾上 **Enforce HTTPS**（证书签发要等一会儿，最长 24 小时）

仓库根目录的 `CNAME` 文件已经写着 `jp.houlinzhi.com`，GitHub 一般会自动识别并回填；
**如果以设置页里填的为准**，两边保持一致即可。

### 4.3 验证 DNS

```powershell
nslookup jp.houlinzhi.com
```

解析结果里应该出现 `zenith0ra.github.io`（或它背后的 GitHub IP）。

---

## 5. 发布后自检

打开 https://jp.houlinzhi.com/ 逐项确认：

- [ ] 首页出现「标准日本语」，初级/中级可切换，课程卡片有注音
- [ ] 随便进一课：注音开关、译文开关有效，注音对齐不撑字
- [ ] 音频能播、进度条能拖、倍速 1→1.25→1.5→2 循环
- [ ] 生词标签两栏对齐，点词能朗读
- [ ] 单词总表能搜索，右上「全部课次」下拉能选到某一课
- [ ] 语法总表能搜索、能按级别过滤
- [ ] 背单词：能选课、顺序/随机可切、空格先翻面再下一张、← 上一张
- [ ] 手机宽度（F12 切设备模拟）不错位
- [ ] 深色模式正常（右上角按钮可切换 跟随系统/浅色/深色）

---

## 6. 日常更新

```powershell
cd D:\Dev\LearnJapanese
git add -A
git commit -m "改了什么"
git push
```

Pages 会在一分钟左右自动重新发布，**不需要任何构建命令**。

只有改动了教材数据源（`..\LearnJapan\_data` 里的 yml/csv）时才需要重建 JSON：

```powershell
npm run data      # 重新生成 data/*.json
git add -A && git commit -m "更新数据" && git push
```

本地预览：

```powershell
npm run serve     # http://127.0.0.1:8321/
```

---

## 7. 常见问题

**打开是 404**
1. Pages 里的分支是不是 `main`、目录是不是 `/ (root)`
2. 仓库根目录有没有 `.nojekyll`
3. Settings → Pages 顶部的绿色提示条现在写的是哪个地址

**域名打开是 GitHub 404**
说明 Custom domain 还没生效或 DNS 没解析到 GitHub。先用 `nslookup` 确认，再看 Pages 页面的 DNS 检查状态。

**Enforce HTTPS 勾不上**
证书还在签发，等 15 分钟到 24 小时；期间 HTTP 能访问就先凑合。

**改了 CNAME 文件没反应**
以 Settings → Pages 里的 Custom domain 为准，文件只作为声明；两边改成一致即可。

**音频拖不动进度条**
线上不会出现——GitHub Pages 支持 HTTP Range。只有用 `npm run serve` 本地预览时才依赖 `scripts/serve.mjs` 的 Range 实现（已经实现）。

**仓库太大**
79 MB 是音频。GitHub 单文件上限 100 MB、仓库建议 1 GB 以内，现在没问题。真要瘦身，把 `audio/` 挪到对象存储或 Release 附件，再改 `assets/js/audio.js` 里的路径前缀。

**想换托管**
纯静态，Cloudflare Pages / Netlify / Vercel 都能直接连仓库：构建命令留空、输出目录填 `/`。换平台时删掉仓库里的 `CNAME` 文件，域名在平台侧配置。

---

## 8. 以后改域名要动什么

### A. 换成另一个域名 / 子域名（仍是独立站点，挂在根路径）

代码里**没有硬编码任何域名**，所以只动三处配置 + 一处 DNS：

| # | 在哪里 | 改成什么 |
| --- | --- | --- |
| 1 | 仓库根目录 `CNAME` 文件 | 新域名，一行，不带 `https://`、不带结尾 `/` |
| 2 | GitHub 仓库 Settings → Pages → **Custom domain** | 新域名 → Save |
| 3 | 域名商 DNS | 新域名加 `CNAME → zenith0ra.github.io`（子域名）或 A 记录（根域名） |
| 4 | 同一页面的 **Enforce HTTPS** | 等证书签发后重新勾选 |

改完要重新等一次 DNS 检查 + 证书签发。旧域名的解析可以留着（仍然指向本仓库），也可以删掉。

> GitHub Pages 在境外，域名只要实名过即可，不涉及 ICP 备案。

### B. 换成某个站点的子路径（例如 `blog.houlinzhi.com/japanese/`）

这种情况**不能**只改配置，还得改代码里的路径：

1. 删掉仓库根目录的 `CNAME` 文件（否则 GitHub 仍按独立站点对待）
2. 把站点文件放进目标站点的 `japanese/` 目录
3. 把下面 4 处**绝对路径**改成相对路径：

| 文件 | 现在 | 改成 |
| --- | --- | --- |
| `index.html` | `href="/assets/app.css"` | `href="assets/app.css"` |
| `index.html` | `src="/assets/js/app.js"` | `src="assets/js/app.js"` |
| `assets/js/data.js` | ``fetch(`/data/${name}.json`)`` | ``fetch(`data/${name}.json`)`` |
| `assets/js/pages/lesson.js` | ``srcOf = … `/audio/lesson/…` `` | 去掉开头的 `/` |

站点用的是 hash 路由（`#/lesson/l1`），页面地址始终是 `index.html`，改成相对路径后任意子目录都能跑。

### C. 文档里的域名

`README.md`、`DEPLOY.md` 里出现的 `jp.houlinzhi.com` 只是说明文字，改不改都不影响运行，顺手替换一下即可。

### D. 顺带要知道的

- **换域名后旧地址会失效**：GitHub Pages 不支持自定义 301 跳转。要保留旧地址跳转，得在 DNS 前面挂 Cloudflare 做 Redirect Rule。
- **如果接了 Cloudflare 代理**：CNAME 指向 `zenith0ra.github.io` 时，橙色云（Proxied）会挡住 GitHub 的证书签发，先设成灰色云（DNS only）等证书签好再考虑开代理。
- **换平台**（Cloudflare Pages / Netlify / Vercel）：同样是纯静态，构建命令留空、输出目录 `/`，删掉 `CNAME`，域名在平台侧配。

---

## 9. 一句话版本

建仓库 `LearnJapanese` → `git push` → Pages 选 `main` + `/ (root)` →
DNS 加 `jp` CNAME 指向 `zenith0ra.github.io` → Pages 填 Custom domain 并勾 HTTPS → 打开
https://jp.houlinzhi.com/ 。
