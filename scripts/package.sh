#!/bin/sh
# Compatibility entry point only. The canonical implementation is
# scripts/pack.mjs (real pnpm pack + Node-written source tarball + whitelist
# and sensitive-file scan). This wrapper forwards an optional output directory.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
exec node "$ROOT/scripts/pack.mjs" "$@"
