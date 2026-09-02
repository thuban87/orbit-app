# Phase 19 — "Your Week" — Deferred Slot Placeholder

- **Phase:** 19 (reserved slot) — "Your Week"
- **Dossier (ground truth):** none. Your Week has **no dossier**. This file records the slot and the
  inputs that must reach it.
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3 (E-04 and the Lane B orphan sweep),
  owner resolutions 2026-09-01

> Planning notes, not decisions. This is a placeholder, not a specification. Nothing here decides
> what Your Week is; it records what other phases have delegated **to** it, so the delegation is not
> lost.

---

## Why this file exists

The audit's Lane B orphan sweep found **"Your Week" named as an owner in four dossier decisions with
no phase slot anywhere in the roadmap map** (D-RM-014):

- D-04-025 and D-04-082 — richer birthday presentation belongs to Your Week
  (`phase-04…md:75,270`).
- D-05-013 and D-05-072 — "the Dashboard does not contain a permanent birthday/upcoming module…
  richer upcoming birthday content belongs to Your Week" (`phase-05…md:122-124`, :397).

That made it a **genuine orphan** (E-04): if the Dashboard birthday banner goes and Your Week does
not exist, the 7-day "reason to reconnect" surface disappears with nothing planned to replace it.
The slot now exists so the delegation has a destination.

## Inputs that must reach this phase

### 1. Birthdays, per the ADR-034 supersession

- ADR-034's Decision was: "The dashboard displays a seven-day, soonest-first birthday banner…", with
  "No banner or reserve space for a digest" among its **rejected** alternatives
  (`docs/decisions/ADR-034…md:18,22`).
- **Code facts (verified 2026-09-01):** `src/components/BirthdayBanner.tsx:40` (`WINDOW_DAYS = 7`),
  mounted at `HomeScreen.tsx:270`; the read is `listBirthdayCandidates`
  (`src/db/dashboard-read.ts:391-399`). **Digest has no birthday read at all** — grepping
  `src/db/digest-read.ts` and `src/screens/DigestScreen.tsx` for "birthday" returns nothing.
- **What this phase inherits:** the 7-day, soonest-first birthday surface, in whatever richer form
  Your Week takes. Read the ADR-034 supersession in `docs/decisions/` before planning — it, not this
  file, records what was ratified.
- Related existing state: `contacts.birthday`, the `birthdayEnabled` and `birthdayUnboundEnabled`
  settings (both in `PORTABLE_SETTINGS_KEYS`).

### 2. Group Events

- Phase 12 builds the Group Event parent, nullable `group_event_id` on child interactions, and
  per-field override/inheritance state (D-12-007/009/022/027) — **none of it exists today**
  (migrations 001–014 have no group table).
- **What this phase inherits:** an upcoming/recent Group Event rollup is a natural Your Week
  element. Phase 12 owns the schema and the write paths; Your Week reads them.
- **Constraint carried forward:** any interaction Your Week creates or edits still routes through
  `insertInteractionCore` / `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore`
  (`src/db/recency-dao.ts:159-214,258-346`; ADR-010/024/071), composing the cores in one
  transaction. The write mutex is non-reentrant.

### 3. Heatmap aggregation reuse

- Phase 11 builds the Cycles heatmap and History aggregation (D-11-053/054,
  `phase-11…md:275-281`); D-11-083 explicitly defers Analytics-style reuse.
- **What this phase inherits:** the aggregation layer, not a reimplementation of it. Reuse Phase 11's
  reads.
- **Constraint carried forward (R-15):** cadence-relative aggregation is **undefined for contacts
  with no cadence**. `interval_days` is nullable (`011-contact-lifecycle-schema.ts:22-23`) and
  `computeContactIntensity` returns `{available:false}` for Unbound (`src/utils/impact.ts:139`);
  ADR-062 requires every cadence consumer to guard nullable cadence. Whatever fallback Phases 10 and
  11 settle on applies here too — do not invent a third answer.

## Sequencing

- **Deferred.** This phase is not planned in milestone 2's build order.
- **Depends on:** Phase 11 (History aggregation), Phase 12 (Group Events), and the ADR-034 outcome
  for birthdays. It cannot be planned before those land.
- **Implies no schema of its own** as currently scoped — it is a read/aggregation surface. If
  planning discovers it needs a migration, that is a signal an upstream phase missed something.
- **If it is planned after Phase 16's format-4 backup bump**, and it *does* need durable state, that
  state will need its own bump — a strong reason to keep it read-only.
