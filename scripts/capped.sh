#!/usr/bin/env bash
# Runs a command under a memory cap where the system can give one (systemd on Linux), so a runaway
# test run dies alone instead of taking the machine down: a failing component test in this suite
# has sent `bun test` past 29 GB. Elsewhere the command runs as it is.
set -e
if command -v systemd-run >/dev/null 2>&1 && systemd-run --user --scope -q -p MemoryMax=6G true 2>/dev/null; then
  exec systemd-run --user --scope -q -p MemoryMax=6G "$@"
fi
exec "$@"
