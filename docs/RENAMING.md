# Package identity and data compatibility

Current npm package and Harness plugin identity: **dsh-zotero-research**, version **1.0.0-beta.3**.

The package, host export, Cordis layer, client loader, panel registration, API routes and installer names agree. The README describes local installation, removal and upgrading the old package; remove the old dependency and update any hand-written plugin layer before enabling the new package.

Existing storage remains under `storages/zotero-plugin`. The `dsh-zotero-backup` data format, legacy Zotero provenance tags/note markers and localStorage keys remain readable and intentionally stable. They are data compatibility identifiers, not alternate plugin registrations. Do not enable both old and new packages.

Validation on macOS Apple Silicon includes standard tgz installation, installed-file comparison, clean-source build/check, the shell packaging compatibility entry point, old-backup validation, real Markdown export and preservation of existing records. Windows/Linux are adapted but have not been tested on actual systems. CI is configured for manual dispatch only and has not been executed remotely.

This is private release preparation. No npm publication or marketplace submission has been made.
