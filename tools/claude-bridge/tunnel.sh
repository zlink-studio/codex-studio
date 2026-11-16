#!/usr/bin/env bash
# Keep a Cloudflare quick tunnel in front of the bridge and keep Vercel pointed at it.
# Run from cron every minute. Quick tunnels get a new random URL whenever they
# restart; when that happens this updates CLAUDE_BRIDGE_URL on Vercel and
# redeploys production so the website follows.
set -u
cd "$(dirname "$0")" || exit 1
exec 9>tunnel.lock
flock -n 9 || exit 0

export PATH="/home/claudeops/.local/bin:/usr/bin:/bin"
VERCEL=/home/claudeops/.local/vercel-cli/node_modules/.bin/vercel
REPO=/home/claudeops/projects/codex-studio
PORT=$(grep -m1 '^BRIDGE_PORT=' bridge.env | cut -d= -f2)
TOKEN=$(grep -m1 '^BRIDGE_TOKEN=' bridge.env | cut -d= -f2)
log() { echo "$(date -u +%FT%TZ) $*" >> tunnel-manager.log; }

healthy() {
  [ -s tunnel.url ] || return 1
  curl -s -m 15 -o /dev/null -w '%{http_code}' "$(cat tunnel.url)/health" -H "Authorization: Bearer $TOKEN" | grep -q '^200$'
}

start_tunnel() {
  [ -s tunnel.pid ] && kill "$(cat tunnel.pid)" 2>/dev/null
  : > tunnel.log
  nohup cloudflared tunnel --no-autoupdate --url "https://127.0.0.1:${PORT:-18443}" --no-tls-verify >> tunnel.log 2>&1 &
  echo $! > tunnel.pid
  for _ in $(seq 1 40); do
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log | head -1)
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "${url:-}" ] || { log "tunnel did not report a URL"; return 1; }
  echo "$url" > tunnel.url
  log "tunnel started: $url"
  sleep 8
}

sync_vercel() {
  local url
  url=$(cat tunnel.url)
  [ "$url" = "$(cat synced.url 2>/dev/null)" ] && return 0
  cd "$REPO" || return 1
  "$VERCEL" env rm CLAUDE_BRIDGE_URL production --yes >/dev/null 2>&1
  printf '%s' "$url" | "$VERCEL" env add CLAUDE_BRIDGE_URL production >/dev/null 2>&1 || { log "vercel env add failed"; return 1; }
  if "$VERCEL" redeploy codex-studio-sandy.vercel.app --target production >> "$OLDPWD/tunnel-manager.log" 2>&1; then
    cd "$OLDPWD" && echo "$url" > synced.url && log "vercel updated to $url"
  else
    log "vercel redeploy failed"
  fi
}

ss -ltn | grep -q ":${PORT:-18443} " || ./start.sh
healthy || { sleep 5; healthy; } || start_tunnel
healthy && sync_vercel
