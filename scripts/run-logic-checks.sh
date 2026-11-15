#!/usr/bin/env bash
# Runs every logic check in several time zones (DST matters for the date rules).
# Usage, from the project root:  bash scripts/run-logic-checks.sh
# Needs `npx tsx` (downloaded on first use; it is not a project dependency).
set -u
status=0
for tz in Asia/Jakarta America/New_York Europe/London Pacific/Auckland America/Sao_Paulo; do
  for f in scripts/batch2-logic-check.ts scripts/batch3-logic-check.ts scripts/batch4-logic-check.ts scripts/batch5-logic-check.ts; do
    result=$(TZ="$tz" npx --yes tsx "$f" 2>&1 | tail -1)
    echo "$tz  $(basename "$f" .ts): $result"
    case "$result" in *" 0 failed"*) ;; *) status=1 ;; esac
  done
done
[ $status -eq 0 ] && echo "ALL LOGIC CHECKS PASSED" || echo "SOME LOGIC CHECKS FAILED"
exit $status
