#!/bin/bash
# Refresh the live site from the Observatory: export the rankings, rebuild, deploy.
# Meant to be run on a schedule (see com.firstlight.refresh-site.plist.example) from the
# laptop that hosts the Observatory. The laptop is the only deployer: it is the only place
# the private pages' data exists, so a deploy from anywhere else would drop them.
#
#   scripts/refresh-site.sh              deploy only if the export changed
#   FORCE=1 scripts/refresh-site.sh      deploy regardless
#   DRY_RUN=1 scripts/refresh-site.sh    export, then stop before deploying
#
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Put them in
# ~/.config/first-light/env (never in the repo); this script sources that file if present.
set -euo pipefail
cd "$(dirname "$0")/.."

# launchd starts with a bare PATH; add the usual places node lives.
# nvm keeps each Node version in its own folder, so add the newest one.
NVM_NODE="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="/opt/homebrew/bin:/usr/local/bin:${NVM_NODE:+$NVM_NODE:}$PATH"
# `set -a` exports every variable the file defines, so plain KEY=value lines reach wrangler.
if [ -f "$HOME/.config/first-light/env" ]; then set -a; . "$HOME/.config/first-light/env"; set +a; fi

OBSERVATORY_DIR="${OBSERVATORY_DIR:-$(cd .. && pwd)/observatory}"
OUT="$PWD/data/index.json"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

STATUS="$PWD/data/observatory-status.json"   # written by the Observatory pipeline, not by this script
before="$(shasum "$OUT" "$STATUS" 2>/dev/null || true)"
log "exporting from $OBSERVATORY_DIR"
( cd "$OBSERVATORY_DIR" && ./.venv/bin/python -m observatory.site_export --out "$OUT" )
after="$(shasum "$OUT" "$STATUS" 2>/dev/null || true)"

if [ "$before" = "$after" ] && [ -z "${FORCE:-}" ]; then
    log "rankings and observatory status unchanged, nothing to deploy"
    exit 0
fi
[ -n "${DRY_RUN:-}" ] && { log "dry run: would deploy now"; exit 0; }
log "deploying"
npm run --silent deploy
log "done"
