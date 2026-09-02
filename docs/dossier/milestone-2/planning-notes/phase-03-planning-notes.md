# Phase 03 — Contact Knowledge Foundation — Planning Notes

- **Phase:** 03 Contact Knowledge Foundation
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-03-contact-knowledge-foundation-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

**This is the milestone's largest schema cluster and it gates Phases 4, 6, 7, 10, 13, 14 and 16.**

---

## Escalations resolved (how the dossier was amended)

**E-05 — AI egress widening (ADR-050's closed allowlist, ADR-036's Compose guardrail) and the
un-owned interaction-note permission gate.**

- **Owner resolution (2026-09-01):** a **per-interaction "Allow AI" toggle, default OFF**, owned by
  Phases 11 and 13 for surfacing and Phase 16 for defaults. **Group Notes are never sent** — no
  toggle, no exception.
- Consequence for Phase 3: the phase's **per-item AI permission model for knowledge items**
  (D-03-039…046, default OFF per type) is the sibling of that gate and must be built here. Today
  there is **no per-item AI permission column** on `fuel` at all; egress is decided by `kind` /
  `source` in SQL (`src/db/fuel-read.ts:133-141` excludes `off_limits` everywhere), and
  `share_with_ai` exists **only per custom-field definition**.
- The **Off Limits transmission** half of E-05 (D-03-051, `phase-03…md:125`; D-16-100/101;
  D-14-076) touches ADR-050's explicit "never … off-limits fuel" and ADR-036's rejected
  "UI-side privacy filter". **That outcome is recorded in the dossier and in `docs/decisions/`, not
  here** — check for a superseding ADR before planning any change to `fuel-read.ts`'s exclusions.
  If none exists, the SQL-level exclusion stands.

## REPLAN items for plan-phase

### R-01 — The Contact Knowledge model is almost entirely unbuilt

- **Unbuilt / needed (claims vs disk, all verified 2026-09-01):**

  | Dossier claim | On disk |
  |---|---|
  | Memory-type registry with metadata (D-03-006) | none |
  | Generic Custom type + label (D-03-005/007) | fixed 5 kinds `recent/topic/fact/gift/off_limits` (`src/db/fuel-dao.ts:43`, ADR-028) |
  | Optional note / meaningful date (D-03-033/035) | none — only immutable `created_at` |
  | Pinning (D-03-030) | none |
  | Profile visibility / hidden (D-03-023/024) | none |
  | Outdated / inactive (D-03-027) | none |
  | Soft-delete + Recently Deleted (D-03-028/029) | hard `DELETE` + tombstone (`fuel-dao.ts:228-250`) |
  | Provenance (D-03-037) | `source` string only |
  | Relationships table w/ optional linked contact (D-03-013/014) | **none** — Phase 8's "existing structured relationship model" (D-08-104/142) does not exist |
  | Last Talked About history (D-03-009…011) | none |
  | Current Location + history (D-03-019) | none |
  | Per-item AI permission, default OFF + type defaults (D-03-041/043) | none per item |
  | Imported phone notes as a Memory (D-03-062) | the native picker never reads the Note MIME type and the importer writes no note (`android/.../OrbitContactPickerModule.kt:92-95,234-246`; `src/db/imported-contact-dao.ts:108-187`) |
  | Search over Memory labels/notes/relationships/custom fields (D-03-025, D-04-050) | name + eligible `fuel.text` only (`src/db/dashboard-read.ts:230-240`) |

- **Resolved path (owner, 2026-09-01):**
  1. **Phase 3 owns the Recently Deleted / Trash surface for Memories** (D-03-029). It was a genuine
     orphan in the audit; it is no longer. Plan the soft-delete state, the restore path, and the
     retention sweep here.
  2. **Share-sheet captures become Memories of the default type.** Today the share intent writes
     `fuel kind='topic', source='share'` (`src/db/capture-dao.ts:43-55`,
     `src/screens/CaptureScreen.tsx:276`; ADR-037/038). The Phase 3 migration must carry those rows
     onto the new model as default-type Memories.
  3. **The never-finished AI-proposed-fuel path (ADR-030, `source='ai'` confirm flow) is retired by
     the Phase 3 migration.** Plan the removal of its rows/paths explicitly and record it, since
     ADR-030 is Accepted — retirement here is the owner's decision, executed by this migration, and
     should be reflected in a superseding ADR.
- **Constraints / trip-wires:**
  - **ADR-028 trip-wire.** A Custom type with a *user label* does not reverse ADR-028's fixed kinds
    **only if the kind set stays application-owned**. Write that boundary into the plan.
    **User-created system types would reverse ADR-028 → ESCALATE.** Phase 3 already defers them
    (D-03-078).
  - "Memory" is the type name Phase 3 keeps (D-01-063/075) — confirm as final with the owner before
    naming schema after it. The **default/general built-in Memory type name** (D-13-060, D-RM-056,
    D-13-190) is an open owner reconciliation item and is **needed before Phase 13 planning**.
  - Nothing watches a timestamp: any Trash expiry or history retention runs as a **launch sweep**,
    never a background timer (`CLAUDE.md`, `HANDOFF.md` §14).
  - Every destructive operation snapshots to `field_history` inside the same transaction for
    custom-field work (see R-08).

### R-08 — Custom fields: URL/Email/Phone types, history-retained values, groups, per-contact one-off definitions, promotion — all unbuilt (consumed by 10 and 13)

- **Unbuilt / needed:** D-03-054…058 (`phase-03…md:132-140`).
- **Code facts (verified 2026-09-01):**
  - `FieldType` has **7** members — no URL / Email / Phone (`src/schemas/types.ts:20-27`;
    `src/utils/field-parsers.ts:44-91`). ADR-014 requires "exactly seven parsers"; going to ten is
    **additive** and still one parser per type.
  - `custom_field_values UNIQUE(contact_id, field_def_id)` (`006-normalize-custom-field-values.ts:41-51`)
    — **one current row per pair**.
  - `field_history` is `contact_id, field_col_name, old_value, operation, created_at`, written only
    on destructive ops, pruned at 30 days, **has no reader**, and is **excluded from backup**
    (`001-initial.ts:155-163`; `src/services/field-sweep.ts:126-131`;
    `src/backup/export-manifest.ts:13`). **It cannot host a value timeline.**
  - No group column, no per-contact scope column, no promotion logic (`001-initial.ts:127-142`).
- **Resolved / recommended path:** history-retained custom fields need a **new additive
  value-history table**, not a relaxation of the existing constraint and not `field_history`.
- **Constraints / trip-wires:**
  - **ESCALATE trip-wire:** any plan that relaxes `UNIQUE(contact_id, field_def_id)` **reverses
    ADR-001** → stop and ask the owner. Same for `custom_field_values.uid UNIQUE`.
  - Per-contact one-off definitions change ADR-013 / `HANDOFF.md` §14's "one global definition row
    per field, seeded for every contact" (`src/db/field-ddl.ts:79-91`,
    `src/db/contacts-dao.ts:196-207`). A **scope column is additive**, but **the seeding writers
    must change** — enumerate them before planning.
  - Route every sort/filter on a custom field through the single `sortExpr()` helper; never
    interpolate an identifier into ORDER BY.
  - `custom_field_values.value` stays raw TEXT; never rewrite it to satisfy a type. Type changes
    never destroy data — failing values are flagged, not coerced.

### R-10 — "Reasonable typo tolerance" and knowledge-wide search vs ADR-031/032's deliberate LIKE-only, no-FTS5 model

- **Unbuilt / needed:** D-04-052…059 (`phase-04…md:174-196`); Phase 3 owns the **searchable corpus**
  that Phase 4 queries.
- **Code facts (verified 2026-09-01):** exact substring `LIKE ? ESCAPE '\'` over `contacts.name` +
  eligible `fuel.text`, ordered by the active sort and **never by relevance**
  (`src/db/dashboard-read.ts:230-240`). ADR-031 **rejected FTS5**.
- **Resolved path (owner, 2026-09-01):** typo tolerance = **TypeScript scoring over the
  already-filtered eligible set** — prefix/substring **plus edit distance ≤ 1 per term (≤ 2 for
  terms of six or more characters)**. **No FTS5. No new index.**
- **Constraints / trip-wires:** implementing this via FTS5 would reverse ADR-031 → ESCALATE. The
  SQL stays the eligibility filter; scoring happens in TS over what SQL already returned. Phase 4
  consumes; Phase 3 must expose the corpus (Memory labels/notes, relationships, custom fields) that
  the eligibility filter can see.

## Migration / sequencing

- **The largest migration cluster in the milestone.** Implies (at minimum):
  - new tables for **memories** (or the reshaped `fuel`), **relationships**, **location history**,
    **Last-Talked-About history**, and the **Memory type registry**;
  - **soft-delete / pin / visibility / per-item AI permission / note / meaningful-date** columns;
  - custom-field additions: three new field types, a **new value-history table**, a **group**
    column, a **scope** column (R-08);
  - the **share-capture carry-over** and the **ADR-030 AI-proposed-fuel retirement** (owner
    resolution).
- Whether this is one migration or several is the plan's call; **it must be a strictly ordered
  forward-only sequence** and must not assume a starting state.
- **Number every migration head+1 at plan time**, verified against `src/db/migrations/` on disk.
  Head at audit time was **14**. Do not carry a number forward from these notes.
- **Must land before:** Phases 4 (search corpus), 8 (satellites depend on relationships existing —
  Phase 3 correctly precedes 8 in D-RM-062), 10 (TTR sections), 13 (Update Contact / Memory editor),
  14 and 16 (AI context contents).
- **Must land before the backup bump:** every new entity here must be serializable by Phase 16's
  format-4 plan (R-09). Declare the entity list in this phase's plan so Phase 16 can consume it.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** the audit listed Recently Deleted / Trash as a *possible* Phase 15 owner. **That is
  retired** — the owner assigned Trash to Phase 3. Phase 15 keeps only the AI permission
  *management* routing (via Phase 16) and Contacts Administration.
- **Import / Backup / Sync:** imported phone notes as a Memory requires the native picker to read
  the Note MIME type — a real code change in `OrbitContactPickerModule.kt`, not a mapping. Backup
  fidelity is Phase 16's format-4 bump. Sync is out of milestone (D-RM-006).
