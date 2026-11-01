#!/bin/sh
# Build the PDFKit helper for the current Mac. Requires the Swift toolchain
# (Xcode Command Line Tools). Targets macOS 13.0; tested on macOS 26.6.2 arm64.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
ARCH=$(uname -m)
case "$ARCH" in
  arm64) TARGET="arm64-apple-macos13.0" ;;
  x86_64) TARGET="x86_64-apple-macos13.0" ;;
  *) echo "unsupported architecture: $ARCH" >&2; exit 1 ;;
esac
mkdir -p "$ROOT/build/.swift-module-cache"
swiftc -O -module-cache-path "$ROOT/build/.swift-module-cache" -target "$TARGET" \
  -o "$ROOT/build/pdfkit-helper" "$ROOT/scripts/pdfkit-helper.swift"
printf '{"arch":"%s","minMacOS":"13.0","builtWith":"Swift toolchain","builtAt":"%s"}\n' \
  "$ARCH" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ROOT/build/pdfkit-helper.json"
echo "built $ROOT/build/pdfkit-helper ($TARGET)"
