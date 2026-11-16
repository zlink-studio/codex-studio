#!/usr/bin/env bash
# Start the bridge if it is not already listening. Safe to run from cron every minute.
cd "$(dirname "$0")" || exit 1
PORT=$(grep -m1 '^BRIDGE_PORT=' bridge.env | cut -d= -f2)
ss -ltn | grep -q ":${PORT:-18443} " && exit 0
export PATH="/home/claudeops/.local/bin:/usr/bin:/bin"
nohup /usr/bin/node bridge.mjs >> bridge.log 2>&1 &
