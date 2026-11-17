#!/usr/bin/env bash
# Start the bridge and the CloudCLI gate if they are not already listening.
cd "$(dirname "$0")" || exit 1
export PATH="/home/claudeops/.local/bin:/usr/bin:/bin"
port() { grep -m1 "^$1=" bridge.env | cut -d= -f2; }
ss -ltn | grep -q ":$(port BRIDGE_PORT) " || nohup /usr/bin/node bridge.mjs >> bridge.log 2>&1 &
ss -ltn | grep -q ":$(port CLI_GATE_PORT) " || nohup /usr/bin/node cli-gate.mjs >> cli-gate.log 2>&1 &
