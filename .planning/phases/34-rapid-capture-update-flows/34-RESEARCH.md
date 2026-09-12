# Phase 34: Rapid Capture & Update Flows - Research

**Researched:** 2026-09-12
**Domain:** React Native / Expo on-device SQLite — capture/update UX over the interaction recency spine + Contact Knowledge model
**Confidence:** HIGH (every code claim below opened on disk this session; file:line + verbatim quotes given)

## Summary

Phase 34 delivers the four ordinary capture/update surfaces — streamlined Add Contact, immediate Quick Log (+ post-log note/Memory), detailed Log Interaction, and the Update Contact chooser loop — plus the Edit Contact accordion and Memory-editor seams they touch. It is almost entirely **UI/logic composition over infrastructure that already exists**. The interaction recency spine, the migrated Tone/channel vocabulary, the per-interaction `allow_ai` gate, the `duration` column, and every literal data-consumer of `quality`/`channel` were **already shipped by Phase 32 (migration 025)** and Phase 33 (migration 026). This is the single most important finding for the planner, and it resolves D-07.

**The biggest planning risk is over-scoping.** CAPT-15 ("the legacy vocabulary migrates … every literal consumer updated in the same change") reads like new schema work, but it is **already done** — re-issuing an `interactions` data migration would put a second, redundant vocabulary UPDATE on the shared table. The genuinely-new work is: (1) channel-sensitive Direction/Connected defaulting, (2) the Default Interaction Channel preference (one new `app_settings`-backed pref + its remembered value), (3) restructuring Add Contact into 3 sections + Show More, (4) the Edit Contact top-level accordion, (5) the Quick Log post-log Add-Note → Interaction-Note-or-Memory editor, (6) the Update Contact chooser loop, and (7) wiring the existing `LogContact`/`UpdateContact`/`Memory` route **placeholders** to real screens.

**Primary recommendation:** Compose the existing primitives (`TouchpointRefineForm`, `TriStateLastSpoke`, `MemoryEditor`, `FrequencyPicker`, `ContactPicker`, `Snackbar`, `SegmentedControl`) and the existing recency-spine DAOs. Ship exactly one new migration (head+1 = **027**, `app_settings` columns for the Default Interaction Channel preference). Do **not** touch the `interactions` schema, `ai-context-read.ts` egress, or re-migrate vocabulary.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from 34-CONTEXT.md `## Implementation Decisions`)
- **D-01:** Read the phase dossier IN FULL before planning; its dated "Amendment — audit resolutions 2026-09-01" section overrides older text. [DECIDED]/[REJECTED] items are settled; reopening one, or reversing any Accepted ADR or HANDOFF.md entry, is an owner decision — stop and ask.
- **D-02:** Read the planning-notes file as a binding appendix: every REPLAN finding must be reflected; every trip-wire is a stop-and-ask.
- **D-03:** This phase ships SQLite schema. Never assume a migration number — verify head+1 against `src/db/migrations/` and `TARGET_VERSION` in `src/db/database.ts` on disk at plan time. Milestone order is schema → consumers → backup; the backup v-bump is Phase 36's final plan. All new durable preferences are `app_settings` columns added to `PORTABLE_SETTINGS_KEYS`, never AsyncStorage.
- **D-04:** The ordinary Log form **owns** the per-interaction **Allow AI** toggle at capture time, placed with the Note field, shipping **default OFF**, initialized from Phase 36's new-items-only type default (E-05). Trip-wire: shipping default-ON, or routing a **Group Note** through the toggle, reverses the owner resolution and widens AI egress — stop and ask. Group Notes are never transmitted to AI regardless of any Allow AI value (ADR-078).
- **D-05:** ADR-016's tri-state last-spoke control (today / on date / not yet) **stays** in Add Contact's Relationship Basics, defaulting "today" (R-13, ESCALATE trip-wire). "Not yet" must continue to create **no interaction at all** — never an interaction with a null date.
- **D-06:** Channel vocabulary becomes exactly Message / Call / In Person (R-03). `interactions.channel` has no CHECK but `interaction_assists.channel` does, and `markAssistLogged` copies it into `interactions.channel`: the assists CHECK stays as the transport and is mapped to Message at log time — no table rebuild. Trip-wire: update every literal consumer of `quality` **with** the migration, not after it; legacy `other`/`unspecified` must stay representable.
- **D-07:** Decide **once** whether this phase or Phase 32 owns the shared `interactions` migration (Tone/channel data migration + per-interaction Allow AI defaulting OFF), with the other consuming it, coordinated with Phase 33's group linkage as one strictly ordered sequence. All interaction writes still go through the single recency spine — `insertInteractionCore` / `editTouchpointFull` / `deleteTouchpoint` + `recomputeLastContactCore`, composed inside one transaction (ADR-010/024/071); no direct or set-based writes to `interactions`.
- **D-08:** Tone offers Positive / Neutral / Negative, is optional, defaults null/unset, and an omitted Tone is **never** silently treated as Neutral. Quick Log writes immediately at the current time, never backdates, never asks for duration.
- **D-09:** The Default Interaction Channel preference and its remembered value are new durable `app_settings` columns, portable via the backup manifest, not AsyncStorage (R-16). Remembered updates **only after a successful ordinary save** — a cancelled unsaved form never mutates it — and Group Log is exempt and defaults In Person.
- **D-10:** The Bound/Unbound supersession is compatible with ADR-062 — re-verify on disk before touching cadence writes. Phase 24's Contact Knowledge model gates Update Contact and the Memory editor (R-01); do not plan against an unbuilt knowledge model.
- **D-11:** Two owner reconciliation blockers **RESOLVED by owner 2026-09-12** (use verbatim, do not re-flag):
  - **Log naming (D-13-184):** the canonical form/CTA name is **"Log Interaction"**. "Log Contact" is legacy — do not use in user-facing copy.
  - **Default/general built-in Memory type display name:** final display name is **"Memory"** — keep the shipped `PROVISIONAL_MEMORY_LABEL` value as the final label. Rapid capture requests the type by registry key (`DEFAULT_MEMORY_TYPE_KEY = "general"`), never by hardcoded display name or type ID.

### Claude's Discretion
Everything the dossier marks [DERIVED], plus open implementation details that do not touch a [DECIDED] item, an ADR, or a HANDOFF.md entry.

### Deferred Ideas (OUT OF SCOPE — do NOT plan)
A second multi-contact detailed logging form (Group Event semantics belong to Phase 33); automatic extraction/classification of Memories from interaction notes; a more granular Channel taxonomy (separate Email/SMS/WhatsApp/Video Call); user-defined Tone scales or expanded Tone analytics; comprehensive redesign of the Memory type taxonomy.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (abbrev.) | Research Support |
|----|-----------------------|------------------|
| CAPT-01 | Name-only streamlined 3-section Add Contact + Show More; Save → Profile | `CreateContactScreen` + `create-contact-logic.ts` exist and are real (not placeholder); restructure into Identity/Relationship Basics/Contact Methods accordions. `canSave` already gates Name-only. |
| CAPT-02 | Retain tri-state last-spoke, default "today"; "Not yet" creates no interaction | `TriStateLastSpoke` + `firstInteractionOccurredAt` already implement all three states; "not yet" omits `firstInteraction` (no row). ADR-016 preservation. |
| CAPT-03 | No-cadence contact is Unbound; cadence → Bound on; keep dormant cadence Unbound | `createContactFull` takes `trackingEnabled`; ADR-062 + `contacts_prevent_cadence_clear` trigger. Re-verify per D-10. |
| CAPT-04 | Edit Contact = direct-access top-level accordions, no nested Things-to-Remember | `EditContactScreen`/`edit-contact-logic.ts` exist; restructure IA. |
| CAPT-05 | Quick Log immediate + Undo; Add Note → Interaction Note OR Create Memory Instead (never both) + Edit Memory | `runQuickLog` (immediate + Undo snackbar) exists; the post-log editor + Memory branch is NEW. `MemoryEditor`/`addMemory` compose the Memory path. |
| CAPT-06 | Full Memory editor lives in Update Contact; type inside; metadata behind More Options | `MemoryEditor` component exists with type picker + More-Options metadata. Compose into the (placeholder) `UpdateContact`/`Memory` routes. |
| CAPT-07 | Detailed Log Interaction: date/time default now, backdateable, Channel/Direction/Connected/Tone/Note/Allow AI, Duration under More Options | `TouchpointRefineForm` exposes all fields incl. `allowAi`, `duration`, `visibleFields` allow-list. `LogContact` route is a placeholder to fill. |
| CAPT-08 | Channel = Message/Call/In Person; Direction default Outbound (Msg/Call) / Mutual (In Person); Connected default Yes, hidden for In Person | Channel vocabulary DONE in form. Channel-sensitive Direction/Connected defaulting is NEW parent logic. |
| CAPT-09 | Tone Positive/Neutral/Negative, optional, default null, never coerced to Neutral | `TONE_OPTIONS` + `quality:null` unset already implemented in form + spine. |
| CAPT-10 | Allow AI toggle with Note field, default OFF, survives save, editable | `allow_ai` column (migration 025) + `coerceAllowAi` + spine writes all exist. Toggle default OFF verified. |
| CAPT-11 | Default Interaction Channel pref (Remember Last Choice factory / Msg / Call / In Person), ordinary-only, remembered updates only on successful save, Group Log exempt | NEW: one migration (027) for `app_settings` columns; NEW pref UI (exported to Phase 15 but the durable column + remembered-value write land here). |
| CAPT-12 | Update Contact compact chooser loop returning to itself until Done; Category stays Edit-Contact | `UpdateContact` route is a placeholder — build it. Chooser driven by knowledge registry. |
| CAPT-13 | Preselect contact from invoking context; History-originated prefills the day | `LogContact` route already carries `{ contactId?, prefillDate? }`; `ContactPicker` for untargeted. |
| CAPT-14 | Failed saves preserve state, never show completion; validation reveals+focuses accordion; unchanged forms exit silently | Locked copy in UI-SPEC; `discard-keep-guard.ts` shell dirty-state exists. |
| CAPT-15 | Legacy vocabulary migrates: quality→Tone, 6-value channel→Message/Call/In Person, legacy kept representable, every literal consumer updated in same change | **ALREADY SATISFIED by Phase 32 migration 025 + consumer updates.** See D-07 evidence below. Phase 34 verifies, does not re-migrate. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contact/interaction persistence | Database / on-device SQLite | — | All writes route through recency-spine DAOs; no backend exists (CLAUDE.md local-first). |
| Recency invariant (`last_contact`) | Database (recency-dao.ts) | — | Single-writer; recompute is MAX over current rows inside one txn. |
| Vocabulary remap (legacy→Tone/channel) | Database (migration 025 + interaction-vocabulary.ts) | — | Done. One shared map; readers compare migrated literals. |
| Durable preferences (Default Channel) | Database (`app_settings`) | Backup manifest (Phase 36 emits) | D-09: `app_settings` columns, portable, never AsyncStorage. |
| Capture/update forms & choosers | Client (screens/components) | — | Presentational + pure-logic split; DAOs never called in components. |
| Channel-sensitive Direction/Connected defaulting | Client (new parent logic over `TouchpointRefineForm`) | — | Initialization/context behavior, not a validation rule (dossier §R/§S). |
| AI-egress gating | Database (ai-context-read.ts) | Client (Allow AI toggle) | Phase 34 ships the per-row gate ONLY; note egress consumption is future (see D-04 scope note). |

## Standard Stack

This is an existing, shipped React Native / Expo app. No new external packages are needed or wanted for this phase (the UI-SPEC's Registry Safety section confirms "No shadcn, no third-party UI registry, no external icon/component package is introduced by this phase"). All work composes in-repo primitives.

### Core in-repo modules to reuse (NOT re-implement)
| Module | Path | Purpose | Provenance |
|--------|------|---------|-----------|
| Recency spine | `src/db/recency-dao.ts` | `recordTouchpoint`, `editTouchpointFull`, `deleteTouchpoint`, `createContactWithInteraction`; cores `insertInteractionCore`/`recomputeLastContactCore` | [VERIFIED: src/db/recency-dao.ts:200-502] |
| Atomic create | `src/db/contacts-dao.ts` | `createContactFull(CreateContactFullInput)` — the ONLY production create path (seeds definition-pair matrix) | [VERIFIED: src/db/contacts-dao.ts:87-116] |
| Vocabulary map | `src/db/interaction-vocabulary.ts` | `LEGACY_QUALITY_REMAP`, `LEGACY_CHANNEL_REMAP`, `remapLegacyQuality/Channel` | [VERIFIED: src/db/interaction-vocabulary.ts:35-75] |
| Detailed log form | `src/components/TouchpointRefineForm.tsx` + `touchpoint-refine-logic.ts` | Controlled channel/direction/connected/tone/note/duration/allowAi; `visibleFields` allow-list; two-dialog date+time | [VERIFIED: src/components/TouchpointRefineForm.tsx:76-116] |
| Tri-state last-spoke | `src/components/TriStateLastSpoke.tsx` + `tri-state-last-spoke-logic.ts` | `LastSpokeValue` today/date/not-yet + future-date guard | [VERIFIED: src/components/tri-state-last-spoke-logic.ts:18-65] |
| Memory editor | `src/components/MemoryEditor.tsx` | `MemoryDraft`/`MemoryEditPatch`/`MemoryEditorProps`; type picker + More-Options metadata | [VERIFIED: src/components/MemoryEditor.tsx:44-71] |
| Memory DAO | `src/db/memories-dao.ts` | `addMemory`, `editMemory`, `setMemoryAllowAi`, `assertRegisteredMemoryType` | [VERIFIED: src/db/memories-dao.ts:296-330] |
| Memory registry | `src/db/memory-registry.ts` | `DEFAULT_MEMORY_TYPE_KEY="general"`, `PROVISIONAL_MEMORY_LABEL="Memory"`, `MEMORY_TYPE_REGISTRY` | [VERIFIED: src/db/memory-registry.ts:10-59] |
| Quick Log command | `src/services/quick-log-command.ts` | `runQuickLog` immediate write + Undo/Retry snackbar contract | [VERIFIED: src/services/quick-log-command.ts:81-126] |
| Settings DAO | `src/db/app-settings-dao.ts` | `AppSettings`, `PortableSettingsSnapshot`, `AppSettingsPatch`, `updateAppSettings`, assert-validators | [VERIFIED: src/db/app-settings-dao.ts:131-341, 1065] |
| Interaction edit read | `src/db/interaction-edit-read.ts` | `readInteractionForEdit` seeds the full refine form for edit | [VERIFIED: src/db/interaction-edit-read.ts:58-85] |
| Shared UI primitives | `src/components/` | `Snackbar`, `SegmentedControl`, `FrequencyPicker`, `ContactPicker`; `src/components/ui/` `Button`/`AppText`/`Modal`/`Sheet`/`ConfirmDialog` | [VERIFIED: directory listing] |

### Installation
None. Zero new dependencies. `npm view`/registry checks are N/A — no package is added.

## Package Legitimacy Audit

Not applicable. This phase installs no external packages (confirmed against `package.json` and UI-SPEC Registry Safety). All work composes existing `src/` modules and React Native core. No SLOP/SUS surface exists.

## D-07 RESOLUTION — the shared `interactions` migration is ALREADY OWNED BY PHASE 32

This is the phase's central sequencing question, and the on-disk evidence resolves it unambiguously. **Phase 32 (migration 025) owns and has already shipped the entire shared `interactions` migration.** Phase 34 is the consumer. Do NOT plan another `interactions` migration.

Verbatim from `src/db/migrations/025-interaction-history-schema.ts:44-72` [VERIFIED]:
```sql
ALTER TABLE interactions ADD COLUMN duration INTEGER;
ALTER TABLE interactions ADD COLUMN allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0, 1));
UPDATE interactions SET quality = CASE quality
  WHEN 'good' THEN 'Positive' WHEN 'fine' THEN 'Neutral' WHEN 'hard' THEN 'Negative' ELSE quality END;
UPDATE interactions SET channel = CASE channel
  WHEN 'text' THEN 'Message' WHEN 'email' THEN 'Message' WHEN 'call' THEN 'Call'
  WHEN 'in-person' THEN 'In Person' ELSE channel END;
ALTER TABLE app_settings ADD COLUMN history_lens TEXT NOT NULL DEFAULT 'cycles';
ALTER TABLE app_settings ADD COLUMN history_cycle_count INTEGER NOT NULL DEFAULT 10;
```

So the following D-06 / D-07 / CAPT-10 / CAPT-15 items are **DONE**:
- `interactions.allow_ai` (NOT NULL DEFAULT 0, CHECK 0/1) — the per-interaction gate defaults OFF. [VERIFIED: 025:47-48]
- `interactions.duration` (nullable INTEGER seconds). [VERIFIED: 025:45]
- `quality` values re-mapped to Tone (good→Positive, fine→Neutral, hard→Negative; NULL/other/unspecified pass through). [VERIFIED: 025:50-56]
- `channel` values collapsed to Message/Call/In Person (text/email→Message; other/unspecified kept). [VERIFIED: 025:58-65]
- The `interaction_assists.channel` CHECK is NOT rebuilt; `markAssistLogged` routes the transport channel through `remapLegacyChannel` at log time. [VERIFIED: src/db/interaction-assist-dao.ts:99-118]

And **every literal consumer named in the D-06 trip-wire was already updated by Phase 32** (verify, do not re-do):
- `ai-context-read.ts` compares the migrated Tone literals `'Positive'`/`'Neutral'`/`'Negative'`, not `good/fine/hard`. [VERIFIED: src/db/ai-context-read.ts:137-143]
- `digest-read.ts` (`readGentleLine`) tallies `'Positive'`/`'Neutral'`/`'Negative'`. [VERIFIED: src/db/digest-read.ts:162-170]
- Backup restore writer `restore-apply.ts` remaps via `remapLegacyChannel`/`remapLegacyQuality` on ingest and forces `allow_ai=0`. [VERIFIED: src/backup/restore-apply.ts:190-201]
- The detailed form `TouchpointRefineForm` already emits the new vocabulary: `CHANNEL_OPTIONS` = Message/Call/In Person/other/unspecified and `TONE_OPTIONS` = Positive/Neutral/Negative. [VERIFIED: src/components/TouchpointRefineForm.tsx:76-88]

> **Planner action for CAPT-15:** treat it as **satisfied-by-dependency (Phase 32)**. Add a *verification* task (grep for any straggler legacy `'good'/'fine'/'hard'/'text'/'email'` interaction literal in a writer/reader) and a note in PLAN.md. **Do NOT author a second `interactions` vocabulary migration** — a redundant UPDATE on the shared table is exactly the double-migration hazard the data-layer rules warn against. The planning-notes citation "UI channel values are `call|text|in-person|email|other|unspecified` (TouchpointRefineForm.tsx:60-67)" was verified 2026-09-01 and is now **STALE** — Phase 32 (files dated 2026-09-11) migrated it.

### What Phase 33 (migration 026) added to `interactions`
`group_event_id` (FK ON DELETE SET NULL), `ge_follow_channel/quality/duration`, and a partial UNIQUE index. [VERIFIED: src/db/migrations/026-group-events-schema.ts:31-39]. The recency spine's `insertInteraction` already handles these group columns conditionally. [VERIFIED: src/db/recency-dao.ts:222-262] Phase 34 does not touch group linkage.

## Migration pattern + current head (D-03)

- `TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION` and `GROUP_EVENTS_SCHEMA_VERSION = 26`. [VERIFIED: src/db/database.ts:67; src/db/migrations/026-group-events-schema.ts:12]
- Migration registration list ends `…profilePresentationMigration (v24), migration025, migration026`. [VERIFIED: src/db/database.ts:70-97]
- **Phase 34's one new migration is head+1 = version `027`**, file `027-<name>.ts`, registered in `MIGRATIONS` and bumping `TARGET_VERSION` (re-verify on disk at plan time; numbers drift). It is **`app_settings`-only** (Default Interaction Channel pref + remembered value). No `interactions` change.
- **Template to copy:** `src/db/migrations/020-dashboard-swipe-pref.ts` — a single additive `ALTER TABLE app_settings ADD COLUMN … TEXT NOT NULL DEFAULT … CHECK(… IN (…))`. [VERIFIED: 020:12-16]
- Migrations are forward-only, irreversible on unreachable devices, run in strict order via `PRAGMA user_version` runner; PRAGMAs (`journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout`) are set before any transaction. [VERIFIED: src/db/database.ts:5-10, 156-192]
- Migration numbering note: migration 024 exists only as `profilePresentationMigration` (version 24, no `024-` filename). Verify the registration list, not just filenames.

### Suggested new `app_settings` columns (Claude's discretion on exact names/values; verify at plan time)
- `default_interaction_channel TEXT NOT NULL DEFAULT 'remember'` with `CHECK(default_interaction_channel IN ('remember','Message','Call','In Person'))` — Remember Last Choice is the factory default (dossier §P). Channel labels match the migrated stored vocabulary.
- `remembered_interaction_channel TEXT NOT NULL DEFAULT 'Message'` — the last successfully-saved ordinary channel; first-use fallback Message (dossier §P derived, D-13-093).
- Add BOTH keys to `PORTABLE_SETTINGS_KEYS` **declare-only** (accepted on restore, NOT emitted by `getPortableSettingsSnapshot`, NO `BACKUP_FORMAT_VERSION` bump). This is the established pattern — the array already carries Phase 23/25/29/30 keys "allowlisted NOW … emission + BACKUP_FORMAT_VERSION bump … Phase 36 scope." [VERIFIED: src/backup/backup-schema.ts:133-190] Emission is Phase 36's job per D-03 milestone order (schema → consumers → backup).
- Wire into `AppSettings` interface, `AppSettingsPatch`/`COLUMN_OF`, `updateAppSettings`, and an `assert…` validator following the `assertDashboardRightSwipeAction` idiom. [VERIFIED: src/db/app-settings-dao.ts:131-263, 910, 1065]

## Architecture Patterns

### System Architecture Diagram
```
                  ┌─────────────────────────────────────────────┐
   User intents   │  Screens (client)                           │
   (FAB / Profile │  Add Contact · Log Interaction · Quick Log  │
    / Dashboard / │  · Update Contact chooser · Edit Contact    │
    History /     │  · Memory editor                            │
    deep link)    └───────┬───────────────────────┬─────────────┘
      │ contactId /       │ controlled value        │ pure form→input
      │ prefillDate       ▼                         ▼
      │            ┌──────────────┐          ┌──────────────────────┐
      └───────────▶│ Primitives   │          │ *-logic.ts (pure,     │
   preselect /     │ TouchpointRefi│          │  node-tested)         │
   ContactPicker   │ neForm,       │          │ create-contact-logic, │
                   │ TriStateLast  │          │ touchpoint-refine-    │
                   │ Spoke,        │          │ logic, tri-state-…    │
                   │ MemoryEditor, │          └──────────┬───────────┘
                   │ FrequencyPicker│                     │ builds DAO input
                   └──────────────┘                      ▼
                                            ┌─────────────────────────────┐
                                            │ Recency spine (DATA-04)      │
                                            │ recordTouchpoint /           │
                                            │ editTouchpointFull /         │
                                            │ deleteTouchpoint /           │
                                            │ createContactFull            │
                                            │  └─ recomputeLastContactCore │
                                            │     (MAX over current rows)  │
                                            └───────────┬─────────────────┘
                                                        │ one txn, mutex
                                                        ▼
                                            ┌─────────────────────────────┐
                                            │ SQLite: interactions,        │
                                            │ contacts, memories,          │
                                            │ app_settings (+ new 027 cols)│
                                            └─────────────────────────────┘
   AI egress (SEPARATE, read-only): ai-context-read.readPromptContext — aggregate channel/quality
   only; interaction NOTE is NOT selected today. Allow AI gate is stored per-row but note-egress
   consumption is future work (see D-04 scope note). Group Notes never transmitted (ADR-078).
```

### Pattern 1: RN screen ↔ pure-logic split (project-standard)
**What:** Every correctness-critical rule lives in a react-native-free `*-logic.ts` module unit-tested in vitest; the `.tsx` screen is presentational. `TouchpointRefineForm.tsx` imports react-native + native pickers and cannot load in vitest, so the date/time carry-state math is in `touchpoint-refine-logic.ts`. [VERIFIED: src/components/touchpoint-refine-logic.ts:1-24]
**When to use:** All new Phase-34 forms (Add Contact, Log Interaction, Update Contact chooser). Follow `create-contact-logic.ts` (build `CreateContactFullInput`, own the Save gate). [VERIFIED: src/screens/create-contact-logic.ts:60-127]

### Pattern 2: Compose `TouchpointRefineForm` with `visibleFields`, add defaulting in the parent
**What:** The form is purely controlled — parent owns `value` and calls the DAO. Channel-sensitive Direction/Connected defaulting (CAPT-08) is NOT in the form; it belongs in the parent's `onChange` handler / a new pure logic module. Dossier §R/§S: In Person → Direction default Mutual + Connected hidden; Message/Call → Direction default Outbound + Connected default Yes; once the user overrides Direction, do not re-fight it on unrelated re-renders. [VERIFIED: dossier lines 366-384]
**Example (skeleton — literals verified against form source):**
```ts
// New pure module, e.g. src/screens/log-interaction-logic.ts (node-tested).
// CHANNEL labels are the MIGRATED stored values, verbatim from TouchpointRefineForm CHANNEL_OPTIONS.
function defaultsForChannel(channel: "Message" | "Call" | "In Person") {
  return channel === "In Person"
    ? { direction: "mutual", connectedHidden: true, connected: 1 }   // §R/§S
    : { direction: "outbound", connectedHidden: false, connected: 1 };
}
// Guard: only apply defaults when the user has NOT explicitly overridden direction.
```
Direction enum is `outbound|inbound|mutual` and Connected is `0/1`. [VERIFIED: src/components/TouchpointRefineForm.tsx:85, 287-301]

### Pattern 3: Immediate Quick Log + post-log editor
**What:** `runQuickLog` writes immediately at `localDateTime()`, then shows a **Logged** snackbar with **Undo**; failure shows **Couldn't log** with **Retry**; single-flight via `pendingRef`. [VERIFIED: src/services/quick-log-command.ts:81-126] The current `QuickLogInput` hardcodes `channel:"unspecified"`, `direction:"outbound"`, `quality:null`. [VERIFIED: src/services/quick-log-command.ts:26-36, 91-97]
**Phase 34 adds:** an **Add Note** affordance on the success snackbar opening a small post-log editor bound to the just-created `interactionId`. It saves EITHER an Interaction Note (via `editTouchpointFull` seeded from `readInteractionForEdit`) OR a Memory (via `addMemory`) — **never both** (CAPT-05 / dossier §I). After a basic Memory, offer **Edit Memory** → full `MemoryEditor`.
**Open decision (Claude's discretion, flag if consequential):** whether Quick Log should adopt the Default Interaction Channel instead of `'unspecified'`. Dossier §P scopes the preference to "ordinary new Log Interaction forms"; Quick Log is not a form and collects no channel. Recommendation: leave Quick Log at `'unspecified'` unless the owner says otherwise — do not silently change it.

### Pattern 4: Update Contact chooser loop (CAPT-12)
**What:** After the contact is known, open a compact chooser (Last Talked About, Key People, Current Location, Memory, Off Limits, Contact Method, Contact Frequency, + custom fields by name). Selecting an item opens a focused editor; its inner Save returns to the chooser with the same contact targeted; **Done** exits. Each inner save persists independently (not one giant transaction). [VERIFIED: dossier lines 511-535]
**Build target:** the `UpdateContact` route is currently `UpdateContactPlaceholderScreen`. [VERIFIED: src/navigation/tabs/DashboardStack.tsx:48-49; src/screens/placeholders/FabActionPlaceholders.tsx:50] Params `{ contactId?: number }`. [VERIFIED: src/navigation/types.ts:59] Chooser is driven by the Contact Knowledge registry (dossier §Y derived), not hardcoded tables.

### Anti-Patterns to Avoid
- **Re-migrating `interactions` vocabulary** — already done by 025; a second UPDATE is redundant and risky on unreachable devices.
- **Writing `interactions`/`last_contact` directly** — all writes go through the recency spine cores inside one transaction (ADR-010/024/071). [VERIFIED: src/db/recency-dao.ts:5-51]
- **Expanding `ai-context-read.ts` to transmit interaction notes** — out of Phase-34 scope; the note column is deliberately never selected there today. [VERIFIED: src/db/ai-context-read.ts:8-26, 94-99]
- **AsyncStorage for the Channel preference** — D-09 requires `app_settings` columns.
- **`toISOString().split('T')[0]`** — banned; use `formatLocalDate()`/`localDateTime()`. [VERIFIED: src/utils/dates.ts convention enforced across recency-dao.ts:36-50]
- **Hardcoding a Memory type ID or display name in rapid-capture UI** — request by `DEFAULT_MEMORY_TYPE_KEY="general"`. [VERIFIED: src/db/memory-registry.ts:15]
- **Cloning `TouchpointRefineForm`/`MemoryEditor`/`TriStateLastSpoke`** — compose them (UI-SPEC scope note).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recompute recency after a write | A per-row last-write-wins update | `recomputeLastContactCore` (MAX over current rows) | Single-writer invariant; correct after ANY mutation. [VERIFIED: recency-dao.ts:181-198] |
| Atomic contact create | Inline INSERTs | `createContactFull` | Seeds full definition-pair matrix + first interaction in one txn. [VERIFIED: contacts-dao.ts:116] |
| Legacy vocab mapping | New CASE/if-chains | `remapLegacyQuality/Channel` | ONE source of truth; a second copy silently corrupts AI/digest. [VERIFIED: interaction-vocabulary.ts:12-27] |
| Date+time picking (Android) | Combined picker / toISOString | `TouchpointRefineForm` two-dialog + `combineDateAndTime` | No native combined picker; local wall-clock stitch avoids the UTC off-by-one. [VERIFIED: touchpoint-refine-logic.ts:69-83] |
| Future-date rejection | Ad-hoc compare | `rejectFutureOccurredAt` / `isFutureLocalDate` (locked copy) | Shared with the DAO so UI flags exactly what the DAO rejects. [VERIFIED: tri-state-last-spoke-logic.ts:32-37] |
| Settings read/write | Raw SQL in a screen | `updateAppSettings` + assert-validators | Validated patch boundary; `COLUMN_OF` allowlist. [VERIFIED: app-settings-dao.ts:1065] |
| Memory CRUD | Inline memory INSERT | `addMemory`/`editMemory`/`setMemoryAllowAi` | Enforces registered types + provenance. [VERIFIED: memories-dao.ts:296-330] |

**Key insight:** nearly every hard part is already built and tested; Phase 34 is composition and IA, not new infrastructure.

## Runtime State Inventory

> Included because the phase touches a rename-adjacent vocabulary concern (D-06/D-11), but the data rename itself already ran (migration 025). This inventory checks what remains.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `interactions.quality`/`channel` values ALREADY migrated to Tone/Message-Call-In-Person on every device that reached v25 (migration 025). `allow_ai`/`duration` columns exist. | None — verify only. Do NOT re-migrate. [VERIFIED: 025:44-72] |
| Stored data (new) | Default Interaction Channel + remembered value do NOT yet exist as columns. | New migration 027 (app_settings). |
| Live service config | None — no external service stores this app's channel/tone vocabulary. | None (no backend; local-first). |
| OS-registered state | None relevant to this phase. | None. |
| Secrets/env vars | None — AI keys are SecureStore-only and untouched here. | None. [VERIFIED: app-settings-dao.ts:216-217] |
| Build artifacts | None — no package rename. | None. |
| Legacy naming residue | Route id `LogContact` and migration-020 CHECK value `'log-contact'` are INTERNAL identifiers; user-facing CTA must read **"Log Interaction"** (D-11). `dashboard_right_swipe_action IN ('quick-log','log-contact')`. [VERIFIED: 020:14-15; navigation/types.ts:45,152,213] | Do NOT rename the stored enum/route id (would need a table rebuild / cross-file refactor); only ensure user-facing COPY says "Log Interaction". Flag if the planner wants the route renamed. |

## Common Pitfalls

### Pitfall 1: Double-migrating the shared `interactions` table (CAPT-15 over-scope)
**What goes wrong:** Reading CAPT-15/D-06 literally and authoring a new `interactions` vocabulary migration.
**Why it happens:** The planning-notes (dated 2026-09-01) describe the migration as unbuilt; Phase 32 built it on 2026-09-11.
**How to avoid:** Treat CAPT-15 as satisfied-by-dependency; verify with a grep; ship no `interactions` migration.
**Warning signs:** A PLAN task titled "migrate quality/channel" or "ALTER TABLE interactions".

### Pitfall 2: Setting the Allow AI toggle default ON, or routing a Group Note through it
**What goes wrong:** Widens AI egress; reverses the owner resolution (E-05 / ADR-078).
**How to avoid:** Default OFF (`coerceAllowAi` returns 0 unless explicit 1/true); never expose the toggle on Group Notes. [VERIFIED: touchpoint-refine-logic.ts:176-178]
**Warning signs:** any `allowAi: 1` default; a group-note path importing the toggle. **STOP AND ASK.**

### Pitfall 3: Dropping the tri-state last-spoke control from Add Contact
**What goes wrong:** Silent reversal of ADR-016 (marked "costly"); loses the never-contacted backlog case.
**How to avoid:** Keep `TriStateLastSpoke` in Relationship Basics defaulting "today"; "Not yet" omits `firstInteraction` entirely (NULL last_contact, no row). [VERIFIED: create-contact-logic.ts:76-125; ADR-016 Decision] **ESCALATE if the streamlined form omits it.**

### Pitfall 4: Coercing an omitted Tone to Neutral
**What goes wrong:** Destroys the explicit-vs-missing distinction (dossier §T, D-08).
**How to avoid:** `quality:null` = unset; the form's "No selection" maps to null. [VERIFIED: TouchpointRefineForm.tsx:87-88, 318-319]

### Pitfall 5: Mutating the remembered channel on cancel
**What goes wrong:** A cancelled/unsaved Log form changes the remembered default (violates D-09).
**How to avoid:** Update `remembered_interaction_channel` ONLY inside the successful-save path, and only for ordinary (non-group) logging.

### Pitfall 6: Writing recency outside the mutex / nesting the write transaction
**What goes wrong:** Calling a `…Core` bare, or nesting `inWriteTransaction`, permanently hangs (non-reentrant mutex) or defeats DATA-04.
**How to avoid:** Use the mutexed wrappers (`recordTouchpoint`/`editTouchpointFull`) from top-level handlers; only compose cores inside an already-open txn. [VERIFIED: recency-dao.ts:166-198, 488-502]

## Code Examples

### Seed the detailed edit/log form from a stored interaction
```ts
// src/db/interaction-edit-read.ts — returns EVERY editable field incl. note/duration/allow_ai.
const seed = await readInteractionForEdit(exec, contactId, interactionId);
// seed: { occurredAt, channel, direction, connected, quality, note, duration, allowAi }
```
[VERIFIED: src/db/interaction-edit-read.ts:58-85]

### Persist a full interaction edit (post-log note as Interaction Note branch)
```ts
await editTouchpointFull(exec, {
  interactionId, contactId, occurredAt, now,
  channel, direction, connected, quality, note,   // note set here for the "Interaction Note" branch
  duration, allowAi,                               // allowAi defaults 0
});
```
[VERIFIED: src/db/recency-dao.ts:310-374]

### Create a basic Memory (the "Create Memory Instead" branch — never both)
```ts
import { DEFAULT_MEMORY_TYPE_KEY } from "@/db/memory-registry"; // "general"
await addMemory(exec, { /* type: DEFAULT_MEMORY_TYPE_KEY, value, provenance:"user", now, ... */ });
// The Interaction Note is left empty on this branch (dossier §I: text is not duplicated).
```
[VERIFIED: src/db/memories-dao.ts:296; src/db/memory-registry.ts:15]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `quality` = good/fine/hard; `channel` = call/text/in-person/email/other/unspecified | `quality` = Positive/Neutral/Negative (Tone); `channel` = Message/Call/In Person (+legacy pass-through) | Phase 32, migration 025 (2026-09-11) | CAPT-15 data + consumers DONE; Phase 34 verifies only. |
| No per-interaction AI gate; notes never eligible | `interactions.allow_ai` NOT NULL DEFAULT 0 | Phase 32, migration 025 | Phase 34 surfaces the toggle; egress consumption still future. |
| `UpdateContact`/`LogContact`/`Memory` = placeholder screens | Real screens | Phase 34 | Build the four flows onto existing typed routes. |

**Deprecated/outdated:** the planning-notes' "code facts (verified 2026-09-01)" for `TouchpointRefineForm.tsx:60-67` (legacy channel values) and `interactions.channel`/consumers — superseded by Phase 32. Re-verify anything dated 2026-09-01 against disk.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Suggested new column names `default_interaction_channel` / `remembered_interaction_channel` and their CHECK/DEFAULT values | Migration pattern | LOW — names are Claude's discretion; must be finalized/verified at plan time; values match migrated vocabulary. |
| A2 | Quick Log should stay `channel:'unspecified'` rather than adopt the Default Channel | Pattern 3 | MEDIUM — dossier §P scopes the pref to Log forms; if owner wants Quick Log to honor it, revisit. Flag if consequential. |
| A3 | `MEMORY_TYPE_REGISTRY.general.displayName` currently resolves to "General", but D-11 sets the general type's display name to "Memory" | Memory registry (below) | MEDIUM — see the discrete-value note; planner must reconcile the shown string. |

**Discrete-value reconciliation (D-11, general Memory type name):** verbatim on disk, `PROVISIONAL_MEMORY_LABEL = "Memory"` and `PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME = "General"`, and `general: { displayName: PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME, … }` — so the **general** type currently displays **"General"**, while the **custom** type displays **"Memory"**. [VERIFIED: src/db/memory-registry.ts:10-15, 28-38, 49-58] D-11 (owner, 2026-09-12) sets "the default/general built-in Memory type display name" to **"Memory"** and says to "keep the shipped `PROVISIONAL_MEMORY_LABEL` value as the final label." Reading these together, `MEMORY_TYPE_REGISTRY.general.displayName` should point at `PROVISIONAL_MEMORY_LABEL` ("Memory"). This is a small, owner-settled code edit — implement it, don't re-flag as unresolved — but confirm the exact string shown in the chooser/editor with the owner if any ambiguity remains. `MemoryEditor` renders `MEMORY_TYPE_REGISTRY[type].displayName`. [VERIFIED: src/components/MemoryEditor.tsx:29-30]

## Open Questions

1. **Route rename `LogContact` → `LogInteraction`?**
   - What we know: user-facing CTA must read "Log Interaction" (D-11); route id is internal `LogContact`; migration-020 stores `'log-contact'` as a CHECK value. [VERIFIED]
   - What's unclear: whether the owner wants the internal route id renamed too.
   - Recommendation: keep the internal id; fix only user-facing copy. Renaming the route touches multiple stacks; renaming the stored enum needs a table rebuild — both are owner-scope if desired.
2. **Exact Update Contact custom-field ranking/overflow threshold** — dossier marks it implementation tuning (§Z DERIVED). Claude's discretion.
3. **E4 loading transient while resolving the preselected contact** — UI-SPEC marks it "unresolved — planner assumption"; no shipped loading pattern mandated.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-sqlite | all data work | ✓ (in use) | project-pinned | — |
| vitest | validation | ✓ | ^4.1.10 (package.json) | — |
| @react-native-community/datetimepicker | date/time in forms | ✓ (imported by TouchpointRefineForm) | project-pinned | — |
| Physical Pixel / desktop build | on-device UAT | per MEMORY (build on droid, run on Pixel) | — | debug APK |

No missing dependencies. No new external dependency is introduced.

## Validation Architecture

> `.planning/config.json` has `nyquist_validation: true` — this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.10 (package.json:55) |
| Config file | vitest (node env); RN `.tsx` screens are NOT loadable — test pure `*-logic.ts` modules |
| Quick run command | `npx vitest run <path/to/file.test.ts>` |
| Full suite command | `npm test` (= `vitest run`, package.json:71) |
| Colour gate | `npm run check:colors` (package.json:62) — blocks hex/named colour literals in `src/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAPT-01/02/03 | Name-only save gate; tri-state → firstInteraction; Unbound-on-no-cadence | unit | `npx vitest run src/screens/create-contact-logic.test.ts` | ✅ (extend) |
| CAPT-05 | Quick Log immediate + Undo/Retry; single-flight | unit | `npx vitest run src/services/quick-log-command.test.ts` | ✅ (extend for Add-Note branch) |
| CAPT-07/08 | Channel-sensitive Direction/Connected defaulting; backdate guard | unit | `npx vitest run src/screens/log-interaction-logic.test.ts` | ❌ Wave 0 (new pure module + test) |
| CAPT-07 | Duration parse/label; date+time combine; future-datetime reject | unit | `npx vitest run src/components/touchpoint-refine-logic.test.ts` | ✅ |
| CAPT-09/10 | Tone null-not-Neutral; allowAi coerce OFF; edit round-trip | unit | `npx vitest run src/db/recency-dao.test.ts` + `interaction-edit-read.test.ts` | ✅ (assert coverage) |
| CAPT-11 | Default Channel pref read/write; remembered updates only on save; validator | unit | `npx vitest run src/db/app-settings-dao.test.ts` | ✅ (extend) + new migration test |
| CAPT-11 | Migration 027 adds columns; portable-settings accept-on-restore | unit | `npx vitest run src/db/migrations/027-*.test.ts` + `src/backup/backup-schema.test.ts` | ❌ Wave 0 |
| CAPT-15 | No straggler legacy vocab; consumers use Tone literals | regression | `npx vitest run src/db/ai-context-read.test.ts src/db/digest-read.test.ts` + grep audit | ✅ (verify) |
| CAPT-12/13/14 | Update Contact loop; preselect; failure preserves state | unit | new `update-contact-*-logic.test.ts` | ❌ Wave 0 |
| all UI flows | on-device behavior | manual UAT | build debug APK on droid, run on Pixel | manual |

### Sampling Rate
- **Per task commit:** the touched module's `*.test.ts` via `npx vitest run <file>` (< 30s).
- **Per wave merge:** `npm test` + `npm run check:colors`.
- **Phase gate:** full suite green + on-device UAT of the four flows before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/screens/log-interaction-logic.ts` (+test) — channel-sensitive Direction/Connected defaulting (CAPT-08), backdate handling (CAPT-07).
- [ ] `src/db/migrations/027-<name>.ts` (+test) — Default Interaction Channel columns.
- [ ] Update-Contact chooser + post-log-note pure logic modules (+tests).
- [ ] Extend `app-settings-dao.test.ts`, `create-contact-logic.test.ts`, `quick-log-command.test.ts`, `backup-schema.test.ts`.
- [ ] `check:colors` must stay green — no new colour literals (compose theme tokens).

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface; local-first, single device. |
| V3 Session Management | no | N/A. |
| V4 Access Control | yes (data-scoping) | Interaction reads/writes scoped by BOTH `id` AND `contact_id` (trust boundary T-32-11). [VERIFIED: interaction-edit-read.ts:63-69; recency-dao.ts:342-372] |
| V5 Input Validation | yes | Every value `?`-bound (no interpolation) in DAOs; assert-validators for settings; future-date guards. [VERIFIED: recency-dao.ts:33-34] |
| V6 Cryptography | no | No crypto in this phase; AI keys SecureStore-only and untouched. |
| Privacy / data egress | yes | Per-interaction Allow AI gate default OFF; Group Notes never transmitted; `ai-context-read` never selects the note column. ADR-078. [VERIFIED: ai-context-read.ts:8-26] |

### Known Threat Patterns for RN/SQLite + AI-egress
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via a custom-field/channel label | Tampering | `?`-bound params; `col_name` guarded by `isSafeColName`; static SQL. [VERIFIED: ai-context-read.ts:22-26] |
| Silent AI-egress widening (note transmitted without consent) | Information disclosure | Allow AI default OFF; note egress not implemented here; type-default affects new items only (ADR-078 risks). |
| Group Note leaking to AI | Information disclosure | Absolute ban regardless of Allow AI (ADR-078). STOP-AND-ASK if any group-note path touches the toggle. |
| Recency corruption via direct write | Tampering/integrity | Single-writer spine; recompute MAX; `changes===1` assertions. [VERIFIED: recency-dao.ts:342-374] |

## STOP-AND-ASK Items (trip-wires from the planning-notes + dossier — surface to owner if triggered)
1. **Allow AI default-ON or Group-Note-through-toggle** — E-05/D-04/ADR-078 reversal. (owner-bucket, security/privacy)
2. **Dropping the tri-state last-spoke control from Add Contact** — ADR-016 (costly) reversal, R-13 ESCALATE.
3. **Reversing D-06 "no `interaction_assists` rebuild"** — the transport CHECK stays; map to Message at log time.
4. **Any new `interactions` schema/vocabulary migration** — would double-migrate the shared table (CAPT-15 is already satisfied by Phase 32); if a real need appears, escalate.
5. **Adopting AsyncStorage for the Channel preference** — D-09 requires `app_settings`.
6. **Renaming the `LogContact` route id or the `'log-contact'` stored enum** — internal identifiers; only the user-facing label is D-11's "Log Interaction". Renaming is owner-scope.
7. **Coercing omitted Tone to Neutral** — D-08 reversal.

## Project Constraints (from CLAUDE.md)
- Local-first, no backend/network on any read path; the only AI egress is the user-invoked feature, gated per-interaction. Widening egress is owner-decision.
- SQLite migrations: forward-only, strict order, irreversible in production, never edit a shipped migration, add a new one. Logic that would be an RPC lives in TypeScript.
- All interaction writes through the recency spine; `contacts.last_contact` has ONE writer.
- All colours via theme tokens; `check:colors` gate; never drive animation from React state (N/A here but respected).
- Use `formatLocalDate()`/`localDateTime()`, never `toISOString().split`.
- TypeScript + Biome; Zustand stores; DAOs in `src/db/`, never inline SQL in components.
- Git worktrees DISABLED; agents never push. (This is a research doc — nothing committed/branched.)
- "Review the code, not the diff": every file:line above was opened on disk this session.

## Sources

### Primary (HIGH confidence — opened on disk this session)
- `src/db/database.ts`, `src/db/recency-dao.ts`, `src/db/interaction-vocabulary.ts`, `src/db/ai-context-read.ts`, `src/db/digest-read.ts`, `src/db/interaction-assist-dao.ts`, `src/db/interaction-edit-read.ts`, `src/db/memory-registry.ts`, `src/db/memories-dao.ts`, `src/db/app-settings-dao.ts`, `src/db/contacts-dao.ts`
- `src/db/migrations/025-interaction-history-schema.ts`, `026-group-events-schema.ts`, `020-dashboard-swipe-pref.ts`
- `src/components/TouchpointRefineForm.tsx`, `touchpoint-refine-logic.ts`, `tri-state-last-spoke-logic.ts`, `MemoryEditor.tsx`
- `src/screens/create-contact-logic.ts`, `src/services/quick-log-command.ts`
- `src/backup/backup-schema.ts`, `src/backup/restore-apply.ts`, `src/backup/export-manifest.ts`
- `src/navigation/types.ts`, `src/navigation/tabs/DashboardStack.tsx`, `src/screens/placeholders/FabActionPlaceholders.tsx`
- `docs/decisions/ADR-016-*.md`, `docs/decisions/ADR-078-*.md`
- `.planning/config.json`, `.planning/REQUIREMENTS.md` (CAPT-01…15), `package.json`
- Dossier + planning-notes + 34-CONTEXT.md + 34-UI-SPEC.md (required reading)

### Secondary / Tertiary
- None. No web sources; all findings verified in-repo.

## Metadata

**Confidence breakdown:**
- Standard stack (in-repo modules): HIGH — every module opened, signatures quoted.
- Architecture / D-07 resolution: HIGH — migration 025/026 read verbatim; consumers confirmed updated.
- Pitfalls / trip-wires: HIGH — grounded in ADR text + code + dossier.
- New migration column names (A1): MEDIUM — discretion; finalize at plan time.

**Research date:** 2026-09-12
**Valid until:** 2026-10-12 (stable) — but re-verify the migration head number and any 2026-09-01-dated planning-note code cite on disk at plan time; the codebase moves every schema phase.
