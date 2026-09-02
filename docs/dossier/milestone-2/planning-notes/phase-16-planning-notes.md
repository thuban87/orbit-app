# Phase 16 — AI Configuration & Prompting — Planning Notes

- **Phase:** 16 AI Configuration & Prompting
- **Dossier (ground truth):** `docs/dossier/milestone-2/phase-16-ai-configuration-prompting-dossier.md`
- **Date:** 2026-09-01
- **Source:** planning notes from `oa-audit-dossiers` run 3, owner resolutions 2026-09-01

> Planning notes, not decisions. The dossier is ground truth; ADRs and `HANDOFF.md` are
> authoritative for recorded decisions. Verify every code cite on disk — cites were confirmed
> 2026-09-01.

**Phase 16 carries an extra responsibility this milestone: it owns the backup wire-shape bump to
format 4, as its final plan, sequenced after all other schema has landed (owner resolution, R-09).**

---

## Escalations resolved (how the dossier was amended)

**E-05 — AI egress beyond ADR-050's closed allowlist and ADR-036's surface guardrail.**

- **Owner resolution (2026-09-01):** a **per-interaction "Allow AI" toggle, default OFF** — Phases
  11 and 13 surface it, **Phase 16 owns the defaults**. **Group Notes are never sent**, with no
  toggle. This settles the previously **un-owned** gate behind D-16-105 ("only where its AI/privacy
  permission semantics permit it").
- **Code facts (verified 2026-09-01):** AI context reads only `channel, quality, connected` from
  interactions — **no note** (`src/db/ai-context-read.ts:114-120`); `off_limits` is excluded in SQL
  everywhere (`src/db/fuel-read.ts:133-141`); **no per-item AI permission column exists on `fuel`**;
  `share_with_ai` exists only per custom-field **definition**.
- The **Off Limits as avoidance constraints** half (D-16-100/101, `phase-16…md:618-626`) and the
  three-most-recent-Interactions context (D-16-103/105, :634-646) touch ADR-050's two explicit
  "never" clauses and ADR-036's rejected UI-side privacy filter. **That outcome is recorded in the
  dossier and `docs/decisions/`, not here.** Confirm a superseding ADR before widening
  `PromptContext`; per `CLAUDE.md`, "any change that widens what that feature transmits is an owner
  decision".

**E-06 — the exact-prompt first-send acknowledgement.** D-16-135/137 (:805-816) replace ADR-052's
"durable first-send acknowledgement of the exact prompt" with a lightweight disclosure, review
available on demand. Code: the exact-prompt gate is live at
`src/services/ai-suggestion-logic.ts:223-235`, with per-provider `ai_ack_*` columns (migration 004).
Phase 10's removal of the Profile AI-draft entry (D-10-016) is the other half.
**The outcome is recorded in the dossier and `docs/decisions/`, not here.**

## REPLAN items for plan-phase

### R-07 — the AI master toggle, three-lane multi-connection model, OpenRouter, Personalization Context, Writing Style, and permission defaults are all unbuilt

- **Unbuilt / needed:** D-16-006 (master toggle); D-16-018/019/044 (one active connection, many
  stored, per-connection model); D-16-014/031 (OpenRouter browser auth); D-16-051/053/089 (pricing);
  D-16-068/071 (Writing Style, sections); D-16-116 (permission defaults).
- **Code facts (verified 2026-09-01):**
  - **No `ai_enabled` column** — `provider='none'` is the sole disable
    (`src/services/ai-types.ts:23-28`; `src/services/AiService.ts:599-602`).
  - One SecureStore item per **fixed** provider, **no bulk accessor**
    (`src/services/ai-key-store.ts:27-32`).
  - Single `ai_provider` / `ai_model` / `ai_custom_*` columns (migration 004) — no multi-connection
    storage.
  - **Zero** hits for `openrouter`, `WebBrowser`, or `AuthSession` in `src/` or `package.json`.
  - The model catalog reads **no pricing fields** (`src/services/model-catalog-filter.ts:19,70-78`).
  - The prompt template is a user "style note" inside a fixed prompt
    (`src/services/prompt-template.ts:36-42`), and truncation is disclosed only on the first ack —
    D-16-083 assumes more.
- **Edit points adding OpenRouter as a fixed provider touches (enumerate in the plan):** the closed
  `AiProviderId` union, a new `ai_ack_<id>` column, the **exhaustive `never` switch** in
  `acknowledgeProvider`, `PROVIDER_NAMES`, `token-budget`, and `CatalogProvider`.
- **Constraints / trip-wires:**
  - OpenRouter adds a **new egress host** and a **browser-OAuth path** — a security-posture item.
    It is already decided in the dossier (D-16-014); do not widen it further without asking.
  - **ADR-049 ("keys only in SecureStore") is honored** by D-16-013/033 — keep it that way. API keys
    must never land in `app_settings` or in the backup.
  - ADR-051's egress guards are confirmed present; there is **no host-allowlist structure** —
    adding one is additive, removing a guard is not.

### R-09 — Backup/Restore must serialize every new milestone-2 entity, and Phase 16 owns the bump

- **Unbuilt / needed:** eight dossiers assert "Backup/Restore preserves X" (D-03-064, D-09-132,
  D-10 via managers, D-11-155, D-12-124, D-16-149, D-GE-003; D-07-063 routes import there too), yet
  no phase owned the wire-shape change.
- **Code facts (verified 2026-09-01):** `BACKUP_FORMAT_VERSION = 3` (`src/backup/types.ts:14`);
  format 3's entity set is at `src/backup/export-manifest.ts:45-81`. **None** of duration, group
  events, orrery systems, profile templates, personalization, memories/relationships/location are
  present. Theme and dashboard prefs live in AsyncStorage and are **not portable**.
- **Resolved path (owner, 2026-09-01):** **the format bump to v4 is folded into Phase 16 as its
  final plan, sequenced after all other schema lands.** It must serialize every entity the milestone
  added and every new `app_settings` key.
- **Constraints / trip-wires:**
  - **Sequencing is the whole point:** this plan runs **last**. If it runs before another phase's
    schema lands, format 4 ships incomplete and a second bump is needed — which users cannot be
    given retroactively.
  - Carry in **Phase 12's validation and orphan-repair rules** (D-12-126/127) and **Phase 16's
    "never falsely Ready after restore"** (D-16-151).
  - Secrets stay out of the backup (ADR-049); `SECRET_SHAPED_KEY` screening in
    `src/backup/backup-schema.ts` must still reject anything key-shaped.
  - Every new portable preference must be added to `PORTABLE_SETTINGS_KEYS`
    (`backup-schema.ts:106-113`); every **retired** key (E-01's Manage-favourites, E-02's
    `includeUnboundNeverContacted`) needs a decided restore-compat behavior, not a silent drop.

### R-16 — persisted preferences across the milestone

- **Resolved path (owner, 2026-09-01):** **all new durable preferences, including theme, live in
  `app_settings` columns**, portable via the backup manifest — **not AsyncStorage**.
- Phase 16's own items: **AI Enabled** and the **permission type-defaults** (D-16-006/116),
  including the per-interaction Allow-AI default (**OFF**, E-05).
- Phase 16, as the owner of the format-4 bump, is the natural place to **verify the whole
  inventory** landed portably: theme package/accent/background (Phase 2), dashboard population/view/
  sort (Phase 4), right-swipe (Phase 6), orrery density/satellites/last-active System (Phases 8/9),
  History lens + cycle preset (Phase 11), Channel preference + remembered (Phase 13), Compose mode +
  remembered (Phase 14).

## Migration / sequencing

- Implies **at least two migrations**:
  1. AI configuration — master toggle, multi-connection storage (definitions + active pointer),
     per-connection model, personalization context, writing style, permission defaults, and the
     OpenRouter provider's `ai_ack_<id>` column.
  2. Any remaining `app_settings` preference columns Phase 16 owns.
- Plus the **backup format-4 bump**, which is a code/wire-shape change plus whatever restore-path
  migration it requires — **the last plan in the milestone**.
- **Number every migration head+1 at plan time**, verified against `src/db/migrations/` on disk.
  Head at audit time was 14 with `BACKUP_FORMAT_VERSION = 3`.
- **Must land after:** every other schema-bearing phase — 3 (knowledge + custom fields), 8/9
  (orrery), 10 (profile templates), 11/13 (interactions: Tone/channel/duration/Allow-AI), 12 (group
  events), plus the preference columns from 2, 4, 6, 14.

## Stub-contract seams exported to Phases 15/17/18/Your Week

- **Phase 15:** the AI management hierarchy, including the **AI-Off escape hatch**, reached as
  **routes into the canonical surfaces Phase 16 builds**, not reimplementations
  (D-16-009/010/124…126/159, D-RM-065, D-MH-014).
- **Phase 17:** may promote **OpenRouter** as the recommended connection and explain the data flow;
  it does **not** redefine the architecture and must respect AI's optional posture (D-16-030/162).
- **Phase 18:** wire the **sanitized AI diagnostic seam** into Sentry, preserving the
  no-private-content boundary (D-16-142…148/161/177).
