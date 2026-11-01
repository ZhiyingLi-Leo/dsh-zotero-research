# dsh-zotero-research

DeepSeek Harness Zotero 科研阅读工作台。私有仓库，尚未公开发布。

当前内部 npm 包名仍为 `dsh-zotero`，版本 `1.0.0-beta.2`。仓库名称与包名独立；安装兼容性保持不变。macOS 已实测，Windows/Linux 已适配但未实测。

本地安装包见 `packages/dsh-zotero-1.0.0-beta.2.tgz`；用 `dsh plugin --profile <profile> add /absolute/path/to/package.tgz` 安装并重启 Harness。没有发布 npm、GitHub Release 或插件市场收录。

# dsh-zotero

Zotero research reading workbench for DeepSeek Harness. It is a DSH plugin, **not** a Zotero XPI: Zotero keeps full PDF reading and native annotation management; the plugin adds layered reading, evidence checks, conversations, research questions and write-back.

Version: **1.0.0-beta.2** (public beta). macOS is the only platform with real UI acceptance so far; Windows/Linux are adapted but not hardware-tested.

## Features

- Layered reading (quick / rough / deep) with page coverage, missing ranges and explicit "partial text" labels.
- Evidence preview: cropped page image, quote location labels, Zotero jump; if the PDF helper is unavailable, evidence falls back to text.
- Unified synthesis over all read batches, with conflicts, uncertainties and citation-backed evidence.
- Compare (max 6 papers) and relations (max 8), each showing the actual pages read per paper.
- In-panel Q&A with per-paper/focus history, plus one-click hand-off into a real DSH conversation carrying selected material.
- Research questions workspace: materials with support/oppose/limit/unverified stances, understanding, open questions, next actions and evolution log.
- Write-back to Zotero notes/annotations/collections with read-back verification and conflict protection.
- Markdown export of a paper (synthesis, evidence table, notes/annotations with provenance, raw batches) and of research questions.
- Backup/restore of plugin data (research questions, analyses+synthesis, Q&A, queue); excludes keys, settings and cache.

## Requirements

| Component | Tested |
|---|---|
| macOS | 26.6.2 arm64: real UI tested; Intel not tested |
| Windows | adapted (PDF.js text, rundll32 Zotero open); **not hardware-tested** |
| Linux | adapted (PDF.js text, xdg-open); **not hardware-tested** |
| DeepSeek Harness | 0.2.1-rc.5 (desktop, Info.plist), tested |
| Zotero | 10.0.7 with local API enabled |
| PDF helper | prebuilt arm64, minimum macOS 13.0; needs Xcode Command Line Tools only if rebuilt |

PDF text, page count, quote location and rectangles use **PDF.js** (pdfjs-dist, Apache-2.0) on every platform. Image rendering uses the optional macOS `build/pdfkit-helper` (arm64, min macOS 13.0); on Windows/Linux or without the helper the reader keeps text evidence and Zotero opening, and never claims an image preview. It does not install Xcode or system tools. Zotero links open with `open -a Zotero` / `rundll32 url.dll,FileProtocolHandler` / `xdg-open` without a shell.

## Install

The public npm scope is undecided; the following is an **example**, not an invitation to install a same-named third-party package:

```sh
# after a future publish (do not run in this beta):
dsh plugin --profile <profile> add @scope/dsh-zotero@beta
```

`npm install @scope/dsh-zotero` only adds a package to a Node project; it does **not** activate the plugin in a Harness profile. Use `dsh plugin --profile <profile> add ...` (local tarball or future published name).

Local beta package (web and desktop profiles use the same npm package; install into the profile you actually run):

```sh
dsh plugin --profile <profile> add /absolute/path/dsh-zotero-1.0.0-beta.2.tgz
```

## Install from the local package

```sh
dsh plugin --profile <profile> add /absolute/path/dsh-zotero-1.0.0-beta.2.tgz
```

Then restart DSH. The package contains code, docs and the helper; it does not contain any library data, credentials or cache. No dev symlink or developer path is required.

Uninstall:

```sh
dsh plugin --profile <profile> remove dsh-zotero
```

## First use

Open the Zotero panel → **设置** (also opens automatically on first run). Check, in order:

1. **Zotero and local API** — start Zotero and enable its local API; press 重新检测.
2. **Model** — defaults to the host configuration; pick another provider/model or restore the host default. Keys are never shown or copied.
3. **PDF preview** — shows helper architecture and minimum macOS; text fallback is used when unavailable.
4. **Write authorization** — choose 始终允许 in Zotero's prompt for notes/annotations/collections.

Each analysis shows a preflight with model, paper, page range, data sent and a cost note; it never fabricates an amount. Compare/relations limits (6/8) are enforced before sending.

## Data flow, privacy and cost

Only after you press 开始分析 / 生成综合 / 对比 / 关系 / 提问 the plugin sends, depending on the entry point: the paper's title, authors, year, venue, abstract, selected page text, your research focus and prior Q&A; **your Zotero notes and annotations when you bring them into a conversation or research question; extracted evidence and synthesis results when generating a synthesis or carrying them into a conversation; selected page excerpts for compare/relations**. A formal DSH conversation carries only the materials you confirm in the launcher, not the plugin's full history. It does not send the Zotero auth key, the PDF file itself or other credentials. Provider retention is governed by that provider's policy; no guarantee is made here. There is no telemetry or background library upload.

Plugin data lives in DSH's `storages/zotero-plugin` directory (shown in 设置 → 隐私). PDF previews are cached there and can be cleared separately; clearing never deletes research results.

## Backup and restore

设置 → 备份与恢复 exports a JSON file containing research questions (with stances/evolution), combined analyses (main + supplements + synthesis), Q&A and the reading queue. It is **not** a Zotero library/PDF backup and excludes the auth key, settings and cache. It also does not contain Harness formal-conversation bodies; research-question conversation entries store only the session id/title reference. Compare/relations results exist only in the current browser session and are not backed up. Restore previews counts and conflicts, then merges by primary key: existing records are kept, only missing ones are added; Q&A only appends unseen turns. Invalid or unsupported files are rejected before any write.

## Upgrade

1. Export a plugin-data backup from 设置 → 备份与恢复.
2. Remove the old plugin (`dsh plugin --profile <profile> remove dsh-zotero`), install the new tarball, restart DSH.
3. Existing `storages/zotero-plugin` data is kept; no automatic migration is performed. Restore the backup only if you need to merge records back (existing records are skipped, never overwritten).

## Research question export

研究问题 → 导出 Markdown creates a readable file with understanding, linked papers/evidence (with stances), open questions, next actions and evolution history.

## Limitations

- Preview-level exact highlighting is not a 1.0 requirement; page-level location is reported honestly.
- No OCR for scanned PDFs, no chart detection, no real-time Zotero selection.
- Syntheses and long analyses can take minutes; the UI shows elapsed time and a cancel button.
- The prebuilt helper is arm64 only; Intel is untested.
- PDF.js text is ordered top-to-bottom by line geometry. Two-column pages are not guaranteed to be restored to semantic reading order; treat order across columns as approximate.
- Annotation sort indexes use the PDF page top and page height; rotated pages or missing page geometry use offset 0 instead of a fabricated precise position.
- Clean-machine installation and full UI verification are not yet performed on a second machine.

## Development

```sh
pnpm install
pnpm build                # client bundle
pnpm build:helper         # macOS-only PDFKit helper (needs Xcode CLT)
node scripts/check.mjs    # pure cross-platform checks + synthetic PDFs
node scripts/pack.mjs     # real `pnpm pack` + Node-written source tarball
node scripts/pack.mjs /path/to/out   # both tarballs into that directory
```

`scripts/pack.mjs` prefers a pnpm JavaScript entry (`DSH_PNPM` or `npm_execpath`), then Harness's bundled pnpm at `~/.dsh/dsh-runtimes/<runtime>/dependencies/pnpm/bin/pnpm.cjs`; on Windows it runs a discovered `pnpm.cmd` through `cmd.exe` rather than treating it as a binary. If none is found, install pnpm or set `DSH_PNPM` to the `pnpm.cjs` path.

Source layout: `lib/` (host), `client/` (web UI), `scripts/pdfkit-helper.swift`, `build/pdfkit-helper`.

## npm, market and data are separate

- GitHub source, npm distribution, dsh-market listing and plugin-data backup/migration are four different things.
- Publishing does not list the plugin in dsh-market. Future listing goes through `awesome-dsh-plugin` (`data/plugins/<owner>__<repo>.yml` PR); dsh-market reads that directory. Not the dsh-market app repository.
- No cloud sync of papers or research data; use the local JSON backup.

## Feedback

See `SECURITY.md` for sensitive reports and `.github/ISSUE_TEMPLATE/bug_report.md` for defects. Repository URL, maintainer and contact are **to be filled in** before publishing; this beta does not imply official endorsement.

## License

MIT. See `LICENSE`.
