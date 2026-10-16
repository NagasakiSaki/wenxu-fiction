# 文序 · 小说阅读与出版

独立公开阅读平台，无读者账号。作品以 JSON 存储在 `content/books/`，由仓库维护者提交，通过 GitHub Actions 校验并部署 GitHub Pages。所有公开文件及提交历史均可被访问，请勿上传私人草稿。

## 使用

Node.js 24。运行 `npm ci`、`npm run dev`；构建 `npm run build`；测试 `npm test`。首次部署需在仓库 Settings → Pages 将 Source 设为 GitHub Actions。

作者工作台支持 DOCX、TXT、Markdown 和文字型 PDF（10 MB、20 万字符，PDF 最多100页），按中文章节、英文 Chapter、Markdown 标题分章。扫描件需先 OCR；Word 图片不会导入。请核对章节识别结果。章节正文当前按纯文本呈现，Markdown 标记会原样显示。

导入后编辑资料、章节标题和正文，可以新增、删除、调整顺序和预览。草稿每15秒及切换页面时保存在当前浏览器。重要内容应导出 JSON 备份，本地存储不是云端备份。

发布：点击「导出并发布」，下载 JSON，再由 NagasakiSaki 登录 GitHub 上传至 `content/books` 并 Commit changes 到 main。Actions 成功后网站自动更新。更新同一作品必须保留原编号和文件名，可从仓库下载其 JSON 后在工作台「恢复作品文件」。删除作品需删除对应 JSON 并提交；旧提交仍留有历史。

书架、进度、阅读字号、夜间模式保存在读者浏览器。普通读者无需登录。当前没有多作者账号、付费、评论或跨设备同步；非作者不能通过前端直接修改线上作品。

默认包含一篇明确标识的原创体验短篇。正式作品准备好后可以删除该示例。前端没有密钥或访问令牌；发布权限依赖 GitHub 仓库访问控制。上传者编辑章节时所有文字都经过 HTML 转义，避免执行文档脚本。
