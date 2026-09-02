# Phase 11 — Interaction History & Insights — Planning Notes

- **Phase:** 11 Interaction History & Insights
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-11-interaction-history-insights-dossier-v0.2-group-events.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

---

## Escalations resolved (how the dossier was amended)

**E-05 — the interaction-note AI permission gate was un-owned.**

- **Owner resolution (2026-09-01):** a **per-interaction "Allow AI" toggle, default OFF**, surfaced
  by **Phases 11 and 13** and defaulted by **Phase 16**. **Group Notes are never sent** — no toggle.
- Consequence for Phase 11: the Interaction **Detail / Edit** surfaces own the toggle's presentation
  and its edit path. Today **no per-interaction AI permission exists**, and AI context reads only
  `channel, quality, connected` from interactions — **never the note**
  (`src/db/ai-context-read.ts:114-120`). The gate must be built before any note can be transmitted.
- **Trip-wire:** widening what the AI feature transmits is an owner decision (`CLAUDE.md`). Shipping
  the toggle default-ON, or letting a Group Note through it, reverses the resolution → stop and ask.

**AUTO-FIX applied to this dossier:**

- **AF-04** — three stale "Phase 12" references meaning Rapid Capture are now **"Phase 13 (Rapid
  Capture & Update Flows)"** at :705, :787, :910 (D-11-128/143/165). In v0.2 "Phase 12" means Group
  Interaction Logging, which does **not** own the ordinary detailed logging form.
- **AF-06** — "quality/impact" replaced with **Tone** at :579, :670, :695 (D-11-108/121/124). This is
  **text sync only**; the data migration is R-03 below.

## REPLAN items for plan-phase

### R-03 — Tone replaces Quality, and Message/Call/In Person replaces the six-value channel vocabulary — a data migration

- **Unbuilt / needed:** Tone as the canonical field, null default, omitted ≠ Neutral
  (D-13-102…107, `phase-13…md:372-383`); the channel vocabulary exactly Message / Call / In Person
  (D-13-078/079, :297-302); legacy values may remain representable (D-13-082, :308).
- **Code facts (verified 2026-09-01):**
  - `quality` is nullable TEXT with UI values `good|fine|hard`
    (`src/components/TouchpointRefineForm.tsx:73`), consumed as **literals** in
    `src/db/ai-context-read.ts:130-134` and `src/db/digest-read.ts:158-161`, and serialized by
    backup (`src/backup/export-manifest.ts:52`).
  - `channel` UI values are `call|text|in-person|email|other|unspecified`
    (`TouchpointRefineForm.tsx:60-67`); **`interactions.channel` has no CHECK**.
  - **`interaction_assists.channel` does** have `CHECK(channel IN ('call','text','email'))`
    (`src/db/migrations/014-interaction-assists.ts:12`), and `markAssistLogged` copies that value
    into `interactions.channel` (`src/db/interaction-assist-dao.ts:98-111`).
- **Resolved path (owner, 2026-09-01):**
  - **Backfill mapping:** quality `good` → **Positive**, `fine` → **Neutral**, `hard` → **Negative**.
  - **Channel mapping:** `text` and `email` → **Message**; `call` → **Call**; `in-person` →
    **In Person**; `other` / `unspecified` **kept as legacy values**.
  - **The `interaction_assists.channel` CHECK stays** as the *transport* (`call`/`text`/`email`) and
    is **mapped to Message at log time** — no table rebuild of `interaction_assists`.
- **Constraints / trip-wires:**
  - Update **every literal consumer** of `quality` before or with the migration:
    `ai-context-read.ts:130-134`, `digest-read.ts:158-161`, the timeline row renderer, and the
    backup serializer. A partial rename produces silently wrong AI context and digest text.
  - Legacy `other` / `unspecified` must stay representable and renderable (D-13-082).
  - Migrations are forward-only and irreversible in production; a user may jump several versions in
    one update. Do not assume a starting state.

### R-04 — the optional interaction `duration` column is unbuilt

- **Unbuilt / needed:** D-11-132…139 (`phase-11…md:733-770`), plus D-12-018/024 and D-13-076/109.
- **Code facts (verified 2026-09-01):** no duration column on `interactions`
  (`011-contact-lifecycle-schema.ts:98-105`); not in the backup (`export-manifest.ts:52`).
- **Resolved / recommended path:** nullable **seconds**, plus reads, the Detail/Edit surfaces, the
  Group override state (Phase 12), and backup serialization (Phase 16's v4).

### R-12 — Bind/Unbind lifecycle events do not exist

- **Unbuilt / needed:** D-11-115 lists Archive, Restore, Snooze, Unsnooze, **Bind, Unbind** "where
  present" (`phase-11…md:619-628`).
- **Code facts (verified 2026-09-01):** `EventType = "archive" | "restore" | "snooze" | "unsnooze"`
  (`src/db/events-dao.ts:39`); snooze/unsnooze have producers
  (`src/db/snooze-dao.ts:103-110,136-143`); **bind/unbind have neither type nor producer** —
  `src/db/contact-lifecycle-dao.ts:62-98` writes no event. `events.type` is plain `TEXT` with **no
  CHECK** (`001-initial.ts:116-124`), so this is additive at the TS layer.
- **Resolved / recommended path:** add the two event types and **insert-only producers inside the
  existing bind/unbind transactions** (ADR-025 — lifecycle events are immutable and written in the
  same transaction as the state change).
- **Constraints / trip-wires:** the event write must be inside the bind/unbind transaction, not
  after it. Backup tombstone/entity validation already knows the `event` type; verify the new type
  strings pass restore validation.

### R-15 — Cycles heatmap is undefined for contacts with no cadence

- **Unbuilt / needed:** D-11-053/054 — each block is one *current* Contact Frequency cycle
  (`phase-11…md:275-281`).
- **Code facts (verified 2026-09-01):** `interval_days` is nullable; `computeContactIntensity`
  returns `{available:false}` for Unbound (`src/utils/impact.ts:139`); ADR-062 requires every cadence
  consumer to guard nullable cadence. Unbound profiles are reachable (D-04-085, D-05-059).
- **Resolved / recommended path:** define the fallback — hide the lens, or fall back to a fixed
  7 Days / Month window. Decide it **once**, with Phase 10's identical note.

### R-02 dependency — group-linked edit and delete paths

- Phase 11 owns interaction Detail/Edit/Delete. Once Group Events exist (Phase 12), a child
  interaction carries `group_event_id` and per-field override/inheritance state. Every edit and
  delete must still route through `editTouchpointFull` / `deleteTouchpoint` +
  `recomputeLastContactCore` (`src/db/recency-dao.ts:159-214,258-346`), composing cores inside one
  transaction. See `phase-12-planning-notes.md` for the full constraint set.

### R-16 — History lens and cycle preset are new durable preferences

- D-11-051/058. **Owner resolution:** `app_settings` columns, portable via the backup manifest —
  not AsyncStorage.

## Migration / sequencing

- Implies **one or more migrations**: the **Tone/channel data migration** (R-03), the nullable
  **`duration`** column (R-04), and the **per-interaction "Allow AI" column** (E-05, default OFF) —
  these all touch `interactions` and should be planned as one ordered sequence with Phase 13, whose
  log form is the other writer. **Decide once which of Phase 11 or 13 owns the `interactions`
  migration**; the other consumes it.
- Bind/unbind event types need **no migration** (`events.type` has no CHECK) — TS union + producers
  only.
- History lens / cycle preset preference columns go in `app_settings`.
- **No rebuild of `interaction_assists`** — the CHECK stays as the transport (owner resolution).
- **Number every migration head+1 at plan time**, verified against `src/db/migrations/` on disk.
  Head at audit time was 14.
- **Must land before:** Phase 16's format-4 backup bump (duration, Tone, Allow-AI, and group linkage
  must all be serializable).

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 18:** yearly heatmap rendering, wheel density/neighbor count, and History performance QA
  (D-11-092/098/156); reduced-motion QA (D-11-144) once Phase 2's hook exists.
- **Phase 19 / Your Week:** History aggregation is the reuse target for Your Week's rollups — see
  `phase-19-your-week-placeholder.md` (D-11-083 defers Analytics).
