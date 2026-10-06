#!/bin/bash
# Refresh the live site from the Observatory: export the rankings, rebuild, deploy.
# Meant to be run on a schedule (see com.firstlight.refresh-site.plist.example) from the
# laptop that hosts the Observatory. The laptop is the only deployer: it is the only place
# the private pages' data exists, so a deploy from anywhere else would drop them.
#
#   scripts/refresh-site.sh              deploy only if the export changed
#   FORCE=1 scripts/refresh-site.sh      deploy regardless
#   DRY_RUN=1 scripts/refresh-site.sh    export and build, then stop before deploying
#
# What is deployed is the committed DEPLOY_REF (default `master`) plus the laptop's data,
# never the checkout's working tree: the build runs in a fresh worktree of that commit
# (DEPLOY_WORKTREE, default ../eminence-deploy), with data/index.json, data/publications/
# and data/private/ copied in from the checkout. Uncommitted edits and other branches
# stay off the live site. The launchd job runs master's copy of this script, not the
# checkout's (see the plist), and sets EMINENCE_REPO to the checkout.
#
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Put them in
# ~/.config/first-light/env (never in the repo); this script sources that file if present.
set -euo pipefail
REPO="${EMINENCE_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
DEPLOY_REF="${DEPLOY_REF:-master}"
WORKTREE="${DEPLOY_WORKTREE:-$(dirname "$REPO")/eminence-deploy}"

# launchd starts with a bare PATH; add the usual places node lives.
# nvm keeps each Node version in its own folder, so add the newest one.
NVM_NODE="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="/opt/homebrew/bin:/usr/local/bin:${NVM_NODE:+$NVM_NODE:}$PATH"
# `set -a` exports every variable the file defines, so plain KEY=value lines reach wrangler.
if [ -f "$HOME/.config/first-light/env" ]; then set -a; . "$HOME/.config/first-light/env"; set +a; fi

OBSERVATORY_DIR="${OBSERVATORY_DIR:-$(dirname "$REPO")/observatory}"
OUT="$REPO/data/index.json"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

before="$(shasum "$OUT" 2>/dev/null || true)"
log "exporting from $OBSERVATORY_DIR"
( cd "$OBSERVATORY_DIR" && ./.venv/bin/python -m observatory.site_export --out "$OUT" )
after="$(shasum "$OUT")"

if [ "$before" = "$after" ] && [ -z "${FORCE:-}" ]; then
    log "rankings unchanged, nothing to deploy"
    exit 0
fi

# A fresh worktree of the committed version, every run, so nothing left over from a
# previous build (or edited by hand) can ship.
commit="$(git -C "$REPO" rev-parse --verify "$DEPLOY_REF^{commit}")"
if [ -e "$WORKTREE" ]; then
    git -C "$REPO" worktree remove --force "$WORKTREE"
fi
git -C "$REPO" worktree prune
git -C "$REPO" worktree add --detach --quiet "$WORKTREE" "$commit"
if [ -n "$(git -C "$WORKTREE" status --porcelain)" ]; then
    log "deploy worktree $WORKTREE is not clean, refusing to deploy"
    exit 1
fi
mkdir -p "$WORKTREE/data"
cp "$OUT" "$WORKTREE/data/index.json"
for d in publications private; do
    if [ -d "$REPO/data/$d" ]; then cp -R "$REPO/data/$d" "$WORKTREE/data/$d"; fi
done
cd "$WORKTREE"
log "building $DEPLOY_REF at $(git rev-parse --short HEAD) in $WORKTREE"

if [ -n "${DRY_RUN:-}" ]; then
    node scripts/build.mjs
    log "dry run: built, would deploy now"
    exit 0
fi
log "deploying"
npm run --silent deploy
log "done"
