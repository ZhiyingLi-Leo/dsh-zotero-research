# Acceptance record / 验收记录

This file separates **implemented and locally verified behavior** from **CI/GUI acceptance**. Fill the links and results after real runs; do not treat configuration as a completed run.

## CI

- Workflow: `.github/workflows/ci.yml` (macOS / Windows / Ubuntu × Node 20/24, `pnpm install --frozen-lockfile`, `node client/build.mjs`, `node scripts/check.mjs`, `node scripts/pack.mjs`).
- Actual run URL / 实际运行链接: **to be filled by maintainer**
- Result / 结果: **to be filled** (no result is claimed in this repository).

## GUI acceptance

- macOS real GUI: manually exercised by the maintainer on the development machine (reading, evidence, Zotero open, export, backup). Screenshots in `docs/images/` use synthetic demo data.
- Windows real GUI: **pending** until the maintainer runs it on Windows hardware.
- Linux real GUI: **pending**.
- CI passing or configuration alone is not a GUI acceptance claim.
- PDF.js text/coordinates are shared across platforms; PDFKit image rendering is macOS-only and optional. Rotated pages are page-only for precise write-back.

## Demo screenshots

`docs/images/*.png` are captured from an isolated demo profile with a synthetic read-only Zotero mock; see `demo/README.md`. They must not contain real papers, notes, keys, paths or credentials.
