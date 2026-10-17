# 文序项目交接

核对日期：**2026-10-18（Asia/Shanghai）**。本文交接时的代码基线为 `419ed3ab513fa3b3412efdba99108f75b14498b7`；本文自身的文档提交会在该基线之后。开始工作前请重新检查 Git 与 Actions，不要把此处状态视为实时信息。

## 给接手模型的入口

项目真实目录是 **`C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction`**，不是聊天环境默认的 `New project`。Windows / PowerShell，分支 `main`。

- 仓库：[NagasakiSaki/wenxu-fiction](https://github.com/NagasakiSaki/wenxu-fiction)
- 在线工作台：[作者工作台](https://nagasakisaki.github.io/wenxu-fiction/#/studio)
- 开发总指南：[developer-guide.md](developer-guide.md)
- 算法说明：[structure-engine.md](structure-engine.md)
- 本地应用：[local-apps.md](local-apps.md)
- 更新记录：[CHANGELOG.md](../CHANGELOG.md)
- 引用与依赖：[REFERENCES.md](../REFERENCES.md)

本次用户要求是**列出剩余工作并写交接文档**，没有要求在交接过程中实施整条产品路线。接手后依据用户的新指令执行；下文“可选路线”不是已经承诺或已经实现的功能。

## 1. 用户目标与协作要求

用户希望将项目发展为功能完善的小说创作与阅读产品，以可解释、可人工校正的自动分章为技术特色。支持网页公开阅读、安卓本地离线书架、草稿文件互通；Windows 当前使用 PWA。

用户已明确暂不做账号系统。不要擅自改回必须登录、必须联网或必须云数据库的架构。当前通过文件传递草稿，没有云端自动同步。

用户要求以 **NagasakiSaki 的项目**发布，不署助手名字；借鉴项目与依赖需要如实注明。已有持续的 GitHub 推送与上线授权。不要上传私人作品、调试截图、密钥或本机产物；用户提供的手稿用于本地验证，不等于同意公开手稿。

## 2. 当前完成度与发布差异

| 项目 | 交接时状态 |
| --- | --- |
| 网页 | 已部署到 `419ed3a`，包含最近全部工作台修复 |
| `package.json` | `2.3.0` |
| 结构引擎 | `3.1.0`，定义在 `src/import-review-model.js` |
| 正式 GitHub Release | [v2.3.0](https://github.com/NagasakiSaki/wenxu-fiction/releases/tag/v2.3.0)，对应 `a6a55cf20c27edb9a474eafa3a9d26a2f5bf9a5e` |
| 正式 APK | Release 中的 `wenxu-android.apk`，**尚未包含 v2.3.0 之后的三次工作台修复** |
| 最新安卓 CI | [38998163795](https://github.com/NagasakiSaki/wenxu-fiction/actions/runs/38998163795)，`package` 与 `offline-device-test` 均成功，对应 `419ed3a` |
| 最新代码部署 CI | [38998163770](https://github.com/NagasakiSaki/wenxu-fiction/actions/runs/38998163770)，成功 |
| Node 回归 | 交接当天重新运行，106 项全部通过 |
| 设备回归 | CI 中已有 3 项离线安卓测试；尚未新增专门覆盖最新断点高亮/取消的设备用例 |
| 工作区 | 写本文前无未提交修改；无遗留开发服务器需要接管 |

**Actions 构建成功不等于 GitHub Release 已更新。** 下载页仍会提供旧正式 APK，需要单独发布补丁版本。`CHANGELOG.md` 的“未发布”表示尚未打正式版本，部分内容其实已随网页部署生效。

### 已具备的主要能力

- TXT、MD、DOCX、文字 PDF 与目录批量导入、编码处理和自然排序。
- 明确章名、连续编号、Markdown 层级、目录正文匹配、卷章节结构、本书标题示例与反例学习。
- 候选证据、人工校正、整书体检、转换后文本完整性核对与脱敏结构报告。
- 导入阶段原文点选标题/正文断点、目录预览、搜索、取消及最近 20 步撤销。
- 工作台光标拆章、多断点批量拆章、篇幅/场景线索建议、编号顺延、合并、撤销与操作前备份。
- 多作品草稿、自动保存、回收站、草稿备份迁移；独立本地阅读副本。
- 字体与字号、手机翻页/滑动、章节首尾导航、书签备注、全文搜索、阅读历史与备份。
- 安卓私有文件存储、SAF 选择/另存为、离线 APK；网页/PWA 离线缓存。

## 3. 最近三次修复：不要重复实现

| 提交 | 用户问题 | 最终实现 |
| --- | --- | --- |
| `578cbb9` | 点击目录后回到目录开头 | `restoreStudioToc` 恢复列表 scrollTop，并让选中章节保持可见；只滚动目录容器 |
| `2453ec8` | 切换章节后断点消失 | 各章 `pendingBreakpoints` 随草稿持久化；切章、刷新、重排与草稿备份后保留 |
| `419ed3a` | 断点没有高亮、无法取消 | 正文行底色与精确位置竖线；断点列表定位/取消、清空本章、同位置再次点击取消 |

### 最新断点功能的代码位置

- [`src/batch-chapter-ui.js`](../src/batch-chapter-ui.js)：读取各章断点、标记/取消、列表、批量预览；通过 `onChange` 请求自动保存。
- [`src/chapter-breakpoint-view.js`](../src/chapter-breakpoint-view.js)：安全生成高亮 HTML、textarea 镜像、滚动/尺寸同步和跳转。
- [`src/chapter-edit-ui.js`](../src/chapter-edit-ui.js)：插入断点列表容器，传递保存回调。
- [`src/chapter-edit.css`](../src/chapter-edit.css)：镜像、底色、竖线、列表与手机样式。
- [`src/main.js`](../src/main.js)：工作台重渲染、目录恢复、`queueAutoSave` 接线、公开导出移除编辑字段。
- [`src/chapter-edit.js`](../src/chapter-edit.js)：拆分/合并时清除受影响章节的待拆断点。
- [`src/local-books-core.js`](../src/local-books-core.js)：阅读副本移除编辑断点。
- [`tests/pending-breakpoints.test.js`](../tests/pending-breakpoints.test.js)：切章重绑定、存储/备份/重排、拆分消费、取消与高亮转义回归。

### 不要破坏的语义

1. `pendingBreakpoints` 是**各章正文的 0 起始 UTF-16 偏移数组**，不是行号或字节。上限 999 个，排序去重并拒绝代理对内部断点。
2. 修改正文会清除当前章旧断点并提示用户，暂未实现“编辑后自动迁移断点”。重命名、章节移动不应清空断点。
3. 拆分/合并消费受影响章节的断点；其他章节保留，操作前备份仍保存原方案。
4. 草稿备份保留编辑断点；公开作品 JSON 和本地阅读副本移除它们。
5. 底色覆盖**包含断点的换行段落，含其自动折行部分**，竖线标明精确偏移；不是向原文插入标记字符。
6. 镜像层 `aria-hidden`、不接收指针，真正输入仍由 textarea 处理；不得把未转义手稿插入 HTML。
7. `ResizeObserver` 同步编辑器尺寸，`MutationObserver` 在编辑器脱离 DOM 后断开观察，避免重渲染积累观察器。

桌面浏览器已实测：标记、切章返回、保存刷新、定位、单独取消、清空、同位置切换取消及长段自动换行。两层滚动高度曾有约 1 px 舍入差异，未见桌面错位；不要据此宣称所有手机和输入法都通过。

## 4. 还要做什么：建议按此顺序

### P0：补齐正式安卓发行

**这是明确的发行差异，不是功能缺失。** 建议下一个正式补丁版本为 `2.3.1`，是否立即发布由接手时用户指令决定。

- [ ] 先完成下一节的最新高亮交互验收，发现问题先修复。
- [ ] 同步 npm 版本/锁文件、安卓 `versionName`/递增的 `versionCode`、本地应用展示版本及 CHANGELOG；当前安卓为 `2.3.0 / 20300`。
- [ ] 使用原应用 ID `io.github.nagasakisaki.wenxu`、原所有者签名，完成新提交的构建与设备测试。
- [ ] 创建补丁 Release，上传新 `wenxu-android.apk`、SHA-256、签名报告，按需附网页包；验证下载页能取到新包。
- [ ] 在保留本机草稿、阅读副本、断点、书签的情况下验证覆盖升级。不要用卸载重装代替升级验证。

验收：网页与正式下载 APK 拥有相同工作台行为，用户无需从 Actions 寻找测试产物。

### P1：最新高亮与取消的手机/安卓专项验收

这部分尚缺专项设备覆盖，当前不是已确认的新 bug。

- [ ] 390 px 左右窄屏、键盘弹出、竖屏/横屏、中文输入法与 Emoji。
- [ ] 长行折行、空行断点、同一行多断点、滚动到底再定位、调整文本框高度、系统字体缩放与夜间模式。
- [ ] 取消后切章、刷新/重启与备份恢复，确保断点数量、列表和底色一致。
- [ ] 重排、删除、拆分、合并、撤销与其他章节断点共存，不串章、不错误清空。
- [ ] 为关键链路增加安卓离线交互用例；用真实选择/触摸操作验证，不直接修改业务状态冒充用户操作。

验收：输入正文保持逐字不变，光标与高亮对齐，取消结果持久化，无观察器错误或重复交互。

### P1：长篇编辑性能评估

高亮现在按需生成整章的镜像 HTML；只对有断点的段落创建标记节点，没有逐行创建 DOM，但仍需要处理整章字符串。**尚无新高亮模块在接近容量上限时的手机性能基准。**

- [ ] 合成测试 10 万字符长行、接近 200 万字符的正文、多处/接近 999 个断点、频繁切章与窗口缩放。
- [ ] 记录首个标记耗时、交互延迟、滚动对齐、内存及保存耗时，区分格式转换、结构分析与编辑渲染。
- [ ] 根据实测决定是否改为视口附近镜像、增量更新或节流；不要未经测量就引入大型编辑器依赖。

验收：无正文截断、错误偏移或明显冻结，并公开说明测试设备与范围。历史结构引擎长篇耗时不能当作高亮渲染性能。

### P2：维护文档和工程可维护性

- [ ] 在开发指南的模块表中补入 `chapter-breakpoint-view.js`，同步最近交互说明与正式版本状态。
- [ ] 有针对性地拆分 `main.js` 的工作台渲染与状态逻辑，避免为小修复重构整个产品。
- [ ] 逐步把新模块的超长压缩行整理为可读代码；保持改动可审查，不夹带无关格式化。
- [ ] 检查 Actions 的旧运行时提示与 runner 升级影响，另做依赖升级变更。现有 CI 已通过，提示不代表构建失败。
- [ ] 明确仓库自身的代码许可证。当前未见根 LICENSE，不应仅因仓库公开就宣称任意开源再分发许可；许可证选择需由项目所有者决定。

## 5. 可选产品路线：尚未整体授权实施

此前给用户提出过下列方向，用户随后优先要求修复实际使用问题。不要把这些点子全部视为待交付承诺。

| 顺序建议 | 方向 | 与现有功能的区别 |
| --- | --- | --- |
| 1 | 分章校对工作区 | 现有导入已能原文点选；进一步做双向目录联动、拖动分界与统一待校对队列 |
| 2 | 方案对比 | 比较自动、示例辅助、人工方案的差异，支持回到某一方案；不是现有单次撤销 |
| 3 | 内容差异核对界面 | 现有已有完整性统计；进一步逐段展示正文/归档去向并允许定位恢复 |
| 4 | 主动请求作者确认 | 从争议候选挑最有区分价值的示例，展示一次确认影响哪些分界，支持撤回；仍可本地规则实现 |
| 5 | 作品版本历史 | 现有有操作前备份与一次撤销；缺少版本时间线、差异比较、单章恢复 |
| 6 | EPUB 导出 | 当前主要交换 JSON；增加带封面、卷章目录的标准电子书导出 |

“编辑正文后让断点自动跟随”也可作为后续体验方向，但要先确定插入/删除跨断点时的规则与可恢复性，不能简单保留旧偏移。

## 6. 环境、验证和发布命令

Node.js 24、npm；安卓 CI 使用 JDK 21、SDK 36。当前本机曾未配置 Android SDK，接手时重新检查，不要假定能在本机完整构建 APK。

```powershell
Set-Location 'C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction'
git status --short
git log -5 --oneline
npm ci
npm test
node scripts/validate-books.mjs
npm run build
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

每次前端变更后先 `build:native`；Gradle 任务使用 `:app:`，避免误跑传递库设备测试。CI 包括 `package`、`offline-device-test` 两个作业。CI 产物不自动创建正式 Release。

结构规则有变化时再执行 `npm run benchmark`。当前 22 份合成样例：18 份自动样例 17 份边界完全匹配，边界 F1 为 0.96；另外 4 份作者示例辅助样例单独统计。评测不代表任意真实文档、Word/PDF 转换或移动端性能。

### Git 与发布注意

- 提交使用用户身份，不添加助手署名或 Co-authored-by：

```powershell
git -c user.name=NagasakiSaki -c user.email=196273039+NagasakiSaki@users.noreply.github.com commit -m "具体变更说明"
```

- 当前 gh 已可访问该仓库；不要输出 token。正式签名使用已配置的 Actions Secrets，沿用原证书；不要生成替代密钥发布覆盖更新。
- `.private/`、`.artifacts/`、构建目录被忽略，前者含本机签名材料。不要列印内容或添加到 Git。
- Release 的 `--target` 使用完整提交 SHA；APK 资产名保持 `wenxu-android.apk`，应用入口依赖稳定文件名。
- 网页 `base=/wenxu-fiction/`，原生相对路径；更改部署位置需同时改 PWA 清单与离线回退路径。
- 对普通小变更执行相关回归和构建即可，纯交接文档不需要重发 APK。

## 7. 本机验证证据与阅读顺序

以下文件是忽略目录中的本机截图，**没有随仓库发布**，换机器可能不存在：

- `.artifacts/studio-toc-position.png`：后部章节目录定位。
- `.artifacts/pending-breakpoints-restored.png`：刷新后断点恢复。
- `.artifacts/breakpoint-highlights.png`：高亮与取消入口。

推荐接手阅读顺序：本文 → `git status` 与最新 CI → `developer-guide.md` → `pending-breakpoints.test.js` → 最新断点模块。继续算法研发时再读结构引擎说明与公开评测。

可直接给下一个模型的启动指令：

> 请先阅读 `C:\Users\lenovo\Documents\ChatGPT\wenxu-fiction\docs\HANDOFF.md` 和开发者指南，核对代码及发布状态。不要重复实现已完成的目录定位、断点持久化、高亮与取消。简述当前状态和建议优先任务，再按我的新指令继续；保留本地离线与草稿兼容性，不公开私人手稿，不署助手名，引用保留在 REFERENCES.md。
