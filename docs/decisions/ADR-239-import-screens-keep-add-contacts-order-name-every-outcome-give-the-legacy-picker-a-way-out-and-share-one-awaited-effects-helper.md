# ADR-239: Import Screens Keep Add Contact's Order, Name Every Outcome, Give the Legacy Picker a Way Out, and Share One Awaited Effects Helper

**Status:** Accepted
**Date:** 2026-10-18
**Phase:** 38.12-lifecycle-import-settings-ux
**Source decisions:** D-108, D-54, D-55, D-109, D-57, D-58, D-161 (38.12-CONTEXT.md; ledger Q-14, Q-15, device batch LBL); carried D-16
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Import review listed Bound first and bulk setup Unbound first. Import review's birthday was free "YYYY-MM-DD" text. Import complete always showed six cards and merged user skips with failures. The legacy contact picker (SDK < 37) had no way out of a denied permission and lost the selection on failure. The post-import reminder and widget effects existed in three copies, one not awaited. Unbound imports never scheduled Unbound birthdays, and phone labels were replaced by "Main".

## Decision

Both import screens show the participation choice in Add/Edit Contact's order, Bound then Unbound. The default stays Unbound (D-16), so the selected default sits second (D-108). The owner wanted the default "in a different position" so import reads as different from the usual Add screen.

Import review uses the app's `BirthdayField`. An unreadable phone birthday is named in a hint under it. Import has a button role, and method warnings use the effective phone region (D-54).

Import complete shows only non-zero outcomes, as mutually exclusive person buckets: Imported, Linked, Already in Orbit, In the Bin (ADR-238), Skipped by you, Skipped — no name, Couldn't import, Needs review (D-55). A user skip is counted apart from a failure by summary logic only, with no schema change. Each outcome lists the people's names, collapsed after five with "Show all" (D-109). Imported and linked names open that person (ADR-241), and a person is named by the Orbit contact the row resolved to.

The legacy picker gets "Not now" on denied and permanent states, routed through the host-aware `exitFlow` Phase 39 can retarget (D-57, 39 D-61). It also gets Try again on a read error, keeps the list and selection on an import failure, shows "No contacts match" as an EmptyState, adds a bottom inset, and runs inside the import-flow guard.

One awaited helper, `applyImportLifecycleEffects`, runs after commit on the single, bulk, Duplicate Review and combine paths (D-58). It reconciles the schedule at most once per call: for any Bound contact, or for Unbound contacts when "Birthday alerts for Unbound contacts" is on. It refreshes the widget only for Bound imports, and an unreadable setting counts as off. A finalize failure after creation still runs the effects and does not tell the user a created contact failed. Setup and resume share one lifecycle sanitiser in `src/db/import-lifecycle.ts`.

Import carries the phone's own phone and email labels (Mobile, Work, custom) into Orbit on single and bulk import, with no forced "Main" (D-161).

## Alternatives Considered

- **Unbound first on both screens** (default first) — rejected by the owner: same-position defaults on near-identical screens would hide the difference (Q-14).
- **Counts only on Import complete** — rejected for names under each count (Q-15).
- **Store "Main" for every imported method** — the built behaviour; the owner chose the phone's labels at the device batch (LBL).

## Consequences

### Positive

- The user sees who was imported, skipped or refused, and can open them.
- Unbound imports schedule Unbound birthdays when that setting is on.

### Negative

- Import complete grows long for a large batch until a bucket is collapsed.

### Risks

- The legacy picker path runs only on SDK < 37; its first-deny states were unit-tested, not walked on a device.

## Implementation

**Key files:**
- `src/screens/ImportReviewScreen.tsx` — order, `BirthdayField`, button role, region warnings.
- `src/screens/BulkImportSetupScreen.tsx` — Bound then Unbound.
- `src/screens/bulk-import-setup-logic.ts` — `BULK_LIFECYCLE_OPTIONS`.
- `src/db/import-lifecycle.ts` — `sanitiseImportLifecycle` shared by setup and resume.
- `src/db/import-session-read.ts` — `sessionSummaryCounts`, `summaryBucketFor`.
- `src/screens/ImportCompleteScreen.tsx` — non-zero outcomes with names and Show all.
- `src/screens/LegacyContactPickerScreen.tsx` — way out, Try again, kept selection, empty search.
- `src/services/import/import-lifecycle-effects.ts` — `applyImportLifecycleEffects`.
- `src/services/import/import-acquire.ts` — single import awaits the helper.
- `src/services/import/import-driver.ts` — bulk awaits the helper.
- `src/services/import/source-consolidation.ts` — combine awaits the helper.
- `src/screens/DuplicateReviewScreen.tsx` — Import as new awaits the helper.
- `src/logic/picked-contact-map.ts` — phone labels carried into Orbit.

**Depends on:** ADR-066 (Deliberate Reviewed Import with Unbound Bulk Defaults); ADR-171 (Durable Bulk-Import Lifecycle Choice, Locked Batches, and One Pass per Session)
**Required by:** None
