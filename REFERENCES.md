# 参考项目与依赖说明

维护者：NagasakiSaki。

## 设计参考

- [Readest](https://github.com/readest/readest) 及其[阅读说明](https://www.readest.com/docs/reading)：参考书签、备注、全书搜索和阅读位置恢复的功能设计；本仓库独立实现浏览器本地存储与定位逻辑，未复制其源码。

- [raikyou/novel-parser](https://github.com/raikyou/novel-parser)：参考中英文章节识别、TXT 编码兼容、书名前置资料和序言处理的设计。
- [rockbenben/novel-processor](https://github.com/rockbenben/novel-processor)：参考章节规范化与排序的功能设计。

本站的章节规则、整篇结构分析、文件夹排序、批量预览、限额处理和草稿存储由本仓库独立实现，没有复制上述项目的源代码，也没有把其后端作为运行依赖。对参考功能的说明不代表使用了其全部功能。

## 直接使用的开源依赖

- [Mammoth.js](https://github.com/mwilliamson/mammoth.js)：DOCX 转 HTML，保留段落、标题样式及粗体等语义。
- [Turndown](https://github.com/mixmark-io/turndown) 与 [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm)：HTML 转 Markdown 和表格处理。
- [DOMPurify](https://github.com/cure53/DOMPurify)：浏览器端 HTML 清理。
- [PDF.js](https://github.com/mozilla/pdf.js)：文字型 PDF 提取。
- [Vite](https://github.com/vitejs/vite)：本地开发和构建。
- [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB)：仅用于草稿存储自动化测试，不参与生产包。

以上依赖保留各自许可证及版权说明。PDF.js、Mammoth、Turndown、GFM 插件与 DOMPurify 的许可证随构建产物一起提供于 `pdfjs/licenses/`。其他完整声明见 npm 包目录。参考设计与使用库分别列出，避免将依赖或他人工作误写为本站原创。
