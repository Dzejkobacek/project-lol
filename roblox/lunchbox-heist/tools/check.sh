#!/usr/bin/env bash
# Type-check + lint all Luau sources with luau-lsp (strict) against Roblox type definitions.
# Tools live in $LUAU_TOOLS (default /root/.luau-tools): luau-lsp, luau, stylua, globalTypes.d.luau
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
T="${LUAU_TOOLS:-/root/.luau-tools}"
cd "$HERE"
python3 -I tools/gen_sourcemap.py >/dev/null || exit 2
"$T/luau-lsp" analyze --definitions="$T/globalTypes.d.luau" --sourcemap=sourcemap.json --settings=tools/lsp-settings.json src
