# 文序项目交接

核对日期：**2026-10-18（Asia/Shanghai）**。本文交接时的代码基线为 `6d58c0d8bde2e68235702a9f6a93905eff0659d3`（v2.5.0 发布提交）；本文自身的文档提交会在该基线之后。开始工作前请重新检查 Git 与 Actions，不要把此处状态视为实时信息。

## 给接手模型的入口

项目真实目录是 **`C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction`**，不是聊天环境默认的 `New project`。Windows / PowerShell，分支 `main`。

- 仓库：[NagasakiSaki/wenxu-fiction](https://github.com/NagasakiSaki/wenxu-fiction)
- 在线工作台：[作者工作台](https://nagasakisaki.github.io/wenxu-fiction/#/studio)
- 开发总指南：[developer-guide.md](developer-guide.md)
- 算法说明：[structure-engine.md](structure-engine.md)
- 本地应用：[local-apps.md](local-apps.md)
- 断点设备验收：[chapter-breakpoint-acceptance.md](chapter-breakpoint-acceptance.md)
- 更新记录：[CHANGELOG.md](../CHANGELOG.md)
- 引用与依赖：[REFERENCES.md](../REFERENCES.md)

## 1. 用户目标与协作要求

用户希望将项目发展为功能完善的小说创作与阅读产品，以可解释、可人工校正的自动分章为技术特色。支持网页公开阅读、安卓本地离线书架、草稿文件互通；Windows 当前使用 PWA。

用户已明确暂不做账号系统。不要擅自改回必须登录、必须联网或必须云数据库的架构。当前通过文件传递草稿，没有云端自动同步。大模型分章是**可选**连接器：默认只发送候选短行，密钥只存本机，不写入草稿或导出文件。

用户要求以 **NagasakiSaki 的项目**发布，不署助手名字；借鉴项目与依赖需要如实注明。已有持续的 GitHub 推送与上线授权。不要上传私人作品、调试截图、密钥或本机产物；用户提供的手稿用于本地验证，不等于同意公开手稿。

## 2. 当前完成度与发布差异

| 项目 | 交接时状态 |
| --- | --- |
| 网页 | 已部署 `6d58c0d`，含 2.5.0 全部功能（线上包 `assets/index-Jw2jqqOV.js` 与本地构建一致） |
| `package.json` | `2.5.0` |
| 结构引擎 | `3.1.0`，定义在 `src/import-review-model.js` |
| 正式 GitHub Release | [v2.5.0](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.5.0)，对应 `6d58c0d8bde2e68235702a9f6a93905eff0659d3` |
| 正式 APK | Release 中的 `wenxu-android.apk`，6,324,084 字节，SHA-256 `ff5b76f4e4de003cda3a61c280f2f3f2c957a11254af5eb255dd134a461a4077`，`versionCode 20500` |
| 历史版本 | [v2.4.0](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.4.0)、[v2.3.1](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.3.1) |
| 最新安卓 CI | [39056380941](https://github.com/NagasakiSaki/wenxu-fiction/actions/runs/39056380941)，`package` 与 `offline-device-test` 均成功 |
| 最新部署 CI | [39056381033](https://github.com/NagasakiSaki/wenxu-fiction/actions/runs/39056381033)，`smoke` 与 `deploy` 均成功 |
| Node 回归 | 交接当天重新运行，185 项全部通过 |
| 无头冒烟 | `npm run smoke:ui` 本地与 CI 均通过（4 步） |
| 设备回归 | CI 中 3 项离线安卓测试；仍无覆盖断点高亮、分章与校对交互的设备用例 |
| 工作区 | 写本文时只有文档改动待提交；无遗留开发服务器需要接管 |

**网页与正式 APK 版本一致。** 以后发布功能版本仍按 `CHANGELOG` → 版本号 → CI → Release 的顺序执行；Actions 成功不等于 Release 已更新。

### 已具备的主要能力

- TXT、MD、DOCX、文字 PDF 与目录批量导入、编码处理和自然排序。
- 明确章名、连续编号、Markdown 层级、目录正文匹配、卷章节结构、本书标题示例与反例学习。
- 候选证据、人工校正、整书体检、转换后文本完整性核对与脱敏结构报告。
- 导入阶段原文点选标题/正文断点、目录预览、搜索、取消及最近 20 步撤销。
- 工作台光标拆章、多断点批量拆章、篇幅/场景线索建议、编号顺延、合并、撤销与操作前备份。
- 一键智能分章：站点杂讯过滤、规律标题识别、整篇重分章、碎章合并、长章断点建议、断点迁移。
- 原文分界校对与示例重扫；抓取原文快照；可选大模型识别标题（默认只发候选短行）。
- 多作品草稿、自动保存、回收站、草稿备份迁移；独立本地阅读副本。
- 字体字号、手机翻页/滑动、首尾导航、书签备注、全文搜索、阅读历史与备份；竖排阅读（实验）。
- 安卓私有文件存储、SAF 选择/另存为、离线 APK；网页/PWA 离线缓存。
- 纸墨 / 版画两种界面风格；TXT / Markdown 导出与章名统一；本机存储面板与旧备份轮换。

## 3. 最近实现：不要重复

| 版本 | 功能 | 主要位置 |
| --- | --- | --- |
| 2.3.1 | 目录定位、断点持久化、高亮与取消 | `main.js`（`restoreStudioToc`）、`batch-chapter-ui.js`、`chapter-breakpoint-view.js` |
| 2.4.0 | 杂讯过滤 / 规律标题 / 一键分章 / 大模型 / 版画 | `forum-noise.js`、`forum-headings.js`、`smart-split.js`、`llm-*.js`、`theme.js`、`woodcut.css` |
| 2.5.0 | 分界校对与示例重扫 | [`src/boundary-review.js`](../src/boundary-review.js)、[`src/boundary-review-ui.js`](../src/boundary-review-ui.js) |
| 2.5.0 | 候选行模式与示例提示 | [`src/llm-chapter-service.js`](../src/llm-chapter-service.js) |
| 2.5.0 | 原文快照 | [`src/draft-source.js`](../src/draft-source.js) |
| 2.5.0 | 导出与章名统一 | [`src/book-export.js`](../src/book-export.js)、[`src/file-export.js`](../src/file-export.js) |
| 2.5.0 | 存储配额与备份轮换 | [`src/storage-health.js`](../src/storage-health.js)、`draft-store.js`（`deleteDraft`） |
| 2.5.0 | Worker 分章与按帧高亮 | [`src/smart-split-engine.js`](../src/smart-split-engine.js)、`chapter-breakpoint-view.js` |
| 2.5.0 | 排版清洗 / 竖排 / 章首刻印 | [`src/text-tidy.js`](../src/text-tidy.js)、`reader-controls.js`、`paged-reading.css` |
| 2.5.0 | 无头浏览器冒烟 | [`scripts/smoke-ui.mjs`](../scripts/smoke-ui.mjs)、`pages.yml` 的 `smoke` 作业 |

### 不要破坏的语义

1. `pendingBreakpoints` 是**各章正文的 0 起始 UTF-16 偏移数组**，不是行号或字节。上限 999 个，排序去重并拒绝代理对内部断点。
2. 修改正文会清除当前章旧断点；拆分/合并消费受影响章节的断点；其他章节保留，操作前备份仍保存原方案。
3. 草稿备份保留编辑断点；公开作品 JSON 和本地阅读副本移除它们。
4. 高亮底色覆盖**包含断点的换行段落，含其自动折行部分**，竖线标明精确偏移；镜像层 `aria-hidden`，真正输入仍由 textarea 处理；不得把未转义手稿插入 HTML。输入事件按帧合并，不要改回每次按键重建整章。
5. `smartSplit` 只提出标题行；真正的切分与覆盖核对始终交给 `analyseChapters`。`integrity.ok === false` 时界面禁用“应用”。
6. 杂讯规则分强证据与关键词规则；关键词规则只在整行较短且不像叙事句时删除，可疑行保留给作者核对。
7. 规律标题需同形重复、中位间隔 ≥300 字、编号大多递增、标题互不相同；纯数字与【标题】证据最弱。
8. 大模型默认候选行模式：只发送短行或可解析标题，返回值必须落在候选集合内；模型绝不返回正文。全文模式只是兜底。
9. 大模型密钥与配置分开存储（`wenxu-llm-config` / `wenxu-llm-key` / 会话级 `wenxu-llm-key-session`），不属于草稿、备份、公开作品或导出文件。
10. `applySmartSplit` 用 `rebaseBreakpoints` 迁移断点：落在新章节边界或代理对内部的断点丢弃；任何情况下都先生成独立 `draftKey` 的备份。
11. 分界校对只在清洗后的原文上进行（`cleanedText`），行号是全文 1 起始行号；应用前必须重新 `buildReview` 并检查覆盖。
12. 原文快照 `importSource` 只存本机：`exported()`、阅读副本、结构报告都不包含它；超过 200 万字符不保存。
13. 旧备份轮换只处理标题含“备份”的草稿，保留最近 12 份，当前草稿与回收站项目永不清理；安卓端移入回收站而不是物理删除。
14. 竖排只允许滚动模式；切到竖排时若原为翻页会自动改回滚动，因为翻页依赖水平宽度计算。
15. 风格只通过 `html[data-theme="woodcut"]` 覆盖变量；默认 `:root` 与 `.night` 不受影响；不引入图片或外部字体。
16. 冒烟测试使用本机 Chrome + DevTools 协议，不引入 Playwright/Puppeteer；CI 依赖运行器预装的 Chrome。

## 4. 还要做什么：建议按此顺序

### P0：真机专项验收（尚无设备证据）

清单与判定标准见 [chapter-breakpoint-acceptance.md](chapter-breakpoint-acceptance.md)：390 px 窄屏、键盘、输入法、Emoji、长行折行、同行多断点、取消后切章/刷新/备份恢复、重排/删除/拆分/合并共存、覆盖安装升级。新增的分界校对与竖排也应纳入同一轮真机验收。**本机没有 Android SDK，设备验证依赖 CI 或用户真机。**

### P1：大模型与抓取文本的真实环境验证

- 用作者自己的密钥在 2–3 个服务商上跑真实接口，记录模型、耗时、候选行比例与失败原因；CI 只用假 `fetch`。
- 抓取文本的识别准确率仍无评测集。构造合成的贴吧式文本（含楼层、广告、不同标题风格），统计“正确分界 / 误切 / 漏切”，不要用私人手稿。
- 观察候选行模式在超长文上的 token 与耗时收益，必要时调整 60 字阈值。

### P1：正文编辑后断点自动迁移

当前修改正文会清除该章断点。若要迁移，需要先定义插入/删除跨断点时的规则与可恢复性，不能简单保留旧偏移。

### P2：维护文档和工程可维护性

- 有针对性地拆分 `main.js` 的工作台渲染与状态逻辑（已新增若干弹窗，仍在膨胀）。
- 明确仓库自身代码许可证；未见根 LICENSE，不能因仓库公开就宣称可任意再分发。
- 检查 Actions 旧运行时提示与 runner 升级影响；依赖升级单独提交。
- 抓取规则按常见站点写成启发式；新格式优先补合成样例与测试，不要直接放宽为“遇到短行就切”。

### P3：可选产品路线（尚未整体授权）

| 顺序建议 | 方向 | 与现有功能的区别 |
| --- | --- | --- |
| 1 | 方案对比 | 比较自动、示例辅助、人工、大模型方案的差异，支持回到某一方案 |
| 2 | 内容差异核对界面 | 现有已有完整性统计；进一步逐段展示正文/归档去向并允许定位恢复 |
| 3 | 作品版本历史 | 现有有操作前备份与一次撤销；缺少版本时间线、差异比较、单章恢复 |
| 4 | EPUB 导出 | 当前有 TXT/Markdown；增加带封面、卷章目录的标准电子书导出 |

## 5. 环境、验证和发布命令

Node.js 24、npm；安卓 CI 使用 JDK 21、SDK 36。本机未配置 Android SDK（无 `ANDROID_HOME`、无 `android/local.properties`），不能在本机完整构建 APK。

```powershell
Set-Location 'C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction'
git status --short
git log -5 --oneline
npm ci
npm test
node scripts/validate-books.mjs
npm run build
npm run smoke:ui
npm run benchmark:editor
npm run dev -- --port 5180
```

`npm run smoke:ui` 会自己启动 `vite preview` 并拉起 Chrome；没有 Chrome 时设置 `CHROME_PATH`。开发地址为 `http://127.0.0.1:5180/wenxu-fiction/#/studio`。不同端口/域名的本机数据隔离，别将环境变化误判为草稿丢失。

原生前端同步与设备回归：

```powershell
npm run build:native
Set-Location android
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:connectedDebugAndroidTest
```

CI 包括安卓 `package`、`offline-device-test` 与网页 `smoke`、`deploy` 作业；CI 产物不自动创建 Release。

结构规则有变化时再执行 `npm run benchmark`。当前 22 份合成样例：18 份自动样例 17 份边界完全匹配，边界 F1 为 0.96；另外 4 份作者示例辅助样例单独统计。评测不代表任意真实文档、Word/PDF 转换或移动端性能。

### Git 与发布注意

- 提交使用用户身份，不添加助手署名或 Co-authored-by：

```powershell
git -c user.name=NagasakiSaki -c user.email=196273039+NagasakiSaki@users.noreply.github.com commit -m "具体变更说明"
```

- 正式签名使用已配置的 Actions Secrets，沿用原证书；不要生成替代密钥发布覆盖更新。`.private/`、`.artifacts/`、构建目录被忽略。
- Release 的 `--target` 使用完整提交 SHA（短 SHA 会返回 422）；APK 资产名保持 `wenxu-android.apk`。
- 网页 `base=/wenxu-fiction/`，原生相对路径；更改部署位置需同时改 PWA 清单与离线回退路径。

## 6. 本机验证证据与阅读顺序

以下文件在忽略目录 `.artifacts/` 中，**没有随仓库发布**，换机器可能不存在：

- `boundary-review.png`、`boundary-review-toggled.png`、`boundary-review-examples.png`：分界校对、增删分界与示例重扫。
- `storage-panel.png`、`text-export.png`：本机存储面板与文本导出弹窗。
- `reader-vertical-woodcut.png`：竖排 + 版画章首刻印。
- `smart-split-preview.png`、`smart-split-applied.png`、`smart-split-backup.png`：一键分章的预览、应用与备份。
- `studio-woodcut.png`、`home-woodcut.png`、`reader-woodcut.png`：版画风格主要页面。
- `editor-benchmark.json`：2,000,000 字符 / 999 断点约 9.6 ms，30 万字符抓取文本分章约 56 ms。

2026-10-18 用无头 Chrome 实际走通了“一键分章 → 预览 → 分界校对 → 返回 → 换肤”，控制台无异常；这是桌面浏览器证据，不是手机证据。CI 的 `smoke` 作业已复跑同一脚本。

推荐接手阅读顺序：本文 → `git status` 与最新 CI → `developer-guide.md` → `tests/smart-split.test.js` → `smart-split.js` → `boundary-review.js` → 断点模块。

可直接给下一个模型的启动指令：

> 请先阅读 `C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction\docs\HANDOFF.md` 和开发者指南，核对代码及发布状态。不要重复实现已完成的一键分章、分界校对、候选行大模型、原文快照、文本导出、存储面板、竖排与版画风格。简述当前状态和建议优先任务，再按我的新指令继续；保留本地离线与草稿兼容性，不公开私人手稿，不署助手名，引用保留在 REFERENCES.md。
