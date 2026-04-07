#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MODEL_ID="${CCR_MODEL_ID:-MiniMax-M2.5}"

export PATH="$HOME/.local-bun/node_modules/.bin:$HOME/.local/bin:$PATH"

if ! command -v ccr >/dev/null 2>&1; then
  echo "ccr not found in PATH. Expected it at $HOME/.local/bin/ccr." >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found in PATH. Expected it under $HOME/.local-bun/node_modules/.bin." >&2
  exit 1
fi

if ! ccr status >/dev/null 2>&1; then
  echo "Starting Claude Code Router..." >&2
  ccr start >/dev/null
  sleep 2
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
exec bun ./dist/cli.js --model "$MODEL_ID" "$@"
