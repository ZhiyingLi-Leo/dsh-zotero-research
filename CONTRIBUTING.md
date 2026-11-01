# Contributing

Thanks for helping improve dsh-zotero.

- Use issues for bugs and proposals; keep reports free of credentials, private paper text and personal paths.
- For code changes: `pnpm install`, `pnpm build`, run a focused manual check in an isolated DSH profile, and keep the true Zotero library untouched.
- Do not commit `node_modules`, build artifacts other than the helper, state/cache, PDFs, backups or `.env` files.
- Do not add telemetry, background uploads, new permissions or global settings changes without an explicit design discussion.
- Preserve the existing write authorization, read-back verification and conflict protection.
- The maintainer/repository address is not yet published; use the issue template and state what you can reproduce.

All contributions are under the MIT license.
