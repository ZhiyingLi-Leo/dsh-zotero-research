# dsh-zotero-research 1.0.0-beta.3 — public beta

Local installation package for macOS (Apple Silicon tested).

Highlights: first-run checks and model selection; preflight showing model/pages/data/cost; privacy panel; backup/restore with conflict preview; research-question Markdown export; provenance labels in Markdown exports; task recovery across panel switches; PDF helper targeting macOS 13.0+ arm64 with text fallback.

Install: `dsh plugin --profile <profile> add /path/dsh-zotero-research-1.0.0-beta.3.tgz`, then restart DSH. A bare `npm install` only adds a dependency and does not activate the plugin.

Standard packages: real `pnpm pack` tarball + Node-written source tarball. PDF text/coordinates use PDF.js on macOS/Windows/Linux; PDFKit image rendering is macOS-only and optional. Platform capabilities are listed in the README; automated CI and desktop GUI evidence are recorded separately in docs/ACCEPTANCE.md.

Not included: Zotero XPI, OCR, chart detection, real-time selection, Intel support claim.

Known limits: clean-machine install and full UI acceptance have not been repeated on a second machine; synthesis can take minutes; exact preview highlighting is out of scope.
