#!/bin/zsh
# Cut a release: bump, run the FULL gauntlet, tag, push, deploy, converge,
# live smoke. Releasing is deliberate; nothing here happens automatically.
# Usage: ./release.sh 0.1.0
set -o pipefail
eval "$(/opt/homebrew/bin/fnm env)"
cd "$(dirname "$0")"
VERSION=$1
[[ -z "$VERSION" ]] && { echo "usage: ./release.sh <version>"; exit 1; }
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must look like 0.1.0"; exit 1; }
git rev-parse "$VERSION" >/dev/null 2>&1 && { echo "tag $VERSION already exists"; exit 1; }

echo "== bumping package.json to $VERSION =="
node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));p.version=process.argv[1];fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");' "$VERSION"

echo "== the full gauntlet =="
./run-gauntlet.sh || { echo "RELEASE ABORTED: the gate was not green"; exit 1; }

LIVE_URL=https://math-practice-3rd.pages.dev WANT_VERSION=$VERSION node tools/live-smoke.mjs || {
  echo "RELEASE ABORTED: the live site is not serving $VERSION"; exit 1; }

echo "== tagging $VERSION =="
git add -A
git commit --author="Andy Ab2003 Justyna Beyer <beyerbuyer1@gmail.com>" -m "Release $VERSION" || true
git tag "$VERSION"
git push origin main --tags
echo "RELEASE $VERSION DONE — https://math-practice-3rd.pages.dev"
