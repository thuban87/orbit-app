# Milestone-2 Planning Notes — what these files are

**Date:** 2026-09-01 · **Source:** `oa-audit-dossiers milestone-2` run 3 (dry run, 2026-09-01) plus
the owner's resolutions of 2026-09-01.

## What these are

One file per milestone-2 phase (`phase-NN-planning-notes.md`), carrying that phase's **REPLAN**
findings and **STUB-CONTRACT** seams from the cross-dossier audit, with the owner's resolutions
folded in.

They exist because of a mechanical gap: GSD's `plan-phase` / `gsd-phase-researcher` read a phase's
own planning inputs, **not** `docs/dossier/milestone-2/audit/AUDIT-REPORT.md` (which is gitignored
and local to the audit run). Without these files the audit's schema, sequencing, and trip-wire
findings never reach the planner. See `../AUDIT-HANDOFF.md` for the intent behind the bridge.

## What these are NOT

**These are planning notes, not decisions.**

- The **dossier remains ground truth** for WHAT each phase delivers. Where a note and the dossier
  disagree, the dossier wins and the note is stale — re-read the dossier.
- ADRs in `docs/decisions/` and `HANDOFF.md` remain authoritative for decisions already recorded.
  Where an ESCALATE item was ratified, a **superseding ADR** is the record — not these notes.
- Nothing here originates a decision. Every "resolved path" below traces to either the owner's
  2026-09-01 resolutions or the audit report's recommended path for that finding.

## How `plan-phase` should consume them

1. Read the phase's **dossier** first, in full. It is the decision record.
2. Read this phase's notes file second, as an appendix of implementation/sequencing constraints
   the dossier does not own.
3. Treat **"Migration / sequencing"** as binding process, not suggestion: this repo's migration
   numbers drift every schema phase. **Never assume a migration number** — verify head+1 against
   `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` at plan time. Migration head
   at audit time was **14** (backup format **3**); it will have moved.
4. Treat every **trip-wire** as a stop-and-ask: a trip-wire marks a path that would reverse an
   Accepted ADR or a `HANDOFF.md` `[DECIDED]` item. Per `CLAUDE.md`, reversing a recorded decision
   is the owner's call, not the planner's — even when the trigger is purely technical.
5. Verify code facts before relying on them. Every `file:line` cite here was confirmed on disk by
   the audit orchestrator on 2026-09-01, but the code moves. Re-open the file.

## Files

| File | Covers |
|---|---|
| `phase-01-planning-notes.md` … `phase-14-planning-notes.md`, `phase-16-planning-notes.md` | one per planned milestone-2 phase |
| `phase-15-17-18-stub-contracts.md` | the deferred-phase contracts (Settings & Personalization, Onboarding, Responsive & Release Hardening) — a checklist for each eventual stub |
| `phase-19-your-week-placeholder.md` | the deferred "Your Week" slot and the inputs that must reach it |

Phases 15, 17, 18 and 19 have no dossier and are roadmap-deferred; their files are contracts and
placeholders, not phase notes.

## Cross-cutting rules that apply to every phase

- **Migration order is milestone-wide:** schema → consumers → backup wire-shape bump, in that
  order. The backup bump to format 4 is **Phase 16's final plan**, sequenced after all other schema
  in the milestone has landed (owner resolution, R-09).
- **All new durable preferences live in `app_settings` columns**, portable via the backup manifest
  (`PORTABLE_SETTINGS_KEYS`, `src/backup/backup-schema.ts:106-113`) — **not** AsyncStorage. This
  includes theme (owner resolution, R-16). Existing AsyncStorage prefs (`orbit-theme`,
  `orbit-dashboard-prefs`) are not portable today; migrating them is part of the owning phase.
- **Single recency writer:** any path that creates, edits, or deletes an interaction goes through
  `insertInteractionCore` / `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore`
  (`src/db/recency-dao.ts:159-214,258-346`; ADR-010/024/071), composing the *cores* inside one
  transaction — the write mutex is non-reentrant, so top-level writers must not be nested. A bulk
  `INSERT INTO interactions` leaves `last_contact` wrong.
- **AI egress gate (owner resolution, E-05):** a **per-interaction "Allow AI" toggle, default OFF**
  (surfaced by Phases 11/13, defaulted by Phase 16). **Group Notes are never sent**, with no toggle.
