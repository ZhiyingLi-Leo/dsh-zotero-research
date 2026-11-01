# Local release checklist (stop before publishing)

- [ ] Version 1.0.0-beta.3 in `package.json`, UI and docs.
- [ ] `pnpm build` and `pnpm build:helper` succeed; helper arch/minOS recorded.
- [ ] `npm pack` produced `dsh-zotero-research-1.0.0-beta.3.tgz`.
- [ ] Tarball contains no `node_modules`, state/cache, PDFs, backups, `.env`, credentials or personal paths.
- [ ] Isolated profile install from the tarball works; `/dsh-zotero-research/status` returns version 1.0.0-beta.3.
- [ ] Backup export/preview/restore tested in the isolated profile.
- [ ] Research Markdown export tested.
- [ ] README has no personal paths, real item keys or process logs.
- [ ] LICENSE, CHANGELOG, CONTRIBUTING, SECURITY, issue template present.
- [ ] Fill repository URL and security contact before any public release.
- [ ] Do **not** git push, create a remote, publish an npm package, create an online release or upload papers/library data.
