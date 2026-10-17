# 参考项目与依赖说明

维护者：NagasakiSaki。

## 设计参考

- [Readest](https://github.com/readest/readest) 及其[阅读说明](https://www.readest.com/docs/reading)：参考书签、备注、全书搜索和阅读位置恢复的功能设计；本仓库独立实现浏览器本地存储与定位逻辑，未复制其源码。

- [raikyou/novel-parser](https://github.com/raikyou/novel-parser)：参考中英文章节识别、TXT 编码兼容、书名前置资料和序言处理的设计。
- [rockbenben/novel-processor](https://github.com/rockbenben/novel-processor)：参考章节规范化与排序的功能设计。

本站的章节规则、整篇结构分析、文件夹排序、批量预览、限额处理和草稿存储由本仓库独立实现，没有复制上述项目的源代码，也没有把其后端作为运行依赖。对参考功能的说明不代表使用了其全部功能。

- 1930 年代中国木刻版画（含鲁迅编印的木刻选集）与同时期书刊封面：仅参考黑白套色、粗刻线、印章式落款和方角排版的视觉语言。界面为原创 CSS，未复制任何具体作品或版画图像。

## 可选大模型接口（默认关闭）

大模型分章是可选连接器，只有用户自行配置并勾选后才会调用。本仓库用浏览器 `fetch` 直接请求下列服务的公开 HTTP 接口，未引入任何模型 SDK，也未复制其示例代码；接口字段以各家文档为准，发生变化时以文档为准更新适配。

- [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat)
- [DeepSeek API](https://api-docs.deepseek.com/)
- [Moonshot / Kimi API](https://platform.moonshot.cn/docs)
- [阿里云百炼 OpenAI 兼容模式](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)
- [智谱 GLM API](https://open.bigmodel.cn/dev/api)
- [SiliconFlow](https://docs.siliconflow.cn/)、[OpenRouter](https://openrouter.ai/docs)、[Groq](https://console.groq.com/docs)
- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [Google Gemini generateContent](https://ai.google.dev/api/generate-content)
- [Ollama](https://github.com/ollama/ollama/blob/main/docs/openai.md)、[LM Studio 本地服务](https://lmstudio.ai/docs/app/api)：本机地址，无需密钥。

密钥由用户自备，只保存在其本机浏览器；服务商的条款、计费与数据处理政策由用户与该服务商约定，本站没有账号系统或云端草稿。

## 直接使用的开源依赖

- [Capacitor](https://github.com/ionic-team/capacitor)：原生安卓容器与桥接；[App](https://github.com/ionic-team/capacitor-plugins/tree/main/app)、[Filesystem](https://github.com/ionic-team/capacitor-filesystem) 用于生命周期与私有文件存储。不是把在线地址作为应用页面。
- [AndroidX DocumentFile](https://developer.android.com/reference/androidx/documentfile/provider/DocumentFile)：安卓系统文件夹递归读取。SAF文件选择/另存为桥接由本仓库实现，参考 [Android 官方存储说明](https://developer.android.com/training/data-storage/shared/documents-files) 与 [Capacitor 插件文档](https://capacitorjs.com/docs/plugins/tutorial/android-implementation)。
- [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa)、[Workbox](https://github.com/GoogleChrome/workbox)：可安装桌面Web应用与更新确认式离线缓存；参考 [PWA预缓存说明](https://vite-pwa-org.netlify.app/guide/service-worker-precache)。

- [Mammoth.js](https://github.com/mwilliamson/mammoth.js)：DOCX 转 HTML，保留段落、标题样式及粗体等语义。
- [Turndown](https://github.com/mixmark-io/turndown) 与 [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm)：HTML 转 Markdown 和表格处理。
- [DOMPurify](https://github.com/cure53/DOMPurify)：浏览器端 HTML 清理。
- [PDF.js](https://github.com/mozilla/pdf.js)：文字型 PDF 提取。
- [Vite](https://github.com/vitejs/vite)：本地开发和构建。
- [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB)：仅用于草稿存储自动化测试，不参与生产包。
- 无头浏览器冒烟测试使用本机 Chrome 与 [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)，由 `scripts/smoke-ui.mjs` 通过 Node 内置 `WebSocket` 直接驱动；**未引入 Playwright、Puppeteer 或 Selenium**。CI 使用 GitHub Actions 运行器预装的 Google Chrome。

以上依赖保留各自许可证及版权说明。PDF.js、Mammoth、Turndown、GFM 插件与 DOMPurify 的许可证随构建产物一起提供于 `pdfjs/licenses/`。其他完整声明见 npm 包目录。参考设计与使用库分别列出，避免将依赖或他人工作误写为本站原创。

Capacitor各运行依赖和Workbox窗口库的许可证随构建产物提供于 `third-party/`。AndroidX等原生依赖保留其包内声明。CI使用 [android-emulator-runner](https://github.com/ReactiveCircus/android-emulator-runner) 和 [Gradle Actions](https://github.com/gradle/actions) 进行构建及模拟器验证，未作为应用运行时服务。
