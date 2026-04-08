#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MODEL_ID="${CCR_MODEL_ID:-MiniMax-M2.5}"
CCR_CONFIG_PATH="${HOME}/.claude-code-router/config.json"

export PATH="$HOME/.local-bun/node_modules/.bin:$HOME/.local/bin:$PATH"

if ! command -v ccr >/dev/null 2>&1; then
  echo "ccr not found in PATH. Expected it at $HOME/.local/bin/ccr." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found in PATH. Expected it under $HOME/.local-bun/node_modules/.bin." >&2
  exit 1
fi

provider_hosts=""
if [ -f "$CCR_CONFIG_PATH" ] && command -v node >/dev/null 2>&1; then
  provider_hosts="$(node -e "
    const fs = require('fs')
    const path = process.argv[1]
    const cfg = JSON.parse(fs.readFileSync(path, 'utf8'))
    const hosts = [...new Set((cfg.Providers || [])
      .map((provider) => provider.api_base_url)
      .filter(Boolean)
      .map((url) => {
        try {
          return new URL(url).hostname
        } catch {
          return null
        }
      })
      .filter(Boolean))]
    process.stdout.write(hosts.join(','))
  " "$CCR_CONFIG_PATH" 2>/dev/null || true)"
fi

proxy_bypass_hosts="127.0.0.1,localhost"
if [ -n "$provider_hosts" ]; then
  proxy_bypass_hosts="${proxy_bypass_hosts},${provider_hosts}"
fi

export NO_PROXY="$proxy_bypass_hosts"
export no_proxy="$proxy_bypass_hosts"
unset ALL_PROXY all_proxy

if ! ccr status 2>/dev/null | grep -q "Status: Running"; then
  echo "Starting Claude Code Router..." >&2
  nohup ccr start >/dev/null 2>&1 < /dev/null &
  for _ in {1..10}; do
    if ccr status 2>/dev/null | grep -q "Status: Running"; then
      break
    fi
    sleep 1
  done
fi

if ! ccr status 2>/dev/null | grep -q "Status: Running"; then
  echo "ccr failed to start. Please run 'ccr status' and inspect ~/.claude-code-router/logs/." >&2
  exit 1
fi

# Clear stale direct-to-provider settings before injecting the router endpoint.
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY
eval "$(ccr activate)"

export ANTHROPIC_DEFAULT_OPUS_MODEL="$MODEL_ID"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$MODEL_ID"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$MODEL_ID"
# Force this launcher to use its own context settings even when the login
# shell already exported older global CLAUDE_CODE_* defaults in ~/.bashrc.
# Use RUN_MINIMAX_* if you want to override this wrapper intentionally.
export CLAUDE_CODE_MAX_OUTPUT_TOKENS="${RUN_MINIMAX_MAX_OUTPUT_TOKENS:-2048}"
export CLAUDE_CODE_AUTO_COMPACT_WINDOW="${RUN_MINIMAX_AUTO_COMPACT_WINDOW:-65535}"

cd "$SCRIPT_DIR"
exec bun ./dist/cli.js  --model "$MODEL_ID" "$@"
