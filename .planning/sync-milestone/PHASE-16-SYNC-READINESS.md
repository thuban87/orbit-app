# Phase 16 — Sync-Readiness Changes (stays in v1.0)

**Status:** proposed changes to the *existing* Phase 16, not yet folded into `ROADMAP.md`.
**Context:** Only Phases 15 and 16 remain in v1.0. Phase 15 (Weekly Digest) is **unaffected** — no
schema, no network, pure read-surface. All sync-readiness pressure lands on Phase 16.
**Companion:** `SYNC-MILESTONE-INVESTIGATION.md` (the v2.0 milestone).

---

## The core insight

Phase 16 as already specced is **most of a sync-lite reconciliation engine**. Its current success
criteria already include:

- One-file export with a `user_version` manifest + forward-migrate on restore.
- **Merge = newest-`modified_at`-wins, keyed on `uid`.**
- **Recompute `last_contact` after merge** (not merge it as a scalar).
- **Recreate custom-field columns from `custom_field_defs`** on restore.
- Optional AES-256-GCM at rest.

That is the same shape multi-device sync needs. So the goal here is **not to expand Phase 16 into sync
work** — it's to make the merge logic *correct and reusable* and to close the one hole that is expensive
to retrofit later: deletions.

Ship Phase 16 in v1.0. It's needed regardless (loss backstop + anti-lock-in pillar). Build it so v2.0
reuses its reconciliation core instead of writing a second one.

---

## Change 1 — Tombstones (the one real addition) ⭐

**Problem, today, independent of sync:** `purgeContact()` is a hard `DELETE` of the contact + all
children in one transaction, leaving **no record**. Merge restore is uid-keyed newest-wins. So:

> back up → purge a contact → Merge-restore an older backup → **the purged contact comes back.**

This is a resurrection bug in v1.0's own Merge, not a hypothetical sync problem. Tombstones fix it here
*and* are the single most expensive-to-add-later sync primitive.

**Proposed:**
- New **migration 006**: a `sync_tombstones` (name TBD) table — `entity_type`, `entity_uid`,
  `deleted_at`, and room for `revision` / `device_id` later (v2.0 may widen it; keep it additive-safe).
  *(Renumbered 005 → 006 on 2026-08-23: Phase 15 (Weekly Digest) ships first and now owns migration 005 —
  `app_settings.digest_enabled` — per owner ruling reconciling the digest toggle's persistence with the
  dossier "no new schema" line. Migrations are forward-only and ordered by ship sequence, so the digest
  takes 005 and tombstones take 006.)*
- `purgeContact()` writes a tombstone row **in the same transaction** as the hard delete (every
  purged entity, or at least the contact uid — decide granularity; contact-level is likely enough since
  children go with it).
- **Merge restore respects tombstones:** a uid with a tombstone newer than the backup's row is not
  resurrected; a backup row newer than a tombstone still restores (last-write-wins extends to deletes).
- **Export includes tombstones**; forward-migrate handles a tombstone-less older backup gracefully.

**Scope note:** this touches shipped Phase-4 purge code + adds a migration. Pre-release, so acceptable.
Recommend it as **Phase 16 wave 0** (before the export/merge waves), or a tiny standalone phase if you'd
rather keep 16 purely user-facing — I lean toward folding it in, since correct Merge *requires* it.

---

## Change 2 — Extract the Merge logic as a documented reconciliation core

**Not new behavior — new packaging.** Write the merge rules as a standalone, documented module (with
its own tests) rather than as backup-private code, and state the rules explicitly so v2.0's sync engine
consumes the same module:

1. **Key on `uid`**, never local integer `id`.
2. **Scalar contact metadata: last-write-wins by `modified_at`** (name, birthday, email, interval,
   category, flags).
3. **Child rows (interactions, events, fuel, links, custom values): additive** — union by uid, never
   overwrite the set.
4. **Derived columns are recomputed, never merged** — `last_contact` = MAX over merged interaction rows,
   through the single-writer DAO. (Already in the spec; make it a named rule.)
5. **Respect tombstones** (Change 1).
6. **Resolve child→parent by parent `uid`**, mapping to the local integer `id` at apply time.

Rules 1–4 are effectively already required by the current criteria; 5 is new (Change 1); 6 is worth
making explicit now because it's the same resolution sync needs (`SYNC-MILESTONE §B.4`).

---

## Change 3 — Be conscious of device-local vs shared (light touch)

For *backup/restore* you generally want to restore everything, so this is mostly a **labeling** task, not
a behavior change — but do it now so v2.0's sync partition isn't guesswork:

- Export already **excludes** secure-store keys and `field_history` (correct).
- Note in the backup manifest / code which rows are inherently **device-local** and would *not* sync
  later: `app_settings` (no `uid`), `ring_seq`, favourites order, `snooze_until`, notification schedule,
  widget config. Backup still restores them; sync (v2.0) will treat them differently.
- **Do not** bake an assumption into the Merge core that every row is globally shared — keep it row-set
  agnostic so §B.7's partition can be applied later without a rewrite.

---

## Change 4 — Keep the two encryption concerns separate

- Phase 16's **AES-256-GCM backup-at-rest passphrase** and the future **E2EE sync key** (v2.0, D0.4)
  are different keys with different lifecycles. Don't let Phase 16 build anything that presumes they're
  the same. A one-line note in the backup design prevents a painful entanglement later.

---

## Explicitly NOT changing in Phase 16

- **Custom-field storage stays the §14 dynamic-column design.** Restore already recreates columns from
  defs — correct and sync-neutral. Whether that design survives Turso sync is a v2.0 spike
  (`SYNC-MILESTONE §A.5/§B.6`), **not** a Phase 16 rewrite. Reversing §14 is an owner call gated on
  spike evidence, not something to pre-empt here.
- **No sync-ordering clock / server-revision column** added now. `modified_at` (localtime) is fine as
  the Merge tiebreaker for single-user backup. v2.0 revisits the global-ordering authority (`§B.5`).
- **No network anything.** Phase 16 is still fully local (SAF file I/O only).
- **Phase 15** — untouched.

---

## Decisions for you on Phase 16

| # | Decision | My lean |
|---|----------|---------|
| P1 | Tombstones: fold into Phase 16 (wave 0) vs a tiny standalone pre-phase | Fold into 16 — correct Merge requires it. |
| P2 | Tombstone granularity: contact-level only vs per-entity | Contact-level likely enough for backup; leave the column shape open for v2.0 to widen. |
| P3 | Frame Phase 16 as "backup feature" only, or "backup + documented reconciliation core" | The latter — same work, reused by v2.0. |
| P4 | Do we edit `ROADMAP.md` Phase 16 now to reflect this, or keep it in this doc until you've reviewed | Your call — I'll fold it into the roadmap on your word (it's a committed-roadmap edit, so I'm holding). |

---

## If you greenlight the roadmap edit

I'd update the Phase 16 block in `ROADMAP.md` to: add a wave-0 tombstone/migration-006 item, add a
fourth success criterion ("purge leaves a tombstone; Merge does not resurrect tombstoned uids"), and add
a one-line note that the Merge module is the reconciliation core for the future sync milestone. Nothing
else in the roadmap changes; Phase 15 stays as-is.
