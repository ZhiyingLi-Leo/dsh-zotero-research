# Zotero Research

**在 DeepSeek Harness 里读懂 Zotero 文献，把理解留在原文旁边。**

[English](README.en.md) · [安装与升级](docs/GETTING_STARTED.md) · [反馈问题](https://github.com/ZhiyingLi-Leo/dsh-zotero-research/issues) · [开发文档](CONTRIBUTING.md)

读完一篇论文，往往还需要核对结论、追问方法、对比其他工作，再把有用的内容整理成自己的笔记。Zotero Research 把这些步骤连起来：**论文 → 分层阅读 → 原文证据 → 对话追问 → 笔记与研究问题**。

包名：`dsh-zotero-research`。Zotero 负责文献与原生 PDF 阅读，Harness 承载分析和对话。

![真实论文的阅读覆盖、综合结论与待核实问题](docs/images/reading-real.jpg)

*真实阅读画面：同一篇论文的分批结果被合并，已读范围、证据数量和仍需核实的问题同时保留。*

## 从读完，到读懂

| 你要做的事 | 插件提供的支持 |
|---|---|
| 判断哪些论文值得读 | 搜索、主题整理、阅读队列与优先级，快速筛选研究问题和主要贡献 |
| 把论文的方法和结论读透 | 粗读、精读、分批续读与综合；整理方法、公式、图表条件、局限和复现信息 |
| 确认回答有没有依据 | 查看引用的 PDF 片段与页码，区分原文和 AI 解释，随时打开 Zotero 核对 |
| 带着问题继续推理 | 将论文、小节、证据或标注带入正式 Harness 对话，多篇文献做对比与关系分析 |
| 留下能继续使用的积累 | 将成果写回 Zotero 笔记，或归入研究问题，记录材料立场、当前理解与下一步 |

## 每个结论，都能回到原文

点击证据即可并排查看 PDF 片段、文字摘录与解释。这里只提供核对所需的轻量预览；需要完整阅读、原生高亮或批注时，直接打开 Zotero。

![真实 PDF 第 11 页的引文、截图和解释](docs/images/evidence-real.jpg)

## 让追问接上刚才读到的内容

例如：**“文中的 IoU 结果，能否直接迁移到另一种软体机器人？”**

选择要带入的文献、原文和解释，检查材料后发到新建或已有对话。讨论结果可以编辑后保存回文献，研究问题也能持续关联证据和对话。

![把真实论文与原文片段带入 Harness 对话](docs/images/conversation-real.jpg)

*截图使用一篇已发表论文的实际阅读结果；对话画面展示发送前的材料确认。*

## 安装

需要 **DeepSeek Harness `>=0.2.1-rc.5 <0.3.0`**，以及开启本地 API 的 Zotero Desktop。

当前可下载[预构建安装包](packages/dsh-zotero-research-1.0.0-beta.3.tgz)，安装到你实际使用的 Harness profile：

```sh
dsh plugin --profile <profile> add /path/to/dsh-zotero-research-1.0.0-beta.3.tgz
```

重开 Harness 后，在侧边栏打开 **Zotero → 设置**，检查连接、模型和写入授权，再选择论文开始阅读。

npm 分发正在准备；发布后将使用 `dsh plugin --profile <profile> add dsh-zotero-research@beta` 安装。完整安装、旧包升级和卸载说明见[快速开始](docs/GETTING_STARTED.md)。

## 平台与数据

- **macOS、Windows、Linux** 共用 PDF.js 文字提取、页数与引文定位能力。
- **PDF 图像预览**由可选的 macOS 13+ arm64 PDFKit helper 提供；其他环境使用文字证据并跳转 Zotero。
- 笔记、标注与集合写回需要 Zotero 授权。插件数据保存在本机，可导出 Markdown 与 JSON 备份；没有文库云同步。
- 模型调用会发送本次操作需要的材料，可能产生服务商费用。插件不在后台上传整个文库，也不发送 Zotero 授权密钥或 PDF 文件本身。

[数据与隐私](docs/GETTING_STARTED.md#数据与隐私) · [自动检查与桌面验收](docs/ACCEPTANCE.md) · [安全反馈](SECURITY.md)

## 参与改进

欢迎通过 [Issues](https://github.com/ZhiyingLi-Leo/dsh-zotero-research/issues) 提交复现步骤、使用建议或文献工作流需求。开发与构建见 [CONTRIBUTING.md](CONTRIBUTING.md)。

MIT License · [LICENSE](LICENSE)
