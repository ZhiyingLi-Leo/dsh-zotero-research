# Contributing

Use [Issues](https://github.com/ZhiyingLi-Leo/dsh-zotero-research/issues) for reproducible bugs and workflow suggestions. Do not include credentials, private papers, notes, or library backups.

## Build and test

Node.js 20 or 24 and pnpm 10.17.0 match the CI toolchain.

```sh
pnpm install --frozen-lockfile
node client/build.mjs
node scripts/check.mjs
node scripts/pack.mjs
node scripts/install-check.mjs
```

The generated client is committed so direct GitHub installs work without an install-time build. Rebuild it when changing `client/src/`. The npm package is prebuilt; consumers do not need esbuild. The optional PDFKit helper is macOS-specific and has its Swift source under `scripts/`.

Keep existing storage and note provenance compatible. Use synthetic fixtures for write tests. Preserve the safeguards for credentials, private library files, overwrite conflicts, and backup validation.

Changes to the reading workflow should be checked in the actual UI. CI covers the macOS/Windows/Linux Node matrix; the [acceptance record](docs/ACCEPTANCE.md) records its scope and links.

Publishing instructions: [docs/PUBLISHING.md](docs/PUBLISHING.md). Licensing: [MIT](LICENSE).
