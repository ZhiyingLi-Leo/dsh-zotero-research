# 快速开始 / Getting started

[English](#english)

## 安装与连接

1. 安装 DeepSeek Harness `>=0.2.1-rc.5 <0.3.0`，启动 Zotero Desktop，开启 Zotero 本地 API。
2. 下载仓库 `packages/` 中的 tgz。使用实际 profile 安装，然后正常退出并重开 Harness：

   ```sh
   dsh plugin --profile <profile> add /absolute/path/dsh-zotero-research-1.0.0-beta.3.tgz
   ```

   Windows 可以使用带引号的路径：

   ```powershell
   dsh plugin --profile <profile> add "C:\Downloads\dsh-zotero-research-1.0.0-beta.3.tgz"
   ```

3. 打开 Zotero → 设置，检查本地 API、模型、PDF 能力。阅读可以只读使用；保存笔记、标注或主题整理结果时再授权写入。
4. 选择论文进行快速筛选、粗读或精读；查看实际阅读页范围，再决定是否续读。引用卡片可预览原文、打开 Zotero 或带原文提问。

普通 `npm install` 不会激活 Harness 插件；web 与 desktop 各有自己的 profile。npm 发布后使用 `dsh plugin --profile <profile> add dsh-zotero-research@beta`。

## 从旧包升级

先导出插件数据备份并退出 Harness，再移除旧包、添加新包：

```sh
dsh plugin --profile <profile> remove dsh-zotero
dsh plugin --profile <profile> add /absolute/path/dsh-zotero-research-1.0.0-beta.3.tgz
```

若 `cordis.patch.yml` 有手写旧插件层，只把该层的 `id/name` 换为 `dsh-zotero-research`，保留其他配置。新旧插件不要同时启用。重开 Harness；不要删除 `storages/zotero-plugin`。

旧存储路径、备份格式、笔记来源标签和偏好 key 保留兼容，不会因为包名改变丢弃旧记录。

## 卸载

```sh
dsh plugin --profile <profile> remove dsh-zotero-research
```

正常重启 Harness。卸载包不等于删除插件数据。

## 数据与隐私

插件数据 JSON 备份包含组合分析、研究问题、问答和阅读队列，不含授权密钥、设置、缓存、PDF、正式会话正文或临时对比/关系结果。恢复会先展示冲突，再合并缺失记录与未见问答，不覆盖已有记录。

只在用户发起分析、综合、对比、关系分析或提问时，向所选模型发送该操作需要的元数据、摘要、页正文、关注点和必要历史。用户选择带入的笔记、标注、证据或综合内容也会发送。正式会话只带入确认的材料。服务商的保存策略与费用由相应服务商决定。

PDFKit 图像预览限 macOS 13+ arm64。其他平台使用文字证据和 Zotero。扫描 PDF 没有文字层时不能进行 OCR；图表预览依赖页面区域，不是图表自动检测。

<a id="english"></a>

# Getting started

## Install and connect

1. Use DeepSeek Harness `>=0.2.1-rc.5 <0.3.0`. Start Zotero Desktop and enable its local API.
2. Download the tgz under `packages/`, install it into the profile you use, and restart Harness:

   ```sh
   dsh plugin --profile <profile> add /absolute/path/dsh-zotero-research-1.0.0-beta.3.tgz
   ```

   Quote paths on Windows, for example `"C:\Downloads\dsh-zotero-research-1.0.0-beta.3.tgz"`.
3. Open Zotero → Settings to check the local API, model, and PDF capabilities. Reading can remain read-only; authorize writes when saving notes, annotations, or organization results.
4. Pick a paper, check the actual page coverage, and continue reading when useful. Evidence cards open the source excerpt, Zotero, or a conversation with the selected material.

A plain `npm install` does not activate a Harness plugin. Web and desktop use separate profiles. After npm publication, use `dsh plugin --profile <profile> add dsh-zotero-research@beta`.

## Upgrade from the old package

Export a plugin-data backup and quit Harness, then remove `dsh-zotero` and install the new tgz. If your `cordis.patch.yml` has a hand-written old plugin layer, update only that layer's id/name. Do not enable both packages. Keep `storages/zotero-plugin`; storage, backup format, provenance tags, and preference keys retain compatibility.

## Remove

```sh
dsh plugin --profile <profile> remove dsh-zotero-research
```

Restart Harness. Removing the package does not delete its stored records.

## Data and privacy

JSON backups include combined analyses, research questions, Q&A, and the queue. They exclude auth keys, settings, cache, PDFs, formal conversation bodies, and temporary comparison/relationship results. Restore previews conflicts and adds missing records or unseen turns without overwriting existing records.

Model calls send metadata, abstract, selected page text, focus, and necessary history for the requested operation. Notes, annotations, evidence, and synthesis are sent when selected. Formal conversations receive the materials confirmed in the launcher. Provider retention and charges follow the provider's policies.

Image preview uses macOS 13+ arm64 PDFKit. Other platforms retain text evidence and Zotero opening. There is no OCR for image-only scans or automatic chart detection.
