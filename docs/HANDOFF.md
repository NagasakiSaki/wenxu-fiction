# 文序项目交接

核对日期：**2026-10-18（Asia/Shanghai）**。本文替换上一版交接，覆盖到 v2.5.0 为止的工作。代码基线为本文提交前的 `e497db4`（v2.5.0 发布提交为 `6d58c0d8bde2e68235702a9f6a93905eff0659d3`）；文档提交会在这之后。开始工作前请重新检查 Git 与 Actions，不要把此处状态视为实时信息。

## 后续更新：v2.6.0（2026-10-18）

新增论坛连载整理：`src/forum-serial.js` 与 `src/import-analysis.js`，核心引擎3.2、应用2.6.0、200项Node回归。普通文件导入与原文光标校正复用来源归档层，一键整理使用清洗映射；分篇写入volume。用户文档仅本地验证，不在仓库。详情见[论坛连载说明](forum-serial.md)；发布状态请查最新Release/CI。

## 后续更新：v2.5.1（2026-10-18）

本节之后的v2.5.0表格为历史基线。当前源码已升级2.5.1：编辑断点迁移（新增 `src/breakpoint-migration.js`）、工作台操作按需展开（`src/studio-simple.css`），191项Node测试。迁移规则和限制见开发指南末尾；此处原“修改正文清空断点”的描述已被新实现替代。真实手机输入法专项仍需真机验收。发布状态请检查最新Release与CI。

## 0. 三句话判断

1. 对外版本 **v2.5.0**，网页与安卓包同版本，Node 回归 **185 项**、CI 冒烟全绿。
2. 本轮把“贴吧/转载文本 → 一键分章 → 原文校对 → 导出”连成了闭环，并补上存储、性能、排版与版画风格。
3. 真正缺的不是功能，而是**真机验收、真实模型/语料的实测证据，以及仓库许可证的决定**。

## 1. 入口

项目真实目录是 **`C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction`**，不是聊天环境默认的 `New project`。Windows / PowerShell，分支 `main`。

- 仓库：[NagasakiSaki/wenxu-fiction](https://github.com/NagasakiSaki/wenxu-fiction)
- 在线工作台：[作者工作台](https://nagasakisaki.github.io/wenxu-fiction/#/studio)
- 开发总指南：[developer-guide.md](developer-guide.md)
- 结构引擎：[structure-engine.md](structure-engine.md)
- 本地应用：[local-apps.md](local-apps.md)
- 断点设备验收：[chapter-breakpoint-acceptance.md](chapter-breakpoint-acceptance.md)
- 更新记录：[CHANGELOG.md](../CHANGELOG.md)
- 引用与依赖：[REFERENCES.md](../REFERENCES.md)

## 2. 用户目标与协作要求

用户希望把项目发展为功能完善的小说创作与阅读产品，以**可解释、可人工校正的自动分章**为技术特色；支持网页公开阅读、安卓本地离线书架、草稿文件互通（Windows 用 PWA）。

已明确的要求：

- 暂不做账号系统。不要改回必须登录、必须联网或必须云数据库的架构；草稿靠文件传递，没有云端自动同步。
- 大模型分章是**可选**连接器：默认离线，默认只发送候选短行，密钥只存本机，不写入草稿、备份、公开作品或导出文件。
- 以 **NagasakiSaki 的项目**发布，**不署助手名字**；借鉴项目与依赖如实写进 `REFERENCES.md`。
- 不要上传私人作品、调试截图、密钥或本机产物；用户提供的手稿只用于本地验证，不等于同意公开。
- 保留旧草稿、草稿备份、阅读副本的兼容性；存储结构变更必须给出版本与回退说明。

## 3. 当前完成度与发布差异

| 项目 | 交接时状态 |
| --- | --- |
| 网页 | 已部署 `6d58c0d`，线上包 `assets/index-Jw2jqqOV.js` 与本地构建一致 |
| `package.json` | `2.5.0` |
| 结构引擎 | `3.1.0`，定义在 `src/import-review-model.js` |
| 正式 Release | [v2.5.0](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.5.0)，对应 `6d58c0d8bde2e68235702a9f6a93905eff0659d3` |
| 正式 APK | `wenxu-android.apk`，6,324,084 字节，SHA-256 `ff5b76f4e4de003cda3a61c280f2f3f2c957a11254af5eb255dd134a461a4077`，`versionName 2.5.0` / `versionCode 20500` |
| 历史版本 | [v2.4.0](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.4.0)、[v2.3.1](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.3.1) |
| 最新安卓 CI | [39056380941](https://github.com/NagasakiSaki/wenxu-fiction/actions/runs/39056380941)，`package` 与 `offline-device-test` 均成功 |
| 最新部署 CI | [39056874768](https://github.com/NagasakiSaki/wenxu-fiction/actions/runs/39056874768)，`smoke` 与 `deploy` 均成功 |
| Node 回归 | 185 项全部通过 |
| 无头冒烟 | `npm run smoke:ui` 本地与 CI 均通过（4 步） |
| 设备回归 | CI 中 3 项离线安卓测试；仍无覆盖断点高亮、一键分章、分界校对与竖排的设备用例 |
| 工作区 | 写本文前无未提交修改；无遗留开发服务器 |

**网页与 APK 现在同版本。** Actions 构建成功不等于 Release 已更新，发布仍按 `CHANGELOG → 版本号 → CI → Release` 执行。

### 已具备的主要能力

- 导入：TXT / MD / DOCX / 文字型 PDF、文件夹批量、编码处理、自然排序、限额与完整性核对。
- 分章：明确章名、连续编号、Markdown 层级、目录匹配、卷章节、本书标题示例与反例学习、原文点选、候选证据与整书体检。
- 抓取文本：站点杂讯过滤、规律标题识别、一键整篇分章、碎章合并、长章断点建议、断点迁移、原文分界校对与示例重扫。
- 大模型：13 家服务商预设，候选行模式默认，行号必须落在候选集合，正文仍由离线引擎还原。
- 编辑：光标/多断点拆章、编号顺延、合并、撤销、操作前备份、多作品草稿、自动保存、回收站。
- 阅读：书架、书签备注、全文搜索、历史续读、字号字体行距、翻页/滚动、竖排（实验）、纸墨/版画风格。
- 数据：草稿备份 JSON、公开作品 JSON、TXT / Markdown 导出（可统一章名）、原文快照（仅本机）、阅读备份。
- 工程：185 项 Node 回归、结构评测基准、编辑性能基准、无头浏览器冒烟、安卓离线设备测试。

## 4. 本轮做了什么（不要重复）

| 提交 | 内容 |
| --- | --- |
| `0271c0e` | 提交交接文档与 README 链接 |
| `e6bade1` | v2.3.1：版本同步，正式 APK 补上目录定位、断点持久化、高亮与取消 |
| `9e0a711` | v2.4.0 主体：站点杂讯过滤、规律标题识别、一键分章、断点迁移、可选大模型、版画风格、编辑基准 |
| `468ff82` | 某章吞掉大部分正文时，把规律分界与既有标题**合并**而不是替换；编号倒序/跳号体检 |
| `6d58c0d` | v2.5.0：分界校对与示例重扫、候选行模式、原文快照、TXT/Markdown 导出、存储面板与备份轮换、分章 Worker、按帧高亮、排版清洗、竖排与章首刻印、无头冒烟 |
| `8e3e612`、`e497db4` | 两版交接文档 |

对应的代码位置：

| 功能 | 主要文件 |
| --- | --- |
| 杂讯过滤 | [`src/forum-noise.js`](../src/forum-noise.js) |
| 规律标题 | [`src/forum-headings.js`](../src/forum-headings.js) |
| 一键分章 | [`src/smart-split.js`](../src/smart-split.js)、[`src/smart-split-ui.js`](../src/smart-split-ui.js) |
| 分章线程 | [`src/smart-split-engine.js`](../src/smart-split-engine.js)、[`src/smart-split-worker.js`](../src/smart-split-worker.js) |
| 分界校对 | [`src/boundary-review.js`](../src/boundary-review.js)、[`src/boundary-review-ui.js`](../src/boundary-review-ui.js) |
| 原文快照 | [`src/draft-source.js`](../src/draft-source.js) |
| 大模型 | [`src/llm-providers.js`](../src/llm-providers.js)、[`src/llm-client.js`](../src/llm-client.js)、[`src/llm-chapter-service.js`](../src/llm-chapter-service.js)、[`src/llm-settings.js`](../src/llm-settings.js) |
| 导出与章名 | [`src/book-export.js`](../src/book-export.js)、[`src/file-export.js`](../src/file-export.js) |
| 存储与轮换 | [`src/storage-health.js`](../src/storage-health.js)、`draft-store.js` |
| 排版清洗 | [`src/text-tidy.js`](../src/text-tidy.js) |
| 风格 | [`src/theme.js`](../src/theme.js)、[`src/woodcut.css`](../src/woodcut.css) |
| 冒烟 | [`scripts/smoke-ui.mjs`](../scripts/smoke-ui.mjs)、`pages.yml` 的 `smoke` 作业 |

## 5. 不可破坏的语义

1. `pendingBreakpoints` 是**各章正文的 0 起始 UTF-16 偏移数组**，不是行号或字节；上限 999，排序去重，拒绝代理对内部断点。
2. v2.5.1 起修改正文会迁移当前章断点，仅移除改动内部或无法可靠定位的断点；拆分/合并消费受影响章节的断点，其他章节保留；操作前备份保存原方案。
3. 草稿备份保留编辑断点；公开作品 JSON、本地阅读副本移除编辑字段。
4. 高亮底色覆盖包含断点的整段（含自动折行），竖线标精确偏移；镜像层 `aria-hidden`，输入仍由 textarea 处理；不得把未转义手稿插入 HTML；输入事件按帧合并，不要改回逐键重建整章。
5. `smartSplit` 只提出标题行，切分与覆盖核对始终交给 `analyseChapters`；`integrity.ok === false` 时禁用“应用”。
6. 杂讯规则分强证据与关键词规则；关键词规则只在整行较短且不像叙事句时删除，可疑行保留核对。不要为“更干净”放宽到删长句。
7. 规律标题需同形重复、中位间隔 ≥300 字、编号大多递增、标题互不相同；纯数字与【标题】证据最弱，标记为“需核对”。
8. 大模型默认候选行模式：只发送短行或可解析标题，返回值必须落在候选集合内；模型绝不返回正文。
9. 密钥与配置分开存储（`wenxu-llm-config` / `wenxu-llm-key` / 会话级 `wenxu-llm-key-session`），不属于草稿、备份、公开作品或导出文件。
10. `applySmartSplit` 先 `rebaseBreakpoints` 再写入：落在新章节边界或代理对内部的断点丢弃；任何情况下都生成独立 `draftKey` 的备份。
11. 分界校对只在清洗后的 `cleanedText` 上进行，行号是全文 1 起始；应用前必须重新 `buildReview` 并检查覆盖。
12. 原文快照 `importSource` 只存本机：`exported()`、阅读副本、结构报告都不包含；超过 200 万字符不保存。
13. 旧备份轮换只处理标题含“备份”的草稿，保留最近 12 份，当前草稿与回收站永不清理；安卓端移入回收站而非物理删除。
14. 竖排只允许滚动模式；从翻页切到竖排会自动改回滚动，因为翻页依赖水平宽度计算。
15. 风格只通过 `html[data-theme="woodcut"]` 覆盖变量，默认 `:root` 与 `.night` 不受影响；不引入图片或外部字体。
16. 冒烟测试用本机 Chrome + DevTools 协议，不引入 Playwright/Puppeteer；CI 依赖运行器预装 Chrome。

## 6. 端侧特化分章模型（建议，尚未实现）

用户提出“在 App 内置一个特化分章的模型，体积按现代手机软件的大小考虑”。以下是评估结论，**代码尚未实现**，下一个模型不要当成已有功能。

### 6.1 结论

做，但**不要内置生成式 LLM**。任务本质是逐行二分类（这一行是否章节标题），用 1–8 MB 的判别式小模型即可；生成式模型（0.3B 级）体积 150–400 MB、逐 token 生成，收益不明显。

### 6.2 三条路线

| 方案 | 体积增量 | 耗时（几万行） | 预期收益 | 维护成本 |
| --- | --- | --- | --- | --- |
| A. 规则 + 纯 JS 特征打分（哈希字符 n-gram 逻辑回归/GBDT） | < 200 KB，无运行时 | 10–50 ms | 补“像标题但不是第N章”的形态 | 低：训练脚本 + 权重 JSON |
| B. 字符级小判别模型（char-CNN / 2–4 层 Transformer） | 模型 1–8 MB；若用 ONNX Runtime Web 再加 4–6 MB WASM | 30–150 ms（WASM） | 最强，能吃下奇怪排版 | 中：训练 + 量化一致性校验 |
| C. 端侧 LLM（Gemma 3 270M / Qwen3 0.6B int4） | 150–400 MB | 首次加载数秒，逐 token | 收益不明显 | 高：内存、耗电、机型兼容 |

当前 APK 只有 **6.3 MB**。C 会放大 25–60 倍，伤“离线、轻量、可解释”三条承诺；最多做成用户选装的可选包。

### 6.3 推荐形态

- 模型只看**候选行**（复用 `candidateLines()`，通常占全文 5–10%），不做全文生成。
- 输入：行文本前 60 字 + 结构特征（长度、句末标点、编号/括号/章节字、前后空行、与上一候选的距离、相对位置、是否与其他候选同形）。
- 输出：0–1 概率；阈值 + 间距约束得到 `boundaryLines`，再交给 `analyseChapters` 验证覆盖。
- 推理：字符级、词表约 6k，参数 < 600k，int8 权重 < 1 MB；**优先手写 typed-array 前向传播，不引入 onnxruntime**（省下的 5 MB 比模型还大）。
- 入口建议：新建 `src/device-heading-model.js`，在 `smartSplit` 里作为第三个 scorer（规则 / 设备模型 / 可选大模型），证据面板显示“模型 0.93 · 规则命中 第N章”，仍可在分界校对里改。
- 体积预算：APK 6.3 MB → 约 7.3 MB（纯 JS 方案）。

### 6.4 前置条件

**先有行级标注集，再谈模型。** 规则在 22 份合成样例上边界 F1 0.96，但目前没有任何真实行级标注；没有评测就用 6 MB 换一个说不清有没有变好的东西，不划算。

建议顺序：

1. **P0**：写 `benchmarks/heading-lines.mjs`，用现有规则与噪声生成器合成 200 篇、约 5 万行，人工抽检 1–2 千行做金标；同时训练 A 方案对比。若 A 足够，只涨 200 KB。
2. **P1**：A 不够时训练 char-CNN，导出 int8 权重，纯 JS 推理；失败静默回退规则；纳入冒烟。
3. **P2**：模型做成可选包（PWA 首次启用下载，APK 可内置），版本号 + 哈希进缓存键。

### 6.5 验收指标

| 指标 | 目标 |
| --- | --- |
| 行级精确率 / 召回 | 相对规则基线召回 +10%，精确率不降 |
| 误切率 | 不高于规则基线 |
| P95 推理耗时（中端安卓 WebView） | < 150 ms / 万行候选 |
| 冷启动 | 模型加载 < 300 ms，失败自动回退 |
| 包体增量 | ≤ 1 MB（纯 JS 方案） |
| 离线 | 断网可用，不依赖 CDN |

### 6.6 风险与合规

- 训练只能用可公开的合成数据（公版文本 + 注入噪声），**不得使用用户手稿**。
- 若基于他人预训练权重微调，必须确认许可证允许再分发；最稳妥是字符级模型从零训练、权重自有。
- 可解释性：模型分数只是证据，必须保留“依据 + 覆盖核对 + 原文校对”三层，避免产品退化成黑箱。
- WebView ≥119（项目已有要求）支持 WASM SIMD；纯 JS 方案则无版本门槛。

## 7. 还要做什么

### P0：真机专项验收（无设备证据）

- 按 [chapter-breakpoint-acceptance.md](chapter-breakpoint-acceptance.md) 验证：390 px 窄屏、键盘、输入法、Emoji、长行折行、同行多断点、取消后切章/刷新/备份恢复、重排/删除/拆分/合并共存、覆盖安装升级。
- 新增的分界校对、竖排、存储面板也应纳入同一轮；本机没有 Android SDK，只能靠用户真机或 CI。

### P1：真实环境证据

- 用作者自己的密钥在 2–3 个服务商跑真实接口，记录模型、耗时、候选行比例、失败原因；CI 只用假 `fetch`。
- 构造合成的贴吧式评测集，统计“正确分界 / 误切 / 漏切”；不要用私人手稿。
- 观察候选行模式对 token 与耗时的实际收益，必要时调整 60 字阈值。

### 已实现：正文编辑后断点自动迁移（v2.5.1）

根据实际输入范围迁移；区间内部、无可信输入范围且存在位置歧义的断点移除并提示。保留的断点随草稿保存。还需真实手机输入法专项验证；不保证找回已移除的断点。

### P2：维护与工程

- `main.js` 仍在膨胀（工作台渲染 + 多个弹窗），建议按“页面 / 状态 / 弹窗”定向拆分，不做大重构。
- 明确仓库自身代码许可证；目前无根 LICENSE，不能因公开就宣称可任意再分发。
- 检查 Actions 旧运行时提示与 runner 升级；依赖升级单独提交。
- 抓取规则是新站点格式的主要短板：优先补合成样例与测试，不要直接放宽成“遇到短行就切”。

### P3：可选产品路线（尚未授权）

| 顺序 | 方向 | 与现有功能的区别 |
| --- | --- | --- |
| 1 | 方案对比 | 比较自动、示例辅助、人工、大模型、设备模型方案，支持回到某一方案 |
| 2 | 内容差异核对 | 现有已有完整性统计；进一步逐段展示正文/归档去向并允许定位恢复 |
| 3 | 作品版本历史 | 现有有操作前备份与一次撤销；缺时间线、差异比较、单章恢复 |
| 4 | EPUB 导出 | 现有 TXT/Markdown；增加带封面、卷章目录的标准电子书 |

## 8. 环境、验证与发布

Node.js 24、npm；安卓 CI 使用 JDK 21、SDK 36。本机**没有** Android SDK（无 `ANDROID_HOME`、无 `android/local.properties`），不能在本机完整构建 APK。

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

- `npm run smoke:ui` 会自己启动 `vite preview` 并拉起 Chrome；没有 Chrome 时设置 `CHROME_PATH`。
- 开发地址 `http://127.0.0.1:5180/wenxu-fiction/#/studio`；不同端口/域名的本机数据隔离，别把环境变化误判为草稿丢失。
- 结构规则变化时再跑 `npm run benchmark`。当前 22 份合成样例：18 份自动样例 17 份边界完全匹配，F1 0.96；另 4 份示例辅助单独统计，不代表任意真实文档或手机性能。

安卓同步与设备回归：

```powershell
npm run build:native
Set-Location android
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:connectedDebugAndroidTest
```

CI 作业：安卓 `package`、`offline-device-test`；网页 `smoke`、`deploy`。CI 产物不自动创建 Release。

### Git 与发布注意

```powershell
git -c user.name=NagasakiSaki -c user.email=196273039+NagasakiSaki@users.noreply.github.com commit -m "具体变更说明"
```

- 不添加助手署名或 Co-authored-by。
- 正式签名用已配置的 Actions Secrets，沿用原证书；不要生成替代密钥覆盖发布。
- Release 的 `--target` 用完整提交 SHA（短 SHA 返回 422）；APK 资产名保持 `wenxu-android.apk`。
- `.private/`、`.artifacts/`、构建目录被忽略；不要把它们加进 Git。
- 网页 `base=/wenxu-fiction/`，原生相对路径；改部署位置需同时改 PWA 清单与离线回退。

## 9. 本机验证证据与阅读顺序

以下文件在忽略目录 `.artifacts/`，**没有随仓库发布**，换机器可能不存在：

- `boundary-review.png`、`boundary-review-toggled.png`、`boundary-review-examples.png`：分界校对与示例重扫。
- `storage-panel.png`、`text-export.png`：存储面板与导出弹窗。
- `reader-vertical-woodcut.png`：竖排 + 版画章首刻印。
- `smart-split-preview.png`、`smart-split-applied.png`、`smart-split-backup.png`：一键分章预览、应用与备份。
- `studio-woodcut.png`、`home-woodcut.png`、`reader-woodcut.png`：版画风格主要页面。
- `editor-benchmark.json`：2,000,000 字符 / 999 断点约 9.6 ms；30 万字符抓取文本分章约 56 ms。

这些都是桌面浏览器证据，不是手机证据。CI 的 `smoke` 作业复跑了同一脚本。

推荐阅读顺序：本文 → `git status` 与最新 CI → `developer-guide.md` → `tests/smart-split.test.js` → `smart-split.js` → `boundary-review.js` → 断点模块 → 再做端侧模型评测。

## 10. 给下一个模型的启动指令

> 请先阅读 `C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction\docs\HANDOFF.md` 和开发者指南，核对代码与发布状态。不要重复实现已完成的一键分章、分界校对、候选行大模型、原文快照、文本导出、存储面板、竖排与版画风格；端侧分章模型只有设计建议，尚未实现。简述当前状态与建议优先任务，再按我的新指令继续；保留本地离线与草稿兼容性，不公开私人手稿，不署助手名，引用保留在 REFERENCES.md。
