# dsh-zotero-research

[中文](README.md) | **English**

A Zotero research-reading workbench inside DeepSeek Harness: layered reading, evidence checks, research questions, conversation hand-off and write-back. Zotero remains the place for full PDF reading and native annotations; this is **not** a Zotero XPI.

- Version: **1.0.0-beta.3**
- Repository: https://github.com/ZhiyingLi-Leo/dsh-zotero-research
- Package: `packages/dsh-zotero-research-1.0.0-beta.3.tgz`
- No public npm release and no market listing.

## Screenshots

*Synthetic demo data only*

![Reader overview](docs/images/reading.jpg)

![Evidence preview](docs/images/evidence.jpg)

![Research questions](docs/images/research.jpg)

Captured from an isolated demo profile with a synthetic Zotero mock and synthetic records. See [demo/README.md](demo/README.md).

## Features

- Quick/rough/deep reading with actual page coverage, missing ranges and an honest "partial text" basis.
- Unified synthesis with batch conflicts, open uncertainties and verifiable quotes.
- Evidence crop/page preview, location labels and Zotero opening; page-only when exact location is unavailable.
- Research questions with material stances, understanding, open questions, next actions and evolution.
- Hand-off to real Harness conversations from a paper, section, evidence, annotation or comparison.
- Zotero notes/annotations read/write with conflict protection; Markdown export with provenance.
- Plugin-data backup/restore for research questions, analyses, Q&A and queue; excludes auth keys, settings and cache.

## Platform capability

| Capability | macOS arm64 | Windows | Linux |
|---|---|---|---|
| PDF.js text, pages, quote location, PDF rects | yes | yes | yes |
| PDFKit image rendering (evidence crop) | optional helper (macOS 13+) | text evidence | text evidence |
| Open in Zotero | `open -a Zotero` | `rundll32 url.dll,FileProtocolHandler` | `xdg-open` |
| Precise write-back on rotated pages | page-only | page-only | page-only |

PDF text and coordinates use PDF.js on all platforms; image preview is an optional macOS enhancement and never blocks text evidence or Zotero opening. Real GUI/CI acceptance boundaries are in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

## Install

Local package:

```sh
dsh plugin --profile <profile> add /absolute/path/dsh-zotero-research-1.0.0-beta.3.tgz
```

Future npm (example, not published):

```sh
dsh plugin --profile <profile> add @scope/dsh-zotero-research@beta
```

`npm install` only adds a package to a Node project; it does not activate a plugin in a Harness profile. Web and desktop use their own profiles.

## Uninstall

```sh
dsh plugin --profile <profile> remove dsh-zotero-research
```

## Upgrade (keep data)

1. Export a plugin-data backup.
2. Quit Harness normally.
3. Remove the old dependency:
   ```sh
   dsh plugin --profile <profile> remove dsh-zotero
   ```
4. Install the new package:
   ```sh
   dsh plugin --profile <profile> add /absolute/path/dsh-zotero-research-1.0.0-beta.3.tgz
   ```
5. If a desktop profile's `cordis.patch.yml` contains a hand-written old layer `id/name: dsh-zotero`, replace only that plugin block with `dsh-zotero-research`; keep other plugins and config. Never run both blocks together.
6. Restart Harness. Do not delete `storages/zotero-plugin`.

The storage directory, legacy backup format `dsh-zotero-backup`, Zotero tags `dsh-zotero`/`dsh-zotero:ai` and localStorage preference keys remain compatible. No automatic migration; restore only merges and never overwrites existing records.

## Workflow

1. Open the Zotero panel → Settings to check Zotero/local API, model, PDF capability and write authorization.
2. Pick a paper and run quick/rough/deep reading; the preflight shows model, actual page range and data scope.
3. Open evidence for the quoted excerpt; use Zotero for full reading or native highlights.
4. Ask about a conclusion/method/limitation, or take evidence/annotations into a real conversation.
5. Accumulate research-question materials, update understanding, then save results to Zotero or export Markdown.

## Privacy and cost

- Only when you press analyze/synthesis/compare/relations/ask does the plugin send paper metadata, abstract, selected pages, focus and necessary history; notes/annotations/evidence/synthesis are sent only when you bring them in.
- It does not send the Zotero auth key, the PDF attachment file, passwords or other credentials; no telemetry or background full-library upload.
- Provider retention is governed by that provider's policy; no unverified guarantee is made.
- Model calls may cost money; no amount is fabricated. Compare/relations limits (6/8) are shown before sending.

## Backup and restore

Settings → Backup & restore exports plugin-data JSON (research questions, combined analyses, Q&A, queue). Preview conflicts, then merge by primary key without overwriting human content. This is not a Zotero library/PDF backup and excludes conversation bodies, compare/relation results, auth keys, settings and cache.

## Development

Clean-source order (the source tarball intentionally omits the generated `client/client.js`):

```sh
pnpm install
node client/build.mjs
node scripts/check.mjs
node scripts/pack.mjs
node scripts/install-check.mjs
```

`scripts/pack.mjs` prefers `DSH_PNPM`/`npm_execpath`/Harness's bundled pnpm JS entry. On Windows it resolves a `.CMD` shim to the real pnpm JS entry and only falls back to `cmd.exe` with a complete verbatim command when necessary. Synthetic demo: [demo/README.md](demo/README.md).

## Feedback and license

- Issues: `.github/ISSUE_TEMPLATE/bug_report.md`; security: [SECURITY.md](SECURITY.md); contributing: [CONTRIBUTING.md](CONTRIBUTING.md).
- Acceptance boundaries: [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).
- License: MIT, see [LICENSE](LICENSE).

[中文](README.md)
