---
phase: 28-dashboard-card-view
verified: 2026-09-06T09:45:00Z
status: gaps_found
score: "0/5 roadmap must-haves verified"
behavior_unverified: 4
overrides_applied: 0
gaps:
  - truth: "Bulk Quick Log is immediate and reversibly undoable for a selected batch."
    status: failed
    reason: "A second press while the first batch is pending starts another bulk transaction. The singleton Snackbar retains only the later receipt, leaving the first committed batch without the advertised Undo path."
    artifacts:
      - path: "src/components/BulkActionSurface.tsx"
        issue: "Action controls disable only at selectedCount === 0; there is no in-flight disabled state."
      - path: "src/screens/HomeScreen.tsx"
        issue: "performBulkQuickLog has no synchronous single-flight/pending guard."
    missing:
      - "Fence every bulk action with a synchronous in-flight guard plus rendered pending state."
      - "Add a deferred-write test proving a double press commits one Quick Log batch and retains its Undo receipt."
  - truth: "Bulk Set Category applies only to contacts selected when the operation is committed."
    status: failed
    reason: "The async category read captures selected IDs before await and stores that stale snapshot in the picker; a user can exit or change selection before choosing a category."
    artifacts:
      - path: "src/screens/HomeScreen.tsx"
        issue: "onBulkOpenCategoryPicker captures ids before listCategories; picker commit uses picker.ids without revalidating a selection session."
    missing:
      - "Bind the picker to a selection-session token and revalidate at open and commit, or lock selection while it is pending."
      - "Add a deferred category-read test for exit/change-selection before commit."
behavior_unverified_items:
  - truth: "The avatar-first grid remains readable at large text scale and handles grapheme-rich names/context/search snippets without layout corruption."
    test: "On a Pixel, inspect normal, large-text, and grapheme-rich contacts in normal and search Card View."
    expected: "Normal portrait is a compact three-column grid; large text reflows rather than clamps; text remains single-line ellipsized without broken graphemes."
    why_human: "The relevant plan truths are backstop/device-UAT checks; TypeScript and source inspection cannot observe native layout or React Native text shaping."
  - truth: "Card taps and long presses are correctly disambiguated and all eight menu actions operate from a real card."
    test: "Tap and long-press a card, then exercise the context-menu actions and TalkBack actions."
    expected: "Tap opens Profile only; long press opens the ordered eight-item menu only; no Delete or Archive row appears."
    why_human: "There is no rendered-card/device interaction test; symbol wiring cannot prove native gesture arbitration or accessibility action delivery."
  - truth: "Multi-select freezes the result universe, replaces controls, and Back exits selection before navigation."
    test: "Enter selection both ways, refresh/change the dashboard results, Select All, and use Android Back."
    expected: "Only entry-time rows remain selectable; controls are replaced, count updates, and Back exits selection without navigating."
    why_human: "Store tests cover isolated state only; no integration test exercises the HomeScreen async entry, renderer fence, or BackHandler."
  - truth: "After successful bulk operations selection persists while Archive removes only archived cards, and count-aware detailed logging reaches the intended destination."
    test: "Perform each bulk action with one and multiple selected contacts, including Archive and Log Interaction."
    expected: "Ordinary actions preserve selection, Archive removes archived cards, one contact goes to individual logging, and two or more go to Group Log with participant IDs."
    why_human: "No HomeScreen/UI integration test exercises post-commit selection lifetime, navigation, confirm dialogs, or native picker behavior."
---

# Phase 28: Dashboard Card View Verification Report

**Phase Goal:** The Card view gives an avatar-first grid for fast visual scanning and becomes the single home for multi-select bulk management of contacts.
**Verified:** 2026-09-06T09:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Avatar-first responsive Card grid scans real Dashboard contacts with status, favourite, context, and search presentation. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `HomeScreen` obtains real SQLite `DashboardRow[]`, passes them to `CardGrid`, which renders `GridCard`; source has responsive keyed columns, ring/glyph/star, shared empty states and search data. Device text-scale/grapheme/layout backstops are untested. |
| 2 | Tap opens Profile; long-press offers exactly the non-destructive per-contact menu, without List swipes. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `GridCard` owns RN `onPress`/`onLongPress`; `CardContextMenu` contains the locked eight action rows and no swipe dependency. No rendered/native gesture test exists. |
| 3 | Multi-select is entered from menu or overflow, freezes the result universe, replaces Dashboard controls, and exits before Back navigation. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Store, render filter, selection controls, overflow callback, and `BackHandler` exist and are wired. No integration test covers their async/user interaction sequence. |
| 4 | Bulk management safely performs the required actions, including immediate reversible Quick Log and current-selection category updates. | ✗ FAILED | Two observable release failures: duplicate Quick Log presses can leave a committed batch unundoable, and deferred Set Category can mutate contacts no longer selected. |
| 5 | Bulk Archive is recoverable and selection persists correctly after normal operations. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | DAO archive events, confirm copy, `removeFromUniverse`, and count-aware routing are present; no UI/integration test exercises post-commit behavior. |

**Score:** 0/5 roadmap truths verified (4 present but behavior-unverified)

## Requirements Coverage

| Requirement | Source plans | Status | Evidence |
| --- | --- | --- | --- |
| CARDV-01 | 01 | ⚠️ NEEDS HUMAN | Responsive real-data `CardGrid`/`GridCard` exists; device grid geometry/text scale remains unobserved. |
| CARDV-02 | 01, 04 | ⚠️ NEEDS HUMAN | Shared status/ring/snooze composition and deterministic line-3 selector exist; rendered native presentation is untested. |
| CARDV-03 | 01, 04 | ⚠️ NEEDS HUMAN | Binary optimistic star and shared search descriptors/snippet are wired; search geometry/highlight requires device check. |
| CARDV-04 | 05 | ⚠️ NEEDS HUMAN | Locked menu and canonical routes are source-verified; native tap/long-press/accessibility delivery has no test. |
| CARDV-05 | 03, 06 | ⚠️ NEEDS HUMAN | Entry points, circles, tap toggle, and count are wired; full UI flow is not tested. |
| CARDV-06 | 03, 06 | ⚠️ NEEDS HUMAN | Store snapshot plus renderer fence/control replacement are present; no HomeScreen flow test proves it at runtime. |
| CARDV-07 | 02, 07 | ✗ BLOCKED | Set Category may operate on stale, no-longer-selected IDs after `listCategories` resolves. |
| CARDV-08 | 02, 07 | ✗ BLOCKED | A duplicate small-batch Quick Log can create an Undo receipt that the singleton Snackbar overwrites. |
| CARDV-09 | 07 | ⚠️ NEEDS HUMAN | Source routes 1 to `LogContact`, 2+ to serializable `GroupLog.participantIds`; navigation flow has no UI test. |
| CARDV-10 | 02, 07 | ⚠️ NEEDS HUMAN | Transactional archive with immutable events and non-destructive confirmation copy are present; actual archive/restore UX is untested. |
| CARDV-11 | 02, 07 | ⚠️ NEEDS HUMAN | Frequency-only sensitive surface and positive-integer DAO guard exist; picker/confirmation needs device exercise. |
| CARDV-12 | 03, 06, 07 | ⚠️ NEEDS HUMAN | `removeFromUniverse`, ordinary-operation persistence by omission, and `BackHandler` are wired; no interaction test covers the sequence. |

All twelve requirement IDs are claimed by at least one plan; none is orphaned. The two blocked requirements prevent the phase goal from being achieved.

## Plan Must-Have Audit

| Plan | Explicit source/test checks | Result | Exceptions |
| --- | --- | --- | --- |
| 28-01 | Grid components, semantic icon registry, shared data/empty-state/favourite wiring | Present and flowing | Two Pixel-only backstop truths (text reflow and grapheme rendering) remain unverified. |
| 28-02 | Transactional composers, canonical Quick Log shape/receipt/undo, archive events, single-column category/frequency cores | Verified by focused DAO tests | Warning: `bulkSnooze` resolves the preset date once per contact, so a batch crossing midnight can use different dates. |
| 28-03 | Ephemeral frozen-universe store, toggle fence, Select All, archive removal, exit | Partially verified by focused store tests | Warning: `enterSelection` accepts a seed not in its supplied universe, defeating the store-level invariant for a non-card caller. |
| 28-04 | Shared candidate/search reads and deterministic strict-tier compact selector | Verified by focused selector tests | One Pixel grapheme/ellipsis backstop remains unverified. |
| 28-05 | Eight-row menu, canonical host routes, no destructive rows/swipes | Present and wired | Tap/long-press and accessibility interaction need device evidence. |
| 28-06 | Selection entry, controls, renderer fence, overflow enablement, Back hook | Present and wired | No integration test proves persisted async entry or Back behavior. |
| 28-07 | Explicit action surface, DAO calls, confirmations, undo path, routing, archive removal | Partially wired | Quick Log single-flight and category selection-session integrity are missing (blocking). |

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/components/GridCard.tsx` | Avatar-first presentational card | ✓ VERIFIED | 454 substantive lines; shared Avatar/ring/glyph/recency/a11y helpers; no DB/navigation imports. |
| `src/components/CardGrid.tsx` | Responsive virtualized grid | ✓ VERIFIED | Uses `useWindowDimensions`, keyed `FlatList`, full shared list surface contract, and real rows. |
| `src/components/CardContextMenu.tsx` | Eight-action contact menu | ✓ VERIFIED | 163 substantive lines; fixed eight rows, semantic icons, no Delete/Archive. |
| `src/components/BulkActionSurface.tsx` | Explicit bulk controls | ⚠️ PARTIAL | Surface is substantive and mounted, but has no pending-operation fence. |
| `src/db/bulk-actions-dao.ts` | Atomic bulk composers | ✓ VERIFIED | One outer write transaction and core composition per action; focused SQLite tests pass. |
| `src/stores/dashboard-selection-store.ts` | Ephemeral frozen selection session | ⚠️ PARTIAL | No persistence/DB usage and toggle is fenced; unvalidated `seedId` can be out of universe. |
| `src/logic/card-line3-selection.ts` | Compact deterministic line-3 selection | ✓ VERIFIED | Shared date utility, strict tiers, birthday exclusion, stable prompt selection; focused tests pass. |
| `src/navigation/types.ts` | GroupLog participant-ID handoff | ✓ VERIFIED | `GroupLog: { participantIds?: number[] } | undefined` is serializable and used by bulk routing. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| SQLite dashboard reads | CardGrid → GridCard | `reload` sets real `rows`; CardGrid maps each row | ✓ WIRED | `dashboard-read.ts` runs `SELECT ... FROM contacts`; no static/mock fallback. |
| Grid star | HomeScreen favourite overlay/DAO | rendered membership → existing optimistic `toggleFavourite` | ✓ WIRED | Binary membership is `favourite_rank !== null`; no rank ordering in Card components. |
| Grid status | shared ring/glyph utilities | `isSnoozed` display state → `ringVisual` + `StatusGlyph` | ✓ WIRED | Null state omits glyph; snooze uses neutral ring plus snooze glyph. |
| Menu/overflow Select | frozen selection store | `enterSelection(rows.map(...))` | ⚠️ PARTIAL | Normal callers seed valid rows, but store accepts an arbitrary out-of-universe seed. |
| Bulk surface | DAO composers | HomeScreen callbacks | ✗ NOT SAFE | Calls are wired, but duplicate submission and stale category snapshot violate correctness. |
| Small Quick Log | receipt → Snackbar Undo → atomic undo DAO | `undoBulkQuickLog(receipt)` | ✗ NOT SAFE | First of overlapping receipts is overwritten by the singleton snackbar. |
| Archive success | selection store | `removeFromUniverse(ids)` | ✓ WIRED | Removes from both selected IDs and frozen universe after DAO success. |
| Detailed Log | navigation | 1 `LogContact`; 2+ `GroupLog({participantIds})` | ✓ WIRED | Consumption is intentionally deferred to Phase 33, not a Phase 28 gap. |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `HomeScreen`/`CardGrid` | `rows` | `listDashboardPopulation` / `composeDashboardSearch` → SQLite `contacts` query | Yes | ✓ FLOWING |
| `GridCard` line 3 | `line3ByContactId` | `readLine3Candidates` → `selectCardLine3` | Yes | ✓ FLOWING |
| `GridCard` search rows | `searchResultsByContactId` / `item.snippet` | `composeDashboardSearch` descriptors | Yes | ✓ FLOWING |
| Bulk category picker | `categories` | `listCategories(getExecutor())` | Yes, but target IDs are stale after async wait | ⚠️ STALE_TARGET |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Type integrity | `npx tsc --noEmit` | Exit 0 | ✓ PASS |
| Theme-token integrity | `npm run check:colors` | Exit 0 | ✓ PASS |
| Bulk atomicity/undo/frequency/archive | `npx vitest run src/db/bulk-actions-dao.test.ts` | Included focused run: 23 total tests across phase test files, exit 0 | ✓ PASS |
| Frozen-store/line3/overflow contracts | `npx vitest run ...selection-store... ...line3... ...overflow...` | Included focused run: 23 total tests, exit 0 | ✓ PASS |
| Duplicate Quick Log / stale category selection | Requirement-linked test search | No test found | ✗ FAIL |

## Probe Execution

Step 7c: SKIPPED — no phase-declared or conventional `scripts/*/tests/probe-*.sh` probes exist.

## Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `bulk-actions-dao.test.ts` | CARDV-07/08/10/11 | 11 | 0 | No writes/circular fixture generation | Value + transaction behavior | PASS |
| `dashboard-selection-store.test.ts` | CARDV-05/06/12 | 6 | 0 | No | Value/state behavior | PARTIAL — lacks invalid seed case |
| `card-line3-selection.test.ts` | CARDV-02/03 | 6 | 0 | No | Value/determinism | PASS |
| `dashboard-overflow-actions.test.ts` | CARDV-05 | 2 | 0 | No | Value/callback | PARTIAL — does not test HomeScreen async persistence/entry |

No disabled linked tests or circular expected-value generation was found. The missing duplicate-submit and stale-category tests are blocker-level because they leave core bulk behavior unproved and the source demonstrates the failures.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/components/BulkActionSurface.tsx` | 51, 97–99 | Disabled state depends only on zero selection | 🛑 BLOCKER | Allows overlapping writes and loss of first Undo receipt. |
| `src/screens/HomeScreen.tsx` | 973–978, 1756–1764 | Async picker holds stale selected ID snapshot | 🛑 BLOCKER | Category can mutate no-longer-selected contacts. |
| `src/stores/dashboard-selection-store.ts` | 31–39 | Seed ID not fenced to frozen universe | ⚠️ WARNING | Non-card caller can select an ineligible contact. |
| `src/db/bulk-actions-dao.ts` | 131–138 | Snooze date resolved once per contact | ⚠️ WARNING | One batch can span local midnight and assign different dates. |

No unreferenced `TBD`, `FIXME`, or `XXX` markers were found in phase-modified files. Existing `GroupLog` placeholder comments in navigation are explicitly tracked to Phase 33 and are not completion-debt markers for this phase.

## Decision Coverage

`check.decision-coverage-verify` reports **11/11** trackable `28-CONTEXT.md` decisions honored. This is advisory and does not override the observable failures above.

## Human Verification Required After Gap Closure

1. **Grid readability and text handling**

   **Test:** Exercise normal/large text, emoji/combining-mark names, context, and search snippets on a Pixel.
   **Expected:** Compact avatar-first layout reflows rather than clamps; graphemes and ellipses render correctly.
   **Why human:** Native RN measurement/text shaping is not covered by automated tests.

2. **Card interaction and accessibility**

   **Test:** Tap/long-press cards and invoke their TalkBack actions.
   **Expected:** Tap and long-press are mutually exclusive; eight safe actions are reachable and correctly routed.
   **Why human:** No render/device gesture test exists.

3. **Selection and bulk workflow**

   **Test:** Enter selection through both paths, refresh results, Select All, use Back, and run every bulk action for one and multiple contacts.
   **Expected:** Frozen universe, control replacement, count, archive disappearance, confirmations, routing, and reduced-motion behavior all hold.
   **Why human:** These cross native UI, navigation, storage, and accessibility boundaries.

## Gaps Summary

The Card renderer and DAO foundation are substantive, wired, and flow real data. The phase is nevertheless blocked because its advertised multi-select bulk-management home is unsafe under ordinary UI timing: a double press can create an unundoable Quick Log batch, and an async category picker can mutate a stale selection. Neither concern is scheduled to a later milestone phase, so neither is deferred.

---

_Verified: 2026-09-06T09:45:00Z_
_Verifier: the agent (gsd-verifier)_
