#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f ".env.local" ]; then
  echo ".env.local already exists; keeping it."
  exit 0
fi

if [ ! -f ".env.example" ]; then
  echo ".env.example not found; skipping env bootstrap."
  exit 0
fi

echo "Creating .env.local from Codespaces secrets and .env.example defaults."
: > .env.local

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ""|\#*)
      printf "%s\n" "$line" >> .env.local
      ;;
    *=*)
      key="${line%%=*}"
      default="${line#*=}"
      value="${!key:-$default}"
      printf "%s=%s\n" "$key" "$value" >> .env.local
      ;;
    *)
      printf "%s\n" "$line" >> .env.local
      ;;
  esac
done < .env.example

echo ".env.local created. Add GitHub Codespaces secrets for real API keys."
