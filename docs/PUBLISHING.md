# npm and catalog distribution

Package: `dsh-zotero-research`. Prerelease channel: `beta`. Registry: `https://registry.npmjs.org/`.

## Prepare the release package

Build and verify using the commands in [CONTRIBUTING.md](../CONTRIBUTING.md). Publish the verified tgz rather than an unrelated working directory:

```sh
npm publish ./dsh-zotero-research-1.0.0-beta.3.tgz --dry-run --access public --tag beta
```

This is a rehearsal, not a registry publication. Authenticate with the intended npm maintainer account before an authorized publication:

```sh
npm whoami --registry=https://registry.npmjs.org/
npm publish ./dsh-zotero-research-1.0.0-beta.3.tgz --access public --tag beta
```

Do not commit npm tokens or disable two-factor protection. The package name must still be available at publication time; a registry lookup does not reserve it.

## GitHub installation

The repository includes the built client and optional PDFKit binary, with their source. This permits direct GitHub package installation without a consumer build:

```sh
dsh plugin --profile <profile> add github:ZhiyingLi-Leo/dsh-zotero-research
```

This command requires access to the repository. Public distribution requires a public repository or a published package.

## Market catalog

The listing is a single file in `awesome-dsh-plugin/awesome-dsh-plugin`:

`data/plugins/ZhiyingLi-Leo__dsh-zotero-research.yml`

The proposed contents are in [the entry file](market/awesome-dsh-plugin-entry.yml). The repository needs the `dsh-plugin` topic, a working `dsh.bundle` manifest, and public source that maintainers can inspect. Catalog policy requires the repository to be at least one day old. This repository was created at 2026-11-01 14:29:38 Asia/Shanghai, so it reaches that age at 2026-11-02 14:29:38 Asia/Shanghai.

The `screenshots.json` file declares the real feature screenshots for storefronts. Submit only the catalog entry; do not hand-edit the catalog's generated README files or other plugins' entries. Publication does not imply catalog acceptance.

Sources: [catalog contribution guide](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md), [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/).
