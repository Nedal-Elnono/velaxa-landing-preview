#!/usr/bin/env bash
# Publish the current folder to the live client-preview link.
#   https://nedal-elnono.github.io/velaxa-landing-preview/
#
# `origin`  -> private repo, the source of truth
# `preview` -> public repo that GitHub Pages serves from
set -euo pipefail
cd "$(dirname "$0")"

git add -A
git diff --cached --quiet || git commit -m "${1:-Update landing page}"

git push origin HEAD
git push preview HEAD:master --force

echo
echo "Pushed. GitHub Pages rebuilds in ~30-60s:"
echo "  https://nedal-elnono.github.io/velaxa-landing-preview/"
