# React Native Correctness, Application State, Lifecycle, and Navigation Audit

## Audit Metadata

- **Date:** 2026-09-22.
- **Mode / domain code:** Deep domain audit / `RN`.
- **Repository:** `/home/bwales/projects/orbit-app`.
- **Reviewed HEAD:** `0e04c27e1d82bc3b5069bbf5adfc72281155df69` — `docs(kb): record phase 38.1 extraction`.
- **Initial worktree:** No tracked modifications; `docs/audits/2026-09-pre-release/` was already untracked, containing other domain packets. Those packets were not modified or used as substitutes for source inspection.
- **Output:** `docs/audits/2026-09-pre-release/react-native/DOMAIN-AUDIT.md`.
- **Mutation boundary:** Audit output only. No application, test, dependency, configuration, migration, or generated graph edits; no commits, pushes, worktrees, device interactions, or real provider requests.
- **Methodology:** Global `/home/bwales/.codex/skills/repo-audit/SKILL.md`, with repository instructions and current decisions authoritative.

## Executive Summary

**13 OPEN findings: 3 S1 Major and 10 S2 Moderate.** No S0 finding was established. Eleven findings are C3 Confirmed from implementation/control-flow evidence; two timing-sensitive findings are C2 Strong. Device reproduction remains part of downstream verification, not something this audit claims to have performed.

The highest-consequence defects are a Dashboard panel dismissal that leaves the underlying contact UI inert, a first-use nested-navigation path that can omit the Contacts root altogether, and an AI credential draft that crosses provider boundaries when its accordion changes. Further findings concern incomplete Settings-hosted Profile routes, consumers still using retired AI state, missing foreground invalidation, independent Profile snapshots becoming inconsistent, stale calendar state, competing refresh requests, and lifecycle failure/routing coordination.

The newer five-tab architecture itself matches current intent. Several problems arise at its integration boundaries: features assume their host was already mounted, shared screens assume every host registers the same destinations, or successful writes assume navigation focus will refresh the view. The targeted existing suite passed **299 tests in 28 files**, but those tests do not establish the absent interaction and lifecycle guarantees described below.

## Scope

Included:

- React component/hook state ownership, asynchronous reads/writes, effect cleanup, stale publication, retained screen instances, and derived/duplicated state with behavioral consequences.
- Five-tab shell, native stacks, Back/reselect behavior, nested entry, route registration, share/notification/widget gates, FAB context, and modal flows.
- Boot/readiness, foreground return, launch sweeps, animation focus/background gating, and local session restoration.
- Dashboard, Digest, Orrery, Profile/History, shared assist overlays, capture/compose, Memory consent, AI configuration, and representative editing/import workflows.

Excluded:

- Implementing fixes or designing remediation phases.
- A comprehensive SQL integrity, migration, backup cryptography, permission/egress, or accessibility audit. Relevant persistence and credential boundaries were traced to establish UI/state consequences; this packet does not certify all writers or table invariants.
- iOS behavior, Android process-kill/device interaction reproduction, performance measurements, and remote-provider execution.

## Repository Context Reviewed

`HANDOFF.md` was read before investigation. Relevant current authority includes `docs/systems/app-shell.md`, `dashboard.md`, `digest.md`, `profile.md`, `interaction-history.md`, `interaction-assist.md`, and `ai-suggestions.md`, together with the governing ADRs cited in the findings.

Important interpretation decisions:

- **ADR-146 supersedes the earlier four-tab home model:** Contacts, Events, Digest, Orrery, Settings are equal persistent tab stacks; Digest is initially selected. Backup is Settings-only. The retained, unmounted `BackupStack.tsx` is not a sixth live tab.
- **ADR-095:** Dashboard controls are deliberately an in-tree floating surface. Replacing them with a native modal is not an assumed remedy.
- **ADR-133 / Compose session contract:** One contact's draft is deliberately session-only and resets on contact switch; lack of durable drafts is not a defect.
- **ADR-135/136:** The modern AI master setting and active connection supersede reliance on the legacy single-provider field for current availability. Credentials remain provider-scoped and outside SQLite.
- **ADR-120/123:** History uses a shared current-date window, a canonical contact-history read, and typed detailed-log backfill routes.
- **ADR-071:** Assist confirmation uses the original handoff time, preserves the future-date guard, and must surface rejection after clock rollback.
- Existing launch-only cleanup, Android-first scope, local reads, and deliberate animation gating remain constraints on remediation.

Runtime context: React 19.2.3, React Native 0.86.2, Expo 57 package line, React Navigation 7 package lines, Zustand 5. The actual installed navigator implementation was inspected for lazy initialization and route-state semantics.

## Methodology and Coverage

Three parallel, read-only investigative tracks covered navigation/FAB/overlays, async screen and configuration state, and application lifecycle/refresh/animation. The lead separately inspected Profile/History and adjudicated candidates against files on disk, relevant callers and guards, current documentation, and installed framework implementation. Investigator summaries were treated as candidate evidence, not final facts.

Graph discovery used the sanctioned `npm run graph:ask -- governs <path>` wrapper for the root navigator, Settings/FAB surfaces, Dashboard overlay, History, AI connection screen, and launch sweep. The returned governance links were **INFERRED** from ADR Key-files lists, not code-asserted citations. Missing links were not treated as absence of authority. No graph rebuild or generated-file modification occurred.

Verification performed:

- Existing targeted Vitest run: **28 files / 299 tests passed**, covering `src/navigation`, `src/stores`, universal FAB routing, Profile module rendering, History logic, Your Week/Digest, AI connection/permissions logic, and launch sweeps. Command:

  ```sh
  npx vitest run src/navigation src/stores src/components/universal-fab-logic.test.ts src/components/profile/profile-module-host-render.test.tsx src/components/history/history-section-logic.test.ts src/components/digest/YourWeekSection.test.tsx src/screens/DigestScreen.test.tsx src/screens/ai-connection-logic.test.ts src/screens/ai-permissions-logic.test.ts src/services/launch-sweep.test.ts
  ```

- Executed the actual dismissal callback body extracted from `DashboardOverlayHost.tsx` against a Zustand store: request became `null`, owner dismissal count remained **0**.
- Executed installed `StackRouter` with the first-entry state produced by the installed nested-navigation builder: `['Create']` → replace → `['Profile']`; `popToTop` returned **null**.
- Injected a rejected first launch-sweep hook while another pass was queued: only the first hook ran, the runner rejected, and neither the later hook nor queued pass ran.
- These were ephemeral, read-only Node checks. No regression test files or app changes were added.

Framework checks used the installed sources and primary documentation: [React Navigation nested initial-route behavior](https://reactnavigation.org/docs/nesting-navigators/), [navigation lifecycle](https://reactnavigation.org/docs/navigation-lifecycle/), and [React Native Modal behavior](https://reactnative.dev/docs/modal). Stack screens normally remain mounted while another screen is pushed; nested `screen` parameters can override initial-route initialization. Native modal attachment has additional Android behavior, so JS retention alone was not admitted as proof of modal obstruction.

Coverage is strongest for shell routing, refresh ownership, shared overlays, and the admitted configuration-state defects. Import/reconcile/restore presentation paths and native process restoration received narrower inspection; no blanket clean bill is asserted for those areas.

## Findings Summary

| Severity | OPEN | INVESTIGATE |
|---|---:|---:|
| S0 Critical | 0 | 0 |
| S1 Major | 3 | 0 |
| S2 Moderate | 10 | 0 |
| S3 Minor | 0 | 0 |
| S4 Advisory | 0 | 0 |

| ID | Severity | Confidence | Finding |
|---|---|---|---|
| AUD-RN-001 | S1 | C3 | Dashboard panel dismissal leaves underlying content inert |
| AUD-RN-002 | S1 | C3 | First nested workflow entry can omit a tab's semantic root |
| AUD-RN-003 | S1 | C3 | Unsaved provider credentials cross connection cards |
| AUD-RN-004 | S2 | C3 | Settings-hosted Profile omits reachable child routes and context |
| AUD-RN-005 | S2 | C3 | Memory permission controls use retired AI configuration state |
| AUD-RN-006 | S2 | C3 | Digest misses same-route writes and foreground refresh |
| AUD-RN-007 | S2 | C3 | Assist confirmations do not invalidate the foreground view |
| AUD-RN-008 | S2 | C3 | Profile History and relationship metrics refresh independently |
| AUD-RN-009 | S2 | C3 | History's current date is frozen for the component lifetime |
| AUD-RN-010 | S2 | C2 | Dashboard refresh owners can publish obsolete query results |
| AUD-RN-011 | S2 | C3 | An early sweep rejection skips unrelated lifecycle work |
| AUD-RN-012 | S2 | C2 | Delayed cold notification navigation can override a newer tap |
| AUD-RN-013 | S2 | C3 | Assist write failures have no user-facing recovery state |

## Findings

### AUD-RN-001 — Dashboard panel dismissal leaves underlying content inert

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, A11Y, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Dismissing a Population, Filters, or Sort panel removes its visual host but fails to notify the Dashboard that the panel closed. The header and contact/search/view region remain non-interactive and hidden from accessibility.

#### Expected Behavior / Invariant

ADR-095 makes the background inert **while** a panel is open and requires transient-first dismissal. Closing must restore normal interaction and accessibility as well as remove the panel.

#### Observed Behavior

The host clears its request before attempting to retrieve the callback from that request. The owner callback that resets `panelOpen` therefore never runs through the host dismissal path.

#### Evidence

- `src/components/control-surface/DashboardOverlayHost.tsx:20-24` makes `close()` synchronously set `request: null`; `:32-35` calls `close()` and then reads `getState().request?.onDismiss()`.
- `DashboardControlRow.tsx:94-97` is the owning dismissal callback that calls `onPanelOpenChange(false)`. Its three open paths set the flag true at `:193`, `:218`, and `:248`.
- `src/screens/HomeScreen.tsx:504` owns the separate boolean; `:1712` passes its setter to the row. At `:1649-1651` and `:1715-1717`, that boolean controls `pointerEvents="none"` and `importantForAccessibility="no-hide-descendants"`.
- `AnchoredPanel.tsx` routes scrim dismissal and the registered shell transient through the host callback; cleanup unregisters the transient but does not reset Home's boolean.
- Read-only execution of the actual callback against Zustand yielded `{ request: null, ownerDismissCalls: 0 }`.

#### Impact

Ordinary filter/sort use can leave core browsing, search, view switching, and header actions apparently broken. Tab switches preserve the mounted Home state, so they do not inherently repair it. Controls outside those disabled wrappers can remain available; this is not a claim that the entire process becomes permanently unusable.

#### Trigger / Preconditions

Open any Dashboard control panel, then dismiss through its scrim, Android Back, or shell transient dismissal.

#### Remediation Direction

Every dismissal must settle panel visibility and the owning interaction/accessibility state together, without retrieving a callback after discarding its owner.

#### Verification

Exercise all three panels through every dismissal path. Assert restored touch handling and accessibility descendants, including after tab switching. A store-only callback test should accompany the rendered interaction test.

#### Related Findings

AUD-RN-010 shares the Dashboard boundary but has a different cause.

#### Planning Notes

Preserve the owner-approved in-tree floating presentation and transient-first Back semantics. No persistence or schema change is indicated.

### AUD-RN-002 — First nested workflow entry can omit a tab's semantic root

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** BUG, ARCH, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

A fresh Digest launch followed by a FAB workflow can initialize Contacts with only that child screen. Completing the workflow can leave Profile as the tab's sole route, and reselecting Contacts cannot recover Home.

#### Expected Behavior / Invariant

ADR-146 requires stable semantic roots and active-tab reselect returning that stack to its root. A workflow entered before visiting its tab must have the same usable completion/Back contract as one entered after visiting it.

#### Observed Behavior

Cross-tab callers supply a nested `screen` without preserving the destination's declared initial route. Lazy initialization consumes that child as the initial state; later `popToTop` operates on the malformed topology rather than recreating Home.

#### Evidence

- `src/navigation/shell-contract.ts:9` selects Digest initially.
- `src/components/UniversalFab.tsx:257-261` and `:281-285` navigate to Dashboard child screens with no `initial: false` or explicit root-bearing state.
- Installed `node_modules/@react-navigation/bottom-tabs/src/views/BottomTabView.tsx:289` defaults `lazy` to true.
- Installed `@react-navigation/core/src/useNavigationBuilder.tsx:308-318` constructs a single-route state from nested `screen` unless `initial === false`; `:548-585` chooses that state over ordinary initial-route creation. This matches [the documented nested-navigation contract](https://reactnavigation.org/docs/nesting-navigators/).
- `src/screens/CreateContactScreen.tsx:394` replaces Create with Profile after successful creation.
- `src/navigation/RootNavigator.tsx:113-125` only dispatches `popToTop` when the nested stack index exceeds zero.
- Installed-router execution confirmed `['Create']` → `['Profile']` → `popToTop: null` despite the router being configured with `initialRouteName: 'Home'`.
- Other first-entry paths have the same assumption: `src/navigation/linking.ts:78-82` enters Settings/Backup or Dashboard/Capture; `ComposeScreen.tsx:925-929` enters Settings/SettingsAI.

#### Impact

Contacts can stop functioning as the contact browser for the session, with Back/reselect behavior dependent on whether the tab was visited before using a global action. Shared-file and settings-repair entries can similarly omit their expected root.

#### Trigger / Preconditions

Fresh launch → leave Contacts untouched → FAB Add Contact → save. Also test cancellation and other first-entry FAB workflows.

#### Remediation Direction

Ensure every nested entry preserves the destination's semantic root when the tab has not mounted, while retaining intended existing-stack behavior when it has.

#### Verification

Run first-use and already-mounted variants for all six FAB actions, cold text/backup shares, and AI settings repair. Assert actual nested state plus visible Back, completion, and active-tab retap outcomes.

#### Related Findings

AUD-RN-004 addresses missing route registrations, not missing initial state.

#### Planning Notes

Do not replace all navigation with broad resets that discard unrelated stacks. Preserve ADR-146's independent histories and intentional semantic resets for external contact links.

### AUD-RN-003 — Unsaved provider credentials cross connection cards

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** SECURITY, BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

The OpenAI, Anthropic, and Google connection cards share one unsaved key buffer. Switching cards reinterprets the previous provider's masked draft as the newly opened provider's key.

#### Expected Behavior / Invariant

ADR-135 requires independently retained provider credentials. A credential entered under one provider label must retain that ownership through local UI transitions.

#### Observed Behavior

Accordion selection changes the lane label and save destination without changing or scoping the draft. Saving can overwrite the new lane's credential with the old lane's secret. A subsequent request for that lane uses it.

#### Evidence

- `src/screens/AIConnectionScreen.tsx:60` declares one `keyInput`; `:245` changes only `expanded`.
- `:354-355` binds every expanded direct-provider field to the same value/setter; `:110` sends that value with the clicked lane to `saveDirectCredential`.
- `src/screens/ai-connection-logic.ts:76-84` checks only trimmed nonemptiness before calling `setKey(lane, key)`.
- `src/services/ai-key-store.ts:193-200` stores direct credentials under the supplied provider namespace. This boundary correctly isolates namespaces but cannot recover ownership lost by the UI.
- `src/services/AiService.ts:636` binds the Anthropic adapter to the Anthropic namespace; `:395-405` includes that value in its request header. Provider authentication failure would occur after transmission, not prevent it.

#### Impact

Incorrect credential replacement and failed configuration; a secret entered for one provider can be transmitted to another. The audit establishes the code path, not that a real user's key was disclosed.

#### Trigger / Preconditions

Enter a synthetic OpenAI key, expand Anthropic before saving, and save there. A later explicit provider request uses the misplaced key. No exotic timing is required.

#### Remediation Direction

Keep credential draft identity bound to its provider throughout card switching and asynchronous saves. Preserve provider-scoped SecureStore storage and explicit invocation.

#### Verification

Use synthetic distinct credentials and mocked storage/network adapters. Switch cards before save and while a save is pending; assert that no draft or write crosses lanes and no existing different-provider key is overwritten accidentally.

#### Related Findings

AUD-RN-005 is another incomplete integration with the modern AI state model, but has a separate cause.

#### Planning Notes

This is state ownership at the configuration UI boundary. Do not weaken credential isolation or change security posture to accommodate the shared buffer. No real keys or external-service test is necessary.

### AUD-RN-004 — Settings-hosted Profile omits reachable child routes and context

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, ARCH  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Settings legitimately hosts Profiles and Things to Remember, but its stack omits destinations those shared screens expose. Recently Deleted and Message can dispatch unhandled navigation actions; the universal FAB also excludes this Profile host from contact preselection.

#### Expected Behavior / Invariant

The shared Profile/knowledge flow must work from each supported host and preserve origin-aware Back. Current app-shell documentation and ADR-146 retain Settings-hosted Profile routes; the shared FAB contract in ADR-082 preselects Profile context.

#### Observed Behavior

Settings registers only part of the shared route family. Generic shared-screen typings hide the runtime registration difference. FAB context has a separate four-tab allowlist that omits Settings.

#### Evidence

- `src/screens/ArchivedContactsScreen.tsx:272` opens Profile in the current stack.
- `src/navigation/tabs/SettingsStack.tsx:237-258` registers Archived, Profile, ThingsToRemember, MemoryHistory and related editors, but the full stack contains no RecentlyDeleted, Compose, or ComposeResearch registration.
- `src/screens/ThingsToRememberScreen.tsx:453` always exposes `navigate('RecentlyDeleted', { contactId })`; the other four Profile-hosting stacks register that destination.
- `src/screens/ContactProfileScreen.tsx:402-405` navigates to Compose. `src/components/profile/ProfileHero.tsx:65-81` enables Message from actionable methods without an archive check. No ancestor tab route can handle the bare Compose name.
- `src/components/universal-fab-logic.ts:176-184` recognizes Dashboard, Events, Digest and Orrery only, returning no contact context for Settings/Profile.
- Counter-evidence: Compose itself rejects archived contacts (`ComposeScreen.tsx:711` vicinity). Thus enabling archived messaging is not an assumed remedy. The missing RecentlyDeleted route establishes the host-parity defect independently of messaging eligibility.

#### Impact

A user browsing an archived contact through Settings cannot reach the offered Memory recovery screen. Message can silently do nothing in release, and contact-specific FAB actions unexpectedly ask the user to select a contact again.

#### Trigger / Preconditions

Settings → Contacts settings → Archived → Profile → Things to Remember → Recently Deleted. Message additionally requires an actionable method.

#### Remediation Direction

Make the registered route family, enabled actions, and FAB context agree for every supported Profile host. Preserve existing archive restrictions unless the owner explicitly changes them.

#### Verification

Exercise shared Profile/knowledge actions from all five stacks, including Recently Deleted and Back. Check Settings/Profile FAB preselection. Test archived-message eligibility separately from route resolution.

#### Related Findings

AUD-RN-002.

#### Planning Notes

Review actual stack registrations, not only the shared `RootStackParamList` compatibility type. Registration parity does not authorize changing archived-contact product policy.

### AUD-RN-005 — Memory permission controls use retired AI configuration state

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, ARCH  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Four Memory editor hosts decide whether AI is enabled using legacy `aiProvider`, while current settings and generation use `aiEnabled` plus an active connection. Freshly configured AI can work while the local Memory consent controls remain disabled.

#### Expected Behavior / Invariant

The controls must reflect the current AI master-setting contract under ADR-135/136, without inferring permission from availability or rewriting stored per-item consent.

#### Observed Behavior

The old provider field defaults to `none` and is not updated by modern connection activation/master toggles. The Memory editor interprets it as globally disabled.

#### Evidence

- Legacy reads: `src/screens/MemoryScreen.tsx:82`, `ThingsToRememberScreen.tsx:179`, `EditContactScreen.tsx:586`, and `src/components/PostLogNoteEditor.tsx:90`.
- `src/components/MemoryEditor.tsx:388-400` displays “Turn on AI in Settings first” and disables the permission switch using this value.
- `src/db/migrations/004-ai-settings.ts:43` defaults `ai_provider` to `none`; migration 029 separately adds `ai_enabled` and `ai_active_connection` without synchronizing the old provider.
- `src/screens/settings-ai-hub-logic.ts:81-83` produces an `aiEnabled` patch; `src/db/ai-connections-dao.ts:161` activates through `aiActiveConnection`.
- `src/db/app-settings-dao.ts:847-852` maps all three independently. Current callers do not translate modern enablement back into the legacy provider value.

#### Impact

Local consent editing is unavailable despite completed AI setup, and the guidance to enable AI sends the user toward an already-enabled setting. The central permissions manager remains a workaround. This finding does not establish unauthorized egress.

#### Trigger / Preconditions

Fresh database → configure a modern connection/model → enable AI → edit a Memory in one of the four affected hosts.

#### Remediation Direction

Use the canonical current configuration state consistently for UI availability, keeping per-item permission separate and explicit.

#### Verification

Test fresh configuration, disabled/re-enabled AI, incomplete configuration, and legacy/restored settings across all four hosts. Assert correct UI state without changing consent as a side effect.

#### Related Findings

AUD-RN-003.

#### Planning Notes

Removing legacy persisted fields or altering migration/backup contracts is not necessary to establish the desired UI invariant and should not be silently added to scope.

### AUD-RN-006 — Digest misses same-route writes and foreground refresh

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

The default Digest tab can continue showing old outreach suggestions and activity counts after a successful FAB Quick Log, Undo, or overnight foreground return.

#### Expected Behavior / Invariant

ADR-147 defines Digest as live and current; ADR-146 preserves the active stack on resume. Staying on the same route must not prevent current local state from reaching that surface.

#### Observed Behavior

Both the outer Digest data and Your Week refresh on navigation focus only. A shell overlay write does not change focus, and returning the app to the foreground does not inherently refocus an already-focused route.

#### Evidence

- `src/screens/DigestScreen.tsx:89-133` owns its only data-load effect, a focus callback with no shell-refresh/AppState subscription.
- `src/components/digest/YourWeekSection.tsx:107-137` similarly loads on focus. Its current date/window are computed only when `loadPeriod` runs (`:72-103`); changing the period refreshes that section but not the outer Digest.
- `src/components/UniversalFab.tsx:244-251` selects a Quick Log contact and logs without navigation.
- `src/services/quick-log-command.ts:109` and `:169` publish shell refresh for Undo and successful logging. Neither Digest owner consumes it.
- Existing focus cancellation protects older focus loads, but it cannot supply a trigger that is absent.

#### Impact

A just-contacted person can remain suggested as due/never contacted, and Your Week can omit the interaction or retain yesterday's period. The user must navigate away and back to repair the display.

#### Trigger / Preconditions

Quick Log/Undo while Digest remains visible; or background while on Digest and return after the local day or underlying data changes.

#### Remediation Direction

Refresh all relevant Digest sections on applicable committed writes and foreground transitions while keeping reads local and preserving user navigation.

#### Verification

Keep the route focused during Quick Log/Undo and assert suggestions, counts, and day detail become current. Advance local date across background/resume and assert the loaded window changes without tab navigation.

#### Related Findings

AUD-RN-007 (missing producer invalidation); AUD-RN-008 (separate snapshots); AUD-RN-009 (frozen date).

#### Planning Notes

Do not add a persistent Digest cache or reset the user's stack on resume. The current focus read and period-generation guards are useful behavior to preserve.

### AUD-RN-007 — Assist confirmations do not invalidate the foreground view

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Confirming a reach-out from either assist overlay commits the interaction but refreshes only the assist queue and Android widget. The underlying app view can continue showing the pre-confirmation relationship state.

#### Expected Behavior / Invariant

A successful in-app confirmation must be reflected by visible consumers without requiring another navigation or foreground event. This complements ADR-071's truthful confirmation semantics and the shell refresh mechanism already used for Quick Log.

#### Observed Behavior

No foreground invalidation is published after the commit. The queue disappearing can look like success while status/history underneath remains old.

#### Evidence

- `src/components/AssistBanner.tsx:46-55` and `PendingConfirmationsSheet.tsx:46-55` await `markAssistLogged`, call `notifyWidgetDataChanged`, and refresh only `useAssistBanner`.
- `src/db/interaction-assist-dao.ts:99-141` inserts the interaction and recomputes recency inside its transaction; its durable data-revision bump is not a React subscription notification.
- `src/services/widget/widget-refresh.ts:84-85` calls only widget rendering.
- `src/stores/assist-store.ts:30-37` updates queue/newest/count only.
- `HomeScreen.tsx:826`, `OrreryScreen.tsx:478`, and `ContactProfileScreen.tsx:108` consume shell refresh, but these confirmation paths never emit it. Showing/closing their overlays does not blur the underlying route.

#### Impact

Contacts can continue to look overdue immediately after the user attests to reaching them, undermining the primary log-and-check workflow.

#### Trigger / Preconditions

Receive an eligible assist prompt on a browse/Profile surface, confirm it, and remain on that screen.

#### Remediation Direction

Publish a post-commit foreground change signal reaching relevant consumers, with queue/widget updates remaining separate responsibilities.

#### Verification

Confirm from the banner and pending sheet over Home, Orrery, and Profile. Assert visible recency/status/history update without a route change; a failed commit must not announce a successful data change.

#### Related Findings

AUD-RN-006, AUD-RN-008, AUD-RN-013.

#### Planning Notes

Do not replace the transactional/idempotent assist write or introduce a second recency writer. Repairing this producer alone will not fix consumers that ignore the existing refresh mechanism.

### AUD-RN-008 — Profile History and relationship metrics refresh independently

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, ARCH, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Profile owns one relationship snapshot while History owns another read of interaction records. In-place writes can update only one side, producing contradictory counts, history, and metrics within the same Profile.

#### Expected Behavior / Invariant

History heatmap/records and relationship metrics must reflect the same committed interaction state after a user action. ADR-120/123's assembled History experience should not mix a fresh impact series with stale counted interactions.

#### Observed Behavior

Quick Log refreshes the parent snapshot but not the mounted History records. Deletion inside History refreshes History records but not the parent's status/gravity/impact inputs.

#### Evidence

- `src/screens/ContactProfileScreen.tsx:82-109` loads its snapshot on focus and shell refresh.
- `src/components/profile/ProfileModuleHost.tsx:378-394` supplies `snapshot.impactInputs` to History but no snapshot revision, canonical records, or deletion-refresh callback.
- `src/components/history/HistorySection.tsx:163-179` owns a separate `readContactHistory` and refreshes it on focus; it does not consume shell refresh. Parent rerender with the same contact does not rerun that callback.
- `HistorySection.tsx:204-239` counts its own `history.interactions` while Intensity consumes the independently supplied `impactInputs`.
- `src/components/history/InteractionDetail.tsx:105-126` deletes through the recency DAO, notifies the widget and calls `onDeleted`; `HistorySection.tsx:405-408` handles this by loading only itself.
- `src/db/profile-read.ts` assembles the parent's metrics/impact snapshot. `src/db/history-read.ts` supplies the separate full records. Neither automatically updates the other's React state.

#### Impact

A new Quick Log can affect Profile metrics while remaining absent from History; deleting an interaction can remove its history row while leaving Profile metrics and window Intensity based on it until another parent refresh.

#### Trigger / Preconditions

Keep History expanded, Quick Log from the Profile FAB, or delete an interaction through its History detail sheet without leaving Profile.

#### Remediation Direction

Coordinate invalidation/publication of both read owners after relevant in-place writes. A single ownership model or explicit synchronized invalidation must preserve their distinct presentation needs.

#### Verification

With known interaction counts, Quick Log and delete while remaining on Profile. Assert heatmap, date records, relationship metrics, and Intensity all converge to the committed state. Repeat with History collapsed/reopened to expose accidental remount-based workarounds.

#### Related Findings

AUD-RN-006, AUD-RN-007, AUD-RN-009.

#### Planning Notes

This is a UI snapshot-coordination finding, not a claim that SQLite recency is wrong. No new persistence model is required.

### AUD-RN-009 — History's current date is frozen for the component lifetime

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Local  
**Type:** BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

History memoizes today's date once. Retaining a Profile across midnight keeps yesterday as the maximum/current date even after navigation focus reloads the records.

#### Expected Behavior / Invariant

The current cycle, future-day restriction, current-period windows, and default log date must use the current local day. User-selected historical windows may remain selected; that does not justify freezing the definition of today.

#### Observed Behavior

Focus reload updates records/preferences but never the date anchor. All current-date-dependent controls use the initial value until History is remounted.

#### Evidence

- `src/components/history/HistorySection.tsx:151`: `useMemo(() => formatLocalDate(new Date()), [])`.
- `:163-179` refreshes data without updating today.
- `:185`, `:205-213`, and `:241-246` use that value for lens reset, active windows, cycles, next-window calculation and next-button availability.
- `:309` uses it as the empty-history Log interaction prefill; `:349` passes it as the Rolodex maximum day.
- `ProfileModuleHost.tsx:386-394` retains the same child type/key during ordinary snapshot refresh. Independent tab stacks preserve Profile instances.

#### Impact

Current-day activity may be omitted or inaccessible, current-cycle boundaries remain old, and a “Log interaction” entry from empty History can prefill yesterday without an explicit historical selection.

#### Trigger / Preconditions

Keep the Profile History component mounted across local midnight, then resume or revisit the retained Profile.

#### Remediation Direction

Refresh the local calendar anchor on relevant lifecycle boundaries while preserving intentional historical browsing state.

#### Verification

Use a controlled local clock across midnight and month/year boundaries. Test resume, tab return, lens change, next-day access and default logging without remounting the component.

#### Related Findings

AUD-RN-006 and AUD-RN-008.

#### Planning Notes

Continue using `formatLocalDate`; do not substitute UTC slicing or introduce background timers for persistence cleanup.

### AUD-RN-010 — Dashboard refresh owners can publish obsolete query results

**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Local  
**Type:** BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

Each Dashboard reload has its own cancellation closure, but there is no shared request generation across focus, foreground, pull, shell, and action-triggered reloads. An older read started by one owner can outlive a newer query and publish obsolete results.

#### Expected Behavior / Invariant

Rows, snippets, counts, and view-specific enrichment must correspond to the latest accepted Dashboard query. Earlier work must not replace the result after filters/search/view have changed.

#### Observed Behavior

Focus cancellation only cancels the focus-owned call. Pull cancellation only cancels an earlier pull or runs at unmount. Shell refresh drops the returned canceller. Other action paths call `reload()` without retaining it.

#### Evidence

- `src/screens/HomeScreen.tsx:710-814` publishes rows/maps/counts when its closure-local `cancelled` remains false.
- `:751-780` adds a separate awaited line-three enrichment phase for non-search list results; search composition is also multistage. Reads are not one indivisible publication operation.
- `:830-835` owns focus cancellation; `:840-852` owns foreground cancellation; `:857-870` owns pull cancellation. Query changes do not cancel an existing pull through that ref.
- `src/stores/shell-refresh-store.ts:23-26` invokes `onRefresh()` without managing a returned cleanup function.
- `HomeScreen.tsx:913-930` and other completion paths also launch reloads outside the focus owner's cancellation lifetime.

#### Impact

An old population/search result or stale error can replace a newer result while the controls continue displaying the new query. This can mislead contact selection and require another refresh.

#### Trigger / Preconditions

An overlapping pull/shell/action reload and a subsequent query change, with completion order reversed by asynchronous read/enrichment work. The race is structurally present; device timing frequency was not measured.

#### Remediation Direction

All publication paths must share a latest-request/query ownership rule. Cleanup of one effect must not be mistaken for cancellation of all reload sources.

#### Verification

Defer read A from pull or shell refresh, change the query and complete B, then resolve or reject A. Assert B's rows/counts/error state remain. Include List-to-Card and search changes, blur/unmount, and rapid writes.

#### Related Findings

AUD-RN-001 is separate; AUD-RN-012 shares the multiple-owner ordering pattern.

#### Planning Notes

Preserve focus/foreground/pull freshness and local reads. A connection-scoped SQLite observer is not a substitute for the cross-context freshness contract.

### AUD-RN-011 — An early sweep rejection skips unrelated lifecycle work

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Cross-cutting  
**Type:** RELIABILITY, BUG  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME

#### Summary

An early launch-sweep failure rejects the whole foreground runner, skips subsequent responsibilities, and discards a queued rerun. The installed lifecycle trigger does not handle that rejection.

#### Expected Behavior / Invariant

Recoverable failure of one cleanup responsibility must not silently suppress unrelated foreground reconciliation. Recorded sequencing dependencies must still hold, especially background reconciliation before backup.

#### Observed Behavior

The runner directly awaits each hook. Some hooks isolate their own failures, but early hooks have unguarded operations. The registry therefore depends on an exception-isolation contract that not all registered hooks fulfill.

#### Evidence

- `src/services/launch-sweep.ts:76-82` directly awaits hooks; `:84-87` resets both `running` and `pendingRerun` in `finally`; `:106` and `:111` launch it with `void` and no catch.
- `src/services/field-sweep.ts:106-111` performs an uncaught candidate read and `:134-141` an uncaught history prune. Its per-definition catch does not cover either boundary.
- `src/services/interaction-assist-sweep.ts:24-44` can likewise reject its transaction.
- `App.tsx:225-240` registers those responsibilities before notification (`:276`), digest (`:285`), widget (`:295`), and resume (`:302`) hooks.
- `src/services/widget/widget-refresh.ts:21-29` explicitly documents this runner hazard and contains its own errors, confirming that widget isolation does not protect earlier hooks.
- Injected execution with a failing first hook and an overlapping queued call produced only `['first']`; the later hook and rerun did not execute.

#### Impact

A transient cleanup failure can skip notification/digest reconciliation, widget freshness, and durable-workflow resume discovery for that return. This is not a claim of data corruption or that every failed database operation is recoverable in the same pass.

#### Trigger / Preconditions

An early hook rejects during cold start or foreground return; the queued-pass loss additionally requires an overlapping foreground request.

#### Remediation Direction

Establish an explicit failure-isolation/recovery contract so unrelated work is not silently lost and lifecycle-triggered rejections are handled. Respect dependencies when deciding which later operations are safe to run.

#### Verification

Inject failures at candidate reads, cleanup writes, and dependent reconciliation boundaries. Verify intended later hooks, handled failure reporting, running-flag recovery, and queued-rerun behavior.

#### Related Findings

AUD-RN-013 concerns a separate UI promise boundary.

#### Planning Notes

Do not indiscriminately continue dependent backup work after failed background reconciliation. Preserve sequential foreground-only sweeps and existing transaction ownership.

### AUD-RN-012 — Delayed cold notification navigation can override a newer tap

**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Local  
**Type:** BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Warm notification taps use a request-generation guard, but the cold-start response path bypasses it. A delayed cold response or its contact lookup can reset navigation after a newer warm notification has already selected another destination.

#### Expected Behavior / Invariant

The latest accepted notification destination must win across both ingress paths. An older async lookup must not undo a newer user action.

#### Observed Behavior

The two paths independently call the same navigation function, but only one participates in ordering. Cold lookup completion is treated as current regardless of newer warm taps.

#### Evidence

- `src/navigation/notification-gate.tsx:149-152` defaults `applyBodyNav`'s `isCurrent` to an always-true callback; `:165-181` checks that callback before resetting.
- `:233-252` gives warm flushes `bodyNavigationRequestId` and an `isCurrent` predicate.
- `:263-281` awaits the cold response and calls `applyBodyNav(data)` without sharing that generation.
- The cold-start once-only flag prevents repetition, not overtaking. Clearing the last OS response happens after routing and does not repair ordering.
- Counter-evidence: warm-versus-warm publication has a guard and tests. `src/navigation/widget-linking.ts:236-274` explicitly rejects a delayed initial URL after a warm intent, showing the separate widget ingress already handles this class of race.

#### Impact

A later notification tap can apparently open the wrong contact/destination, and the stale reset can discard the newer navigation state.

#### Trigger / Preconditions

Cold response handling overlaps a newer warm body tap, with delayed cold response retrieval or delayed contact lookup. Native event timing has not been reproduced on-device.

#### Remediation Direction

Coordinate ordering across cold and warm body navigation while preserving action idempotency, readiness gating, and cold-response clearing.

#### Verification

Control both the cold-response promise and contact lookup promises. Deliver a newer warm tap, complete its navigation, then settle the old cold work; the newer destination must remain. Also test duplicate cold/warm delivery and teardown.

#### Related Findings

AUD-RN-010.

#### Planning Notes

The widget and notification gates consume different intent sources; do not merge their native consumers merely to share an ordering concept.

### AUD-RN-013 — Assist write failures have no user-facing recovery state

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** BUG, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, RUNTIME, DEVICE

#### Summary

Assist buttons discard promises whose owning handlers do not catch rejection. A rejected confirmation leaves the prompt without an explanation of why logging failed.

#### Expected Behavior / Invariant

ADR-071 explicitly requires handlers to surface the future-date rejection caused by device clock rollback. Failed writes must not present silent/no-op behavior or success.

#### Observed Behavior

The presentational component invokes the async confirmation/dismissal handlers with `void`. Neither owner provides error state or catches the DAO rejection.

#### Evidence

- `src/components/AssistConfirmation.tsx:29-30` discards `onConfirm`; the Don't log handler also discards `onDismiss`.
- `src/components/AssistBanner.tsx:46-63` and `PendingConfirmationsSheet.tsx:46-63` await DAO/refresh operations without catch or error feedback.
- `src/db/interaction-assist-dao.ts:92-97` reads the pending row and calls `rejectFutureOccurredAt(assist.handoff_at, input.now)` before the transaction.
- `docs/decisions/ADR-071-user-attested-handoff-time-interaction-logging-through-the-sole-recency-writer.md`, Risks, explicitly names this clock-rollback failure and its required presentation.
- Transactional pending-status rereading protects against double insertion; that useful guard does not handle presentation of a rejected attempt.

#### Impact

An eligible prompt can repeatedly fail to log with no actionable explanation. The promise rejection is unhandled at the UI boundary. No application crash is claimed without runtime evidence.

#### Trigger / Preconditions

Create an assist, roll the device clock backward before its handoff timestamp, then confirm; a transient write/read failure also reaches this path.

#### Remediation Direction

Contain rejected user actions, retain appropriate retry state, and explain the failure without weakening the future-date guard or claiming success.

#### Verification

Inject the future-date error and database failures into both overlay owners; assert no unhandled rejection, accurate feedback, preserved pending state where appropriate, and successful retry after correction.

#### Related Findings

AUD-RN-007 handles the successful-write branch; AUD-RN-011 concerns lifecycle promises.

#### Planning Notes

The date guard and handoff-time timestamp are recorded decisions. Changing or removing either would be a decision reversal, not a UI error-handling fix.

## Cross-Finding Patterns

- **Incomplete ownership transitions:** panel visibility and Dashboard interactivity are separate states; provider identity and credential draft are separate states; Profile metrics and History records are separate snapshots. Each split has a concrete synchronization failure rather than merely being stylistically redundant.
- **Navigation focus is not application lifecycle:** overlay writes and foreground return can occur while a route stays focused. Existing focus effects often work correctly when they run, but cannot substitute for the missing trigger.
- **Host expansion outpaced contract coverage:** promoting Digest to the initial tab exposed previously hidden lazy-tab initialization assumptions; shared Profile destinations and FAB context were not completed for every host.
- **Cancellation belongs to the operation, not just its effect:** Dashboard and notification work each have multiple ingress owners. A guard in one owner does not order work launched by another.
- **Promise containment is uneven:** transactional safety and idempotency can be correct while user feedback or unrelated lifecycle work still fails after rejection.

## Reviewed Areas With No Material Findings

These are bounded observations, not subsystem certifications:

- Boot/readiness holds navigation behind migration/theme readiness and guards late bootstrap publication after cleanup. Notification channel/category setup is awaited before installing the sweep trigger.
- Current five-tab order, initial Digest selection, Settings-only Backup hosting, and explicit semantic reset helpers align with ADR-146. External contact reset helpers include Home beneath their target; that is counter-evidence to the first-use plain-navigate paths in AUD-RN-002.
- Widget URI allowlisting, readiness queue, live-contact guard, cleanup, and rejection of delayed cold URLs after newer warm input were traced.
- FAB picker remains mounted when its own keyboard hides FAB chrome; shell transients store executable dismissal callbacks. The Dashboard host bug is downstream of that registry, not absence of a transient contract.
- Orrery request generations, blur/background action invalidation, focus/foreground refresh, canvas lifecycle, and SharedValue animation ownership were reviewed. No React-state-per-frame loop was established. Reduced-motion subscriptions have disposal/live-update guards.
- Category-catalog refresh uses generation/cancellation protection. Edit Contact's photo-return refresh is limited to photo state, preserving unrelated form drafts; partial-save retry reseeds relevant baselines.
- Capture and MemoryScreen add/edit paths have synchronous in-flight latches. This observation is not generalized to every Memory/relationship editor host.
- Assist confirmation rereads pending status transactionally; UID-keyed banner contents prevent the suspected cross-assist note reuse.
- Compose ordinary session persistence and Research selection restrictions match their explicit ephemeral, one-contact contract. No present reachable same-instance Compose retarget was established that would trigger the investigated captured-contact closure.

## Accepted / Deferred / Rejected Candidates

- **ACCEPTED by current contract:** Compose draft loss on process death and clearing on a different-contact session. Durable drafts are not required by ADR-133.
- **DEFERRED / unmeasured in current scope:** iOS behavior and physical-device performance. No emulator-based performance claim is made; the existing Orrery/backup contention measurement limitation is not relabeled as a defect.
- **FALSE-POSITIVE:** Retained `BackupStack.tsx` means Backup is still a top-level tab. Actual mounted registrations disprove this.
- **Rejected for insufficient reachability:** Compose lifecycle captures an initial contact ID, but present callers and native-stack reuse/reset behavior did not establish a same-instance contact replacement. A potential future caller hazard is not an OPEN finding.
- **Rejected as a blanket assertion:** Any missing async cancellation flag is necessarily a bug. Candidates were admitted only with a credible publication/interaction sequence; existing synchronous write latches, request generations, transaction guards, and remount behavior were considered.
- **Not admitted as proven Android obstruction:** History leaves some sheet state set during navigation. Installed `ReactModalHostView.kt` dismisses its dialog on native detachment (`:153-155`, `:190-193`), so JS screen retention alone is insufficient to prove that the sheet blocks the destination.

## Coverage Limitations / Follow-up Investigation

- No device was driven. Tap ordering, Android Back/keyboard interaction, TalkBack focus restoration, process recreation, and native modal detach/reattach behavior require device verification. The repository's package/tmux confirmation prerequisite was not bypassed.
- Test coverage here is primarily Node logic, mocked components, and source contracts. The 299 passing tests do not substitute for a mounted React Navigation/native lifecycle suite. New tests should exercise actual ingress and publication ownership, not merely assert helper outputs.
- For History modal flows, verify Log interaction, Edit, group navigation and Back with date/detail sheets open, including nested-sheet reappearance after return. Keep this as a focused device check until the actual native outcome is observed.
- Import/reconcile/restore were reviewed for shell integration and representative guards, not exhaustively for every cancellation, Android process-death, and retained draft transition. No claim of full state-restoration coverage is made.
- The full repository contains substantially more UI and native code than the inspected interaction paths. Photos/template managers, notification/background scheduling internals, backup transport, and native provider/network security need their own focused verification where they exceed this domain.
- This is a domain packet, not cross-domain synthesis. Potential overlap with security/data-privacy findings should retain these IDs and be reconciled in the campaign synthesis rather than silently deleted or counted twice.
