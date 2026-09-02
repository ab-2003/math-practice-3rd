#!/bin/zsh
# THE GAUNTLET: the single gate.
#
# typecheck -> unit suite -> build -> preview -> the senses, in parallel ->
# GATE: GREEN -> deploy -> converge 8/8 -> live smoke.
#
# It judges EXIT CODES, never prose, and it deploys only from a fully green run.
#
# Usage: ./run-gauntlet.sh [--quick [sense...]] [--no-deploy] [--branch <name>]
#
# Senses: probe-core probe-settings probe-juice probe-shop probe-cloud probe-speed
#         probe-parent answer-eye human-eye tap-audit legible-check offline-check
#         (probe-loop selects all six probe suites)
#
# CHANNELS. Production is the main branch at math-practice-3rd.pages.dev.
# --branch alpha publishes a PREVIEW at alpha.math-practice-3rd.pages.dev and
# converges and smokes THAT url, leaving production untouched. The full
# gauntlet is the law before either.
set -o pipefail
eval "$(/opt/homebrew/bin/fnm env)"
cd "$(dirname "$0")"

PROJECT=math-practice-3rd
BRANCH=main

QUICK=0; DEPLOY=1; typeset -a WANT
while [[ $# -gt 0 ]]; do case $1 in
  --quick) QUICK=1; shift;;
  --no-deploy) DEPLOY=0; shift;;
  --branch) BRANCH=$2; shift 2;;
  *) WANT+=("$1"); shift;;
esac; done
if [[ $BRANCH == main ]]; then LIVE=https://$PROJECT.pages.dev; else LIVE=https://$BRANCH.$PROJECT.pages.dev; fi
wants() {
  [[ $QUICK -eq 0 ]] && return 0
  [[ " ${WANT[*]} " == *" $1 "* ]] && return 0
  [[ $1 == probe-* && " ${WANT[*]} " == *" probe-loop "* ]] && return 0
  return 1
}

# Ports come from the shared registry, held by THIS shell's pid and returned on
# exit, so a dead session never blocks a range. Stable slot for this project
# is 8350; it walks forward if something already holds it.
BASE_PORT=$(node tools/ports.mjs claim $PROJECT $$) || { echo "GATE: RED (no ports)"; exit 1; }
PREVIEW_PORT=$BASE_PORT
# zsh QUIRK: EXIT traps run in SUBSHELLS too, so an unguarded trap fires when
# any $(...) exits and kills the preview it was meant to clean up, mid-run.
trap '[[ ${ZSH_SUBSHELL:-0} -eq 0 ]] && { pkill -f "vite preview.*--port $PREVIEW_PORT" 2>/dev/null; node tools/ports.mjs release $$ >/dev/null 2>&1 }' EXIT
echo "PORTS: $PROJECT holds $BASE_PORT-$((BASE_PORT + 49))   CHANNEL: $BRANCH -> $LIVE"

stage() { echo "[gauntlet +${SECONDS}s] $1"; }

stage "stage 1/5: typecheck"
npx tsc --noEmit || { echo "GATE: RED (tsc)"; exit 1; }
echo "TSC CLEAN"

stage "stage 2/5: the unit suite"
npx vitest run 2>&1 | tail -25 | grep -E "Tests +[0-9]+ passed" | grep -qv failed || { echo "GATE: RED (vitest)"; exit 1; }
echo "VITEST GREEN"

stage "stage 3/5: build + preview"
# NEVER redirect a build to /dev/null: it once hid a typecheck failure for 15
# minutes while every probe silently tested a stale bundle.
npx vite build 2>&1 | tail -4 || { echo "GATE: RED (build)"; exit 1; }

# Always a FRESH preview. A stale reused server once meant probing yesterday.
pkill -f "vite preview.*--port $PREVIEW_PORT" 2>/dev/null
npx vite preview --port $PREVIEW_PORT --strictPort >/dev/null 2>&1 &
for i in $(seq 1 25); do curl -sf http://localhost:$PREVIEW_PORT >/dev/null && break; sleep 1; done
curl -sf http://localhost:$PREVIEW_PORT >/dev/null || { echo "GATE: RED (preview never came up on $PREVIEW_PORT)"; exit 1; }

# THE SENSES RUN TOGETHER. Each is its own browser against a static preview, so
# the gate costs what the SLOWEST sense costs, not the sum.
PAR_DIR=$(mktemp -d)
typeset -a PAR_NAMES PAR_PIDS
launch() {
  PAR_NAMES+=("$1"); : > "$PAR_DIR/$1.out"
  ( eval "$2" > "$PAR_DIR/$1.out" 2>&1; echo $? > "$PAR_DIR/$1.rc" ) &
  PAR_PIDS+=($!)
}
stage "stage 4/5: the senses, in parallel"
B="BASE=http://localhost:$PREVIEW_PORT"
for s in core settings juice shop cloud speed parent; do
  wants probe-$s && launch probe-$s "$B node tools/probe/$s.mjs"
done
wants answer-eye    && launch answer-eye    "$B node tools/answer-eye.mjs"
wants human-eye     && launch human-eye     "$B node tools/human-eye.mjs --shots"
wants tap-audit     && launch tap-audit     "$B node tools/tap-audit.mjs"
wants legible-check && launch legible-check "$B node tools/legible-check.mjs"
wants offline-check && launch offline-check "$B node tools/offline-check.mjs"
echo "  running: ${PAR_NAMES[*]:-none}"
[[ ${#PAR_NAMES[@]} -gt 0 ]] && wait ${PAR_PIDS[@]} 2>/dev/null

RED=0; REDWHY=""
for n in "${PAR_NAMES[@]}"; do
  rc=$(cat "$PAR_DIR/$n.rc" 2>/dev/null || echo 99)
  echo "-- $n --"; cat "$PAR_DIR/$n.out" | tail -8
  if [[ $rc -ne 0 ]]; then RED=1; REDWHY+="  $n exited $rc\n"; fi
done
if [[ $RED -eq 1 ]]; then echo "GATE: RED"; printf "%b" "$REDWHY"; rm -rf "$PAR_DIR"; exit 1; fi
rm -rf "$PAR_DIR"

if [[ $QUICK -eq 1 ]]; then echo "GATE: GREEN (quick: ${WANT[*]:-no senses})"; else echo "GATE: GREEN"; fi
[ $DEPLOY -eq 0 ] && exit 0

stage "stage 5/5: deploy + converge + live smoke ($BRANCH)"
# WRANGLER MUST BE TOLD THE BRANCH. Without --branch it infers one from git and
# on any branch but main it publishes a PREVIEW to its own url, leaving the
# production address untouched while reporting a perfect upload. That is the
# behaviour the alpha channel USES, on purpose, so it is always explicit.
npx wrangler pages deploy dist --project-name=$PROJECT --branch=$BRANCH --commit-dirty=true 2>&1 | tail -4

# CONVERGE: Cloudflare's edge is eventually consistent, so a single matching
# response is a lie. Poll until the served bundle hash matches eight times.
# The kid's entry is named main since the grown-ups' door became a second
# entry. An empty grep here would "converge" against an empty grep there,
# so the match is checked before it is trusted.
want=$(grep -oE 'assets/(index|main)-[^"]+\.js' dist/index.html | head -1)
[[ -z "$want" ]] && { echo "GATE: RED (could not find the built bundle name in dist/index.html)"; exit 1; }
echo "  built bundle: $want"
n=0
for i in $(seq 1 60); do
  got=$(curl -s "$LIVE/?cb=$RANDOM" | grep -oE 'assets/(index|main)-[^"]+\.js' | head -1)
  if [ "$got" = "$want" ]; then n=$((n+1)); else n=0; fi
  [ $n -ge 8 ] && break
  sleep 4
done
if [ $n -ge 8 ]; then echo "converged 8/8"; else echo "FAILED to converge"; exit 1; fi

LIVE_URL=$LIVE node tools/live-smoke.mjs || exit 1
node tools/cloud-smoke.mjs || exit 1
echo "GAUNTLET-DEPLOY DONE — $LIVE"
