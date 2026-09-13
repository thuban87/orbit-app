#!/usr/bin/env bash
#
# CAPT-15 legacy interaction-vocabulary straggler audit (Phase 34, Plan 02).
#
# Phase 32's migration 025 renamed the interaction `quality` VALUES to a Tone
# vocabulary (good->Positive, fine->Neutral, hard->Negative) and collapsed the
# `channel` VALUES to user-facing labels (text/email->Message, call->Call,
# in-person->In Person). The SINGLE legitimate place a raw legacy literal may be
# REMAPPED is src/db/interaction-vocabulary.ts (D-06); the migration files hold
# the frozen CASE literals + the assist transport CHECK. Every interactions
# writer/reader must compare/emit the MIGRATED literals, never the legacy ones.
#
# This audit fails ONLY on a NEW, unlisted legacy-value site (per 34-02 Review
# LOW). It is scoped by an EXPLICIT allowlist so it stays green on the legitimate
# sites and trips the moment a new interactions writer/reader reintroduces a
# legacy literal. It does NOT prove behavior on its own — the paired round-trip
# regression in src/db/interaction-vocabulary.test.ts asserts the mapping itself.
#
# Exit 0 = clean (no unlisted straggler). Exit 1 = a new straggler was found.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0

# Strip test files, fixtures, and comment/prose lines so header text describing
# the legacy values never self-invalidates the scan.
filter() {
  grep -vE '\.test\.|__fixtures__|/fixtures/' \
    | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)'
}

# ---------------------------------------------------------------------------
# Check 1 — QUALITY Tone stragglers (high signal).
# The legacy quality literals good/fine/hard are essentially unique to the
# interaction Tone vocabulary, so the allowlist is minimal: the one remap source
# and the migration files. ANY other occurrence anywhere in src/ is a straggler
# (this is the T-34-06 AI-egress guard — ai-context-read must not compare stale
# good/fine/hard).
QUALITY_ALLOW='^(src/db/interaction-vocabulary\.ts|src/db/migrations/)'
quality_hits="$(grep -rnE "['\"](good|fine|hard)['\"]" src --include='*.ts' --include='*.tsx' \
  | filter | grep -vE "$QUALITY_ALLOW" || true)"
if [ -n "$quality_hits" ]; then
  echo "FAIL: legacy quality Tone literal(s) outside interaction-vocabulary.ts / migrations/:"
  echo "$quality_hits"
  fail=1
fi

# ---------------------------------------------------------------------------
# Check 2 — CHANNEL stragglers in the interactions data layer.
# 'text'/'email' also name the reach-out TRANSPORT vocabulary (call|text|email)
# and 'email' names a contact-method type, so this check is scoped to the data
# layer (src/db + src/backup, where every interactions writer/reader lives per
# CLAUDE.md "queries go through DAOs") and allowlists the files where these
# literals are legitimate NON-interactions-value uses:
#   - interaction-vocabulary.ts : the one remap source (D-06)
#   - src/db/migrations/        : frozen CASE literals + transport CHECK
#   - interaction-assist-{dao,read}.ts : reach-out TRANSPORT vocab, remapped via
#       remapLegacyChannel before it is ever persisted into an interactions row
#   - contact-method / search / merge / reconcile / backup files : 'email' is a
#       contact-method TYPE here, unrelated to the interaction channel vocabulary
CHANNEL_ALLOW='^(src/db/interaction-vocabulary\.ts|src/db/migrations/|src/db/interaction-assist-(dao|read)\.ts|src/db/contact-methods-dao\.ts|src/db/contact-methods-read\.ts|src/db/contact-read\.ts|src/db/knowledge-search-read\.ts|src/db/merge-dao\.ts|src/db/reconcile-snapshot-dao\.ts|src/backup/backup-schema\.ts)'
channel_hits="$(grep -rnE "['\"](text|email)['\"]" src/db src/backup --include='*.ts' --include='*.tsx' \
  | filter | grep -vE "$CHANNEL_ALLOW" || true)"
if [ -n "$channel_hits" ]; then
  echo "FAIL: legacy channel literal(s) at a NEW unlisted data-layer site:"
  echo "$channel_hits"
  echo "If this is a genuine interactions writer/reader, route the value through"
  echo "remapLegacyChannel (src/db/interaction-vocabulary.ts) — do NOT add a migration."
  echo "If it is an unrelated legitimate use, add the file to CHANNEL_ALLOW above."
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "OK: no unlisted legacy interaction-vocabulary straggler (CAPT-15)."
fi
exit "$fail"
