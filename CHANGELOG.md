# Changelog

## 1.0.0-beta.3 — 2026-11-01

- Internal package, plugin ID, HTTP route prefix, client module ID and packaging names renamed to `dsh-zotero-research`.
- Storage directory `storages/zotero-plugin`, legacy backup format `dsh-zotero-backup`, Zotero tags `dsh-zotero`/`dsh-zotero:ai` and localStorage preference keys are kept as explicit compatibility data; no auto-migration.
- Upgrade requires removing the old `dsh-zotero` package and installing `dsh-zotero-research`; do not run both.

## 1.0.0-beta.2 — 2026-11-01

- Standard npm/pnpm tarball via `pnpm pack`, with Node-based cross-platform source packaging (`scripts/pack.mjs`).
- Cross-platform PDF text backend (pdfjs-dist, Apache-2.0): page count, text extraction, quote location and PDF-space rectangles on macOS/Windows/Linux; PDFKit image rendering remains a macOS-only optional renderer with explicit text fallback.
- Zotero protocol opening per platform (open -a / rundll32 / xdg-open) without a shell, with error and exit-code handling.
- Engines: Node >=20, DSH >=0.2.1-rc.5 <0.3.0; pdfjs-dist moved to runtime dependencies with license included.
- CI workflow for macOS/Windows/Linux (configuration only; no remote run this round); compatibility table distinguishes real runs from pure-logic tests.
- Market submission template for awesome-dsh-plugin (not submitted) and local release checklist.
- Zotero annotation sort index now follows the reader format (1-based page | char offset | distance from PDF page top); rotated pages and missing geometry do not fake precision. PDF.js line text is ordered top-to-bottom; cross-column reading order is not guaranteed.

## 1.0.0-beta.1 — 2026-11-01

First public beta (macOS, Apple Silicon).

- Versioned and packaged for local installation; removed reliance on development symlinks.
- First-run checks: Zotero/local API, model, PDF helper capability, write authorization.
- Model selection (provider/model) persisted per plugin, defaulting to the host configuration; clear errors for invalid choices.
- Pre-analysis preflight with model, paper, page range, data-sent scope and a non-fabricated cost note.
- Privacy panel and plugin-data backup/restore (research questions, analyses+synthesis, Q&A, queue) with conflict preview and additive merge.
- Research-question Markdown export.
- PDF helper rebuilt for macOS 13.0+ arm64; graceful text fallback and clear errors when unavailable.
- Markdown export labels AI notes, unknown-origin notes and annotations by provenance; no human/AI guessing.
- Compare/relations tasks survive panel switching; duplicate starts are rejected; in-flight tasks are marked interrupted after a reload.
- README, LICENSE, CONTRIBUTING, SECURITY, issue template and local release checklist.
