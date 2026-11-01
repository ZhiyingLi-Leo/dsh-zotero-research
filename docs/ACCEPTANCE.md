# Acceptance record / 验收记录

## Automated CI / 自动化 CI

All six matrix jobs passed on GitHub-hosted runners on **2026-11-01**:

[Successful workflow / 成功运行](https://github.com/ZhiyingLi-Leo/dsh-zotero-research/actions/runs/41283787124)

| Runner | Node 20 | Node 24 |
|---|---|---|
| macOS 14 | Passed / 通过 | Passed / 通过 |
| Windows Server 2022 | Passed / 通过 | Passed / 通过 |
| Ubuntu 22.04 | Passed / 通过 | Passed / 通过 |

Each job performs a frozen-lockfile installation with pnpm 10.17.0, builds the real client, runs `scripts/check.mjs`, produces standard npm/source archives, and installs the generated tgz in a temporary project with lifecycle scripts disabled. The installed-package check verifies package identity/version, host exports, patch, client bundle and API prefix, and the `pdfjs-dist` runtime dependency.

Regression checks cover synthetic multi-page and CMap Chinese PDFs, quote location through the exported entry point, PDF/preview coordinate consistency, rotation and no-match fallbacks, annotation sort payloads, backup validation, real Markdown export with structured values and provenance, platform Zotero command mapping, and pnpm shim resolution. No real Zotero library or model account is used by these jobs.

自动检查覆盖锁定依赖安装、真实客户端构建、PDF/坐标/备份/导出回归、标准打包及产物安装；使用合成夹具，不访问真实 Zotero 文库或调用模型。

Earlier failures identified a Node 20/pnpm 11 mismatch, esbuild build approval configuration, and Windows command quoting. Those issues were fixed before the successful run; no jobs or failing checks were disabled.

## Desktop GUI / 桌面联动

- macOS desktop behavior was exercised locally: library filtering/counts, persisted reading results, evidence previews, Zotero page opening, conversation material previews, research records and Markdown export.
- Windows desktop/Zotero integration will be exercised by the maintainer separately; Linux desktop integration remains separate from hosted-runner checks.
- A green CI run verifies the automated scope above. It does not claim GUI validation, OCR, chart detection, or successful opening of a real Zotero reader on a hosted runner.

桌面 GUI 与 CI 的证据分开记录；不会把平台命令构造检查当作真实 Zotero 窗口跳转验收。

## Screenshots / 功能图片

`docs/images/reading.jpg`, `evidence.jpg`, and `research.jpg` are unmodified screenshots of the real plugin UI running in an isolated Harness profile. The library, PDF and records are synthetic. They contain no real research records or credentials. The evidence image demonstrates the optional macOS PDFKit preview. See the repository's `demo/README.md` for the synthetic fixture setup.

## Distribution / 分发状态

Private repository only. No npm publication, public GitHub release, or market submission has been made.
