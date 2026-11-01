# Local release checklist (stop before publishing)

- [ ] Version 1.0.0-beta.3 in `package.json`, UI and docs.
- [ ] `pnpm build` and `pnpm build:helper` succeed; helper arch/minOS recorded.
- [ ] `npm pack` produced `dsh-zotero-research-1.0.0-beta.3.tgz`.
- [ ] Tarball contains no `node_modules`, state/cache, PDFs, backups, `.env`, credentials or personal paths.
- [ ] Isolated profile install from the tarball works; `/dsh-zotero-research/status` returns version 1.0.0-beta.3.
- [ ] Backup export/preview/restore tested in the isolated profile.
- [ ] Research Markdown export tested.
- [ ] README and screenshots contain no credentials, private notes, unpublished material or personal filesystem paths. Real screenshots of published-paper workflows require maintainer authorization.
- [ ] LICENSE, CHANGELOG, CONTRIBUTING, SECURITY, issue template present.
- [ ] Repository, homepage, issue URL and security reporting instructions are populated.
- [ ] Public distribution is authorized by the maintainer. Never upload credentials, library backups or private paper attachments.
