---
phase: 4
reviewers: [codex, claude]
reviewed_at: 2026-08-15T04:33:14Z
plans_reviewed: [04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md, 04-05-PLAN.md, 04-06-PLAN.md, 04-07-PLAN.md, 04-08-PLAN.md, 04-09-PLAN.md]
note: >
  Owner override for this run — SELF_CLI treated as 'none' so BOTH the codex CLI
  and an independent `claude -p` subprocess reviewed the plans (the normal
  same-CLI skip was explicitly waived). Both reviewers were instructed to verify
  every plan claim against the actual source on disk (project rule: review the
  code, not the diff). Codex could not run `npm test` in its sandbox (Vitest temp
  dir init failed) but did read source; the claude subprocess read source and
  reported no execution issue.
---

# Cross-AI Plan Review — Phase 4: Contact CRUD & Lifecycle

## Codex Review

## Summary

The plans are strongly grounded in the existing data model and correctly target the non-reentrant transaction boundary. However, several lifecycle guarantees are currently only UI conventions or unproven assumptions. I’d revise before execution: the phase otherwise risks incomplete purge behavior, archived-contact leaks, and false confidence in atomic writes.

## Strengths

- No migration is needed: `contacts` already has lifecycle, reach, and status columns, and `contact_links` already has the required FK, UID, label, and ordering fields. [001-initial.ts:62] [001-initial.ts:84]

- The core/wrapper approach is correct. The shared mutex is explicitly non-reentrant, so extracting non-transactional cores is the right way to compose create/edit writes. [transaction.ts:11] [mutex.ts:32]

- The proposed `rarely_responds` recompute is necessary and correctly located in the data layer. The existing recency SQL changes its MAX filter based on that flag. [recency-dao.ts:131] [04-05-PLAN.md:105]

- The plans preserve custom-field safety: existing custom values are TEXT-backed and dynamic identifiers are guarded before interpolation. [field-values-dao.ts:12] [field-values-dao.ts:63]

- The DB purge fan-out correctly includes `field_history`, which has no FK and would otherwise orphan records. [001-initial.ts:119] [04-09-PLAN.md:110]

## Concerns

- **HIGH — Atomicity is asserted but not adequately tested.** Plan 02’s tests cover success, “not yet,” and non-hanging behavior, but not a failure after the contact/interaction inserts and during a custom-value write. A sequential two-transaction implementation could pass those tests. [04-02-PLAN.md:82] The transaction wrapper does roll back correctly when used once, but that needs an end-to-end proof for the new composed DAO. [transaction.ts:43]

- **HIGH — Archive will not be hidden “everywhere.”** The only current live-contact query filters `archived_at IS NULL`. [queries.ts:26] But the planned edit read is `WHERE c.id = ?` without that predicate, so an archived profile/edit route can still load a contact by ID. [04-05-PLAN.md:128]

- **HIGH — Purge is not structurally limited to archived contacts.** The plan’s DAO deletes by `id` alone. [04-09-PLAN.md:112] The UI route restriction is helpful but does not enforce the two-stage safety guarantee at the destructive write boundary.

- **HIGH — “One transaction” cannot cover photo-file or notification cleanup as designed.** `photo` is a path stored on the contact row, not a transactional SQLite resource. [001-initial.ts:69] Plan 09 calls an optional callback inside the SQLite transaction but explicitly passes none in this phase. [04-09-PLAN.md:112] [04-09-PLAN.md:135] That neither deletes files/notifications now nor gives reliable atomicity once those systems exist.

- **MEDIUM — The custom-values UID contract is underspecified on edit.** `upsertValue` requires the UID of the single per-contact values row. [field-values-dao.ts:26] Yet `getContactForEdit` returns only the contact, category label, and values map; Plan 06 says to “obtain it or mint-on-first-value” without defining where that happens. [04-05-PLAN.md:128] [04-06-PLAN.md:85]

- **MEDIUM — Link save semantics are unresolved.** “On save or immediately per row action” are materially different flows, and the plan does not define how unsaved rows receive stable local IDs, how dirty/deleted rows are reconciled, or what the user sees when metadata saves but a link operation fails. [04-07-PLAN.md:131]

- **MEDIUM — Navigation contradicts the approved UI contract.** The UI spec requires Settings to host Custom Fields, Reachability, and Archived contacts. [04-UI-SPEC.md:191] Plan 01 explicitly renders only two rows. [04-01-PLAN.md:125] Also, native-stack headers plus each screen’s custom Back/title chrome will likely produce duplicate headers unless `headerShown` is deliberately configured; `CustomFieldsScreen` already renders its own Back control. [CustomFieldsScreen.tsx:325]

- **LOW — “Back gesture” should not be an acceptance claim for Android.** Android predictive back is explicitly disabled in app config. [app.config.ts:25] Promise native system Back behavior, not a gesture, unless that owner decision changes.

## Suggestions

- Add transaction-proxy tests that assert exactly one `BEGIN`, and inject a custom-value failure after contact/interaction insertion; assert every affected table remains unchanged. Repeat this rollback proof for `updateContactFull`.

- Make all live single-contact reads filter `archived_at IS NULL`, or have profile/edit redirect when the row is archived. Add tests for both direct reads.

- Have `purgeContact` first verify `archived_at IS NOT NULL` inside its transaction, then delete with an asserted one-row result. Add a test that purging a live contact rejects without deleting children.

- Reframe purge cleanup as: atomic database deletion plus idempotent post-commit cleanup. Make the cleanup dependency a real registered adapter, and require Phases 5/11 to wire it; do not claim file/OS cancellation is part of the SQLite transaction.

- Return the `contact_custom_values.uid` in `getContactForEdit`, or provide a named `getOrCreateCustomValuesRowUid` core. Ensure one UID is generated once per contact save.

- Pick one link persistence model before implementation. I’d use local draft rows and persist the full link diff after metadata saves, with explicit partial-save error handling.

- Reconcile the Settings/Reachability discrepancy and choose either native-stack headers or custom screen chrome, not both.

Validation note: `tsc` and the colour gate pass on the current tree. `npm test` could not initialize Vitest’s temporary SSR directory in this review environment, so I could not independently execute the existing DAO suites.

## Risk Assessment

**HIGH** until the atomic-write tests, archived-read filtering, and destructive purge guard are tightened. The overall architecture is good, but these gaps sit directly on contact visibility and irreversible deletion paths.

---

## Claude Review

I read the referenced source on disk (migration 001, `recency-dao.ts`, `transaction.ts`, `field-values-dao.ts`, `field-ddl.ts`, `field-defs-dao.ts`, `queries.ts`, `status.ts`, `launch-sweep.ts`, `database.ts`, `theme-*`, `App.tsx`, `HomeScreen.tsx`, `CustomFieldsScreen.tsx`, the field widgets, `scripts/check-colors.sh`, `package.json`) and checked each plan claim against it.

# Cross-AI Plan Review — Phase 4: Contact CRUD & Lifecycle

## 1. Summary

This is a strong, unusually well-grounded plan set. The three highest-risk technical claims all check out against the code: migration 1 really does ship every column and both tables the phase needs (`001-initial.ts:61-94`), so no migration is added; the composed-core pattern really is re-entrancy-safe because the two functions being promoted to cores (`recomputeLastContact` at `recency-dao.ts:137` and `insertInteraction` at `recency-dao.ts:157`) contain no `inWriteTransaction`/`withMutex` call today; and the purge fan-out covers every table that actually references `contacts`, including `field_history`, which has no FK (`001-initial.ts:155-163`) and therefore genuinely never cascades. The single-writer `last_contact` invariant is correctly preserved — the metadata UPDATE column list in 04-05 omits `last_contact`, and the `rarely_responds`-flip recompute (Pitfall 2) is real and correctly ordered. The problems are not in the data layer; they are at the **form→DAO boundary and in scope/decision authority**: the create path silently drops `phone` (a named CRUD-01 field), the edit form deletes a last-spoke control that a locked owner decision names by hand, no plan pins an initial `interval_days` even though the DAO hard-rejects a non-positive one, and two of the phase's own cross-cutting obligations (never-contacted home; the launch-sweep archived-purge hook) are unowned by any of the 9 plans.

## 2. Strengths

- **The re-entrancy claim is verified, not asserted.** `transaction.ts:42-57` shows `inWriteTransaction` = `withMutex` + hand-rolled BEGIN, and `mutex.ts` is the single non-reentrant chain the header at `transaction.ts:11-29` warns about. `recomputeLastContact` (`recency-dao.ts:137-154`) and `insertInteraction` (`recency-dao.ts:157-192`) are both plain `async (exec, …)` bodies with **no** mutex/BEGIN inside them — so 04-02's plan to export them and call them from one outer `inWriteTransaction` in `createContactFull` is genuinely deadlock-free. Same for `upsertValue`'s body at `field-values-dao.ts:107-118`, which is exactly `assertSafeCol` + one `runAsync` inside the wrapper. The precedent the plans cite is real: `dropFieldColumns` (`field-ddl.ts:113-137`) is a private non-mutexed core called directly from inside `deleteOrQuarantineField`'s single transaction (`field-ddl.ts:171-187`).
- **The `rarely_responds` → recompute coupling is correctly diagnosed and correctly sequenced.** `recency-dao.ts:143-153` filters `AND (contacts.rarely_responds = 0 OR i.connected = 1)` by reading the flag *from the contacts row*, so 04-05's ordering (metadata UPDATE first, then conditional recompute inside the same txn) makes the recompute see the new flag. The test 04-05 Task 1 demands — assert a concrete `last_contact` **value** before and after the flip, not merely that a function was called — is the right shape and mirrors `recency-dao.test.ts:230-276`.
- **Purge fan-out is complete against the actual schema.** Every child declaring `ON DELETE CASCADE` to `contacts` is covered — `contact_links:88`, `interactions:100`, `events:119`, `contact_custom_values:150`, `fuel:171` — plus `field_history` (`:155-163`, no FK, `contact_id INTEGER NOT NULL` with no REFERENCES). 04-09 correctly declines to rely on cascade even though `PRAGMA foreign_keys = ON` is set at `database.ts:102`, and correctly refuses to fabricate the photo/notification deletes.
- **No migration, and the plans caught upstream doc drift.** CONTEXT (`04-CONTEXT.md:59`, `:124`) calls the ordering column `sort` and describes `contact_links` as "a new child table … a migration"; the actual DDL is `display_order` on an already-shipped table. Every plan uses `display_order` and none adds a migration — the correct resolution.
- **Injection surface is honestly scoped.** Contact metadata, links, name, phone are all `?`-bound; the only interpolated identifier remains a custom `col_name` behind `isSafeColName` (`field-values-dao.ts:46-50`, `field-ddl.ts:59-64`). 04-07's links DAO adds no interpolation site, and mutations are both-key scoped with `assertOneChange`, mirroring the WR-04 precedent at `recency-dao.ts:228-246`.
- **The colour gate will actually work as the plans assume.** `scripts/check-colors.sh` accepts file *or* directory targets and excludes only paths under `/theme/`, so 04-09's `danger: "#E5484D"` in `theme-presets.ts` is the one sanctioned location and `npm run check:colors src App.tsx` is a valid invocation.
- **Wave/dependency graph is acyclic and consistent.** 01,02 (w1) → 03,05 (w2) → 04 (w3) → 06 (w4) → 07,08 (w5) → 09 (w6); every `depends_on` is satisfied by an earlier wave. `RootNavigator.tsx` is touched by 01/04/06/08 but never in the same wave.

## 3. Concerns

### HIGH — `phone` is collected on the create form and then silently discarded

`04-02` defines `createContactFull`'s input as `{ uid, name, intervalDays, now, categoryId?, rarelyResponds?, firstInteraction?, rowUid?, customValues? }` — no `phone` — and Task 2 instructs "INSERT the contacts row (uid, name, category_id, interval_days, rarely_responds, created_at, modified_at — **reuse the column set from createContactWithInteraction**)". That column set is exactly `recency-dao.ts:301-303`, which has no `phone`. `04-04` Task 1 then renders `Phone (keyboardType="phone-pad")` in the fixed block and builds `{ uid, name, intervalDays, now, categoryId, rarelyResponds: 0, rowUid, customValues }` — **phone never reaches the DAO**. CRUD-01 (`REQUIREMENTS.md:43`) names phone explicitly, and `04-UI-SPEC.md:167` fixes the order as Name → Category → Frequency → Last-spoke → **Phone**. `contacts.phone` exists (`001-initial.ts:70`), so this is purely a dropped field in the plan, and it is the field that most directly feeds the decay→SMS core loop. The user types a number, saves, and it is gone until they open the edit form.

### HIGH — the edit form deletes the last-spoke control that a locked decision names by hand

`04-06` Task 1: *"Explicitly do NOT render a last-spoke control (single-writer; Phase-6 logging owns interaction edits) — leave a short code comment stating this boundary so it is not read as an omission."* But `04-CONTEXT.md:67-69` (owner-accepted, Area 3) states a name-only contact refines via "Add details" opening the full edit form, **"surfacing frequency + last-spoke + phone first"**, and `04-UI-SPEC.md:180` repeats it verbatim. The planner has resolved a genuine contradiction in the upstream docs (the "Edit-contact form" section at `04-UI-SPEC.md:174` does not list last-spoke) by dropping half of an owner-accepted decision, inside a plan, with only an inline code comment as the record. Per CLAUDE.md ("Enforcing a recorded decision is a planner call. Reversing one is the owner's"), this needs to go back to the owner, not be settled in 04-06. The practical consequence is real: a contact created via "Not yet" (or, later, share-sheet capture) has `last_contact IS NULL`, is excluded from `STATUS_SCAN` (`queries.ts:28`), and has **no reachable surface anywhere in the app to set a first contact date** until Phase 6 ships.

### MEDIUM — no initial `interval_days`, so the primary create path likely fails at the DAO

`04-04` says "Save is blocked only on empty Name; all else optional", and `04-03` defines `FrequencyPicker({ value: number; onChange })` as a controlled component — so the *screen* owns the initial value, and neither plan states it. `createContactFull` rejects before opening any transaction if `!Number.isInteger(intervalDays) || intervalDays <= 0` (the guard 04-02 copies from `recency-dao.ts:289-298`). A user who fills only a name gets `intervalDays must be a positive integer` surfaced as "Couldn't save contact. Please try again." Pin a default (Monthly = `FREQUENCY_DAYS.Monthly` = 30, `types.ts:21`) in 04-04's state initialisation, and say what happens when the "Custom…" input is in its invalid state at save time.

### MEDIUM — the link-scheme mitigation is weaker than the threat register claims

`04-07` Task 2: "prepends `https://` when the url has no scheme (**no `://`**)". Threat T-04-09 claims this means "a raw `javascript:`/`file:` string is not honoured as typed". It does for `javascript:alert(1)` (no `://` → becomes a harmless `https://javascript:alert(1)`), but **not** for `javascript://x%0aalert(1)`, `file:///…`, or — the one that matters on Android — `intent://…#Intent;…;end`, all of which contain `://` and pass through to `Linking.openURL` unchanged. The check should be a positive allowlist (`/^https?:\/\//i` → open as-is; otherwise strip any scheme and prepend `https://`), not a substring test for `://`. Self-inflicted risk (the user typed the URL), hence MEDIUM not HIGH, but the mitigation as written does not do what the register says it does.

### MEDIUM — CRUD-02's future-date rejection has no DAO guard and no automated test

CRUD-02 (`REQUIREMENTS.md:44`) ends "…and a future date is rejected." The only enforcement in the plan set is `04-03` Task 3's `TriStateLastSpoke` `onChange`, which is device-UAT only (`04-RESEARCH.md`: UI is not unit-tested). Contrast `interval_days`, which the plans deliberately validate at *both* entry (04-03) and the write chokepoint (04-02). Nothing in `createContactFull` compares `firstInteraction.occurredAt` to `now`, and 04-02's test list contains no future-date case. A future `occurred_at` makes `PROGRESS_SQL` (`status.ts:59`) negative, pinning the contact `stable` indefinitely — the exact failure 04-03's own threat T-04-05 describes. Add the guard to `createContactFull` alongside the interval guard and a node:sqlite test.

### MEDIUM — the purge extension hook is placed inside the transaction

`04-09` Task 2: `opts.onPurgeExtensions?: (contactId) => Promise<void>` "called **inside the transaction body**". Phases 5/11 will register a photo-file `unlink` and `expo-notifications` cancels there. Both are non-transactional OS side effects: if a later statement throws, the ROLLBACK at `transaction.ts:53` restores the rows but the photo file is already gone; and an awaited filesystem/OS call holds the single shared mutex and an open `BEGIN` for its duration. The hook should fire **after** COMMIT (with its own failure logging), and the module header should say so — otherwise Phase 5 will wire it in the documented-but-wrong place.

### MEDIUM — two phase-level obligations are unowned by any of the 9 plans

- **Success criterion 4** ("Never-contacted and archived are reachable as separate homes", `ROADMAP.md:196`). Plan 08 delivers Archived. Never-contacted is owned by Phase 8 per `04-CONTEXT.md:19`, but no plan records that deferral, so `/gsd-verify-work` will read criterion 4 as half-failed with no explanation on file.
- **The launch-sweep archived-purge hook.** `ROADMAP.md:47` assigns "archived-contact purge (**Phase 4**)" to the sweep, and `launch-sweep.ts:6-8` names "archived-purge" as a registry responsibility a later phase fills. No plan calls `registerSweepHook`. This may well be stale — `04-UI-SPEC.md:128`'s empty-state copy ("kept here until you delete them permanently") implies indefinite retention, which an auto-purge would contradict — but the contradiction should be resolved and recorded, not left silent.

### MEDIUM — the `contact_custom_values` row-uid on the edit path is under-specified

`04-06` Task 1: "pass the contact's own row uid; **obtain it or mint-on-first-value** per the upsert UID CONTRACT." That contract (`field-values-dao.ts:29-37`) is explicit and load-bearing: `uid` is the per-**contact** row uid, written on INSERT only, and it is the Phase-16 merge key. The safe implementation is a single defined behaviour — read `SELECT uid FROM contact_custom_values WHERE contact_id = ?` in `getContactForEdit`, and mint one only when the row is absent. As written, an executor could plausibly mint a fresh uid per save; that happens to be harmless while the row exists (`ON CONFLICT(contact_id) DO UPDATE` never touches `uid`), which is exactly what makes it a latent bug rather than an obvious one. Note also that `createContactFull` only creates the row when `customValues` is non-empty, so the edit path *is* the first-insert path on a fresh install with no `show_on_new` fields.

### MEDIUM — link persistence timing and atomicity left open

`04-07` Task 3: "Persist link edits by calling the `contact-links-dao` ops directly **on save (or immediately per row action)**." These are materially different products — immediate-write means editing a URL and backing out still persists. The plan also deliberately keeps link writes out of `updateContactFull`'s transaction, which is a defensible call, but it means a save can commit metadata and then fail on links (or vice versa) with no user-visible reconciliation. Pick one, and say what the screen shows when the second half fails.

### LOW

- **`recomputeLastContact` is being exported un-suffixed and undocumented as non-mutexed.** `field-ddl.ts` keeps `dropFieldColumns` **private** precisely so nobody calls a core outside a transaction (`field-ddl.ts:106-112`). 04-02 exports `recomputeLastContact` publicly with no `Core` suffix and no header warning; a future caller invoking it bare would write `last_contact` outside the mutex. Name it `recomputeLastContactCore` and carry the non-reentrancy comment.
- **Duplicate-name matching is case-sensitive.** `SELECT 1 FROM contacts WHERE name = ? …` (04-02 Task 3) will not warn on "chris" vs "Chris". Consider `name = ? COLLATE NOCASE`.
- **The `danger` token lands in wave 6, after every screen that needs it.** `04-UI-SPEC.md:93` scopes `danger` to "Purge 'Delete permanently' button, **duplicate-name/validation warning emphasis**", but 04-03 Task 2 explicitly falls back to `textSecondary`+`borderStrong` "because the danger token is NOT available until Plan 09", and nothing revisits it. Move the two-line token addition into 04-01 (wave 1) and the spec is honoured everywhere.
- **`occurred_at` string format for "Pick date" is not pinned.** `TriStateLastSpoke` emits `formatLocalDate(picked)` = `YYYY-MM-DD` (`dates.ts:17-22`), but the DAO's timestamp contract is `YYYY-MM-DD HH:MM:SS` (`recency-dao.ts:37-41`). 04-04 says "at local midnight" — spell out `` `${date} 00:00:00` `` so a bare 10-char value never lands in `occurred_at`/`last_contact`.
- **Impact-summary "custom values" count is a row count, not a field count.** `contact_custom_values` is one row per contact (`001-initial.ts:150`), so `COUNT(*)` is 0 or 1.
- **`|| true` on the RED verify** (04-02 Task 1, 04-05 Task 1) makes the automated gate unconditionally pass; the "must genuinely fail" criterion is unverified.
- **Three executor-facing "OR"s** in autonomous plans: 04-01 Task 3 (`onBack` prop vs `useNavigation`), 04-02 Task 2 (alias vs direct export), 04-07 Task 3 (save-time vs immediate).
- **RESEARCH A3 (restore writes an `events` row) is silently dropped.** 04-08 makes restore a pure flag flip. Probably right, but the `events` table exists and 04-log exported it as a contract; a one-line note would close it.

## 4. Suggestions

- Add `phone` to `createContactFull`'s input and its INSERT column list in 04-02, and to the input object 04-04 builds. Add a node:sqlite assertion that a created contact's `phone` round-trips.
- Escalate the edit-form last-spoke question to the owner before executing 04-06, naming the two halves: `04-CONTEXT.md:67-69` / `04-UI-SPEC.md:180` (surface last-spoke first on the refine path) vs. the single-writer/Phase-6 boundary. If the answer is "defer", record it in CONTEXT and STATE, not in a code comment.
- In `createContactFull`, add a `firstInteraction.occurredAt <= now` guard beside the interval guard, and a test for it — closing CRUD-02's last clause with the same both-layers discipline the interval already gets.
- Move `onPurgeExtensions` outside `inWriteTransaction` (fire after COMMIT), and document in the module header that non-DB cleanup is post-commit and best-effort so Phases 5/11 wire it correctly.
- Move the `danger` token addition from 04-09 Task 1 to 04-01 (it has no dependencies), so FrequencyPicker, the duplicate-name warning, and the future-date error can all use it as `04-UI-SPEC.md:93` specifies.
- Replace 04-07's `://` substring test with `/^https?:\/\//i`, and update T-04-09's mitigation text to match what the code does.
- Pin the create form's initial `intervalDays` to `FREQUENCY_DAYS.Monthly` (or the owner's preferred default) in 04-04, and state the save behaviour when the custom-interval input is invalid.
- Have `getContactForEdit` return the existing `contact_custom_values.uid`, and make 04-06 pass it (minting only when null) — removing the "obtain it or mint" ambiguity.
- Add one explicit note in 04-08 or the phase summary that never-contacted (success criterion 4) is Phase 8's, and resolve the `ROADMAP.md:47` archived-purge sweep assignment either by registering a hook or by recording that v1 archive retention is indefinite per `04-UI-SPEC.md:128`.
- Rename the exported recompute to `recomputeLastContactCore` and carry `transaction.ts`'s non-reentrancy warning into its doc comment.

## 5. Risk Assessment

**MEDIUM.**

The genuinely irreversible surfaces are well covered. No migration is added (correctly — the schema already has everything, verified line by line), so the "permanent on unreachable devices" class of risk is not in play at all this phase. The two data-corruption paths that *are* in play — the non-reentrant-mutex composition and the `rarely_responds` recompute — are both correctly analysed against the real code and carry mandatory node:sqlite tests. The purge, the one unrecoverable user action, deletes every table that actually references `contacts` plus the non-cascading `field_history`, inside one transaction, behind a two-stage flow.

What pulls this to MEDIUM rather than LOW is the concentration of gaps at the form→DAO seam, where the plans' own verification is weakest: screens are device-UAT only, so a dropped `phone`, a missing interval default, and a UI-only future-date guard are exactly the failures the automated gates cannot catch. Add the decision-authority issue on the edit form's last-spoke control — a locked, owner-accepted item being narrowed inside a plan — and the two unowned phase obligations, and the phase is likely to reach `/gsd-verify-work` with a partially-unmet CRUD-01, an unexplained criterion 4, and a reversed decision on the record. All are cheap to fix before execution; none require rethinking the architecture, which is sound.

---

## Consensus Summary

Both reviewers verified the phase's three load-bearing technical claims against the source and found them sound: **no migration is added** (migration 001 already ships `contact_links` plus every needed `contacts` column — `001-initial.ts:61-94`); the **non-reentrant-mutex composition is genuinely deadlock-free** (the promoted cores `recomputeLastContact`/`insertInteraction`/`upsertValue`-body contain no `inWriteTransaction`/`withMutex`, and the `deleteOrQuarantineField` precedent is real); and the **purge fan-out is complete** against the actual schema, including the no-FK `field_history`. The single-writer `last_contact` invariant and the `rarely_responds`-flip recompute (correctly ordered after the metadata UPDATE) both hold. Architecture is not in question — the risk is concentrated at the **form→DAO seam and in decision authority**, where the plans' own automated verification is weakest (screens are device-UAT only). Codex rated overall risk HIGH; claude rated it MEDIUM; both agree the fixes are cheap and pre-execution.

### Agreed Strengths

- No migration needed — schema already complete; verified line by line (both).
- Core/wrapper composition is the correct, verified-safe way to compose atomic writes on the non-reentrant mutex (both).
- `rarely_responds` recompute is correctly diagnosed and located in the data layer (both).
- Purge fan-out covers every `contacts`-referencing table plus the non-cascading `field_history`, explicitly (not via cascade), in one transaction (both).
- Custom-field injection surface is honestly scoped — `?`-bound values, the only interpolated identifier stays behind `isSafeColName` (both).

### Agreed Concerns

- **Purge extension hook placed inside the SQLite transaction** (codex HIGH, claude MEDIUM). Both independently flagged that a photo-file `unlink` / notification-cancel is a non-transactional OS side effect that cannot be rolled back and holds the shared mutex + open BEGIN while awaited; it belongs **after** COMMIT as idempotent best-effort cleanup. Fix the design *and* the module-header wording so Phases 5/11 wire it in the right place.
- **Custom-values row-uid on the edit path is under-specified** (both MEDIUM). "obtain it or mint-on-first-value" is ambiguous; the safe single behaviour is to return `contact_custom_values.uid` from `getContactForEdit` and mint only when the row is absent.
- **Link persistence timing/atomicity is open** (both MEDIUM). "on save OR immediately per row action" are different products; link writes sit outside `updateContactFull`'s transaction, so a partial (metadata-committed, links-failed) save has no defined user-visible reconciliation.

### Divergent Views

- **Overall risk level.** Codex says **HIGH** (weight on the visibility + irreversible-delete paths); claude says **MEDIUM** (weight on the irreversible surfaces being well covered, gaps being cheap and at the UI seam). The delta is severity framing, not a factual disagreement.
- **Distinct HIGHs, non-overlapping — complementary blind spots (the point of dual review):**
  - *Codex-only:* (a) atomic composition is asserted but has **no mid-composition-failure rollback test** — a sequential two-transaction impl could pass the current tests; (b) **archived contacts remain loadable by id** — `getContactForEdit` (`WHERE c.id=?`) and `getContactHeader` (`WHERE id=?`) lack the `archived_at IS NULL` predicate that `STATUS_SCAN` uses, so "hides everywhere" isn't enforced at the read layer; (c) **purge deletes by id with no `archived_at IS NOT NULL` guard** at the destructive write boundary — the two-stage safety is only UI-routing-enforced.
  - *Claude-only:* (d) the create path **silently drops `phone`** (a named CRUD-01 field the form collects but never passes to the DAO); (e) Plan 06 **removes the last-spoke control from the edit form, reversing the owner-accepted CONTEXT Area 3 decision** ("surface frequency + last-spoke + phone first" on the refine path) inside a plan with only a code comment — a CLAUDE.md decision-authority escalation, not a planner call.

  *(Synthesizer note: I verified all five against the source on disk and all five hold. (a)–(c) are latent/forward in Phase 4 — no current route reaches an archived contact's edit screen, and purge is only reached from the Archived list — but each is a cheap, structural hardening of an invariant/irreversible path and should be incorporated. (d) is live data loss against an explicit requirement. (e) requires owner escalation before 04-06 executes.)*

---

## Cycle 2 Review (2026-08-15) — codex + independent Claude, verifying the revision

**Both reviewers: every cycle-1 finding RESOLVED** — 5 HIGH + the contested archived-read item + the full MEDIUM/LOW set, each verified against source on disk (recency-dao, migrations, queries, theme, field-values-dao, app.config). The owner's last-spoke ruling is recorded in 04-CONTEXT.md and enforced in Plans 05/06 (tri-state iff `last_contact IS NULL`, writing a first interaction via the single writer). All four deferrals judged legitimate and recorded. No regression to the lifecycle safeguards. Consensus risk: LOW (claude) / MEDIUM (codex) — zero HIGH.

**New concerns raised in cycle 2 (all non-HIGH — closed in cycle 3):**
- **MEDIUM (codex)** — `createContactFull` `rowUid` is optional in the input but passed unconditionally to `upsertValueCore`, which requires a non-null UID (strict TS). Mint the values-row uid inside the DAO when `customValues` is non-empty (or make it required then).
- **MEDIUM (codex)** — a link-write failure occurs *after* the metadata transaction commits (two-transaction design), yet the plan shows a generic "Couldn't save contact"; the contact details actually saved. Use explicit partial-save copy ("Contact saved — links couldn't be saved") and re-seed the committed metadata state (Plan 07).
- **LOW (codex)** — the archived-by-id no-filter rationale (Plans 05/08) claims it enables archived-list editing, but the Archived list exposes only Restore/Delete. Narrow the rationale to future/direct-route access (there is no Phase-4 edit-from-archived path).
- **LOW (claude)** — Plan 01's slice-summary line still reads "native header + back gesture", contradicting the plan's own `headerShown:false` + system-Back fix. Correct the stale wording.
- **LOW (claude)** — `computeImpact` returns an `events` count that `impactSummaryLines` never renders (harmless now: no events writer, count is always 0). Add a note to surface events in the blast-radius copy when the events subsystem lands.
- **LOW (claude)** — `TriStateLastSpoke`'s initial-value contract is implicit (Plan 03 "default Today" vs Plan 06 "default Not yet"). Specify the component is purely controlled — `value` is authoritative; no internal default overrides it.
- **DOC** — ROADMAP.md still nominally assigns archived-contact purge to Phase 4; update it to reflect the recorded indefinite-retention deferral (removes the cross-phase contradiction).
