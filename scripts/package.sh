#!/bin/sh
# Reproducible local packaging: install tarball + source tarball + containment checks.
# Both packages are staged from explicit whitelists; .gitignore is never the only guard.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-$ROOT}
VERSION=$(node -p "require('$ROOT/package.json').version")
export COPYFILE_DISABLE=1
( cd "$ROOT" && node client/build.mjs )

STAGE=$(mktemp -d "${TMPDIR:-/tmp}/dsh-zotero-pkg.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT INT TERM

scan_forbidden() {
  dir=$1
  found=$(find "$dir" \( -name '.git' -o -name 'node_modules' -o -name 'storages' \
    -o -name 'state.json' -o -name 'analyses.json' -o -name 'ask.json' -o -name 'research.json' \
    -o -name '.env' -o -name '.env.*' -o -name 'credentials*' -o -name '*.credentials.yaml' \
    -o -name '*.pem' -o -name '*.key' -o -name '*.pdf' -o -name '*.caj' \
    -o -name '*.backup.json' -o -name 'dsh-zotero-backup-*.json' \
    -o -name '.restore-*' -o -name '*.tmp' -o -name '*.tgz' -o -name '*.tar.gz' \) -print 2>/dev/null || true)
  if [ -n "$found" ]; then
    echo "forbidden files in $dir:" >&2
    echo "$found" >&2
    exit 1
  fi
}

# ---- install package: explicit whitelist ----
PKG="$STAGE/dsh-zotero"
mkdir -p "$PKG/client" "$PKG/build"
cp "$ROOT/package.json" "$ROOT/README.md" "$ROOT/LICENSE" "$ROOT/CHANGELOG.md" \
   "$ROOT/CONTRIBUTING.md" "$ROOT/SECURITY.md" "$ROOT/cordis.patch.yml" "$PKG/"
cp -R "$ROOT/lib" "$ROOT/scripts" "$ROOT/docs" "$ROOT/examples" "$PKG/"
cp "$ROOT/client/client.js" "$PKG/client/"
cp "$ROOT/build/pdfkit-helper" "$ROOT/build/pdfkit-helper.json" "$PKG/build/"
scan_forbidden "$PKG"
( cd "$STAGE" && tar -czf "$OUT/dsh-zotero-$VERSION.tgz" dsh-zotero )

# ---- source package: explicit whitelist, not a whole-repo tar ----
SRC="$STAGE/source/dsh-zotero"
mkdir -p "$SRC/client/src" "$SRC/build"
cp "$ROOT/package.json" "$ROOT/README.md" "$ROOT/LICENSE" "$ROOT/CHANGELOG.md" \
   "$ROOT/CONTRIBUTING.md" "$ROOT/SECURITY.md" "$ROOT/.gitignore" "$ROOT/cordis.patch.yml" \
   "$ROOT/pnpm-lock.yaml" "$ROOT/pnpm-workspace.yaml" "$SRC/"
cp -R "$ROOT/lib" "$ROOT/scripts" "$ROOT/docs" "$ROOT/examples" "$ROOT/.github" "$SRC/"
cp -R "$ROOT/client/src" "$SRC/client/"
cp "$ROOT/client/build.mjs" "$SRC/client/"
cp "$ROOT/scripts/pdfkit-helper.swift" "$SRC/scripts/" 2>/dev/null || true
cp "$ROOT/build/pdfkit-helper" "$ROOT/build/pdfkit-helper.json" "$SRC/build/"
scan_forbidden "$SRC"
( cd "$STAGE/source" && tar -czf "$OUT/dsh-zotero-$VERSION-source.tar.gz" dsh-zotero )

echo "built: $OUT/dsh-zotero-$VERSION.tgz"
echo "built: $OUT/dsh-zotero-$VERSION-source.tar.gz"
tar -tzf "$OUT/dsh-zotero-$VERSION.tgz" | grep -q '^dsh-zotero/lib/index.js$'
tar -tzf "$OUT/dsh-zotero-$VERSION.tgz" | grep -q '^dsh-zotero/examples/sample-backup.json$'
tar -tzf "$OUT/dsh-zotero-$VERSION-source.tar.gz" | grep -q '^dsh-zotero/client/src/index.jsx$'
tar -tzf "$OUT/dsh-zotero-$VERSION-source.tar.gz" | grep -q '^dsh-zotero/scripts/package.sh$'
echo "contents checked"
