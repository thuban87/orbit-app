# ADR-116: Value-Remapped Interaction Vocabulary and Optional Descriptive Duration

**Status:** Accepted
**Date:** 2026-09-02
**Phase:** 32-interaction-history-insights
**Source decisions:** D-03, D-06, D-12 (32-CONTEXT.md) from dossier §D-06, §Y
**Reversibility:** one-way
**Migration:** 025
**Supersedes:** ADR-023 (partial — the stored channel/quality value vocabulary)
**Superseded by:** None

## Context

The interaction record used the plugin-era value vocabulary — `quality` of `good|fine|hard` and a six-value `channel` (`call|text|in-person|email|other|unspecified`) — which reads poorly as relationship history and offers no place to record how long an interaction lasted. Renaming the vocabulary safely is hard: `quality`/`channel` are compared as literals in several readers and serialized by backup, so a partial rename silently corrupts AI context and digest text.

## Decision

Migration 025 (forward-only, irreversible, owner-authorized) re-maps the stored **values** in place: `quality` `good→Positive, fine→Neutral, hard→Negative`; `channel` `text`/`email`→`Message`, `call`→`Call`, `in-person`→`In Person`, with `other`/`unspecified` kept as representable legacy values and `NULL` untouched. The SQL **column names stay `quality`/`channel`** (a locked invariant so export/restore keep round-tripping without a backup-format bump). It also adds nullable `interactions.duration` (canonical seconds, absent → `NULL` never `0`; presented as minutes/hours, excluded from Quick Log and from every Status/Gravity/Intensity calculation). One canonical remap (`interaction-vocabulary.ts`) is the single source of truth; the migration's CASE arms are frozen literals test-pinned equal to that helper but never importing it at upgrade time; every live literal consumer ships in the same commit as the migration (the D-06 trip-wire).

## Alternatives Considered

- **Rename the SQL columns to `tone`/etc.** — Rejected because it would force an export-manifest/restore-apply change and a backup-format bump for no storage benefit.
- **Rebuild the `interactions` table** — Rejected as unnecessary and risky; an additive `ALTER`+`UPDATE` remap survives a jump from any legacy version.
- **Duplicate the remap inside the migration** — Rejected; a second copy can diverge from the live readers, so the migration pins a frozen copy against the shared helper instead.
- **Store duration in minutes** — Rejected; canonical seconds keeps arithmetic exact and defers unit presentation to the UI.
- **Rebuild `interaction_assists`** — Rejected; its `CHECK(channel IN ('call','text','email'))` stays as the transport and is mapped to `Message`/`Call` at log time.

## Consequences

### Positive

- History, AI context, and digest all read one coherent Tone / Message-Call-In Person vocabulary, and interactions can carry an optional duration.
- Restore and the assist writer consume the same remap, so no writer can reintroduce a retired value.

### Negative

- Migration 025 is irreversible on devices we cannot reach; a wrong mapping is permanent.
- The column names `quality`/`channel` now disagree with their user-facing labels (Tone / channel), a documented invariant future edits must not "fix" by renaming.

### Risks

- A new literal consumer of `quality`/`channel` that uses the retired vocabulary would silently miscount; the single-source map plus the same-commit lockstep is the mitigation.

## Implementation

**Key files:**
- `src/db/migrations/025-interaction-history-schema.ts` — the additive `ALTER`+`UPDATE` value remap and duration column; frozen CASE arms.
- `src/db/interaction-vocabulary.ts` — the single canonical `remapLegacyQuality`/`remapLegacyChannel` map.
- `src/db/database.ts` — registers migration 025 at `TARGET_VERSION` 25.
- `src/db/recency-dao.ts` — writes `duration` through the sole recency writer (insert + `editTouchpointFull`).
- `src/db/ai-context-read.ts` — Tone-literal aggregate, lockstepped in the migration commit.
- `src/db/digest-read.ts` — the gentle-line count over the migrated Tone vocabulary.
- `src/db/interaction-assist-dao.ts` — `markAssistLogged` remaps the transport channel at log time.
- `src/ai/prompt-types.ts` — the Tone literals used in prompt context types.
- `src/components/TouchpointRefineForm.tsx` — Tone chips, three-channel labels, and the optional Duration control.
- `src/components/touchpoint-refine-logic.ts` — pure duration-preset shaping logic.

**Depends on:** ADR-023 (Structured Touchpoints and One-Tap Defaults); ADR-010 (Single-Writer Interaction Recency Spine); ADR-009 (Crash-Safe Forward-Only SQLite Migrations)
**Required by:** ADR-130 (Durable Scoped Default Interaction Channel); ADR-132 (Focused Rapid Capture Workflows)
