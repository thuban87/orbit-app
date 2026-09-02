---
phase: 22
reviewers: [codex, cursor, claude]
reviewed_at: 2026-09-02T16:44:43Z
plans_reviewed: [22-01-PLAN.md, 22-02-PLAN.md, 22-03-PLAN.md, 22-04-PLAN.md, 22-05-PLAN.md, 22-06-PLAN.md]
models:
  codex: "gpt-5.6-terra (reasoning=high)"
  cursor: "unknown"
  claude: "claude-opus-4-8 (read-only subagent)"
model_sources:
  codex: "banner"
  cursor: "unknown"
  claude: "subagent"
---

# Cross-AI Plan Review — Phase 22 (App Shell & Navigation)

Reviewed by three independent AI systems (Codex `gpt-5.6-terra`, Cursor, and a read-only Claude subagent), each source-grounded against the actual code on disk. Every reviewer file:line claim below was re-verified by the orchestrator against the repo (per the repo's "review the code, not the diff" rule) before being folded into the consensus — including the reviewers' decision-reversal claims, which are the highest-authority findings here.

## Consensus Summary

The four-tab architecture is **correct in direction and unusually faithful to the recorded decisions** — ADR-080 (four-tab shell), ADR-044 (external→Dashboard fallback), ADR-018 (single Archived surface), D-03 (no migration; `TARGET_VERSION` stays 14, verified on disk), D-10 (predictive-back stays disabled), and the migration-gate-ahead-of-navigator invariant all survive. The plans' own file:line citations are exceptionally accurate: every existing cited symbol (reset sites, `deleteTouchpoint`/`recordTouchpoint`, the orbit:// guards, the flat `createNativeStackNavigator`) resolved as written.

The risk is concentrated in **two clusters**, both of which the plans' primary automated gate (`npx tsc --noEmit`) is structurally blind to:

1. **A decision reversal against ADR-075 (owner escalation).** Codex found — and the orchestrator verified against `docs/decisions/ADR-075-...md` (Accepted, owner-ratified 2026-09-01) — that Plan 06's `picker-read.ts` ORDER BY carries `favourite_rank ASC`, which reintroduces the retired user-facing favourite order into a *new* read path (the exact risk ADR-075's own "Risks" section names). Separately, Plans 01/04 retain the `ManageFavourites` route, the `HomeScreen:319` Dashboard entry, and the `SettingsScreen:2008` Manage-favourites entry — three surfaces ADR-075 explicitly retires "with nothing put in their place." A reviewer flagging removal of a named control (Manage favourites) is a standing escalation trigger in this repo.

2. **Incomplete cross-tab navigation coverage.** The D-08 "reset & navigate call-site inventory" claims completeness ("cross-tab navigate audit this session") but misses a cluster of in-app `navigate`/`replace` calls that break once routes are partitioned across tabs. All three reviewers independently converged here. Because Plan 01 retains a merged `RootStackParamList` back-compat alias, all of these type-check and fail only at runtime — so the plans' `tsc` verify blocks cannot catch them, and only a path-specific Pixel UAT would.

Overall consensus risk: **HIGH** (Cursor: HIGH; Codex: HIGH; Claude: MEDIUM-HIGH). Direction is sound; the phase should not execute as written until the ADR-075 reversal is resolved with the owner and the cross-tab inventory is completed.

### Agreed Strengths

- **Decision fidelity to ADR-080/044/018 and D-03/D-10** — verified on disk by all three (migration gate at App.tsx:290/297-310; deep-link guards at widget-linking.ts:103-119 untouched; `TARGET_VERSION=14`; predictive-back false at app.config.ts:76).
- **On-disk re-verification (D-06) is genuine**, not inherited from artifacts — the flat `createNativeStackNavigator` (RootNavigator.tsx:57), the nine reset sites, and `deleteTouchpoint` at recency-dao.ts:313 all match. (Codex, Cursor, Claude)
- **`deleteTouchpoint` reuse for Quick Log Undo is the correct data-layer choice** — delete-by-both-keys + tombstone + `recomputeLastContact` in one txn; no new delete DAO; single-writer invariant intact. (Codex ran the full table-writer audit: contacts-dao.ts:185/442, merge-dao.ts:153/187.) (all three)
- **Commit-truthful Quick Log** — success keyed strictly to the resolved `{interactionId}`, no optimistic snackbar — is real (`recordTouchpoint` rejects a future `occurred_at` before opening the txn). (all three)
- **Reanimated compliance** — the FAB is shared-value-driven with React state only for `pointerEvents`; no per-frame setState. (Codex, Claude)
- **Local-first + theme-token discipline** — no network on any read path; `check:colors` gates + status-hue-on-chrome prohibition. (all three)

### Agreed Concerns

- **HIGH — cross-tab navigate inventory is incomplete** (all three reviewers). Confirmed stranded/broken sites the D-08 inventory omits: `HomeScreen.tsx:536/554/572` (Backup/Orrery/Settings quick-links), `OrreryScreen.tsx:433/441 → Profile` (breaks dossier-`[DECIDED]` Orrery→Profile→Back=Orrery — Profile is only in DashboardStack), `ImportCompleteScreen.tsx:267/283 → UnboundContacts/Profile`, `ContactProfileScreen.tsx:827 → ReconcileDetail`, and the birthday-notification container `navigate("Profile")` (notification-nav.ts:101-105 → notification-gate.tsx:137).
- **HIGH — merge-completion `replace("Profile")` crashes from the reconcile origin** (Claude; verified). `src/components/MergeImpactSummary.tsx:17` calls `navigation.replace("Profile", {contactId})` on merge success; the merge cluster is reachable from reconcile (ReconcileDetailScreen.tsx:104/:144 → SurvivorSelect) inside SettingsStack, where Profile is not registered. Plan 01 defers to Plan 03 "at execution time"; Plan 03's `files_modified` excludes the merge component — unowned.
- **HIGH (meta) — `tsc --noEmit` is blind to all of the above** because the retained merged `RootStackParamList` alias lets any route name type-check regardless of its owning stack (Codex, Cursor, Claude).
- **MEDIUM — Quick Log wiring omits the required `uid`** (all three). `RecordTouchpointInput.uid` is mandatory with no default (recency-dao.ts:59-61); Plan 06 Task 3 never mints one. The canonical analog (`doLogContact`, ContactProfileScreen.tsx:339-349) passes `uid: newUid()` + `direction:"outbound"`, `connected:1`, etc.
- **MEDIUM — no freshness propagation after Quick Log / Undo** (Codex, Cursor). The profile logger calls `notifyWidgetDataChanged()` + reloads the focused view (ContactProfileScreen.tsx:350); a shell-mounted Quick Log doesn't, so status/recency/widget stay stale until a later focus. `deleteTouchpoint` also skips `bumpDataRevisionCore` (asymmetry with `recordTouchpoint` at :240), so Undo compounds the staleness.
- **MEDIUM-HIGH — shell-level FAB routing / geometry** (Codex, Cursor, Claude). A shell-mounted FAB dispatching bare `navigate("Create")` won't resolve cross-tab (must be nested `navigate("DashboardTab",{screen,params})`), and the retained `bottom:28` offset (sized for a full-screen Dashboard) will collide with the new tab bar — derive from `useBottomTabBarHeight()`.

### Divergent Views

- **ADR-075 reversal:** only **Codex** surfaced it (it read ADR-075; Cursor and the Claude subagent checked only ADR-080/044/018 and reported "no reversals"). The orchestrator independently verified Codex is correct against `docs/decisions/ADR-075-...md` and `capture-read.ts:65-67`, so it stands as the top finding despite being single-source.
- **Transient-dismiss mechanism (Plan 02):** **Codex** rates HIGH that `dismissTop()` removing a store id cannot close a component whose visibility is local React state (AddSpeedDialFab.tsx:30 `setExpanded`); Cursor/Claude treat the store design as sound in principle. Verified: the concern is real *as written* — the plans don't specify whether overlays derive visibility from the store or hold dismiss callbacks.
- **system Back == visible Back (Plan 02/04):** **Codex** rates HIGH (Compose/Capture own `hardwareBackPress` handlers at ComposeScreen.tsx:404 / CaptureScreen.tsx:216 consume Back first; existing child Back controls call `goBack()` directly; Plan 04 defers child-chrome migration). Claude rates the Plan-02 logic itself LOW. Both are compatible: the *pure logic* is clean, but the *end-to-end guarantee* isn't delivered for existing focused/child screens this phase — partly explicitly-deferred scope the owner may accept.
- **Overall risk:** Cursor & Codex HIGH; Claude MEDIUM-HIGH.

---

## Codex Review

# Phase 22 plan review

Overall: **HIGH risk; do not execute as written.** The tab-shell direction, readiness gate preservation, and recency-DAO reuse are sound. However, the route partition is incomplete and will strand existing navigation paths; the transient-store design cannot actually dismiss UI; and the plans retain rank-ordered favourites/Manage Favourites despite ADR-075 explicitly retiring both.

## Decision-reversal escalation

- **HIGH — ADR-075 is directly reversed.** Plan 01 retains `ManageFavourites`; Plan 06 orders picker results by `favourite_rank ASC`. ADR-075 requires binary favourites, retires the reorder screen and Settings/Dashboard entries, and prohibits rank deciding user-visible order. The live app still contains exactly the legacy surface and rank wiring the ADR says to retire: [ManageFavouritesScreen.tsx:98](/home/bwales/projects/orbit-app/src/screens/ManageFavouritesScreen.tsx:98), [SettingsScreen.tsx:2008](/home/bwales/projects/orbit-app/src/screens/SettingsScreen.tsx:2008), and [HomeScreen.tsx:319](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:319). See [ADR-075:18](/home/bwales/projects/orbit-app/docs/decisions/ADR-075-binary-favourite-membership-without-a-user-facing-order.md:18) and [ADR-075:40](/home/bwales/projects/orbit-app/docs/decisions/ADR-075-binary-favourite-membership-without-a-user-facing-order.md:40).

  Remove the route/screen/entries and sort favourite membership as a boolean band followed by the current Default ordering—not rank.

## Plan 01 — four-tab shell

**Summary:** Good architectural target, but the proposed route-to-tab map does not cover the existing graph. The `RootStackParamList` compatibility alias would allow TypeScript to conceal several runtime-unhandled navigation actions.

**Strengths**

- It correctly starts from the actual flat stack: [RootNavigator.tsx:57](/home/bwales/projects/orbit-app/src/navigation/RootNavigator.tsx:57).
- Preserving the migration gate is essential and feasible: the `NavigationContainer` and navigator are currently mounted only after `ready` succeeds at [App.tsx:290](/home/bwales/projects/orbit-app/App.tsx:290) and [App.tsx:310](/home/bwales/projects/orbit-app/App.tsx:310).
- It correctly preserves the strict widget URI boundary: anchored digit-only URI forms and safe-positive-integer checks are present at [widget-linking.ts:98](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:98) and [widget-linking.ts:113](/home/bwales/projects/orbit-app/src/navigation/widget-linking.ts:113).

**Concerns**

- **HIGH — the proposed Orrery stack cannot deliver Orrery → Profile → Back = Orrery.** The plan assigns only `Orrery` to `OrreryStack`, yet the real Orrery opens `Profile` at [OrreryScreen.tsx:433](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:433) and [OrreryScreen.tsx:441](/home/bwales/projects/orbit-app/src/screens/OrreryScreen.tsx:441). With `Profile` registered solely in DashboardStack, this is an unhandled action, not origin-aware back.

- **HIGH — the reset/navigation inventory misses many cross-tab calls.** Current Dashboard navigation directly targets future tab roots: Backup, Orrery, and Settings at [HomeScreen.tsx:536](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:536), [HomeScreen.tsx:554](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:554), and [HomeScreen.tsx:572](/home/bwales/projects/orbit-app/src/screens/HomeScreen.tsx:572). Import completion also directly targets Dashboard-only routes from the proposed Settings stack at [ImportCompleteScreen.tsx:267](/home/bwales/projects/orbit-app/src/screens/ImportCompleteScreen.tsx:267) and [ImportCompleteScreen.tsx:283](/home/bwales/projects/orbit-app/src/screens/ImportCompleteScreen.tsx:283). Profile also launches `ReconcileDetail`, which the plan assigns only to Settings, at [ContactProfileScreen.tsx:827](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:827).

- **MEDIUM — keeping a merged `RootStackParamList` masks these runtime faults.** The current type is a flat route list at [types.ts:22](/home/bwales/projects/orbit-app/src/navigation/types.ts:22), and the global ref uses it at [linking.ts:36](/home/bwales/projects/orbit-app/src/navigation/linking.ts:36). A merged alias lets a Dashboard child compile while navigating `"Backup"` even when its navigator no longer owns that route.

**Suggestions**

- Build a complete caller → destination → owning-stack matrix from every `navigate`, `reset`, `replace`, and injected `navigate` callback before partitioning.
- Either register the necessary profile workflow family in OrreryStack, or define and test an explicit cross-tab/profile-origin mechanism. A plain Dashboard switch does not satisfy the ADR-080 back contract.
- Type `navigationRef` as `NavigationContainerRef<TabParamList>` and force cross-tab calls into `{ screen, params }`; reserve stack-only screen props for routes actually registered in that stack.

**Risk:** **HIGH.**

## Plan 02 — transient state, retap, Back

**Summary:** Centralizing intent is sensible, but the proposed store records IDs without a mechanism to close the actual component that owns the UI state.

**Strengths**

- The existing speed dial correctly uses a Reanimated shared value, with React state only mirroring pointer-event state: [AddSpeedDialFab.tsx:27](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:27).
- Existing focused workflow handlers demonstrate why Back needs deliberate treatment: Compose and Capture already consume hardware Back at [ComposeScreen.tsx:400](/home/bwales/projects/orbit-app/src/screens/ComposeScreen.tsx:400) and [CaptureScreen.tsx:209](/home/bwales/projects/orbit-app/src/screens/CaptureScreen.tsx:209).

**Concerns**

- **HIGH — `dismissTop(): boolean` cannot dismiss a FAB, picker, or modal.** The current FAB is visually controlled by its local `open` state and `setExpanded` function at [AddSpeedDialFab.tsx:30](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:30). Removing `"fab-speed-dial"` from a Zustand array does not call `setExpanded(false)`. The same problem applies to `OverflowMenu`, whose visibility is private local state at [OverflowMenu.tsx:30](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:30).

- **HIGH — one root BackHandler will not make system Back and visible Back equivalent.** Compose and Capture have focused handlers that consume the event before the root handler can apply the resolver. Separately, many visible Back controls still call `navigation.goBack()` directly, e.g. [DigestScreen.tsx:128](/home/bwales/projects/orbit-app/src/screens/DigestScreen.tsx:128) and [ArchivedContactsScreen.tsx:181](/home/bwales/projects/orbit-app/src/screens/ArchivedContactsScreen.tsx:181).

**Suggestions**

- Store registered close callbacks or a `dismiss` command observable by each overlay—not just IDs. Ensure every shell-owned transient registers it.
- Refactor existing focused Back handlers and visible Back controls through one shared `handleBackIntent` API, retaining workflow-specific behavior after transient dismissal.

**Risk:** **HIGH.**

## Plan 03 — nested callers, completion, Discard/Keep

**Summary:** Correctly recognizes import/reconcile completion and Backup-local resets as different cases, but still depends on the incomplete route inventory.

**Strengths**

- Backup-local resets currently target `Backup` at [RestorePreviewScreen.tsx:99](/home/bwales/projects/orbit-app/src/screens/RestorePreviewScreen.tsx:99) and [RestoreResultScreen.tsx:18](/home/bwales/projects/orbit-app/src/screens/RestoreResultScreen.tsx:18), so retaining their stack-local shape is appropriate if `Backup` remains that stack’s root.
- The completed-edit replay is real: successful save currently pushes/navigates to Profile at [EditContactScreen.tsx:451](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:451).

**Concerns**

- **HIGH — N1–N4 are not the full set of broken cross-stack calls.** The plan fixes only a subset while the calls listed under Plan 01 remain unresolved. This makes the plan’s “all container-level and completion navigation resolves correctly” success criterion false.

- **MEDIUM — the proposed `beforeRemove` guard can block successful Save.** Save currently calls navigation immediately after the write at [EditContactScreen.tsx:451](/home/bwales/projects/orbit-app/src/screens/EditContactScreen.tsx:451). If dirty state is still true, `beforeRemove` intercepts that action and presents “Discard changes?” after a successful save. The plan needs an explicit confirmed-save bypass ref or a synchronously cleared baseline before dispatch.

**Suggestions**

- Add navigation tests for every cross-stack caller, not only `tsc`; the merged compatibility alias cannot prove dispatch is handled.
- Specify the save-success bypass behavior in the reusable guard API.

**Risk:** **HIGH.**

## Plan 04 — app bars, clearance, Dashboard entries

**Summary:** The reusable primitive and Group Events placeholder are appropriately scoped, but the plan does not actually migrate child visible Back controls to the shared behavior it promises.

**Strengths**

- Group Events as a Dashboard-owned destination is aligned with the dossier; it avoids a fifth tab.
- The current `OverflowMenu` already provides a themed, 44px trigger and action-row pattern at [OverflowMenu.tsx:32](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:32).

**Concerns**

- **HIGH — “leave existing child-screen chrome as-is” fails SHELL-03 and SHELL-13.** Existing child headers directly perform `goBack`, including [NeverContactedScreen.tsx:87](/home/bwales/projects/orbit-app/src/screens/NeverContactedScreen.tsx:87), [UnboundContactsScreen.tsx:55](/home/bwales/projects/orbit-app/src/screens/UnboundContactsScreen.tsx:55), and [BackupScreen.tsx:288](/home/bwales/projects/orbit-app/src/screens/BackupScreen.tsx:288). They will not dismiss a transient first or share system-Back semantics.

- **MEDIUM — the existing overflow component does not provide the claimed modal focus management.** Its `Modal` has no `accessibilityViewIsModal`, focus capture, or focus restoration at [OverflowMenu.tsx:47](/home/bwales/projects/orbit-app/src/components/OverflowMenu.tsx:47).

**Suggestions**

- Make ShellAppBar the required child-header path for screens in this phase, or add a small shared Back control and migrate every existing visible Back.
- Upgrade `OverflowMenu` itself before relying on it for a shell a11y requirement.

**Risk:** **MEDIUM-HIGH.**

## Plan 05 — universal FAB

**Summary:** The six-action contract and Reanimated posture are good, but placement and dismissal are underspecified for a shell-level FAB.

**Strengths**

- Reusing the existing shared-value/scrim pointer-events pattern is correct: [AddSpeedDialFab.tsx:31](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:31) and [AddSpeedDialFab.tsx:72](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:72).
- The action set correctly includes Group Log directly rather than through a contact picker.

**Concerns**

- **HIGH — fixed `bottom: 28` is no longer safe once the FAB is outside the tab screen.** The existing value is for a full-screen Dashboard without bottom navigation at [AddSpeedDialFab.tsx:135](/home/bwales/projects/orbit-app/src/components/AddSpeedDialFab.tsx:135). A shell-level FAB with the same offset will overlap or sit beneath the new tab bar, contrary to the dossier’s “above bottom navigation and safe areas” requirement.

- **HIGH — Plan 05 inherits the nonfunctional transient-dismiss design.** Registering `"fab-speed-dial"` in the proposed store does not close the component’s local open state unless the plan adds an actual dismiss subscription/callback.

**Suggestions**

- Derive FAB bottom position from `useBottomTabBarHeight()` and safe-area insets; have `useBottomClearance` consume the same geometry constant.
- Include a component-level test that dispatches the shared dismiss command and proves the scrim becomes inert.

**Risk:** **HIGH.**

## Plan 06 — picker and Quick Log

**Summary:** Local SQLite reads and canonical recency DAO reuse are the right foundations, but the plan has a compile blocker, an ADR-075 reversal, and lacks in-place refresh/widget propagation.

**Strengths**

- `recordTouchpoint` is the correct writer: it validates future timestamps before opening a transaction, inserts, recomputes `last_contact`, and bumps revision at [recency-dao.ts:217](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:217).
- `deleteTouchpoint` correctly scopes deletion by both interaction and contact IDs, tombstones it, and recomputes recency in one transaction at [recency-dao.ts:313](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:313).
- The full writer audit supports the single-recency-writer claim: composed create/update use `recomputeLastContactCore` at [contacts-dao.ts:185](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:185) and [contacts-dao.ts:442](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:442); merge reparents interactions then recomputes at [merge-dao.ts:153](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:153) and [merge-dao.ts:187](/home/bwales/projects/orbit-app/src/db/merge-dao.ts:187).

**Concerns**

- **HIGH — picker SQL using `favourite_rank ASC` repeats the ADR-075 reversal.** Current legacy capture SQL does exactly this at [capture-read.ts:65](/home/bwales/projects/orbit-app/src/db/capture-read.ts:65); copying it would preserve a retired user-visible ranking.

- **HIGH — the proposed Quick Log call omits required `uid`.** `RecordTouchpointInput.uid` is mandatory at [recency-dao.ts:58](/home/bwales/projects/orbit-app/src/db/recency-dao.ts:58). Existing genuine manual/widget logs mint it with `newUid()` at [ContactProfileScreen.tsx:339](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:339) and [widget-mark.ts:51](/home/bwales/projects/orbit-app/src/services/widget/widget-mark.ts:51). The plan must also explicitly use the canonical one-tap values, especially `direction: "outbound"`; DAO defaults make direction `null`.

- **MEDIUM — Quick Log and Undo have no specified freshness propagation.** The existing profile logger reloads the focused view and calls `notifyWidgetDataChanged()` after a commit at [ContactProfileScreen.tsx:350](/home/bwales/projects/orbit-app/src/screens/ContactProfileScreen.tsx:350). Plan 06 mounts outside those screens and does not modify Home/Profile or specify an invalidation mechanism, so contact status/recency and widget data may remain stale until a later focus event.

**Suggestions**

- Replace rank ordering with favourite membership grouping plus Default ordering.
- Add `uid: newUid()`, an explicit one-tap interaction shape, and a single captured `stamp` for both `occurredAt` and `now`.
- After commit and undo, publish the existing freshness/widget signal and refresh the currently focused data surface.

**Risk:** **HIGH.**

---

## Cursor Review

# Cross-AI Plan Review: Phase 22 — App Shell & Navigation

## Executive Summary

These six plans are unusually strong on decision fidelity, dossier traceability, and code-grounded inventory work. The tracer-first Plan 01, `reset-intents.ts` single-owner pattern, migration-gate preservation, and threat-model entries for deep links all match what is actually on disk. Verified: nine `.reset(` call sites, `deleteTouchpoint` at `recency-dao.ts:313`, digit-anchored widget guards at `widget-linking.ts:103–119`, and `App.tsx`'s `ready && !error` gate at lines 298–322.

The main weakness is not decision reversal — ADR-044, ADR-018, D-03, and D-10 are respected — but **incomplete cross-tab navigation coverage**. The D-08 inventory captures container-level resets and four ShareIntent/Resume sites, yet several in-app `navigate()` calls that work today in the flat stack will break or violate origin-aware Back once routes are partitioned. The plan treats SHELL-04 as automatic for Orrery→Profile (`OrreryScreen.tsx:433`), but Profile is assigned only to `DashboardStack`; that contradicts the dossier's explicit `[DECIDED]` rule at dossier lines 160–161. Until those gaps are closed, overall risk is **HIGH** despite excellent planning hygiene.

---

## Plan 01 — Four-Tab Shell + Nested Resets

### Summary
Solid architectural tracer: installs bottom-tabs, splits stacks, centralizes external-entry resets. Decision fidelity and security posture for widget deep links are well handled. The route→tab map follows real launch sites (Settings-owned import/reconcile vs stale PATTERNS guidance).

### Strengths
- **Flat stack confirmed on disk.** `RootNavigator.tsx:71–118` is a single `createNativeStackNavigator` with 32 routes — matches D-06.
- **Reset inventory is accurate.** All nine `.reset(` sites match the plan's A1–C2 table (`ComposeScreen.tsx:267`, `widget-linking.ts:274/287`, `notification-gate.tsx:136`, restore screens, import/reconcile completion).
- **Deep-link guards are real and must stay byte-for-byte.** `widget-linking.ts:103–119` uses anchored digit-only regexes plus `Number.isSafeInteger` / `id > 0`.
- **Migration gate correctly preserved.** `App.tsx:298–322` mounts `NavigationContainer` + `RootNavigator` only after `ready && !error`; plan explicitly forbids moving it.
- **No schema drift.** `database.ts:49` confirms `TARGET_VERSION = 14`; D-03 honored.
- **deleteTouchpoint correction.** Plan correctly cites `recency-dao.ts:313–345` (tombstone + scoped delete + `recomputeLastContact`) — RESEARCH A5 was wrong.
- **Profile Back is already plain `goBack()`.** `ContactProfileScreen.tsx:762` supports per-stack origin-aware back *if* Profile is registered in the launching stack.

### Concerns

| Severity | Concern | Evidence |
|----------|---------|----------|
| **HIGH** | **Orrery→Profile→Back=Orrery will not work as planned.** Plan asserts SHELL-04 holds "by construction" with Profile only in `DashboardStack`, but `OrreryScreen.tsx:433–441` calls `navigation.navigate("Profile", …)` from the Orrery tab. Without dual-registering Profile (and likely Edit/Compose/CropPhoto for Profile's downstream pushes) in `OrreryStack`, this either throws route-not-found or cross-tabs and breaks origin-aware Back — reversing dossier `[DECIDED]` Orrery→Profile→Back=Orrery. | `OrreryScreen.tsx:433`, dossier lines 160–161, plan route map (OrreryStack = Orrery only) |
| **HIGH** | **D-08 inventory omits HomeScreen cross-tab shortcuts.** After the split, `Backup`, `Orrery`, and `Settings` won't live in `DashboardStack`, but `HomeScreen.tsx:536/554/572` still `navigate()` to them. No plan task rewrites these to tab switches. | `HomeScreen.tsx:536–572`, `RootNavigator.tsx:93–96` (current flat registration) |
| **MEDIUM** | **Settings→ManageFavourites is cross-tab and unplanned.** `ManageFavourites` is assigned to `DashboardStack` only, but `SettingsScreen.tsx:2008` navigates there from Settings. Back should return to Settings (origin-aware); nested `DashboardTab` navigate would land Back on Dashboard Home instead. | `SettingsScreen.tsx:2008`, plan route map |
| **MEDIUM** | **Birthday notification `navigate` path not in reset inventory.** Plan 01 Task 2 updates reset shapes in `notification-nav.ts` but not the birthday branch (`notification-nav.ts:102–106`) consumed by `notification-gate.tsx:138` via `nav.navigate(intent.name, intent.params)`. | `notification-nav.ts:102–106`, `notification-gate.tsx:135–138` |
| **MEDIUM** | **`RootStackParamList` back-compat alias may hide breakage at compile time.** Merged alias lets `navigate("Backup")` from `HomeScreen` still type-check while failing at runtime once `Backup` moves to `BackupStack`. | `types.ts:22+`, `HomeScreen.tsx:536` |
| **LOW** | **22-PATTERNS.md Archived guidance contradicts Plan 01.** PATTERNS says single-stack registration + cross-navigate; Plan 01 dual-registers Archived (correct per ADR-080/dossier). Executor should follow the plan, not PATTERNS. | `.planning/.../22-PATTERNS.md` vs plan phase-anchor |

### Suggestions
1. Extend Plan 01 Task 1 with an explicit **Profile dual-registration matrix**: at minimum `OrreryStack` (+ child routes Profile pushes: Edit, Compose, CropPhoto); consider `SettingsStack` for `ImportCompleteScreen.tsx:283`.
2. Add a **Plan 03 Task 0 or expanded Task 1**: grep all `navigate("` call sites and classify intra-stack vs cross-tab; include `HomeScreen.tsx:536/554/572`, `SettingsScreen.tsx:2008`, `ImportCompleteScreen.tsx:267/283`.
3. Update `notification-nav.ts` NavIntent types and `notification-gate.tsx:138` for nested birthday Profile navigate.
4. For tab shortcuts on Home, either remove redundant header entries when ShellAppBar + bottom tabs ship (Plan 04) or convert to `navigation.navigate('OrreryTab')` etc.

### Risk Assessment: **HIGH** (architectural tracer is sound; cross-tab gaps threaten SHELL-04 and boot-time UAT)

---

## Plan 02 — Back Intent, Tab Retap, Nav Hide

### Summary
Clean separation of pure modules (`back-intent`, `focused-route-classification`) from wiring. Correctly limits BackHandler interception to transient dismissal only — aligns with React Navigation nested-back guidance and dossier §C.

### Strengths
- **Transient-first Back matches dossier.** Dismiss overlay before stack pop is the right layering model.
- **Focused-workflow allow-list is explicit** rather than heuristic — good for SHELL-06 maintainability.
- **`tabBarHideOnKeyboard: true`** in Plan 01 + route-based hide covers keyboard case without hand-rolled inset math.
- **No origin-aware Back override** — prohibitions correctly forbid forced Dashboard on ordinary Back.

### Concerns

| Severity | Concern | Evidence |
|----------|---------|----------|
| **MEDIUM** | **Depends on Plan 01 cross-tab fixes Plan 02 doesn't know about.** UAT criteria ("Back pops focused tab's stack to true origin") fails for Orrery→Profile until Plan 01 dual-registers Profile. | `OrreryScreen.tsx:433`, Plan 02 depends on `[22-01]` |
| **LOW** | **`back-intent.ts` is minimal** — only branches on `anyTransientOpen`. Acceptable because `shell-transient-store.dismissTop()` owns ordering; document that contract in tests. | Plan 02 Task 1 |
| **LOW** | **Visible Back wiring deferred to Plan 04** (`ShellAppBar` → `back-intent`). Plan 02 Task 3 documents the seam but Plan 04 must not ship without it or SHELL-03 is only half-delivered until Plan 04. | Plan 02 Task 3 action, Plan 04 Task 1 |

### Suggestions
1. Add acceptance criterion: **with picker + FAB both registered, two Back presses dismiss picker then FAB** (ordering edge in must_haves).
2. Gate Plan 02 on-device UAT on Plan 01 completing Profile-in-OrreryStack registration.

### Risk Assessment: **MEDIUM** (logic is sound; blocked by Plan 01 navigation gaps)

---

## Plan 03 — Container Navigates, Completion Resets, Discard/Keep

### Summary
Correctly identifies the highest-risk stranded navigations (ShareIntent, Resume prompts, import/reconcile Done resets). Backup-local resets correctly stay flat within `BackupStack`. Discard/Keep primitive follows existing `beforeRemove` idiom from `RestorePreviewScreen.tsx:94–96`.

### Strengths
- **N1–N4 sites verified on disk.** `linking.ts:64/67`, `ResumeImportPrompt.tsx:27–50`, `ResumeReconcilePrompt.tsx:45`.
- **C1/C2 completion resets confirmed.** `ImportCompleteScreen.tsx:300`, `ReconcileCompleteScreen.tsx:47` reset to `{ name: "Home" }` — correctly mapped to `resetToDashboardRoot()`.
- **B1–B3 Backup-local resets verified.** `RestorePreviewScreen.tsx:99/123`, `RestoreResultScreen.tsx:18` use `{ name: "Backup" }` — valid if `Backup` is `BackupStack` root.
- **Edit no-replay may already work.** `EditContactScreen.tsx:451` uses `navigate("Profile")`; `ContactProfileScreen.tsx:310–313` documents this pops to the existing Profile instance. Plan's verify-first approach is correct — change may be unnecessary.
- **Merge completion uses `replace`.** `MergeImpactSummary.tsx:17` — `navigation.replace("Profile", …)` already avoids replay within stack.

### Concerns

| Severity | Concern | Evidence |
|----------|---------|----------|
| **HIGH** | **Incomplete navigate inventory (same root cause as Plan 01).** Missing: `HomeScreen` tab shortcuts, `SettingsScreen→ManageFavourites`, `ImportComplete→UnboundContacts/Profile`, birthday notification navigate. | See Plan 01 concerns |
| **MEDIUM** | **Discard/Keep has no existing dirty helper.** `EditContactScreen` has `form`/`seedEditState`/`buildEditInput` but no `hasUnsavedChanges` (grep finds no dirty/unsaved helpers). Photo (`photo` state), links draft, and custom-field values are outside `EditFormState` (`EditContactScreen.tsx:171–185`). Deriving a meaningful delta is non-trivial and under-specified. | `EditContactScreen.tsx:171–185, 352` |
| **LOW** | **Import/reconcile Done → Dashboard is intentional** even though flows launch from Settings — matches historical `Home` reset behavior. | `ImportCompleteScreen.tsx:300`, dossier external-fallback vs completion semantics |

### Suggestions
1. Expand Task 1 scope with a **complete navigate audit** (not just N1–N4).
2. For Discard/Keep Task 3, specify mechanism: e.g. snapshot `seedEditState(result)` in a ref on load, compare via serialized `buildEditInput` output + photo/links deltas — or accept Phase 22 ships guard on metadata fields only and defer photo/links to Rapid Capture.
3. Add test or grep assertion that no bare `navigate("Home")` / `navigate("Profile")` remains at container level post-refactor.

### Risk Assessment: **MEDIUM–HIGH** (critical paths covered; audit holes remain)

---

## Plan 04 — ShellAppBar, Clearance, Group Events

### Summary
Good chrome-layer plan with reusable primitives, theme-token discipline, and correct rejection of fifth-tab / radial-launcher patterns. Group Events placeholder pattern matches existing `types.ts` placeholder docs.

### Strengths
- **D-09 Group Events placement correct** — Dashboard header + redundant overflow, not a tab.
- **Dual-registered Archived assumption matches Plan 01** — overflow Back returns to Dashboard.
- **Status-hue prohibition on chrome** aligns with dossier and theme rules.
- **`useBottomTabBarHeight()` for clearance** — correct vs hardcoded padding (`HomeScreen.tsx:643` currently uses static `styles.content`).

### Concerns

| Severity | Concern | Evidence |
|----------|---------|----------|
| **MEDIUM** | **HomeScreen header conflicts with new shell chrome.** Existing `topBar` (`HomeScreen.tsx:509–581`) has Backup/Orrery/Settings shortcuts that duplicate bottom tabs; Plan 04 adds `ShellAppBar` + Group Events header without addressing removal/conversion of legacy shortcuts. | `HomeScreen.tsx:509–581` |
| **LOW** | **Archived triple entry.** Footer at `HomeScreen.tsx:403–416` plus new overflow (`Plan 04 Task 3`) plus Settings row — dossier requires overflow + Settings; footer predates D-09 and may be stale redundancy. | `HomeScreen.tsx:403–416`, D-09 |
| **LOW** | **Child-screen ShellAppBar migration deferred** — acceptable boundary note, but UAT for SHELL-13 covers only tab roots + "child screens show Back+title" partially. | Plan 04 Task 1 |

### Suggestions
1. Explicit task: **reconcile HomeScreen topBar** with four-tab shell (remove Backup/Orrery/Settings shortcuts or convert Your Week-only header under `ShellAppBar`).
2. Decide footer Archived vs overflow-only — if D-09 mandates overflow, note whether footer entry should be removed to avoid three paths.

### Risk Assessment: **MEDIUM** (presentation layer; dependency on Plan 01 route correctness)

---

## Plan 05 — Universal FAB

### Summary
Strong alignment with D-05 six-action fixed order, Reanimated/shared-value animation rules, scrim pointer-events reuse, and transient-store integration. Supersedes dashboard-only `AddSpeedDialFab` (`HomeScreen.tsx:653`) with shell-level mount — correct for cross-tab consistency.

### Strengths
- **Existing FAB patterns to reuse.** `AddSpeedDialFab.tsx:27–36` uses `useSharedValue` + React `open` state only for `pointerEvents` — CLAUDE.md compliant.
- **`speedDialScrimPointerEvents` retained** from `add-speed-dial-fab-logic.ts` — Pitfall 3 addressed.
- **Group Log direct (no pre-picker)** — matches D-05.
- **Placeholder routes** follow GroupEvents pattern — good seam for Phases 24/33/34.

### Concerns

| Severity | Concern | Evidence |
|----------|---------|----------|
| **MEDIUM** | **Profile-origin detection assumes Profile route in current tab's stack.** `originContactId` from Profile params works only if Profile is registered in the active stack (Orrery issue from Plan 01). | Plan 05 Task 2, `OrreryScreen.tsx:433` |
| **LOW** | **Wave 3 depends on 22-02 + 22-04** — reasonable, but FAB UAT for retap/Back dismissal can't complete until Plan 02 transient store exists. | Plan dependency graph |
| **LOW** | **AddSpeedDialFab import flow removed from FAB** — old FAB had import (`AddSpeedDialFab.tsx:50–68`); universal six-action set correctly omits import (not in D-05). Verify no regression intent. | `AddSpeedDialFab.tsx:78–79` vs D-05 action list |

### Suggestions
1. Wire `UniversalFab` Profile-origin detection to **deepest focused route in navigation state** (handles nested stacks after dual-registration).
2. Confirm testID migration (`dashboard-create-fab`) is sufficient for any E2E relying on old two-action FAB.

### Risk Assessment: **MEDIUM**

---

## Plan 06 — Contact Picker + Quick Log

### Summary
Commit-truthful Quick Log design is excellent and matches SHELL-11. Picker ordering via static SQL mirrors `capture-read.ts` idiom. Local-first read path is correct. Undo via existing `deleteTouchpoint` preserves single-writer invariants.

### Strengths
- **`recordTouchpoint` / `deleteTouchpoint` behavior verified.** `recency-dao.ts:217–242` (txn + `{interactionId}` return + future-date guard); `recency-dao.ts:313–345` (scoped delete + tombstone + recompute).
- **Picker ordering source correctly chosen.** Plan uses `last_contact` (interaction recency), not `capture-read.ts`'s `fuel.created_at` MRU — appropriate for contact picker per dossier §G.
- **No network on read path** — matches `capture-read.ts:1–8` posture.
- **No optimistic success** — aligns with `ContactProfileScreen.tsx:332–357` error handling pattern (Alert, not fake success).

### Concerns

| Severity | Concern | Evidence |
|----------|---------|----------|
| **MEDIUM** | **`recordTouchpoint` call spec incomplete in plan text.** Required fields include `uid: string` (`recency-dao.ts:59–62`); canonical one-tap write at `ContactProfileScreen.tsx:339–348` also passes `direction: "outbound"`, `connected: 1`, etc. Plan 06 Task 3 omits `uid` and `newUid()`. | `recency-dao.ts:59–62`, `ContactProfileScreen.tsx:339–348` |
| **MEDIUM** | **Dashboard refresh after Quick Log not specified.** `HomeScreen.tsx:9–15` refreshes on focus/foreground/pull only — not on same-screen writes. Quick Log from FAB on Dashboard won't update list until tab switch unless plan calls `notifyWidgetDataChanged()` / focus refresh like Profile does (`ContactProfileScreen.tsx:352–354`). | `HomeScreen.tsx:9–15`, `ContactProfileScreen.tsx:352–354` |
| **LOW** | **`deleteTouchpoint` skips `bumpDataRevisionCore`.** `recordTouchpoint` calls it (`recency-dao.ts:240`); delete path does not (`recency-dao.ts:313–345`). Undo may leave widget/orrery stale until next foreground — pre-existing asymmetry; plan should note whether Quick Log Undo needs widget notify. | `recency-dao.ts:240 vs 344` |
| **LOW** | **Snooze marker needs explicit time comparison.** `snooze_until` column exists (`contact-read.ts:107`); plan says "in the future" but doesn't name `localDateTime()` comparator — easy to get wrong across timezone boundaries. | `contact-read.ts:107`, plan Task 1 |

### Suggestions
1. Copy the **`ContactProfileScreen.tsx:338–348` write contract verbatim** into Plan 06 Task 3 (including `uid: newUid()`, `direction: "outbound"`, `source: "manual"` or a FAB-specific source).
2. After successful Quick Log + Undo, call **`notifyWidgetDataChanged()`** and/or trigger dashboard re-query if Home is focused (mirror Profile post-log refresh).
3. Add unit test for snooze marker using wall-clock strings consistent with `localDateTime()`.

### Risk Assessment: **MEDIUM** (data-layer path is correct; write spec and UI freshness gaps)

---

## Cross-Cutting: Decision Reversal Check

| Decision | Status |
|----------|--------|
| ADR-044 external-entry → Dashboard fallback | **Preserved** — Plans 01/03 reshape, never remove |
| Widget deep-link acceptance guards | **Preserved** — byte-for-byte constraint explicit |
| Migration gate ahead of navigator | **Preserved** — `App.tsx:298–322` |
| No SQLite migration (D-03) | **Preserved** — `TARGET_VERSION = 14` |
| Group Events not fifth tab; Dashboard not radial launcher | **Preserved** — Plan 04 prohibitions |
| ADR-018 single destructive Archived surface | **Preserved** — dual-register same component |
| Predictive back stays disabled (D-10) | **Preserved** — `app.config.ts:76` |
| Origin-aware Back (dossier `[DECIDED]`) | **At risk of effective reversal** for Orrery→Profile if Plan 01 ships without OrreryStack Profile registration — implementation gap, not intentional reversal |

**No HIGH decision-reversal flags** — but the Orrery→Profile gap would fail a `[DECIDED]` requirement if shipped as written.

---

## Wave Dependency Assessment

```
Wave 1: Plan 01 (tracer) ──┬── Wave 2: Plans 02, 03, 04
                           │
Wave 3: Plan 05 (needs 02+04)
Wave 4: Plan 06 (needs 05)
```

Ordering is logical, but **Plan 01 UAT cannot pass SHELL-04** until cross-tab/dual-registration gaps are fixed — those fixes should not wait for Wave 2. Recommend treating an expanded navigate audit as part of Plan 01 Task 1 completion, not Plan 03 alone.

---

## Overall Risk Assessment: **HIGH**

**Justification:** Planning quality, ADR fidelity, security mitigations, and pure-module test strategy are well above average. The phase fails on navigation completeness: the flat→nested transition has more `navigate()` coupling than the D-08 inventory captures, and the dossier's clearest origin-aware case (Orrery→Profile→Back=Orrery) is asserted but not actually enabled by the route assignment. That is a fixable planning gap, not a wrong direction — but it would produce a broken shell if executed verbatim.

**Highest-priority fixes before execution:**
1. Dual-register **Profile** (and downstream routes) in **OrreryStack**.
2. Full **navigate audit** beyond N1–N5 (Home tab shortcuts, Settings→ManageFavourites, ImportComplete cross-tab, birthday notification).
3. Complete **Quick Log write contract** (`uid`, `direction`, post-write refresh).
4. Reconcile **HomeScreen header** with bottom tabs + ShellAppBar in Plan 04.

---

## Claude Review

*(Claude reviewer ran as a read-only subagent — the `claude -p` reviewer lane has a Write-permission gap on this host, so the Claude identity is backed by a read-only general-purpose subagent that read the actual code on disk. Same source-grounding contract as the other lanes.)*

## Verification summary (claims checked against disk)

Confirmed accurate: `RootNavigator.tsx` is a single flat `createNativeStackNavigator` with exactly 32 `<Stack.Screen>` routes (RootNavigator.tsx:57, 77-117). `@react-navigation/bottom-tabs` is NOT installed; native@^7.3.16 / native-stack@^7.18.8 / screens@~4.26.0 / safe-area@~5.7.0 are (package.json:9-10, 38-39). `expo-haptics` not installed. `TARGET_VERSION = 14` (database.ts:49); migrations run 001-014, no 015 — D-03 holds on disk. Columns `favourite_rank`/`last_contact`/`snooze_until`/`archived_at` all exist (001-initial.ts:73-77). `predictiveBackGestureEnabled: false` (app.config.ts:76). Migration gate: navigator mounts only in the `ready && !error` branch (App.tsx:290, 297-310). Profile Back is a plain `goBack()` (ContactProfileScreen.tsx:762). `deleteTouchpoint` exists at recency-dao.ts:313 with delete-by-both-keys + tombstone + `recomputeLastContact` in one `inWriteTransaction`; `recordTouchpoint` at :217 returns `{interactionId}` and rejects future `occurred_at` before opening the txn (:227-231). orbit:// guards (`Number.isSafeInteger`/`>0`, digit-anchored regexes) at widget-linking.ts:103-119. **No ADR-080/044/018 reversals found** — external→Dashboard fallback, deep-link guards, migration gate, single Archived surface, predictive-back, and the four-tab (not five) contract are all preserved. (Note: this reviewer did not open ADR-075; see Codex, whose ADR-075 finding the orchestrator verified independently.)

## Plan 01 — Four-tab shell + nested-reset owner

**Summary.** Converts the flat 32-route stack into a four-tab bottom navigator with a native stack per tab and reshapes external-entry resets to the nested tab-tree. The architecture matches ADR-080 exactly, the on-disk re-verification (D-06) is genuine, and the route→tab partition accounts for all 32 routes.

**Strengths.**
- Migration-gate-preservation claim is real and load-bearing (App.tsx:290, 297-310).
- Deep-link acceptance untouched: guards at widget-linking.ts:103-119 are exactly the "byte-for-byte" surface the plan promises to leave alone.
- Dual-registration reasoning (same component + same DAO = one destructive/merge surface, origin-aware Back) is sound and Pitfall-6-compliant.
- Reset owner (`resetToDashboardRoot`/`resetToDashboardWith`) as a single pure module is the right shape; A1 (ComposeScreen.tsx:267), A4 (widget-linking.ts:274), A3 (:287), A2 (notification-gate.tsx:136) all verified.

**Concerns.**
- **HIGH — the D-08 inventory omits the birthday-notification container-level `navigate`.** notification-nav.ts:101-105 returns `{ type: "navigate", name: "Profile", params }` for a birthday tap, and notification-gate.tsx:137 applies it as `nav.navigate(intent.name, intent.params)` on `navigationRef`. Post-split, `Profile` is nested in `DashboardTab`, so a container-level `navigate("Profile")` resolves to no route and the birthday tap silently does nothing. The inventory lists notification only as the A2 *reset*; the *navigate* branch is not enumerated.
- **MEDIUM — widget/notification reset reshaping is under-specified and can break missing-contact detection.** The widget gate reads `pending.routes[1]` and `target.params.openReachOut` (widget-linking.ts:260-264) assuming the flat `[Home, target]` shape. If the executor changes `resolveWidgetUri`'s return to nested (as Task 2's "update the test to nested" implies), the gate's `routes[1]` reads break. Safer: reshape only at the final `navigationRef.reset` call, leaving the pure resolver + tests flat — but that contradicts the plan's instruction. Pick and pin one.

**Risk:** MEDIUM.

## Plan 02 — Transient store + back-intent + nav visibility

**Summary.** One ephemeral Zustand transient registry, one pure back-intent resolver, one focused-route allow-list, wired into tabPress retap, `tabBarStyle` visibility, and a single shell `BackHandler`. Clean, pure-module, node-testable.

**Strengths.**
- Centralizing transient state so tabPress, the shell `BackHandler`, and the visible Back consult one source is the correct approach.
- Correctly declines to hand-roll a global stack walker.
- `isFocusedWorkflow` as an explicit allow-list is faithful to dossier §B.

**Concerns.**
- **LOW — focused-route allow-list must stay in lockstep with the route inventory across plans** (it enumerates routes owned by Plans 04/05). A rename drifts the classification silently. Use a shared constant.
- **LOW — retap `popToTop()` on the focused tab's nested stack** requires resolving the nested stack navigator in the `tabPress` listener; the exact nested-nav resolution is left to the executor.

**Risk:** LOW.

## Plan 03 — Container/completion navigate reconciliation + no-replay + Discard/Keep

**Summary.** Reshapes N1-N4, verifies Backup-local resets stay in-stack, fixes completed-Edit no-replay, and adds a reusable `beforeRemove` Discard/Keep guard. Catches most of the stranded container-level navigates.

**Strengths.**
- N1/N2 verified (linking.ts:64/:67); C1/C2 verified (ImportCompleteScreen.tsx:300, ReconcileCompleteScreen.tsx:47); B1/B2/B3 correctly flagged tab-local with the right verify-first guard.
- No-replay premise is real (EditContactScreen.tsx:451 navigates to Profile after save at :331); the conditional "if it pushes, pop/replace; else assert" is exactly right.

**Concerns.**
- **HIGH — merge-completion `navigation.replace("Profile")` crashes from the reconcile (SettingsStack) origin, and no plan owns it.** MergeImpactSummary.tsx:17 does, on merge success, `navigation.replace("Profile", { contactId: survivorId })`. The merge cluster is reachable from BOTH Profile→SurvivorSelect (ContactProfileScreen.tsx:816) and reconcile→SurvivorSelect (ReconcileDetailScreen.tsx:104, :144). Plan 01 dual-registers the merge cluster in both stacks — but **`Profile` is only in DashboardStack.** So a merge completed from reconcile calls `replace("Profile")` inside SettingsStack → route-not-found. Plan 01 defers ("Plan 03 owns this; verify at execution time"), but Plan 03's `files_modified` does NOT include MergeImpactSummary.tsx. The bug falls through the ownership seam.
- **MEDIUM — the completion/no-replay changes are guarded only by `npx tsc --noEmit`, which is blind to cross-tab routing** (see cross-cutting). The merge crash type-checks cleanly.

**Suggestions.** Add MergeImpactSummary.tsx (and a scan of every `replace(`/`navigate(` in the dual-registered cluster) to Plan 03's file list with an explicit "route to DashboardTab/Profile" instruction.

**Risk:** HIGH (solely due to the unowned merge-completion crash).

## Plan 04 — Shell chrome

**Summary.** Reusable `ShellAppBar`, a `useBottomClearance()` hook over `useBottomTabBarHeight()`, and the Dashboard Group Events header+overflow + Archived overflow with a themed placeholder. Faithful to dossier §I/§J/§N.

**Strengths.**
- `useBottomTabBarHeight()`-based clearance (not hardcoded) matches dossier §J.
- Group Events kept a Dashboard-owned destination, NOT a fifth tab; Dashboard NOT a launcher — both `[REJECTED]` items honored.
- Status-hue-prohibition grep gate is a good checkable guard.

**Concerns.**
- **LOW — FAB clearance constants (56 + 28 + gap) are duplicated** across `useBottomClearance` and AddSpeedDialFab.tsx:136-138 (and again in Plan 05's UniversalFab). Two sources of truth. Single-source the geometry.
- **LOW — `useBottomClearance` (Wave 2) reserves space for a FAB Plan 05 (Wave 3) creates**; consistent only because both share 56/28. Cross-reference the constant.

**Risk:** LOW.

## Plan 05 — Universal six-action FAB + placeholders + haptics

**Summary.** Replaces the two-action FAB with a shell-mounted six-action speed dial (fixed order, contact-preselect vs picker, Group Log direct), hidden on focused/keyboard, a11y-modal with a light haptic; four placeholder routes. Six-action set matches the dossier amendment exactly.

**Strengths.**
- Reanimated-compliance premise verified: AddSpeedDialFab.tsx:31-36 drives `expanded` via `useSharedValue`/`withTiming`, React `open` state ONLY for `pointerEvents` (:28-30). `speedDialScrimPointerEvents` (add-speed-dial-fab-logic.ts:23) is a genuine reusable helper.
- Group Log routed directly, no shell pre-picker (D-05) — correctly enforced.
- Pure `universal-fab-logic` with a frozen six-element array + length-6 test is a solid anti-drift guard.

**Concerns.**
- **MEDIUM-HIGH — a shell-mounted FAB navigating into DashboardStack routes must use the nested form, and the plan doesn't say so.** AddSpeedDialFab today does `navigation.navigate("Create")` (AddSpeedDialFab.tsx:98) from inside the Dashboard stack. Plan 05 mounts UniversalFab "ONCE at shell level" and dispatches to `Create`/`GroupLog`/placeholders — all registered only in DashboardStack. From a shell-level ref (or any non-Dashboard tab), `navigate("Create")` won't resolve; it must be `navigate("DashboardTab", { screen: "Create", params })`. Same stranded-navigate class Plan 03 exists to prevent, reintroduced by a new shell-level consumer — and tsc won't catch it.
- **MEDIUM — `originContactId` derivation from a shell-level mount is non-trivial and under-specified.** Drilling tab→stack→Profile params from outside the stacks is feasible via navigation state, but the plan hand-waves it; get it wrong and every Profile FAB action silently falls into the global pick-then branch.

**Suggestions.** Specify `resolveFabTarget` returns a nested `{ tab, screen, params }` target; origin resolution via `getFocusedRouteNameFromRoute` + nested params. Test that the intent target names a tab, not a bare screen.

**Risk:** MEDIUM-HIGH.

## Plan 06 — Shared contact picker + commit-truthful Quick Log

**Summary.** A pure ordering/filter/marker module + thin static-SQL `picker-read`, a reusable modal `ContactPicker`, and a commit-truthful Quick Log snackbar whose Undo reuses `deleteTouchpoint`. Data-layer posture is careful and mostly correct.

**Strengths.**
- `picker-read` ORDER BY faithfully mirrors the proven `capture-read.ts:65-69` idiom; single `getAllAsync`, no txn, no interpolation — local-first, injection-safe.
- The on-disk correction is right: `deleteTouchpoint` (recency-dao.ts:313) exists; RESEARCH A5 was wrong. Undo reuses it exactly (matches ContactProfileScreen.tsx:602-605). No new delete DAO; single-writer invariant intact.
- Commit-truth wiring — success only inside `.then(({interactionId}))`, error inside `.catch()`, no optimistic snackbar — is exactly SHELL-11; `recordTouchpoint` genuinely returns `{interactionId}` and rejects future `occurred_at` before the txn.
- Correct deliberate divergence: recency source is `last_contact` (interaction recency), NOT `fuel.created_at` (capture MRU).

**Concerns.**
- **MEDIUM — the Quick Log wiring omits the required `uid`.** `RecordTouchpointInput.uid` is REQUIRED with no DAO default (recency-dao.ts:59-61); the canonical analog passes `uid: newUid()` + `direction: "outbound"`, `channel`, `connected: 1`, `quality: null`, `source: "manual"` (ContactProfileScreen.tsx:339-349). Plan 06 Task 3's action text never mints a `uid` and its `read_first` omits the existing Quick-Log button (`doLogContact`). tsc will force it, but the plan should point at the exact analog.
- **LOW — naming proximity** to existing `src/logic/contact-picker-*` import-flow modules; distinct enough but the shared prefix invites confusion.
- **LOW — global Quick Log/picker post-pick routing to placeholder routes inherits Plan 05's nested-navigate gap.**

**Suggestions.** Add `doLogContact` (ContactProfileScreen.tsx:339) to `read_first` and mirror its field set verbatim, including `uid: newUid()`.

**Risk:** MEDIUM.

## Cross-cutting

**Wave/dependency ordering is sound.** W1 (01) → W2 (02/03/04, all `[22-01]`) → W3 (05, `[22-02,22-04]`) → W4 (06, `[22-05]`). Shared-file serialization respected (`types.ts`/`DashboardStack.tsx`: 01→04→05, never concurrent; `HomeScreen.tsx`: 04→05; `UniversalFab.tsx`/`App.tsx`: 05→06). Within W2, 02 touches only RootNavigator while 03/04 touch disjoint files — clean parallelism.

**HIGH (meta) — the plans lean on `npx tsc --noEmit` as the primary correctness gate, but the retained `RootStackParamList` back-compat alias makes tsc blind to exactly the cross-tab routing errors the split introduces.** Plan 01 keeps `RootStackParamList` as "the four per-tab lists merged." Consequence: any `navigate`/`replace` typed against it type-checks for *any* route regardless of which stack it lives in. The merge-completion `replace("Profile")` from SettingsStack, the birthday container `navigate("Profile")`, and the shell-level FAB `navigate("Create")` will ALL pass `tsc` and fail only at runtime. Recommend an explicit executor instruction to grep every `navigate(`/`reset(`/`replace(` in the repo against the post-split route→tab map.

**Local-first:** no network on any read path; `picker-read` and all reads are on-device SQLite. Clean. **Theme tokens:** every plan mandates `useTheme().colors.*` + `check:colors`; no literals; status-hue-on-chrome grep-gated. **RN animation:** Plan 05 FAB is shared-value-driven, not per-frame setState.

## Overall risk: MEDIUM-HIGH

Architecture is correct and (on ADR-080/044/018) decision-faithful; data-layer handling is careful and verified. Risk is concentrated in cross-tab navigation completeness: one confirmed HIGH runtime crash (merge-completion `replace("Profile")` from reconcile, unowned), one HIGH unowned container navigate (birthday notification), one MEDIUM-HIGH under-specified shell-level FAB routing — all masked from the plans' `tsc` gate by the back-compat alias. Resolving the routing gaps (assign owners, specify nested targets, repo-wide navigate/replace sweep) would bring this to LOW-MEDIUM.

---

## Verification coverage

This section records the orchestrator's own source-grounding and cross-artifact fact-drift passes (advisory — they never set a hard block and do not count toward the HIGH or actionable totals). A clean review must never silently mean "nothing was checked."

### Source-grounding (authority = grep)

Every symbol the 6 plans cite against *existing* code was resolved against the source. Symbols the plans declare under "Artifacts this phase produces" (reset-intents.ts, back-intent.ts, focused-route-classification.ts, shell-transient-store.ts, UniversalFab.tsx, universal-fab-logic.ts, ContactPicker.tsx, Snackbar.tsx, snackbar-store.ts, picker-read.ts, contact-picker-order.ts, ShellAppBar.tsx, use-bottom-clearance.ts, GroupEventsScreen.tsx, FabActionPlaceholders.tsx, the four per-tab stacks, `@react-navigation/bottom-tabs`, `expo-haptics`, and the placeholder routes) are **excluded** — they are created by this phase.

**VERIFIED** (file:line confirmed on disk):
- `@react-navigation/native@^7.3.16`, `native-stack@^7.18.8` present; `bottom-tabs`/`expo-haptics` absent (package.json:9-10) — new deps, correct.
- `TARGET_VERSION = 14` (database.ts:49); migrations 001-014, no 015 (src/db/migrations/) — D-03 holds.
- `RootNavigator.tsx:57` single flat `createNativeStackNavigator` — D-06 holds.
- `recordTouchpoint` recency-dao.ts:217; `deleteTouchpoint` recency-dao.ts:313; `RecordTouchpointInput.uid` required (recency-dao.ts:59-61); `bumpDataRevisionCore` present in record (:240) but not in the delete block.
- `ContactProfileScreen.tsx:762` `goBack()`; `:817` navigate("SurvivorSelect"); `:827` navigate("ReconcileDetail"); `:339-349` `doLogContact` canonical write.
- `ComposeScreen.tsx:267` reset; notification-gate.tsx:136 reset, :137 navigate; notification-nav.ts:101-105 birthday navigate("Profile").
- widget-linking.ts:115 `Number.isSafeInteger`/`>0` guard; :274 reset + :278 Alert; :287 reset.
- RestorePreviewScreen.tsx:99/:123; RestoreResultScreen.tsx:18; ImportCompleteScreen.tsx:267/:283/:300; ReconcileCompleteScreen.tsx:47.
- linking.ts:64/:67 navigate; ResumeImportPrompt.tsx:27-50; ResumeReconcilePrompt.tsx:45; SettingsScreen.tsx:181/:830/:2008/:2023.
- HomeScreen.tsx:44/:319/:407/:517/:536/:554/:572/:653; OrreryScreen.tsx:433/:441; MergeImpactSummary.tsx:17 `replace("Profile")`.
- add-speed-dial-fab-logic.ts:23 `speedDialScrimPointerEvents`; AddSpeedDialFab.tsx:30/:115/:135-138 (local `open` state, `dashboard-create-fab` testID, geometry).
- capture-read.ts:64-69 ordering idiom incl. `favourite_rank ASC`; 001-initial.ts:73-77 columns (`last_contact`/`favourite_rank`/`archived_at`/`snooze_until`); dashboard-prefs-store.ts uses `persist`; OverflowMenu.tsx (hitSlop 16, "Dismiss actions"); types.ts placeholder-route doc pattern; ADR-075 (Accepted, retires ManageFavourites + rank ordering); ManageFavouritesScreen.tsx still present.

**MISSING** (grep can check; symbol absent): none — no existing cited symbol failed to resolve. (Plan hygiene here is unusually high.)

**AMBIGUOUS:** none material.

**UNCHECKABLE** (grep cannot analyze — recorded, never treated as verified):
- The exact `@react-navigation/bottom-tabs` v7 fade `animation` token (Plan 01 Assumption A1) — the dep is not yet installed; must be confirmed against node_modules types at execution.
- Library-API *signatures* and correct usage of `CompositeScreenProps`, `NavigatorScreenParams`, `getFocusedRouteNameFromRoute`, `useBottomTabBarHeight`, `BottomTabScreenProps` (react-navigation v7) — signature correctness is UNCHECKABLE under grep.
- `recordTouchpoint`/`deleteTouchpoint` call-*signature* match for Plan 06's new invocation — signature mismatch is UNCHECKABLE under grep (the missing `uid` is a plan-text omission, folded in as a MEDIUM, not a grep verdict).
- Reanimated shared-value / no-per-frame-setState behavior of the new UniversalFab (component not yet written).

### Cross-artifact fact-drift (advisory)

- **Phase status:** `drift-guard phase-status --phase 22` → verdict **`uncheckable`** (STATE.md "Phase 22 planned — 6 plans, 4 waves" vs ROADMAP "Planned"; the tool could not rank either status string, so `stateRank`/`roadmapRank` are null). Not a `drifted` finding; recorded here as uncheckable per protocol. STATE.md and ROADMAP.md do not narratively contradict.
- **Judgment pairs** (ROADMAP Success Criteria ↔ PLAN must_haves.truths; ROADMAP Requirements ↔ PLAN requirement refs): no contradictions found. The FAB six-action set/order, the crossfade-no-swipe criterion, and the commit-truthful Quick Log criterion match verbatim between ROADMAP and the plan truths. Plans add truths beyond ROADMAP (sanctioned), none of which invert a ROADMAP fact.

No fact-drift findings contribute to the HIGH or actionable counts.
