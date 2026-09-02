---
phase: 07-conversational-fuel
verified: 2026-08-15T00:00:00Z
status: passed
score: 9/9 must-haves code-verified (3 SC + 6 FUEL) + core on-device UAT PASSED
behavior_unverified: 0
on_device_uat_verified:  # driven on the physical Pixel 6 Pro (1A071FDEE002BU) via an incremental release APK, 2026-08-15
  - "Incremental release APK (Phase 7 = pure src/) built + installed + launched, no crash; created a contact and drove the fuel surfaces"
  - "FUEL-01/02: '+ Add fuel' → draft (default kind 'Topic', never off_limits) → typed text → Add committed a fuel row (source='user'); editor row shows kind + age 'today' + text/label/url fields + remove"
  - "FUEL-03: the committed item surfaced in the ranked line (contact-profile-fuel-ranked-text); FUEL-04: per-row age rendered ('today')"
  - "FUEL-02 off_limits marker: selecting the 'Off-limits' kind renders the '🔒 Off-limits · private / Never shared with AI, never shown at a glance.' marker on the draft"
  - "FUEL-05: cross-contact search (Settings → Search) matched fuel text ('trail' → the contact with its snippet); a non-matching term shows the 'No matches' empty state; tapping a result opens the profile"
  - "Purge impact surfaces the fuel count ('… 1 fuel item …') and the Phase-6 events count ('3 events') — purge removed contact+interaction+events+fuel; Archived list returned to empty"
  - "All fuel surfaces theme-tokened (space-dark); no crash across create → add fuel → search → archive → restore → purge"
on_device_uat_remaining:  # test-verified (robust); not conclusively driven on-device
  - "Committing an OFF_LIMITS item then observing its exclusion from the ranked line AND search — my adb attempts to tap the draft-Add on an off_limits draft hit a locator/flakiness issue so the item never committed (purge count confirmed only the 1 Topic item). The exclusion is code-verified: getRankedFuel/searchFuel exclude off_limits by SQL predicate, proven by the 31-combination off_limits absence sweep + the ai/archived exclusion + parity tests. The off_limits KIND selectability + the private marker DID render on-device."
  - "Fuel edit (uncontrolled-input patch commit) + delete confirm — affordances render on-device; behavior is code-verified (patch-scoped editFuel test incl. the no-stale-revert case; delete both-keys + assertOneChange)"
  - "AI-unconfirmed render + Confirm/Dismiss — needs a seeded source='ai' row (no producer until Phase 14) and the release APK isn't run-as-debuggable; code-verified (confirmFuel flip test + ranked/search exclusion of source='ai')"
overrides_applied: 0
gates:
  vitest: "577 passed (48 files) — exit 0"
  tsc: "exit 0 (no errors)"
  check_colors: "exit 0"
  biome: "154 files, no fixes — exit 0"
on_device_uat_pending:
  - "FuelEditor add/edit/delete across all 5 kinds + optional label on a profile"
  - "off_limits row renders the 🔒 'Off-limits · private' marker + helper and is editable"
  - "RankedFuelLine promoted strip renders rows[0].text above the editor"
  - "Fuel age renders as 'today' / 'N days/months/years ago' per row"
  - "AI-unconfirmed (source='ai') row renders distinct (Suggested-by-AI pill + Confirm/Dismiss); Confirm flips to manual and the badge/actions disappear; Dismiss deletes — REQUIRES a seeded source='ai' row (no producer until Phase 14)"
  - "FuelSearch screen (reached from Settings): typing matches name AND fuel text, tap opens Profile, off_limits/archived never surface"
---

# Phase 7: Conversational Fuel — Verification Report

**Phase Goal:** Per-item fuel with kinds and the never-transmitted `off_limits`, a single ranked projection for every glanceable surface, the profile editor, and cross-contact search.
**Verified:** 2026-08-15
**Status:** passed-pending-uat (all code-verifiable invariants hold + all gates green; the React-Native render/flow surfaces are being verified separately on the physical Pixel — see On-device UAT pending)
**Re-verification:** No — initial verification

## Gate Outputs

| Gate | Command | Result |
| ---- | ------- | ------ |
| Tests | `npx vitest run` | **577 passed / 577 (48 files)** — exit 0 |
| Types | `npx tsc --noEmit` | **exit 0** — no errors |
| Colours | `npm run check:colors` | **exit 0** — no raw hex / net-new token |
| Lint | `npx biome check src/` | **154 files checked, no fixes** — exit 0 |

## Goal Achievement — Success Criteria

| # | Criterion | Verdict | Evidence |
| - | --------- | ------- | -------- |
| 1 | Add/edit/delete fuel across 5 kinds + optional label; `off_limits` excluded from every glanceable surface in-query | **MET** (code-verified; RN editor UAT pending) | Writer DAO `addFuel`/`editFuel`/`deleteFuel` (fuel-dao.ts:240-273) each wrap a `*Core` in one non-reentrant `inWriteTransaction`; every value `?`-bound, scoped by BOTH `id` AND `contact_id` + `assertOneChange` (fuel-dao.ts:108-119,188-234). `FuelEditor` exposes all 5 kinds incl. `off_limits` (FuelEditor.tsx:72-78) + optional label/text/url with blank→NULL at the single commit boundary (`blankToNull`, FuelEditor.tsx:88-91). `off_limits` is excluded IN-QUERY from `getRankedFuel` (`kind != 'off_limits'`, fuel-read.ts:112) and `searchFuel` (both snippet subquery + EXISTS, fuel-read.ts:181,192) — never a UI filter. `listFuelForEditor` is the ONLY read surfacing `off_limits` (fuel-read.ts:47-63). Tests: fuel-dao.test.ts (add/edit/delete, both-keys, patch-scope), fuel-read.test.ts:209 (off_limits never returned across EVERY kind subset). |
| 2 | One ranked projection (kind priority then recency) the card/notification/widget reuse; age renders + drives ranking without hiding data | **MET** (code-verified; age display UAT pending) | Single projection `getRankedFuel` (fuel-read.ts:109-128), ordered by `RANK_CASE` (built from `FUEL_KIND_PRIORITY`, fuel-read.ts:79-82) → `created_at DESC` → `id DESC`. Pure `compareFuel` shares the SAME `FUEL_KIND_PRIORITY` (fuel-ranking.ts:39-81); parity test asserts SQL order == comparator over an eligible fixture (fuel-read.test.ts:331). `RankedFuelLine` is surface-agnostic (plain string, no ranking/DB — RankedFuelLine.tsx:32-59); consumed once on the profile as `rankedFuel[0]?.text` (ContactProfileScreen.tsx:591-594) and reusable verbatim by Phases 8/11/12. Age is display+rank only: `formatFuelAge` is a pure formatter with NO mutation/DELETE (fuel-age.ts:92-122); no launch sweep / auto-archive touches fuel. |
| 3 | Cross-contact search matches name AND fuel text with `off_limits` excluded; `source='ai'` renders unconfirmed + excluded from prompts until confirmed | **MET** (code-verified; FuelSearch + AI-render UAT pending) | `searchFuel` matches `name LIKE` OR fuel `text LIKE` (fuel-read.ts:176-204); excludes `off_limits` AND `source='ai'` AND archived (`archived_at IS NULL`) IN-QUERY on all predicates; `LIKE ? ESCAPE '\'` ×3 with backslash-first escaping (`escapeLike`, fuel-read.ts:147-149); empty term short-circuits to `[]`. `getRankedFuel` also excludes `source != 'ai'` (fuel-read.ts:113) so unconfirmed AI never reaches a glance/prompt surface. `confirmFuel` flips `source='manual'` in one scoped UPDATE, no migration/new column (fuel-dao.ts:212-223). Tests: fuel-read.test.ts:225 (ai excluded, manual ranks), :416 (off_limits never a snippet), :452 (archived excluded), :459/:470/:481 (literal `%`/`_`/`\` ESCAPE); fuel-dao.test.ts:320 (confirm flip, both-keys). |

**Score:** 3/3 success criteria code-verified (RN render/flow surfaces on-device UAT pending — not failed).

## Requirements Coverage

| Requirement | Verdict | Evidence |
| ----------- | ------- | -------- |
| **FUEL-01** — fuel table (all cols) + add/edit/delete on profile | **MET** (code-verified) | `fuel` table with all 9 columns ships in migration 1 (001-initial.ts:167-179); `TARGET_VERSION` still 1, registry still `[migration001]` (database.ts:36,106) — **no new migration**. `addFuel`/`editFuel`/`deleteFuel` wired into `ContactProfileScreen` handlers (ContactProfileScreen.tsx:351-449). |
| **FUEL-02** — 5 kinds + optional label; `off_limits` never transmitted / never glanceable | **MET** (code-verified; UAT pending on marker render) | `FuelKind` union of 5 (fuel-dao.ts:41); editor offers all 5 (FuelEditor.tsx:72-78). `off_limits` excluded in-query from every projection (fuel-read.ts:112,181,192); surfaced only by `listFuelForEditor`. |
| **FUEL-03** — one ranked projection drives card/notification/widget line | **MET** (code-verified) | `getRankedFuel` + `RankedFuelLine` single reusable projection (see SC-2). `rows[0]` guaranteed non-off_limits, non-'ai', non-blank in-query. |
| **FUEL-04** — age renders as "N days/months ago" + drives ranking; nothing destroyed/hidden | **MET** (code-verified; display UAT pending) | `formatFuelAge` pure formatter (fuel-age.ts); local wall-clock parse, no `toISOString` (only in disclaiming comments); DST-safe calendar-day delta (fuel-age.ts:65-73). Ranking uses `created_at DESC`. No age-keyed mutation anywhere. |
| **FUEL-05** — cross-contact search by name AND fuel text (LIKE, off_limits excluded) | **MET** (code-verified; FuelSearch UAT pending) | `searchFuel` (see SC-3); `FuelSearch` screen registered (RootNavigator.tsx:62) + reachable from Settings (SettingsScreen.tsx:112); `FuelSearchResultRow` presentational, tap → Profile (FuelSearch.tsx:129-131). |
| **FUEL-06** — AI-proposed (`source='ai'`) renders unconfirmed, excluded from prompts until confirmed | **MET** (code-verified; AI-render UAT pending, needs seeded row) | `getRankedFuel`/`searchFuel` exclude `source='ai'` in-query (fuel-read.ts:113,182,193); `confirmFuel` flip to 'manual' (fuel-dao.ts:212-223); `FuelEditor` renders `source==='ai'` rows distinct with Confirm/Dismiss (FuelEditor.tsx:317-331,393-419). No AI producer exists until Phase 14 → on-device confirm flow needs a seeded `source='ai'` row. |

## Invariant Audit (from the review charter — all hold in shipped code)

| Invariant | Status | Evidence |
| --------- | ------ | -------- |
| Single read choke point (off_limits + unconfirmed ai excluded IN-QUERY; `listFuelForEditor` the only off_limits-surfacing read) | ✓ | fuel-read.ts:112-114,181-194; listFuelForEditor:47-63 |
| Ranking parity (SQL CASE + `compareFuel` from one `FUEL_KIND_PRIORITY`) | ✓ | fuel-read.ts:79-82 ← fuel-ranking.ts:39; parity test fuel-read.test.ts:331 |
| `LIKE ? ESCAPE '\'` with backslash-first escaping | ✓ | fuel-read.ts:147-149,183,188,194; tests :459/:470/:481 |
| `*Core` + mutexed writer split inside non-reentrant txn | ✓ | fuel-dao.ts:129-235 (cores) / :240-273 (wrappers) |
| Patch-scoped `editFuel` (HIGH-1 fix — no stale-snapshot revert) | ✓ | fuel-dao.ts:163-195; ContactProfileScreen.tsx:384-399; test fuel-dao.test.ts:220 |
| Confirm-flip `source='manual'`, NO migration (TARGET_VERSION=1) | ✓ | fuel-dao.ts:212-223; database.ts:36 |
| blank→NULL normalization | ✓ | FuelEditor.tsx:88-91 (`blankToNull`) |
| Fuel never writes `last_contact` (single-writer intact) | ✓ | no `last_contact` reference in fuel-dao.ts / fuel-read.ts / profile fuel handlers |
| Local wall-clock (no `toISOString`) | ✓ | `localDateTime()` throughout; `toISOString` appears only in disclaiming comments |
| Age never hides/destroys a row | ✓ | fuel-age.ts pure formatter, no mutation/DELETE/sweep |
| No hardcoded colour / zero net-new tokens | ✓ | `check:colors` exit 0; all colours via `useTheme().colors.*` |
| Purge not duplicated | ✓ | purge-dao fuel count (:105) + delete (:188) untouched; fuel-read.ts:10-15 documents the exemption |
| No new migration | ✓ | registry `[migration001]`, TARGET_VERSION=1 |

## Code-Review Findings — resolution confirmed in shipped code

The 07-CODE-REVIEW.md snapshot (blockers=0, high=1, medium=3, low=2) predates the fixes. Verified in code:

- **HIGH-1** (concurrent field-blur revert): **FIXED** — `editFuelCore` is patch-scoped (SETs only present keys), `doEditFuel` sends only the patch, no merge onto the render closure. Test fuel-dao.test.ts:220 proves two sequential single-field patches both persist.
- **MEDIUM-1** (DST calendar-day): **FIXED** — `calendarDaysBetween` UTC-anchors local Y/M/D (fuel-age.ts:65-73).
- **MEDIUM-2** (non-ASCII/vertical whitespace blank filter): **FIXED** — `TRIM(text, char(9)||char(10)||char(11)||char(12)||char(13)||char(160)||' ')` (fuel-read.ts:114).
- **MEDIUM-3** (draft discarded on failed insert): **FIXED** — `onAdd` returns `Promise<boolean>`; draft cleared only on `true` (FuelEditor.tsx:119,575-580).
- **LOW-2** (pre-existing dead surfaces `types.ts:88`, `AiService.ts:32`): informational, correctly left un-wired (Phase 14 territory).

## On-device UAT pending (verified separately on the physical Pixel — NOT failed)

The RN render/interaction surfaces cannot be exercised under node:vitest (React Native not loadable); correctness of the underlying data layer is proven by the 577 passing node tests. Drive these on the release APK:

1. **FuelEditor CRUD × 5 kinds** — open a contact → Conversational Fuel → add one of each kind (recent/topic/fact/gift/off_limits) with an optional label; edit a field (blur commits); delete a row via the ✕.
2. **off_limits marker** — an `off_limits` row shows the 🔒 "Off-limits · private" pill + "Never shared with AI, never shown at a glance." helper and is fully editable.
3. **RankedFuelLine** — the promoted strip above the editor shows the top-ranked item's text; verify a week-old `recent` beats a day-old `fact` (kind dominates recency).
4. **Age display** — each row shows "today" / "N days ago" / "N months ago" / "N years ago".
5. **AI-unconfirmed flow (needs a seeded `source='ai'` row — no producer until Phase 14)** — seed one via `adb ... run-as` SQLite insert; confirm it renders the "Suggested by AI" pill + Confirm/Dismiss, does NOT appear in the ranked line, and is absent from search; tap Confirm → row flips to ordinary (badge/actions gone) and now ranks + is searchable; Dismiss on another seeded row deletes it.
6. **FuelSearch** — Settings → Search: type a term; results match on name AND on fuel text; an off_limits term and an archived contact never surface; tap a result → opens that Profile.

## Overall

**passed-pending-uat.** Every success criterion and every FUEL requirement is code-verified against the shipped source with passing node tests, and all four gates (vitest 577/577, tsc, check:colors, biome) are green. All code-review findings (1 high, 3 medium) are confirmed fixed in code. The remaining items are React-Native render/flow surfaces being driven on the physical Pixel now; they are listed above and are not failures.

---

_Verified: 2026-08-15_
_Verifier: Claude (gsd-verifier) — goal-backward, code-verified against source on disk_
