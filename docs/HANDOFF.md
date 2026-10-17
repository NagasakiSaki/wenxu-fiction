# 文序项目交接

核对日期：**2026-10-18（Asia/Shanghai）**。本文交接时的代码基线为 `468ff82c7fa8ce14d47f92bc146b536ff4cdeae4`（v2.4.0 发布提交）；本文自身的文档提交会在该基线之后。开始工作前请重新检查 Git 与 Actions，不要把此处状态视为实时信息。

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

用户已明确暂不做账号系统。不要擅自改回必须登录、必须联网或必须云数据库的架构。当前通过文件传递草稿，没有云端自动同步。大模型分章是**可选**连接器：默认流程完全离线，密钥只存本机，不写入草稿或导出文件。

用户要求以 **NagasakiSaki 的项目**发布，不署助手名字；借鉴项目与依赖需要如实注明。已有持续的 GitHub 推送与上线授权。不要上传私人作品、调试截图、密钥或本机产物；用户提供的手稿用于本地验证，不等于同意公开手稿。

2026-10-18 的新要求已实现：面向贴吧/爬虫文本的智能分章、一键分章与整篇重排、主流大模型接口、分章后的断点、鲁迅式版画风格并可切换。

## 2. 当前完成度与发布差异

| 项目 | 交接时状态 |
| --- | --- |
| 网页 | 已部署 `468ff82`，含 2.4.0 全部功能 |
| `package.json` | `2.4.0` |
| 结构引擎 | `3.1.0`，定义在 `src/import-review-model.js` |
| 正式 GitHub Release | [v2.4.0](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.4.0)，对应 `468ff82c7fa8ce14d47f92bc146b536ff4cdeae4` |
| 正式 APK | Release 中的 `wenxu-android.apk`，6,303,159 字节，SHA-256 `7f9b665a4524e97d4f4a3976493a0d667c88add09925d871a1d427f9c5780bae`，`versionCode 20400`，与网页同版本 |
| 补丁版本 | [v2.3.1](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.3.1) 已单独发布，补上 2.3.0 之后的三次工作台修复 |
| 最新安卓 CI | [39053823203](https://github.com/NagasakiSaki/wenxu-fiction/actions/runs/39053823203)，`package` 与 `offline-device-test` 均成功 |
| 最新代码部署 CI | [39053823246](https://github.com/NagasakiSaki/wenxu-fiction/actions/runs/39053823246)，成功 |
| Node 回归 | 交接当天重新运行，155 项全部通过 |
| 设备回归 | CI 中 3 项离线安卓测试；尚无覆盖断点高亮与智能分章的设备用例 |
| 工作区 | 写本文时只有文档改动待提交；无遗留开发服务器需要接管 |

**网页与正式 APK 现在版本一致。** 以后发布功能版本时仍要按 `CHANGELOG` → 版本号 → CI → Release 的顺序执行，Actions 成功不等于 Release 已更新。

### 已具备的主要能力

- TXT、MD、DOCX、文字 PDF 与目录批量导入、编码处理和自然排序。
- 明确章名、连续编号、Markdown 层级、目录正文匹配、卷章节结构、本书标题示例与反例学习。
- 候选证据、人工校正、整书体检、转换后文本完整性核对与脱敏结构报告。
- 导入阶段原文点选标题/正文断点、目录预览、搜索、取消及最近 20 步撤销。
- 工作台光标拆章、多断点批量拆章、篇幅/场景线索建议、编号顺延、合并、撤销与操作前备份。
- **一键智能分章**：站点杂讯过滤、规律标题识别、整篇重分章、碎章合并、长章断点建议、旧断点迁移。
- **可选大模型分章**：13 种服务商预设，模型只返回标题行号，正文由离线引擎还原。
- 多作品草稿、自动保存、回收站、草稿备份迁移；独立本地阅读副本。
- 字体与字号、手机翻页/滑动、章节首尾导航、书签备注、全文搜索、阅读历史与备份。
- 安卓私有文件存储、SAF 选择/另存为、离线 APK；网页/PWA 离线缓存。
- **纸墨 / 版画两种界面风格**，页脚一键切换，与夜间模式兼容。

## 3. 最近实现：不要重复

| 版本 | 功能 | 主要位置 |
| --- | --- | --- |
| 2.3.1 | 目录定位、断点持久化、断点高亮与取消 | `main.js`（`restoreStudioToc`）、`batch-chapter-ui.js`、`chapter-breakpoint-view.js`、`chapter-edit-ui.js`、`chapter-edit.js` |
| 2.4.0 | 站点杂讯过滤 | [`src/forum-noise.js`](../src/forum-noise.js) |
| 2.4.0 | 规律标题识别 | [`src/forum-headings.js`](../src/forum-headings.js) |
| 2.4.0 | 一键分章编排、断点迁移、备份 | [`src/smart-split.js`](../src/smart-split.js)、[`src/smart-split-ui.js`](../src/smart-split-ui.js) |
| 2.4.0 | 大模型接口 | [`src/llm-providers.js`](../src/llm-providers.js)、[`src/llm-client.js`](../src/llm-client.js)、[`src/llm-chapter-service.js`](../src/llm-chapter-service.js)、[`src/llm-settings.js`](../src/llm-settings.js) |
| 2.4.0 | 版画风格与切换 | [`src/theme.js`](../src/theme.js)、[`src/woodcut.css`](../src/woodcut.css) |

### 不要破坏的语义

1. `pendingBreakpoints` 是**各章正文的 0 起始 UTF-16 偏移数组**，不是行号或字节。上限 999 个，排序去重并拒绝代理对内部断点。
2. 修改正文会清除当前章旧断点；拆分/合并消费受影响章节的断点；其他章节保留，操作前备份仍保存原方案。
3. 草稿备份保留编辑断点；公开作品 JSON 和本地阅读副本移除它们。
4. 高亮底色覆盖**包含断点的换行段落，含其自动折行部分**，竖线标明精确偏移；镜像层 `aria-hidden`，真正输入仍由 textarea 处理；不得把未转义手稿插入 HTML。
5. `smartSplit` 只提出标题行；真正的切分与覆盖核对始终交给 `analyseChapters`。`integrity.ok === false` 时界面禁用“应用”。
6. 杂讯规则分强证据（楼层控件、翻页条、日期、客户端签名）与关键词规则；关键词规则只在整行较短且不像叙事句时删除，可疑行保留给作者核对。不要为了“更干净”放宽到删除长句。
7. 规律标题需同形重复、中位间隔 ≥300 字、编号大多递增、标题互不相同；纯数字与【标题】证据最弱，标记为“需核对”。
8. 大模型只收到清洗后的正文片段，返回的 `line` 必须落在本段范围内；越界、重复、空标题丢弃，解析失败重试一次。模型绝不返回正文。
9. 大模型密钥与配置分开存储（`wenxu-llm-config` / `wenxu-llm-key` / 会话级 `wenxu-llm-key-session`），不属于草稿、备份、公开作品或导出文件。
10. `applySmartSplit` 用 `rebaseBreakpoints` 迁移断点：落在新章节边界或代理对内部的断点丢弃；任何情况下都先生成独立 `draftKey` 的备份。
11. 风格只通过 `html[data-theme="woodcut"]` 覆盖变量，默认 `:root` 与 `.night` 不受影响；不要引入图片或外部字体。

## 4. 还要做什么：建议按此顺序

### P0：真机专项验收（尚无设备证据）

清单与判定标准见 [chapter-breakpoint-acceptance.md](chapter-breakpoint-acceptance.md)：390 px 窄屏、键盘、输入法、Emoji、长行折行、同行多断点、取消后切章/刷新/备份恢复、重排/删除/拆分/合并共存、覆盖安装升级。**本机没有 Android SDK，设备验证依赖 CI 或用户真机。**

### P1：大模型与抓取文本的真实环境验证

- 用作者自己的密钥在 2–3 个服务商上跑一遍真实接口，记录模型、耗时、失败原因；CI 只用假 `fetch`，没有联网证据。
- 抓取文本的识别准确率尚无评测集。构造合成的贴吧式文本（含楼层、广告、不同标题风格），统计“正确分界 / 误切 / 漏切”，不要用私人手稿。
- 观察超长文（>12 万字符）的分段请求成本与取消行为。

### P1：正文编辑后断点自动迁移

当前修改正文会清除该章断点。若要迁移，需要先定义插入/删除跨断点时的规则与可恢复性，不能简单保留旧偏移。

### P2：维护文档和工程可维护性

- 有针对性地拆分 `main.js` 的工作台渲染与状态逻辑。
- 明确仓库自身代码许可证。当前仍未见根 LICENSE；许可证选择由项目所有者决定，不能因仓库公开就宣称可任意再分发。
- 检查 Actions 旧运行时提示与 runner 升级影响；依赖升级单独提交。
- 抓取文本规则是按常见站点写的启发式，遇到新站点格式时优先补合成样例与测试，不要直接放宽为“遇到短行就切”。

### P3：可选产品路线（尚未整体授权）

| 顺序建议 | 方向 | 与现有功能的区别 |
| --- | --- | --- |
| 1 | 分章校对工作区 | 现有导入已能原文点选；进一步做双向目录联动、拖动分界与统一待校对队列 |
| 2 | 方案对比 | 比较自动、示例辅助、人工、大模型方案的差异，支持回到某一方案 |
| 3 | 内容差异核对界面 | 现有已有完整性统计；进一步逐段展示正文/归档去向并允许定位恢复 |
| 4 | 作品版本历史 | 现有有操作前备份与一次撤销；缺少版本时间线、差异比较、单章恢复 |
| 5 | EPUB 导出 | 当前主要交换 JSON；增加带封面、卷章目录的标准电子书导出 |

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
npm run benchmark:editor
npm run dev -- --port 5180
```

开发地址为 `http://127.0.0.1:5180/wenxu-fiction/#/studio`，以终端实际端口为准。不同端口/域名的本机数据隔离，别将环境变化误判为草稿丢失。测试用独立草稿，不覆盖用户正在写的作品。

原生前端同步与设备回归：

```powershell
npm run build:native
Set-Location android
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:connectedDebugAndroidTest
```

每次前端变更后先 `build:native`；Gradle 任务使用 `:app:`。CI 包括 `package`、`offline-device-test` 两个作业，产物不自动创建 Release。

结构规则有变化时再执行 `npm run benchmark`。当前 22 份合成样例：18 份自动样例 17 份边界完全匹配，边界 F1 为 0.96；另外 4 份作者示例辅助样例单独统计。评测不代表任意真实文档、Word/PDF 转换或移动端性能。

### Git 与发布注意

- 提交使用用户身份，不添加助手署名或 Co-authored-by：

```powershell
git -c user.name=NagasakiSaki -c user.email=196273039+NagasakiSaki@users.noreply.github.com commit -m "具体变更说明"
```

- 正式签名使用已配置的 Actions Secrets，沿用原证书；不要生成替代密钥发布覆盖更新。`.private/`、`.artifacts/`、构建目录被忽略，前者含本机签名材料。
- Release 的 `--target` 使用完整提交 SHA（短 SHA 会返回 422）；APK 资产名保持 `wenxu-android.apk`，应用入口依赖稳定文件名。
- 网页 `base=/wenxu-fiction/`，原生相对路径；更改部署位置需同时改 PWA 清单与离线回退路径。
- 对普通小变更执行相关回归和构建即可；纯文档变更不需要重发 APK。

## 6. 本机验证证据与阅读顺序

以下文件在忽略目录 `.artifacts/` 中，**没有随仓库发布**，换机器可能不存在：

- `studio-woodcut.png`、`home-woodcut.png`、`reader-woodcut.png`：版画风格的工作台、首页与阅读页。
- `smart-split-preview.png`、`smart-split-applied.png`、`smart-split-backup.png`：一键分章的预览、应用结果与草稿箱备份。
- `llm-settings.png`：大模型设置面板。
- `editor-benchmark.json`：2,000,000 字符 / 999 断点约 9.6 ms，30 万字符抓取文本分章约 56 ms（Node 纯字符串）。
- 旧验收截图：`studio-toc-position.png`、`pending-breakpoints-restored.png`、`breakpoint-highlights.png`。

2026-10-18 还用无头 Chrome 实际走通了“打开一键分章 → 粘贴文本 → 分析 → 应用 → 草稿箱出现备份”的链路，控制台无异常；这是桌面浏览器证据，不是手机证据。

推荐接手阅读顺序：本文 → `git status` 与最新 CI → `developer-guide.md` → `tests/smart-split.test.js` → `smart-split.js` → 断点模块。继续算法研发时再读结构引擎说明与公开评测。

可直接给下一个模型的启动指令：

> 请先阅读 `C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction\docs\HANDOFF.md` 和开发者指南，核对代码及发布状态。不要重复实现已完成的一键分章、规律标题识别、大模型连接器、断点高亮与版画风格。简述当前状态和建议优先任务，再按我的新指令继续；保留本地离线与草稿兼容性，不公开私人手稿，不署助手名，引用保留在 REFERENCES.md。
