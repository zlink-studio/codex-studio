#!/usr/bin/env bash
# Keep the bridge, the CloudCLI gate and their Cloudflare quick tunnels running.
# Run from cron every minute.
#  - bridge tunnel: its URL is written to Vercel (CLAUDE_BRIDGE_URL) and production
#    is redeployed when it changes.
#  - cli tunnel: its URL is only stored in cli-tunnel.url; the OS asks the bridge
#    for it (/cli-url), so a change needs no redeploy.
set -u
cd "$(dirname "$0")" || exit 1
# Children must not inherit fd 9, or they would hold the lock forever.
exec 9>tunnel.run.lock
flock -n 9 || exit 0

export PATH="/home/claudeops/.local/bin:/usr/bin:/bin"
VERCEL=/home/claudeops/.local/vercel-cli/node_modules/.bin/vercel
REPO=/home/claudeops/projects/codex-studio
cfg() { grep -m1 "^$1=" bridge.env | cut -d= -f2; }
TOKEN=$(cfg BRIDGE_TOKEN)
log() { echo "$(date -u +%FT%TZ) $*" >> tunnel-manager.log; }

# $1 = name (bridge|cli), $2 = local origin, $3 = health path
healthy() {
  local file="$1-tunnel.url"
  [ "$1" = bridge ] && file=tunnel.url
  [ -s "$file" ] || return 1
  local code
  if [ "$1" = bridge ]; then
    code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$(cat "$file")/health" -H "Authorization: Bearer $TOKEN")
    [ "$code" = 200 ]
  else
    # The gate answers 403 without a cookie; any answer from it means the tunnel works.
    code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$(cat "$file")/")
    [ "$code" = 403 ]
  fi
}

start_tunnel() {
  local name=$1 origin=$2 file="$1-tunnel.url" logf="$1-tunnel.log" pidf="$1-tunnel.pid" url=""
  [ "$name" = bridge ] && { file=tunnel.url; logf=tunnel.log; pidf=tunnel.pid; }
  [ -s "$pidf" ] && kill "$(cat "$pidf")" 2>/dev/null
  : > "$logf"
  nohup cloudflared tunnel --no-autoupdate --url "$origin" --no-tls-verify >> "$logf" 2>&1 9>&- &
  echo $! > "$pidf"
  for _ in $(seq 1 40); do
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$logf" | head -1)
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { log "$name tunnel did not report a URL"; return 1; }
  echo "$url" > "$file"
  log "$name tunnel started: $url"
  sleep 8
}

sync_vercel() {
  local url
  url=$(cat tunnel.url)
  [ "$url" = "$(cat synced.url 2>/dev/null)" ] && return 0
  if (cd "$REPO" && "$VERCEL" env add CLAUDE_BRIDGE_URL --environment production --value "$url" --no-sensitive --force --yes >/dev/null 2>&1 \
      && "$VERCEL" redeploy codex-studio-sandy.vercel.app --target production >/dev/null 2>&1); then
    echo "$url" > synced.url && log "vercel updated to $url"
  else
    log "vercel update failed"
  fi
}

./start.sh 9>&-
sleep 1

healthy bridge || { sleep 5; healthy bridge; } || start_tunnel bridge "https://127.0.0.1:$(cfg BRIDGE_PORT)"
healthy bridge && sync_vercel

healthy cli || { sleep 5; healthy cli; } || start_tunnel cli "http://127.0.0.1:$(cfg CLI_GATE_PORT)"
